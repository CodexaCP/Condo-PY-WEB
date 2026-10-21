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
import { PushService } from '../../core/push.service';
import { salesWhatsAppUrl } from '../../config/sales.config';

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

                <!-- Logo + nombre + eslogan -->
                <div class="lp-brand-top">
                    <img src="/brand/expenses-icon.svg" alt="Expenses" class="lp-logo-img" />
                    <div class="lp-brand-id">
                        <span class="lp-brand-name">EXPENSES</span>
                        <span class="lp-brand-tagline">Cuando todo está claro, everyone trusts.</span>
                    </div>
                </div>

                <!-- Mensaje principal -->
                <div class="lp-slogan-block">
                    <div class="lp-slogan-eyebrow">Control condominial · en tiempo real</div>
                    <h1 class="lp-slogan">
                        Cada edificio.<br>
                        Cada movimiento.<br>
                        <span class="lp-slogan-accent">Todo bajo control.</span>
                    </h1>
                    <p class="lp-slogan-sub">
                        Finanzas, operaciones y comunidad conectadas en una sola plataforma.
                    </p>
                </div>

                <!-- Video promocional -->
                <div class="lp-video">
                    <video src="/brand/expenses-promo.mp4" autoplay muted loop playsinline controls preload="metadata"
                           aria-label="Video de presentación de Expenses"></video>
                </div>

                <!-- Indicadores de confianza -->
                <div class="lp-trust-row">
                    <div class="lp-trust-item">
                        <span class="lp-trust-ico"><i class="pi pi-shield"></i></span>
                        <div><strong>Trazabilidad completa</strong><small>Historial y auditoría en cada operación.</small></div>
                    </div>
                    <div class="lp-trust-sep"></div>
                    <div class="lp-trust-item">
                        <span class="lp-trust-ico"><i class="pi pi-users"></i></span>
                        <div><strong>Permisos por rol</strong><small>Cada usuario, el acceso correcto.</small></div>
                    </div>
                    <div class="lp-trust-sep"></div>
                    <div class="lp-trust-item">
                        <span class="lp-trust-ico"><i class="pi pi-lock"></i></span>
                        <div><strong>Datos protegidos</strong><small>Tu información, siempre segura.</small></div>
                    </div>
                </div>
            </div>

            <!-- ═══ PANEL DERECHO — Formulario ═══ -->
            <div class="lp-form-side">
                <div class="lp-form-card">

                    <!-- Mobile: logo pequeño -->
                    <div class="lp-mobile-logo">
                        <img src="/brand/expenses-icon.svg" alt="Expenses" class="lp-logo-img-sm" />
                        <span class="lp-mobile-brand-name">EXPENSES</span>
                    </div>

                    <div class="lp-form-head">
                        <h2>Tu espacio de gestión.</h2>
                        <p>Accede a tu cuenta de Expenses.</p>
                    </div>

                    <div class="lp-field">
                        <label class="lp-label" for="lp-email">Correo o usuario</label>
                        <div class="lp-input-wrap">
                            <i class="pi pi-envelope"></i>
                            <input pInputText id="lp-email" type="text"
                                   placeholder="usuario@ejemplo.com"
                                   class="lp-input"
                                   [(ngModel)]="email" (keyup.enter)="submit()" />
                        </div>
                    </div>

                    <div class="lp-field">
                        <label class="lp-label" for="lp-pass">Contraseña</label>
                        <div class="lp-input-wrap">
                            <i class="pi pi-lock"></i>
                            <p-password id="lp-pass" [(ngModel)]="password"
                                        placeholder="Ingresa tu contraseña"
                                        [toggleMask]="true" [fluid]="true" [feedback]="false"
                                        styleClass="lp-password"
                                        (keyup.enter)="submit()">
                            </p-password>
                        </div>
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

                    <a class="lp-apk-link" href="/downloads/condopy.apk" download="Expenses.apk">
                        <i class="pi pi-android"></i> Descargar app para Android
                    </a>

                    <div class="lp-form-footer">
                        <i class="pi pi-lock"></i> Conexión segura
                    </div>
                </div>
            </div>

            @if (whatsappUrl) {
                <a class="lp-wa-fab" [href]="whatsappUrl" target="_blank" rel="noopener noreferrer"
                   aria-label="Pedir una cotización por WhatsApp" title="Pedir una cotización por WhatsApp">
                    <i class="pi pi-whatsapp"></i>
                    <span class="lp-wa-label">Pedí tu cotización</span>
                </a>
            }
        </div>
    `,
    styles: [`
        .lp-wa-fab {
            position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 50;
            display: flex; align-items: center; gap: 0.6rem;
            padding: 0.85rem 1.1rem; border-radius: 999px;
            background: #25d366; color: #fff; text-decoration: none;
            font-size: 0.95rem; font-weight: 600;
            box-shadow: 0 8px 24px rgba(37, 211, 102, 0.4);
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .lp-wa-fab:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(37, 211, 102, 0.5); }
        .lp-wa-fab i { font-size: 1.6rem; }
        @media (max-width: 640px) {
            .lp-wa-fab { padding: 0.9rem; }
            .lp-wa-label { display: none; }
        }
        .lp-forgot-row { display: flex; justify-content: flex-end; margin: -0.5rem 0 1.25rem; }
        .lp-forgot-row a { font-size: 0.82rem; color: var(--brand-blue, #1385b6); text-decoration: none; }
        .lp-forgot-row a:hover { text-decoration: underline; }
        .lp-apk-link {
            display: flex; align-items: center; justify-content: center; gap: 0.5rem;
            margin-top: 1rem; padding: 0.7rem 1rem; border-radius: 0.75rem;
            border: 1px solid var(--brand-blue, #1385b6); color: var(--brand-blue, #1385b6);
            font-size: 0.9rem; font-weight: 600; text-decoration: none;
        }
        .lp-apk-link:hover { background: rgba(19, 133, 182, 0.08); }
    `]
})
export class Login {
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);
    private readonly pushSvc = inject(PushService);

    readonly whatsappUrl = salesWhatsAppUrl();

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
                    if (!mustChangePassword) {
                        void this.pushSvc.init();
                    }
                    void this.router.navigateByUrl(mustChangePassword ? '/change-password' : homeRoute(this.auth));
                },
                error: (error) => {
                    const body = error?.error;
                    if (body?.error === 'duplicate_username') {
                        this.errorMessage = body.message ?? 'El usuario tiene cuentas en varias empresas. Usa el formato usuario@empresa para iniciar sesión.';
                    } else if (body?.error === 'web_access_denied') {
                        this.errorMessage = body.message;
                    } else {
                        this.errorMessage = 'No se pudo iniciar sesión. Verifica credenciales y backend.';
                    }
                }
            });
    }
}
