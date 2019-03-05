
import {of as observableOf} from 'rxjs';

import {catchError, tap} from 'rxjs/operators';
import {Injectable} from '@angular/core';
import * as Immutable from 'immutable';
import {HttpClient} from '@angular/common/http';

type MappingUrlType = string;
interface WmsInterface {
    VERSION: string;
    FORMAT: string;
}
interface WfsInterface {
    VERSION: string;
    FORMAT: string;
}
interface WcsInterface {
    SERVICE: string;
    VERSION: string;
}
interface DebugModeInterface {
    WAVE: boolean;
    MAPPING: boolean;
}
interface UserInterface {
    GUEST: {
        NAME: string,
        PASSWORD: string,
    };
}
interface DelaysInterface {
    LOADING: {
        MIN: number,
    };
    TOOLTIP: number;
    DEBOUNCE: number;
    STORAGE_DEBOUNCE: number;
    GUEST_LOGIN_HINT: number;
}
type ProjectType = 'GFBio' | 'IDESSA' | 'GeoBon';
interface DefaultsInterface {
    PROJECT: {
        NAME: string,
        TIME: string,
        TIMESTEP: '15 minutes' | '1 hour' | '1 day' | '1 month' | '6 months' | '1 year',
        PROJECTION: 'EPSG:3857' | 'EPSG:4326',
    };
}
interface MapInterface {
    BACKGROUND_LAYER: 'OSM' | 'countries' | 'hosted' | 'XYZ';
    BACKGROUND_LAYER_URL: string;
    HOSTED_BACKGROUND_SERVICE: string;
    HOSTED_BACKGROUND_LAYER_NAME: string;
    HOSTED_BACKGROUND_SERVICE_VERSION: string;
    REFRESH_LAYERS_ON_CHANGE: boolean;
}
interface GfbioInterface {
    LIFERAY_PORTAL_URL: string;
}

interface Natur40Interface {
    SSO_JWT_PROVIDER_URL: string;
}

interface TimeInterface {
    ALLOW_RANGES: boolean;
}

interface ConfigInterface {
    CONFIG_FILE: string;
    MAPPING_URL: MappingUrlType;
    WMS: WmsInterface;
    WFS: WfsInterface;
    WCS: WcsInterface;
    DEBUG_MODE: DebugModeInterface;
    USER: UserInterface;
    DELAYS: DelaysInterface;
    PROJECT: ProjectType;
    DEFAULTS: DefaultsInterface;
    MAP: MapInterface;
    GFBIO: GfbioInterface;
    NATUR40: Natur40Interface;
    TIME: TimeInterface;
}

/**
 * The default config
 * @type {any}
 */
const ConfigDefault = Immutable.fromJS({
    MAPPING_URL: '/cgi-bin/mapping_cgi',
    WMS: {
        VERSION: '1.3.0',
        FORMAT: 'image/png',
    },
    WFS: {
        VERSION: '2.0.0',
        FORMAT: 'application/json',
    },
    WCS: {
        SERVICE: 'WCS',
        VERSION: '2.0.1',
    },
    DEBUG_MODE: {
        WAVE: false,
        MAPPING: false,
    },
    USER: {
        GUEST: {
            NAME: 'guest',
            PASSWORD: 'guest',
        },
    },
    DELAYS: {
        LOADING: {
            MIN: 500,
        },
        TOOLTIP: 400,
        DEBOUNCE: 400,
        STORAGE_DEBOUNCE: 1500,
        GUEST_LOGIN_HINT: 5000,
    },
    PROJECT: 'GFBio',
    DEFAULTS: {
        PROJECT: {
            NAME: 'Default',
            TIME: '2000-06-06T12:00:00.000Z',
            TIMESTEP: '1 month',
            PROJECTION: 'EPSG:3857',
        },
    },
    MAP: {
        BACKGROUND_LAYER: 'OSM',
        BACKGROUND_LAYER_URL: '',
        HOSTED_BACKGROUND_SERVICE: '/mapcache/',
        HOSTED_BACKGROUND_LAYER_NAME: 'osm',
        HOSTED_BACKGROUND_SERVICE_VERSION: '1.1.1',
        REFRESH_LAYERS_ON_CHANGE: false,
    },
    GFBIO: {
        LIFERAY_PORTAL_URL: 'https://dev.gfbio.org/',
    },
    NATUR40: {
        SSO_JWT_PROVIDER_URL: 'http://vhrz669.hrz.uni-marburg.de/nature40/sso?jws=',
    },
    TIME: {
        ALLOW_RANGES: true,
    },
} as ConfigInterface);

