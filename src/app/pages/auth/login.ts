import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { AppFloatingConfigurator } from '../../layout/component/app.floatingconfigurator';
import { AuthService } from '../../auth/auth.service';
import { homeRoute } from '../../auth/auth.guard';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CheckboxModule, InputTextModule, PasswordModule, FormsModule, RouterModule, MessageModule, AppFloatingConfigurator],
    template: `
        <app-floating-configurator />

        <div class="lp-root">
            <div class="lp-orb lp-orb-a"></div>
            <div class="lp-orb lp-orb-b"></div>
            <div class="lp-orb lp-orb-c"></div>

            <!-- ═══ PANEL IZQUIERDO — Marca ═══ -->
            <div class="lp-brand">

                <!-- Logo + nombre -->
                <div class="lp-brand-top">
                    <div class="lp-logo-ring">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 188" class="lp-logo-svg">
                            <rect x="8"   y="10"  width="76" height="138" fill="#fff" opacity=".95"/>
                            <rect x="16"  y="20"  width="14" height="21" rx="2" fill="#1AB7AF"/>
                            <rect x="36"  y="20"  width="14" height="21" rx="2" fill="#1AB7AF"/>
                            <rect x="56"  y="20"  width="14" height="21" rx="2" fill="#1AB7AF"/>
                            <rect x="16"  y="48"  width="14" height="21" rx="2" fill="#1AB7AF"/>
                            <rect x="36"  y="48"  width="14" height="21" rx="2" fill="#1AB7AF"/>
                            <rect x="56"  y="48"  width="14" height="21" rx="2" fill="#1AB7AF"/>
                            <rect x="16"  y="76"  width="14" height="21" rx="2" fill="#1AB7AF"/>
                            <rect x="36"  y="76"  width="14" height="21" rx="2" fill="#1AB7AF"/>
                            <rect x="56"  y="76"  width="14" height="21" rx="2" fill="#1AB7AF"/>
                            <rect x="16"  y="104" width="14" height="21" rx="2" fill="#1AB7AF"/>
                            <rect x="36"  y="104" width="14" height="21" rx="2" fill="#1AB7AF"/>
                            <rect x="56"  y="104" width="14" height="21" rx="2" fill="#1AB7AF"/>
                            <rect x="4"   y="148" width="82" height="8"  fill="#fff" opacity=".7"/>
                            <rect x="90"  y="24"  width="60" height="124" fill="#fff" opacity=".95"/>
                            <rect x="98"  y="34"  width="12" height="17" rx="2" fill="#6AC64A"/>
                            <rect x="115" y="34"  width="12" height="17" rx="2" fill="#6AC64A"/>
                            <rect x="98"  y="57"  width="12" height="17" rx="2" fill="#6AC64A"/>
                            <rect x="115" y="57"  width="12" height="17" rx="2" fill="#6AC64A"/>
                            <rect x="98"  y="80"  width="12" height="17" rx="2" fill="#6AC64A"/>
                            <rect x="115" y="80"  width="12" height="17" rx="2" fill="#6AC64A"/>
                            <rect x="98"  y="103" width="12" height="17" rx="2" fill="#6AC64A"/>
                            <rect x="115" y="103" width="12" height="17" rx="2" fill="#6AC64A"/>
                            <rect x="148" y="94"  width="44" height="54" fill="#fff" opacity=".95"/>
                            <rect x="156" y="104" width="12" height="15" rx="2" fill="#6AC64A"/>
                            <rect x="88"  y="148" width="106" height="8" fill="#fff" opacity=".7"/>
                        </svg>
                    </div>
                    <span class="lp-brand-name">CONDOPY</span>
                </div>

                <!-- Slogan -->
                <div class="lp-slogan-block">
                    <div class="lp-slogan-eyebrow">Plataforma de administración condominal</div>
                    <h1 class="lp-slogan">
                        Cuando todo está claro,<br>
                        <span class="lp-slogan-accent">todos confían.</span>
                    </h1>
                    <p class="lp-slogan-sub">
                        CONDOPY reúne la administración, las finanzas y la comunicación
                        del edificio en una plataforma diseñada para brindar
                        <strong>transparencia, orden y tranquilidad.</strong>
                    </p>
                </div>

                <!-- Divisor -->
                <div class="lp-divider"></div>

                <!-- Reel: mockup compacto con capturas reales de la plataforma -->
                <div class="lp-reel">
                    <div class="lp-reel-glow"></div>
                    <div class="lp-reel-frame">
                        <div class="lp-reel-bar">
                            <span></span><span></span><span></span>
                        </div>
                        <div class="lp-reel-screen">
                            @for (shot of reelShots; track shot; let i = $index) {
                                <img [src]="shot" [class.active]="i === reelIndex()" alt="" />
                            }
                            <div class="lp-reel-scan"></div>
                        </div>
                    </div>
                </div>

                <!-- Trust strip -->
                <div class="lp-trust-strip">
                    <div class="lp-trust-item">
                        <i class="pi pi-shield"></i>
                        <span>Acceso seguro</span>
                    </div>
                    <div class="lp-trust-sep"></div>
                    <div class="lp-trust-item">
                        <i class="pi pi-eye-slash"></i>
                        <span>Datos privados</span>
                    </div>
                    <div class="lp-trust-sep"></div>
                    <div class="lp-trust-item">
                        <i class="pi pi-lock"></i>
                        <span>Roles y permisos</span>
                    </div>
                </div>

                <!-- Badge versión -->
                <div class="lp-brand-footer">
                    <span class="lp-version-badge">Panel Administrativo · v1.0</span>
                </div>
            </div>

            <!-- ═══ PANEL DERECHO — Formulario ═══ -->
            <div class="lp-form-side">
                <div class="lp-form-card">

                    <!-- Mobile: logo pequeño -->
                    <div class="lp-mobile-logo">
                        <div class="lp-logo-ring lp-logo-ring-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 188" class="lp-logo-svg-sm">
                                <rect x="8" y="10" width="76" height="138" fill="#fff" opacity=".95"/>
                                <rect x="16" y="20" width="14" height="21" rx="2" fill="#1AB7AF"/>
                                <rect x="36" y="20" width="14" height="21" rx="2" fill="#1AB7AF"/>
                                <rect x="56" y="20" width="14" height="21" rx="2" fill="#1AB7AF"/>
                                <rect x="16" y="48" width="14" height="21" rx="2" fill="#1AB7AF"/>
                                <rect x="36" y="48" width="14" height="21" rx="2" fill="#1AB7AF"/>
                                <rect x="56" y="48" width="14" height="21" rx="2" fill="#1AB7AF"/>
                                <rect x="90" y="24" width="60" height="124" fill="#fff" opacity=".95"/>
                                <rect x="98" y="34" width="12" height="17" rx="2" fill="#6AC64A"/>
                                <rect x="115" y="34" width="12" height="17" rx="2" fill="#6AC64A"/>
                                <rect x="148" y="94" width="44" height="54" fill="#fff" opacity=".95"/>
                                <rect x="156" y="104" width="12" height="15" rx="2" fill="#6AC64A"/>
                            </svg>
                        </div>
                        <span class="lp-mobile-brand-name">CONDOPY</span>
                    </div>

                    <div class="lp-form-head">
                        <h2>Bienvenido</h2>
                        <p>Ingresa tus credenciales para acceder al sistema</p>
                    </div>

                    <div class="lp-field">
                        <label class="lp-label" for="lp-email">Correo o nombre de usuario</label>
                        <input pInputText id="lp-email" type="text"
                               placeholder="correo@empresa.com"
                               class="lp-input"
                               [(ngModel)]="email" (keyup.enter)="submit()" />
                    </div>

                    <div class="lp-field">
                        <label class="lp-label" for="lp-pass">Contraseña</label>
                        <p-password id="lp-pass" [(ngModel)]="password"
                                    placeholder="••••••••"
                                    [toggleMask]="true" [fluid]="true" [feedback]="false"
                                    styleClass="lp-password"
                                    (keyup.enter)="submit()">
                        </p-password>
                    </div>

                    <div class="lp-forgot-row">
                        <a routerLink="/forgot-password">¿Olvidaste tu contraseña?</a>
                    </div>

                    @if (errorMessage) {
                        <p-message severity="error" [text]="errorMessage" styleClass="w-full" />
                    }

                    <button class="lp-submit-btn" [disabled]="isSubmitting" (click)="submit()">
                        @if (isSubmitting) {
                            <i class="pi pi-spin pi-spinner"></i>
                        } @else {
                            <i class="pi pi-sign-in"></i>
                        }
                        Entrar al sistema
                    </button>

                    <div class="lp-form-footer">
                        <i class="pi pi-lock"></i> Acceso seguro · CONDOPY
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .lp-forgot-row { display: flex; justify-content: flex-end; margin: -0.5rem 0 1.25rem; }
        .lp-forgot-row a { font-size: 0.82rem; color: var(--brand-blue, #1385b6); text-decoration: none; }
        .lp-forgot-row a:hover { text-decoration: underline; }

        .lp-reel {
            position: relative;
            display: flex;
            justify-content: center;
            flex: 0 0 auto;
        }
        .lp-reel-glow {
            position: absolute;
            inset: -12px;
            background: radial-gradient(circle, rgba(26,183,175,0.35) 0%, rgba(19,133,182,0.15) 45%, transparent 75%);
            filter: blur(20px);
            animation: lp-glow-pulse 4s ease-in-out infinite;
            pointer-events: none;
        }
        @keyframes lp-glow-pulse {
            0%, 100% { opacity: 0.7; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.05); }
        }
        .lp-reel-frame {
            position: relative;
            width: 100%;
            max-width: 260px;
            border-radius: 12px;
            overflow: hidden;
            background: rgba(10,30,40,0.55);
            border: 1px solid rgba(255,255,255,0.18);
            box-shadow: 0 12px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(26,183,175,0.15);
            backdrop-filter: blur(6px);
        }
        .lp-reel-bar {
            display: flex;
            gap: 5px;
            padding: 0.4rem 0.55rem;
            background: rgba(255,255,255,0.06);
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .lp-reel-bar span {
            width: 7px; height: 7px; border-radius: 50%;
            background: rgba(255,255,255,0.25);
        }
        .lp-reel-bar span:nth-child(1) { background: #ef4444; opacity: 0.7; }
        .lp-reel-bar span:nth-child(2) { background: #f59e0b; opacity: 0.7; }
        .lp-reel-bar span:nth-child(3) { background: #22c55e; opacity: 0.7; }
        .lp-reel-screen {
            position: relative;
            width: 100%;
            aspect-ratio: 16 / 10;
            overflow: hidden;
        }
        .lp-reel-screen img {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: top;
            opacity: 0;
            transform: scale(1.02);
            transition: opacity 1.1s ease, transform 6s ease;
        }
        .lp-reel-screen img.active {
            opacity: 1;
            transform: scale(1);
        }
        .lp-reel-scan {
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, transparent 0%, rgba(26,183,175,0.12) 50%, transparent 100%);
            background-size: 100% 200%;
            animation: lp-scan 3.5s linear infinite;
            pointer-events: none;
        }
        @keyframes lp-scan {
            0% { background-position: 0 -100%; }
            100% { background-position: 0 200%; }
        }
        @media (max-width: 1024px) {
            .lp-reel { display: none; }
        }
    `]
})
export class Login implements OnDestroy {
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    email = '';
    password = '';
    errorMessage = '';
    isSubmitting = false;

