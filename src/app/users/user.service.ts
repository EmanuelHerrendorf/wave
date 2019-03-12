
import {
    BehaviorSubject, Observable, Subject, combineLatest as observableCombineLatest, throwError as observableThrowError, EMPTY,
    of as observableOf
} from 'rxjs';

import {catchError, map, tap, switchMap, mergeMap} from 'rxjs/operators';
import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';

import {Guest, User} from './user.model';

import {MappingRequestParameters, ParametersType, RequestParameters} from '../queries/request-parameters.model';
import {AbcdArchive} from '../operators/dialogs/abcd-repository/abcd.model';
import {Basket} from '../operators/dialogs/baskets/gfbio-basket.model';

import {
    MappingSource,
    MappingSourceRasterLayer,
    MappingSourceDict,
    MappingSourceResponse,
    MappingTransform, MappingSourceVectorLayer, ProvenanceInfo
} from '../operators/dialogs/data-repository/mapping-source.model';
import {CsvColumn, CsvFile} from '../operators/dialogs/baskets/csv.model';

import {Unit} from '../operators/unit.model';
import {Config} from '../config.service';
import {Operator} from '../operators/operator.model';
import {
    FeatureDBList,
    FeatureDBListEntry,
    featureDBListEntryToOperator,
    FeatureDBServiceListParameters,
    FeatureDBServiceUploadParameters
} from '../queries/feature-db.model';
import {NotificationService} from '../notification.service';
import {ColorizerData} from '../colors/colorizer-data.model';

