
import {BehaviorSubject, Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {Component, OnInit, ChangeDetectionStrategy, AfterViewInit} from '@angular/core';
import {FormGroup, FormBuilder, Validators, FormControl} from '@angular/forms';
import {Config} from '../../config.service';
import {WaveValidators} from '../../util/form.validators';
import {UserService} from '../user.service';
import {User} from '../user.model';
import {NotificationService} from '../../notification.service';
import {MatIconRegistry} from '@angular/material';
import {DomSanitizer} from '@angular/platform-browser';

enum FormStatus {
    LoggedOut,
    LoggedIn,
    Loading
}

@Component({
    selector: 'wave-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit, AfterViewInit {

    formStatus$ = new BehaviorSubject<FormStatus>(FormStatus.Loading);
    isLoggedIn$: Observable<boolean>;
    isLoggedOut$: Observable<boolean>;
    isLoading$: Observable<boolean>;

    loginForm: FormGroup;

    user: Observable<User>;
    invalidCredentials$ = new BehaviorSubject<boolean>(false);
    jwtClientToken: string;

    constructor(private formBuilder: FormBuilder,
                private config: Config,
                private userService: UserService,
                private notificationService: NotificationService,
                private iconRegistry: MatIconRegistry,
                private sanitizer: DomSanitizer) {
        this.iconRegistry.addSvgIconInNamespace('login', 'natur_40_logo',
            sanitizer.bypassSecurityTrustResourceUrl('assets/icons/natur_40_logo.svg'));

        this.loginForm = this.formBuilder.group({
            loginAuthority: ['gfbio', Validators.required],
            username: ['', Validators.compose([
                Validators.required,
                WaveValidators.keyword([this.config.USER.GUEST.NAME]),
            ])],
            password: ['', Validators.required],
            staySignedIn: [true, Validators.required],
        });

        this.isLoggedIn$ = this.formStatus$.pipe(map(status => status === FormStatus.LoggedIn));
        this.isLoggedOut$ = this.formStatus$.pipe(map(status => status === FormStatus.LoggedOut));
        this.isLoading$ = this.formStatus$.pipe(map(status => status === FormStatus.Loading));
    }

    ngOnInit() {
        this.userService.isSessionValid(this.userService.getSession())
            .subscribe(valid => {
                const isNoGuest = !this.userService.isGuestUser();
                this.formStatus$.next(valid && isNoGuest ? FormStatus.LoggedIn : FormStatus.LoggedOut);

                if (isNoGuest) {
                    this.loginForm.controls['username'].setValue(
                        this.userService.getSession().user
                    );
                }
            });

        this.user = this.userService.getUserStream();
        this.userService.getJwtClientToken().subscribe(r => {
            this.jwtClientToken = r.clientToken;
        })
    }

    ngAfterViewInit() {
        // do this once for observables
        setTimeout(() => this.loginForm.updateValueAndValidity(), 0);
    }

    login() {
        this.formStatus$.next(FormStatus.Loading);

        let loginRequest: Observable<boolean>;

        switch (this.loginForm.controls['loginAuthority'].value.toLowerCase()) {
            case 'gfbio':
                loginRequest = this.userService.gfbioLogin({
                    user: this.loginForm.controls['username'].value,
                    password: this.loginForm.controls['password'].value,
                    staySignedIn: this.loginForm.controls['staySignedIn'].value,
                });

                break;
            case 'system':
            /* falls through */
            default:
                loginRequest = this.userService.login({
                    user: this.loginForm.controls['username'].value,
                    password: this.loginForm.controls['password'].value,
                    staySignedIn: this.loginForm.controls['staySignedIn'].value,
                });
                break;
        }

        loginRequest.subscribe(
            valid => {
                if (valid) {
                    this.invalidCredentials$.next(false);
                    this.formStatus$.next(FormStatus.LoggedIn);
                } else {
                    this.invalidCredentials$.next(true);
                    (this.loginForm.controls['password'] as FormControl).setValue('');
                    this.formStatus$.next(FormStatus.LoggedOut);
                }
            },
            () => { // on error
                this.invalidCredentials$.next(true);
                (this.loginForm.controls['password'] as FormControl).setValue('');
                this.formStatus$.next(FormStatus.LoggedOut);
            }
        );
    }

    logout() {
        this.formStatus$.next(FormStatus.Loading);
        this.userService.guestLogin()
            .subscribe(
                () => {
                    this.loginForm.controls['password'].setValue('');
                    this.formStatus$.next(FormStatus.LoggedOut);
                },
                error => this.notificationService.error(`The backend is currently unavailable (${error})`));
    }

    get jwtLoginUrl(): string {
        const jwtUrl = 'http://vhrz669.hrz.uni-marburg.de/nature40/sso?jws=';
        const jwtUrlWithClienToken = jwtUrl + this.jwtClientToken;
        return jwtUrlWithClienToken;
    }
}