    reelShots = [
        'assets/login-reel/dashboard.png',
        'assets/login-reel/facturas.png',
        'assets/login-reel/pago.png',
        'assets/login-reel/periodos.png'
    ];
    reelIndex = signal(0);
    private reelTimer?: ReturnType<typeof setInterval>;

    constructor() {
        this.reelTimer = setInterval(() => {
            this.reelIndex.update(i => (i + 1) % this.reelShots.length);
        }, 3200);
    }

    ngOnDestroy(): void {
        if (this.reelTimer) clearInterval(this.reelTimer);
    }

    submit(): void {
        if (!this.email || !this.password) {
            this.errorMessage = 'Ingresa tu correo o usuario, y tu contraseña.';
            return;
        }

        this.errorMessage = '';
        this.isSubmitting = true;

        this.auth
            .login(this.email, this.password)
            .pipe(finalize(() => (this.isSubmitting = false)))
            .subscribe({
                next: (mustChangePassword) => {
                    void this.router.navigateByUrl(mustChangePassword ? '/change-password' : homeRoute(this.auth));
                },
                error: (error) => {
                    const body = error?.error;
                    if (body?.error === 'duplicate_username') {
                        this.errorMessage = body.message ?? 'El usuario tiene cuentas en varias empresas. Usa el formato usuario@empresa para iniciar sesión.';
                    } else {
                        this.errorMessage = 'No se pudo iniciar sesión. Verifica credenciales y backend.';
                    }
                }
            });
    }
}