const PATH_PREFIX = window.location.pathname.replace(/\//g, '_').replace(/-/g, '_');

export interface Session {
    user: string;
    sessionToken: string;
    staySignedIn?: boolean;
    isExternallyConnected?: boolean;
}

class UserServiceRequestParameters extends MappingRequestParameters {
    constructor(config: {
        request: string,
        sessionToken: string,
        parameters?: ParametersType
    }) {
        super({
            service: 'USER',
            request: config.request,
            sessionToken: config.sessionToken,
            parameters: config.parameters,
        });
    }
}

class LoginRequestParameters extends UserServiceRequestParameters {
    constructor(config: {
        username: string;
        password: string;
    }) {
        super({
            request: 'login',
            sessionToken: undefined,
            parameters: {
                username: config.username,
                password: config.password,
            },
        });
    }
}

class GfbioServiceRequestParameters extends MappingRequestParameters {
    constructor(config: {
        request: string,
        sessionToken: string,
        parameters?: ParametersType
    }) {
        super({
            service: 'gfbio',
            request: config.request,
            sessionToken: config.sessionToken,
            parameters: config.parameters,
        });
    }
}

class GFBioPortalLoginRequestParameters extends RequestParameters {
    constructor(config: { username: string, password: string }) {
        super();
        this.addAuthentication(config.username, config.password);
    }
}

/**
 * A service that is responsible for retrieving user information and modifying the current user.
 */
@Injectable()
export class UserService {
    private readonly user$: BehaviorSubject<User>;
    private readonly session$: BehaviorSubject<Session>;

    private readonly isGuestUser$: Observable<boolean>;

    private rasterSources$ = new BehaviorSubject<Array<MappingSource>>([]);
    private rasterSourceError$ = new BehaviorSubject<boolean>(false);
    private reloadRasterSources$ = new BehaviorSubject<void>(undefined);

    constructor(private config: Config,
                private http: HttpClient,
                private notificationService: NotificationService) {
        this.session$ = new BehaviorSubject(
            this.loadSessionData()
        );

        this.user$ = new BehaviorSubject(new Guest(config));
        this.isGuestUser$ = this.session$.pipe(map(s => s.user === this.config.USER.GUEST.NAME));

        // storage of the session
        this.session$.subscribe(newSession => {
            this.isSessionValid(newSession).subscribe(isValid => {
                if (isValid) {
                    this.saveSessionData(newSession);

                    this.getUserDetails(newSession)
                        .subscribe(user => {
                            if (user) {
                                this.user$.next(user);
                            } else {
                                this.user$.next(new Guest(config));
                            }
                        });
                } else {
                    this.guestLogin().subscribe();
                }
            });
        });

        this.createRasterSourcesStream(this.session$, this.reloadRasterSources$)
            .subscribe(sources => {
                this.rasterSources$.next(sources);
                if (this.rasterSourceError$.getValue()) {
                    this.rasterSourceError$.next(false);
                }
            });
    }

    /**
     * @returns Retrieve the current user.
     */
    getUser() {
        return this.user$.getValue();
    }

    /**
     * @returns Retrieve a stream that notifies about the current user.
     */
    getUserStream(): Observable<User> {
        return this.user$;
    }

    /**
     * @returns Retrieve the current session.
     */
    getSession() {
        return this.session$.getValue();
    }

    /**
     * @returns Retrieve a stream that notifies about the current session.
     */
    getSessionStream(): Observable<Session> {
        return this.session$;
    }

    isGuestUserStream(): Observable<boolean> {
        return this.isGuestUser$;
    }

    isGuestUser(): boolean {
        return this.session$.getValue().user === this.config.USER.GUEST.NAME;
    }

    /**
     * Login using user credentials. If it was successful, set a new user.
     * @param credentials.user The user name.
     * @param credentials.password The user's password.
     * @returns `true` if the login was succesful, `false` otherwise.
     */
    login(credentials: { user: string, password: string, staySignedIn?: boolean }): Observable<boolean> {
        if (credentials.staySignedIn === undefined) {
            credentials.staySignedIn = true;
        }

        const parameters = new LoginRequestParameters({
            username: credentials.user,
            password: credentials.password,
        });
        return this.request<{ result: string | boolean, session: string }>(parameters).pipe(
            map(result => {
                const success = typeof result.result === 'boolean' && result.result === true;

                return [result.session, success];
            }), tap(([session, success]: [string, boolean]) => {
                if (success) {
                    this.session$.next({
                        user: credentials.user,
                        sessionToken: session,
                        staySignedIn: credentials.staySignedIn,
                        isExternallyConnected: false,
                    });
                }
            }),
            map(([session, success]) => success as boolean), );
    }

    guestLogin(): Observable<boolean> {
        return this.login({
            user: this.config.USER.GUEST.NAME,
            password: this.config.USER.GUEST.PASSWORD,
        });
    }

    /**
     * Login using user credentials. If it was successful, set a new user.
     * @param session.user The user name.
     * @param session.password The user's password.
     * @returns `true` if the login was succesful, `false` otherwise.
     */
    isSessionValid(session: Session): Observable<boolean> {
        // use >>user info request<< for this
        const parameters = new UserServiceRequestParameters({
            request: 'info',
            sessionToken: session.sessionToken,
        });
        return this.request<{ result: string | boolean }>(parameters).pipe(
            map(result => {
                return typeof result.result === 'boolean' && result.result;
            }));
    }

    /**
     * Retrieve the user details.
     * @param session.user The user name.
     * @param session.password The user's password.
     * @returns the user details.
     */
    getUserDetails(session: Session): Observable<User> {
        if (session.user === this.config.USER.GUEST.NAME) {
            return observableOf(new Guest(this.config));
        }

        const parameters = new UserServiceRequestParameters({
            request: 'info',
            sessionToken: session.sessionToken,
        });
        return this.request<{ result: string | boolean }>(parameters).pipe(
            map(result => {
                const valid = typeof result.result === 'boolean' && result.result;

                if (valid) {
                    const userResult = result as {
                        result: string | boolean,
                        username: string,
                        realname: string,
                        email: string,
                        externalid?: string;
                    };
                    return new User({
                        name: userResult.username,
                        realName: userResult.realname,
                        email: userResult.email,
                        externalid: userResult.externalid,
                    });
                } else {
                    return undefined;
                }
            }));
    }

    /**
     * Change the details of the current user.
     * @param details.firstName The first name
     * @param details.lastName  The last name
     * @param details.email     The E-Mail address
     */
    changeDetails(details: { realName: string, email: string }) {
        let user = this.getUser();
        user.realName = details.realName;
        user.email = details.email;

        this.user$.next(user);
    }

    /**
     * Get as stream of raster sources depending on the logged in user.
     */
    getRasterSourcesStream(): Observable<Array<MappingSource>> {
        return this.rasterSources$;
    }

    /**
     * Reload the raster sources
     */
    reloadRasterSources() {
        this.reloadRasterSources$.next(undefined);
    }

    getRasterSourcesErrorStream(): Observable<boolean> {
        return this.rasterSourceError$;
    }

    /**
     * Get as stream of CSV sources depending on the logged in user. TODO: should this be a service?
     */
    getCsvStream(): Observable<Array<CsvFile>> {
        const csvSourcesUrl = './assets/csv-data-sources.json';

        return this.http.get<Array<CsvFile>>(csvSourcesUrl);
    }

    /**
     * Get the schema of a source operator. TODO: this should be replaced by a generic service call, which resolves the shema of a source.
     */
    getSourceSchemaAbcd(): Observable<Array<CsvColumn>> {
        const jsonUrl = './assets/abcd-mandatory-fields.json';

        return this.http.get<Array<CsvColumn>>(jsonUrl);
    }

    /**
     * Get as stream of Abcd sources depending on the logged in user.
     */
    getAbcdArchivesStream(): Observable<Array<AbcdArchive>> {
        interface AbcdResponse {
            archives: Array<AbcdArchive>;
            result: boolean;
        }

        return this.getSessionStream().pipe(switchMap(session => {
            const parameters = new GfbioServiceRequestParameters({
                request: 'abcd',
                sessionToken: session.sessionToken,
            });
            return this.request<AbcdResponse>(parameters).pipe(map(abcdResponse => abcdResponse.archives));
        }));
    }

    /**
     * Get as stream of GFBio baskets sources depending on the logged in user.
     */
    getGfbioBasketStream(): Observable<Array<Basket>> {
        interface GfbioBasketResponse {
            baskets: Array<Basket>;
            result: boolean;
        }

        return this.getSessionStream().pipe(switchMap(session => {
            const parameters = new GfbioServiceRequestParameters({
                request: 'baskets',
                sessionToken: session.sessionToken,
            });
            return this.request<GfbioBasketResponse>(parameters).pipe(map(gfbioBasketResponse => gfbioBasketResponse.baskets));
        }));
    }

    /**
     * Get the GFBio login token from the portal.
     * Get the GFBio login token from the portal.
     */
    getGFBioToken(credentials: { username: string, password: string }): Observable<string> {
        const parameters = new GFBioPortalLoginRequestParameters(credentials);

        return this.http.get<string | { exception: string, message: string }>(
            this.config.GFBIO.LIFERAY_PORTAL_URL + 'api/jsonws/GFBioProject-portlet.basket/get-token',
            {headers: parameters.getHeaders()}
        ).pipe(mergeMap(response => {
            if (typeof response === 'string') {
                return observableOf(response); // token
            } else {
                const result: { exception: string, message: string } = response;
                return observableThrowError(result.message);
            }
        }));
    }

    /**
     * Login using gfbio credentials. If it was successful, set a new user.
     * @param credentials.user The user name.
     * @param credentials.password The user's password.
     * @returns `true` if the login was succesful, `false` otherwise.
     */
    gfbioLogin(credentials: { user: string, password: string, staySignedIn?: boolean }): Observable<boolean> {
        if (!credentials.staySignedIn) {
            credentials.staySignedIn = true;
        }

        const token$ = this.getGFBioToken({
            username: credentials.user,
            password: credentials.password,
        });
        return token$.pipe(mergeMap(token => {
                const parameters = new MappingRequestParameters({
                    service: 'gfbio',
                    sessionToken: undefined,
                    request: 'login',
                    parameters: {token: token},
                });
                return this.request<{ result: string | boolean, session: string }>(parameters).pipe(
                    map(response => {
                        const success = typeof response.result === 'boolean' && response.result === true;

                        if (success) {
                            this.session$.next({
                                user: credentials.user,
                                sessionToken: response.session,
                                staySignedIn: credentials.staySignedIn,
                                isExternallyConnected: true,
                            });
                        }

                        return success;
                    }));
            }
        ));
    }

    /**
     * Login using the gfbio token. If it was successful, set a new user.
     * @param token The user's token.
     * @returns `true` if the login was succesful, `false` otherwise.
     */
    gfbioTokenLogin(token: string): Observable<boolean> {
        const parameters = new MappingRequestParameters({
            service: 'gfbio',
            sessionToken: undefined,
            request: 'login',
            parameters: {token: token},
        });

        const subject = new Subject<boolean>();

        this.request<{ result: string | boolean, session: string }>(parameters).pipe(
            mergeMap(response => {
                const success = typeof response.result === 'boolean' && response.result === true;

                if (success) {
                    return this.getUserDetails({user: undefined, sessionToken: response.session}).pipe(
                        tap(user => {
                            this.session$.next({
                                user: user.name,
                                sessionToken: response.session,
                                staySignedIn: false,
                                isExternallyConnected: true,
                            });
                        }),
                        map(user => true), );
                } else {
                    return observableOf(false);
                }
            }))
            .subscribe(
                success => subject.next(success),
                () => subject.next(false),
                () => subject.complete()
            );

        return subject;
    }

    setIntroductoryPopup(show: boolean) {
        localStorage.setItem('showIntroductoryPopup', JSON.stringify(show));
    }

    shouldShowIntroductoryPopup(): boolean {
        const show = localStorage.getItem('showIntroductoryPopup');
        return show === null || JSON.parse(show); // tslint:disable-line:no-null-keyword
    }

    getFeatureDBList(): Observable<Array<{ name: string, operator: Operator }>> {
        if (this.isGuestUser()) {
            return observableOf([]);
        }

        return this.request<FeatureDBList>(new FeatureDBServiceListParameters({sessionToken: this.session$.getValue().sessionToken})).pipe(
            map(list => list.data_sets.map(featureDBListEntryToOperator)));
    }

    addFeatureToDB(name: string, operator: Operator): Observable<{ name: string, operator: Operator }> {
        if (this.isGuestUser()) {
            return EMPTY;
        }

        const subject = new Subject<{ name: string, operator: Operator }>();

        this
            .request<FeatureDBListEntry>(
                new FeatureDBServiceUploadParameters({
                    sessionToken: this.session$.getValue().sessionToken,
                    name: name,
                    crs: operator.projection,
                    query: operator.toQueryJSON(),
                    type: operator.resultType.getCode() as 'points' | 'lines' | 'polygons',
                }),
                true,
            ).pipe(
            map(featureDBListEntryToOperator))
            .subscribe(
                data => {
                    subject.next(data);
                    subject.complete();
                },
                error => subject.error(error)
            );

        return subject;
    }

    /**
     * Login using a jwt token. If it was successful, set a new user.
     * @param token The user's token.
     * @returns `true` if the login was succesful, `false` otherwise.
     */
    jwtTokenLogin(token: string): Observable<boolean> {
        const parameters = new MappingRequestParameters({
            service: 'jwt',
            sessionToken: undefined,
            request: 'login',
            parameters: {token: token},
        });

        console.log(parameters);

        const subject = new Subject<boolean>();

        this.request<{ result: string | boolean, session: string }>(parameters).pipe(
            mergeMap(response => {
                const success = typeof response.result === 'boolean' && response.result === true;

                if (success) {
                    return this.getUserDetails({user: undefined, sessionToken: response.session}).pipe(
                        tap(user => {
                            this.session$.next({
                                user: user.name,
                                sessionToken: response.session,
                                staySignedIn: false,
                                isExternallyConnected: true,
                            });
                        }),
                        map(user => true), );
                } else {
                    return observableOf(false);
                }
            }))
            .subscribe(
                success => subject.next(success),
                () => subject.next(false),
                () => subject.complete()
            );

        return subject;
    }

    getJwtClientToken(): Observable<{clientToken: string}> {
        const parameters = new MappingRequestParameters({
            service: 'jwt',
            sessionToken: undefined,
            request: 'clientToken',
            parameters: {},
        });

        return this.request<{ result: string | boolean, clientToken: string }>(parameters)
    }

    /**
     * Get the session data.
     * @returns the session data
     */
    protected loadSessionData(): Session {
        // look first into the localStorage, then sessionStorage and if there is no data
        // return an empty guest session

        const sessionData = JSON.parse(localStorage.getItem(PATH_PREFIX + 'session')) as Session;
        if (sessionData === null) { // tslint:disable-line:no-null-keyword
            const sessionData2 = JSON.parse(sessionStorage.getItem(PATH_PREFIX + 'session')) as Session;
            if (sessionData2 === null) { // tslint:disable-line:no-null-keyword
                return {
                    user: this.config.USER.GUEST.NAME,
                    sessionToken: '',
                };
            } else {
                return sessionData2;
            }
        } else {
            return sessionData;
        }
    }

    protected saveSessionData(sessionData: Session) {
        if (sessionData.staySignedIn) {
            localStorage.setItem(PATH_PREFIX + 'session', JSON.stringify(sessionData));
            sessionStorage.removeItem(PATH_PREFIX + 'session');
        } else {
            sessionStorage.setItem(PATH_PREFIX + 'session', JSON.stringify(sessionData));
            localStorage.removeItem(PATH_PREFIX + 'session');
        }
    }

    protected request<ResponseType>(requestParameters: MappingRequestParameters, encode = false): Observable<ResponseType> {
        return this.http.post<ResponseType>(
            this.config.MAPPING_URL,
            requestParameters.toMessageBody(encode),
            {headers: requestParameters.getHeaders()}
        );
    }

    private createRasterSourcesStream(session$: Observable<Session>, reload$: Observable<void>): Observable<Array<MappingSource>> {
        return observableCombineLatest(session$, reload$, (session, reload) => session).pipe(
            switchMap(session => {
                const parameters = new UserServiceRequestParameters({
                    request: 'sourcelist',
                    sessionToken: session.sessionToken,
                });
                return this.request<MappingSourceResponse>(parameters).pipe(
                    map(json => {
                        const sources: Array<MappingSource> = [];

                        for (const sourceId in json.sourcelist) {
                            if (json.sourcelist.hasOwnProperty(sourceId)) {
                                const source: MappingSourceDict = json.sourcelist[sourceId];
                                const sourceProvenance: ProvenanceInfo = {
                                    uri: (source.provenance) ? source.provenance.uri : '',
                                    citation: source.provenance ? source.provenance.citation : '',
                                    license: source.provenance ? source.provenance.license : '',
                                };

                                const sourceChannels = (!source.channels) ? [] : source.channels.map((channel, index) => {
                                    const channelUnit = channel.unit ? Unit.fromMappingDict(channel.unit) : Unit.defaultUnit;
                                    const channelColorizer = channel.colorizer ? ColorizerData.fromMappingColorizerData(channel.colorizer) :
                                        source.colorizer ? ColorizerData.fromMappingColorizerData(source.colorizer) :
                                            ColorizerData.grayScaleColorizer(channelUnit);
                                    const coords = channel.coords || source.coords; // fixme: throw?

                                    const provenance: ProvenanceInfo = (channel.provenance) ? {
                                        uri: (source.provenance) ? source.provenance.uri : '',
                                        citation: source.provenance ? source.provenance.citation : '',
                                        license: source.provenance ? source.provenance.license : '',
                                    } : sourceProvenance;

                                    return {
                                        id: index,
                                        name: channel.name || 'Channel #' + index,
                                        channel: channel.channel,
                                        datatype: channel.datatype,
                                        nodata: channel.nodata,
                                        unit: channelUnit,
                                        colorizer: channelColorizer,
                                        hasTransform: !!channel.transform,
                                        isSwitchable: !!channel.transform && !!channel.transform.unit && !!channel.unit,
                                        transform: channel.transform === undefined ?
                                            undefined : {
                                                unit: channel.transform.unit ?
                                                    Unit.fromMappingDict(channel.transform.unit)
                                                    : Unit.defaultUnit,
                                                datatype: channel.transform.datatype,
                                                offset: channel.transform.offset,
                                                scale: channel.transform.scale,
                                            } as MappingTransform,
                                        coords: coords,
                                        provenance: provenance,
                                        file_name: channel.file_name || source.file_name || undefined,
                                    } as MappingSourceRasterLayer;
                                });

                                // vector data
                                const sourceVectorLayer = (!source.layer) ? [] : source.layer.map((layer, index) => {
                                    // TODO: can we  safely assume EPSG: 4326 here?
                                    const coords = layer.coords || source.coords || {crs: 'EPSG:4326'};

                                    const provenance: ProvenanceInfo = (layer.provenance) ? {
                                        uri: (source.provenance) ? source.provenance.uri : '',
                                        citation: source.provenance ? source.provenance.citation : '',
                                        license: source.provenance ? source.provenance.license : '',
                                    } : sourceProvenance;

                                    return {
                                        id: layer.id || layer.name,
                                        name: layer.title || layer.name || 'Layer #' + index,
                                        title: layer.title || layer.name || 'Layer #' + index,
                                        geometryType: layer.geometry_type || 'POINTS',
                                        textual: layer.textual || [],
                                        numeric: layer.numeric || [],
                                        coords: coords,
                                        provenance: provenance,
                                    } as MappingSourceVectorLayer;
                                });


                                sources.push({
                                    operator: (source.operator) ? source.operator : 'rasterdb_source', // FIXME: remove rasterdb_source?
                                    source: sourceId,
                                    name: (source.name) ? source.name : sourceId,
                                    rasterLayer: sourceChannels,
                                    vectorLayer: sourceVectorLayer,
                                    provenance: sourceProvenance
                                });
                            }
                        }
                        return sources;
                    }),
                    catchError(error => {
                        this.notificationService.error(`Error loading raster sources: »${error}«`);
                        this.rasterSourceError$.next(true);
                        return [];
                    }), );
            }));
    }

}
