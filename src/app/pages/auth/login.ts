import { Component, inject } from '@angular/core';
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

                <!-- Pilares en grid -->
                <div class="lp-pillars">
                    <div class="lp-pillar">
                        <div class="lp-pillar-icon"><i class="pi pi-home"></i></div>
                        <div>
                            <strong>Multi-edificio</strong>
                            <p>Gestiona varios condominios desde un solo panel unificado.</p>
                        </div>
                    </div>
                    <div class="lp-pillar">
                        <div class="lp-pillar-icon"><i class="pi pi-dollar"></i></div>
                        <div>
                            <strong>Finanzas en tiempo real</strong>
                            <p>Gastos, ingresos, expensas y morosidad siempre al día.</p>
                        </div>
                    </div>
                    <div class="lp-pillar">
                        <div class="lp-pillar-icon"><i class="pi pi-bell"></i></div>
                        <div>
                            <strong>Comunicados</strong>
                            <p>Avisos y anuncios para residentes y propietarios.</p>
                        </div>
                    </div>
                    <div class="lp-pillar">
                        <div class="lp-pillar-icon"><i class="pi pi-check-square"></i></div>
                        <div>
                            <strong>Votaciones formales</strong>
                            <p>Decisiones con quórum, opciones y resultados trazables.</p>
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
    `
})
export class Login {
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    email = '';
    password = '';
    errorMessage = '';
    isSubmitting = false;

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