/**
 * Calls a recursive Object.freeze on an object.
 * @param o
 * @returns {any}
 */
function deepFreeze(o) {
    Object.freeze(o);
    if (o === undefined) {
        return o;
    }

    Object.getOwnPropertyNames(o).forEach(function (prop) {
        if (o[prop] !== null
            && (typeof o[prop] === 'object' || typeof o[prop] === 'function')
            && !Object.isFrozen(o[prop])) {
            deepFreeze(o[prop]);
        }
    });

    return o;
}

/**
 * A service that provides config entries.
 * Loads a custom file at startup.
 */
@Injectable()
export class Config {
    static get CONFIG_FILE(): string {
        return 'assets/config.json';
    };

    private _MAPPING_URL: MappingUrlType;
    private _WMS: WmsInterface;
    private _WFS: WfsInterface;
    private _WCS: WcsInterface;
    private _DEBUG_MODE: DebugModeInterface;
    private _USER: UserInterface;
    private _DELAYS: DelaysInterface;
    private _PROJECT: ProjectType;
    private _DEFAULTS: DefaultsInterface;
    private _MAP: MapInterface;
    private _GFBIO: GfbioInterface;
    private _TIME: TimeInterface;
    private _NATUR40: Natur40Interface;


    get MAPPING_URL(): MappingUrlType {
        return this._MAPPING_URL;
    }

    get WMS(): WmsInterface {
        return this._WMS;
    }

    get WFS(): WfsInterface {
        return this._WFS;
    }

    get WCS(): WcsInterface {
        return this._WCS;
    }

    get DEBUG_MODE(): DebugModeInterface {
        return this._DEBUG_MODE;
    }

    get USER(): UserInterface {
        return this._USER;
    }

    get DELAYS(): DelaysInterface {
        return this._DELAYS;
    }

    get PROJECT(): ProjectType {
        return this._PROJECT;
    }

    get DEFAULTS(): DefaultsInterface {
        return this._DEFAULTS;
    }

    get MAP(): MapInterface {
        return this._MAP;
    }

    get GFBIO(): GfbioInterface {
        return this._GFBIO;
    }

    get Natur40(): Natur40Interface {
        return this._NATUR40;
    }

    get TIME(): TimeInterface {
        return this._TIME;
    }

    constructor(private http: HttpClient) {
    }

    /**
     * Initialize the config on app start.
     */
    load(): Promise<void> {
        return this.http
            .get<ConfigInterface>(Config.CONFIG_FILE).pipe(
            tap(
                appConfig => {
                    const config = ConfigDefault.mergeDeep(Immutable.fromJS(appConfig)).toJS();

                    this.handleConfig(config);
                },
                () => { // error
                    this.handleConfig(ConfigDefault.toJS());
                }),
            catchError(() => observableOf(undefined)), )
            .toPromise();
    }

    private handleConfig(config: {[key: string]: any}) {
        for (const key in config) {
            if (config.hasOwnProperty(key)) {
                const value = deepFreeze(config[key]);

                switch (key.toUpperCase()) {
                    case 'MAPPING_URL':
                        this._MAPPING_URL = value;
                        break;
                    case 'WMS':
                        this._WMS = value;
                        break;
                    case 'WFS':
                        this._WFS = value;
                        break;
                    case 'WCS':
                        this._WCS = value;
                        break;
                    case 'DEBUG_MODE':
                        this._DEBUG_MODE = value;
                        break;
                    case 'USER':
                        this._USER = value;
                        break;
                    case 'DELAYS':
                        this._DELAYS = value;
                        break;
                    case 'PROJECT':
                        this._PROJECT = value;
                        break;
                    case 'DEFAULTS':
                        this._DEFAULTS = value;
                        break;
                    case 'MAP':
                        this._MAP = value;
                        break;
                    case 'GFBIO':
                        this._GFBIO = value;
                        break;
                    case 'NATUR40':
                        this._NATUR40 = value;
                        break;
                    case 'TIME':
                        this._TIME = value;
                        break;
                    default:
                        break;
                }
            }
        }
    }

}
