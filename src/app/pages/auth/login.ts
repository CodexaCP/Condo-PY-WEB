import { Component, computed, effect, inject } from '@angular/core';
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
import { trackPortalVisitOnce } from '../demo/demo-funnel';
import { faqsFor } from '../../config/faq.data';
import { LANGS, LangService } from '../../core/i18n/lang.service';
import { LangSwitcherComponent } from '../../core/i18n/lang-switcher.component';
import { LOGIN_TX } from './login.i18n';
import { gaEvent } from '../../core/analytics';
import { SeoService } from '../../core/seo.service';

// Torre isométrica de la ilustración: centro de la base, medios ejes de la base (a horizontal, b = a/2 vertical), alto y pisos.
interface Tower { cx: number; cy: number; a: number; b: number; h: number; floors: number; }

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CheckboxModule, InputTextModule, PasswordModule, FormsModule, RouterModule, MessageModule, AppFloatingConfigurator, LangSwitcherComponent],
    template: `
        <app-floating-configurator />

        <div class="lp-root">
            <div class="lp-top-actions">
                <a class="lp-demo-top" routerLink="/explorar"><i class="pi pi-play-circle"></i> {{ t().demoTop }}</a>
                <app-lang-switcher />
                <button type="button" class="lp-faq-link" (click)="goToFaq()">
                    <i class="pi pi-question-circle"></i> {{ t().faqLink }}
                </button>
            </div>

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
                        <span class="lp-brand-tagline">{{ t().tagline }}</span>
                    </div>
                </div>

                <!-- Mensaje principal + video promocional -->
                <div class="lp-hero">
                    <div class="lp-slogan-block">
                        <div class="lp-slogan-eyebrow">{{ t().eyebrow }}</div>
                        <h1 class="lp-slogan">
                            {{ t().slogan1 }}<br>
                            {{ t().slogan2 }}<br>
                            <span class="lp-slogan-accent">{{ t().sloganAccent }}</span>
                        </h1>
                        <p class="lp-slogan-sub">
                            {{ t().sloganSub }}
                        </p>
                        <a class="lp-demo-btn" routerLink="/explorar"><i class="pi pi-play-circle"></i> {{ t().demoBtn }} <span aria-hidden="true">→</span></a>
                    </div>

                    <!-- Video promocional: en bucle, sin sonido y sin controles (no se puede pausar) -->
                    <div class="lp-promo">
                        <video src="/brand/expenses-promo.mp4" [muted]="true" autoplay loop playsinline
                               disablepictureinpicture disableremoteplayback preload="auto" tabindex="-1"></video>
                        <span class="lp-vc-tag"><i class="pi pi-play-circle"></i> {{ t().promoTag }}</span>
                    </div>
                </div>

                <!-- Ilustración: edificios y tarjetas del panel (vista de ejemplo) -->
                <div class="lp-visual" aria-hidden="true">
                    <svg class="lp-visual-svg" viewBox="0 0 520 400" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="lpPlat" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0" stop-color="#ffffff" />
                                <stop offset="1" stop-color="#dcebf7" />
                            </linearGradient>
                            <linearGradient id="lpWallL" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0" stop-color="#e9f0f7" />
                                <stop offset="1" stop-color="#c3d4e4" />
                            </linearGradient>
                            <linearGradient id="lpWallR" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0" stop-color="#ffffff" />
                                <stop offset="1" stop-color="#dbe7f2" />
                            </linearGradient>
                            <radialGradient id="lpTree" cx="0.4" cy="0.35" r="0.7">
                                <stop offset="0" stop-color="#7ed08b" />
                                <stop offset="1" stop-color="#3a9a5b" />
                            </radialGradient>
                        </defs>

                        <!-- Plataforma -->
                        <polygon points="10,279 260,404 260,390 10,265" fill="#b9cde0" />
                        <polygon points="510,279 260,404 260,390 510,265" fill="#cfdeec" />
                        <polygon points="10,265 260,390 510,265 260,140" fill="url(#lpPlat)" stroke="#c9dbea" stroke-width="1.5" />
                        <polygon points="60,265 260,365 460,265 260,165" fill="none" stroke="#bfe3ee" stroke-width="1" stroke-dasharray="4 5" />

                        <!-- Árboles -->
                        @for (t of trees; track $index) {
                            <rect [attr.x]="t[0] - 1.5" [attr.y]="t[1]" width="3" height="9" fill="#8a6d4f" />
                            <circle [attr.cx]="t[0]" [attr.cy]="t[1] - 3" [attr.r]="t[2]" fill="url(#lpTree)" />
                        }

                        <!-- Torres (de atrás hacia adelante) -->
                        @for (t of towers; track $index) {
                            <polygon [attr.points]="leftFace(t)" fill="url(#lpWallL)" />
                            <polygon [attr.points]="rightFace(t)" fill="url(#lpWallR)" />
                            <g [attr.transform]="leftMatrix(t)">
                                @for (r of floorList(t); track r) {
                                    @for (c of columns; track c) {
                                        <rect [attr.x]="0.12 + c * 0.22" [attr.y]="0.03 + r * (0.94 / t.floors)" width="0.14" [attr.height]="0.94 / t.floors * 0.5" fill="#7fa3c7" opacity="0.8" />
                                    }
                                }
                            </g>
                            <g [attr.transform]="rightMatrix(t)">
                                @for (r of floorList(t); track r) {
                                    @for (c of columns; track c) {
                                        <rect [attr.x]="0.12 + c * 0.22" [attr.y]="0.03 + r * (0.94 / t.floors)" width="0.14" [attr.height]="0.94 / t.floors * 0.5" fill="#9bbbd8" opacity="0.85" />
                                    }
                                }
                            </g>
                            <polygon [attr.points]="topFace(t)" fill="#f6f9fc" stroke="#d3e1ee" stroke-width="1" />
                        }

                        <!-- Nodos de conexión -->
                        @for (n of nodes; track $index) {
                            <circle [attr.cx]="n[0]" [attr.cy]="n[1]" r="9" fill="#2ec4b6" opacity="0.18" />
                            <circle [attr.cx]="n[0]" [attr.cy]="n[1]" r="3.5" fill="#2ec4b6" />
                        }
                    </svg>

                    <!-- Finanzas -->
                    <div class="lp-vc lp-vc-fin">
                        <div class="lp-vc-head"><span class="lp-vc-ico"><i class="pi pi-chart-bar"></i></span><b>{{ t().fin.title }}</b><em>{{ t().online }}</em></div>
                        <small>{{ t().fin.collected }}</small>
                        <div class="lp-vc-big">Gs. 48.230.750</div>
                        <div class="lp-vc-up">{{ t().fin.trend }}</div>
                        <svg class="lp-spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="0,26 14,20 28,23 42,14 56,17 70,8 84,10 100,2" fill="none" stroke="#2fb67c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                        <small class="lp-vc-sub">{{ t().fin.latest }}</small>
                        <ul class="lp-vc-rows">
                            <li><span>18/04</span><span>{{ t().fin.rows[0] }}</span><b>1.250.000</b></li>
                            <li><span>18/04</span><span>{{ t().fin.rows[1] }}</span><b>320.000</b></li>
                            <li><span>17/04</span><span>{{ t().fin.rows[2] }}</span><b>600.000</b></li>
                            <li><span>16/04</span><span>{{ t().fin.rows[3] }}</span><b>450.000</b></li>
                        </ul>
                    </div>

                    <!-- Morosidad -->
                    <div class="lp-vc lp-vc-mor">
                        <div class="lp-vc-head"><span class="lp-vc-ico"><i class="pi pi-percentage"></i></span><b>{{ t().mor.title }}</b><em>{{ t().online }}</em></div>
                        <div class="lp-vc-big">{{ t().mor.big }} <span class="lp-vc-down">{{ t().mor.trend }}</span></div>
                        <div class="lp-vc-bar"><i style="width: 38%"></i></div>
                        <div class="lp-vc-two">
                            <div><small>{{ t().mor.debtors }}</small><strong>18</strong><small>(8,4%)</small></div>
                            <div><small>{{ t().mor.totalUnits }}</small><strong>214</strong><small>(100%)</small></div>
                        </div>
                    </div>

                    <!-- Proveedores -->
                    <div class="lp-vc lp-vc-pro">
                        <div class="lp-vc-head"><span class="lp-vc-ico"><i class="pi pi-truck"></i></span><b>{{ t().pro.title }}</b><em>{{ t().online }}</em></div>
                        <ul class="lp-vc-kv">
                            <li><span>{{ t().pro.pending }}</span><b>3</b></li>
                            <li><span>{{ t().pro.overdue }}</span><b>1</b></li>
                            <li><span>{{ t().pro.total }}</span><b>Gs. 4.820.000</b></li>
                        </ul>
                    </div>

                    <!-- Votaciones -->
                    <div class="lp-vc lp-vc-vot">
                        <div class="lp-vc-head"><span class="lp-vc-ico"><i class="pi pi-users"></i></span><b>{{ t().vot.title }}</b><em>{{ t().online }}</em></div>
                        <div class="lp-vc-title">{{ t().vot.name }}</div>
                        <small>{{ t().vot.available }}</small>
                        <div class="lp-vc-bar lp-vc-bar-green"><i style="width: 68%"></i><span>68%</span></div>
                        <small>{{ t().vot.of }}</small>
                    </div>

                    <div class="lp-vc lp-vc-pill"><i class="pi pi-building"></i><span>{{ t().managed }}</span><b>4</b></div>

                    <span class="lp-visual-note">{{ t().sample }}</span>
                </div>

                <!-- Indicadores de confianza -->
                <div class="lp-trust-row">
                    <div class="lp-trust-item">
                        <span class="lp-trust-ico"><i class="pi pi-shield"></i></span>
                        <div><strong>{{ t().trust[0].title }}</strong><small>{{ t().trust[0].text }}</small></div>
                    </div>
                    <div class="lp-trust-sep"></div>
                    <div class="lp-trust-item">
                        <span class="lp-trust-ico"><i class="pi pi-users"></i></span>
                        <div><strong>{{ t().trust[1].title }}</strong><small>{{ t().trust[1].text }}</small></div>
                    </div>
                    <div class="lp-trust-sep"></div>
                    <div class="lp-trust-item">
                        <span class="lp-trust-ico"><i class="pi pi-lock"></i></span>
                        <div><strong>{{ t().trust[2].title }}</strong><small>{{ t().trust[2].text }}</small></div>
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
                        <h2>{{ t().formTitle }}</h2>
                        <p>{{ t().formSub }}</p>
                    </div>

                    <div class="lp-field">
                        <label class="lp-label" for="lp-email">{{ t().userLabel }}</label>
                        <div class="lp-input-wrap">
                            <i class="pi pi-envelope"></i>
                            <input pInputText id="lp-email" type="text"
                                   [placeholder]="t().userPlaceholder"
                                   class="lp-input"
                                   [(ngModel)]="email" (keyup.enter)="submit()" />
                        </div>
                    </div>

                    <div class="lp-field">
                        <label class="lp-label" for="lp-pass">{{ t().passLabel }}</label>
                        <div class="lp-input-wrap">
                            <i class="pi pi-lock"></i>
                            <p-password id="lp-pass" [(ngModel)]="password"
                                        [placeholder]="t().passPlaceholder"
                                        [toggleMask]="true" [fluid]="true" [feedback]="false"
                                        styleClass="lp-password"
                                        (keyup.enter)="submit()">
                            </p-password>
                        </div>
                    </div>

                    <div class="lp-forgot-row">
                        <a routerLink="/forgot-password">{{ t().forgot }}</a>
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
                        {{ t().submit }}
                    </button>

                    <!-- Invitación a la demostración: es el paso 2 del embudo (visita → demo → funciones → necesidad → contacto). -->
                    <div class="lp-demo-card">
                        <div class="lp-demo-head">
                            <span class="lp-demo-ico"><i class="pi pi-play"></i></span>
                            <h3>{{ t().demoCardTitle }}</h3>
                        </div>
                        <p>{{ t().demoCardText }}</p>
                        <a class="lp-demo-cta" routerLink="/explorar">{{ t().demoCardCta }}</a>
                        <small>{{ t().demoCardNote }}</small>
                    </div>

                    <a class="lp-apk-link" href="/downloads/expenses.apk" download="Expenses.apk">
                        <i class="pi pi-android"></i> {{ t().apk }}
                    </a>

                    <div class="lp-form-footer">
                        <i class="pi pi-lock"></i> {{ t().secure }}
                        <span class="lp-footer-sep"></span>
                        <a class="lp-linkedin-link" href="https://www.linkedin.com/company/expensespy/home/"
                           target="_blank" rel="noopener noreferrer"
                           [attr.aria-label]="t().linkedinAria" [title]="t().linkedinTitle">
                            <i class="pi pi-linkedin"></i> LinkedIn
                        </a>
                    </div>
                </div>
            </div>

            @if (whatsappUrl(); as wa) {
                <a class="lp-wa-fab" [href]="wa" target="_blank" rel="noopener noreferrer" (click)="trackWhatsApp()"
                   [attr.aria-label]="t().waAria" [title]="t().waAria">
                    <i class="pi pi-whatsapp"></i>
                    <span class="lp-wa-label">{{ t().waLabel }}</span>
                </a>
            }
        </div>

        <!-- Qué se puede explorar en la demostración: cinco herramientas, cada una enseña algo real del producto. -->
        <section class="lp-explore" id="lp-explore" aria-labelledby="lp-explore-title">
            <div class="lp-explore-head">
                <span class="lp-explore-eyebrow">{{ t().exploreEyebrow }}</span>
                <h2 id="lp-explore-title">{{ t().exploreTitle }}</h2>
                <p>{{ t().exploreText }}</p>
            </div>
            <div class="lp-explore-grid">
                @for (s of t().steps; track s.title; let i = $index) {
                    <a class="lp-explore-card" routerLink="/explorar">
                        <span class="lp-explore-no">{{ i + 1 }}</span>
                        <i class="pi" [class]="'pi ' + s.icon"></i>
                        <b>{{ s.title }}</b>
                        <small>{{ s.text }}</small>
                    </a>
                }
            </div>
            <div class="lp-explore-foot">
                <a class="lp-demo-cta" routerLink="/explorar">{{ t().demoCardCta }}</a>
                <small>{{ t().exploreFoot }}</small>
            </div>
        </section>

        <!-- Preguntas frecuentes: queda debajo de la pantalla de ingreso (hay que bajar para verla) y sirve para que los buscadores entiendan qué es Expenses. -->
        <section class="lp-faq" id="lp-faq" aria-labelledby="lp-faq-title">
            <h2 id="lp-faq-title">{{ t().faqTitle }}</h2>
            @for (item of faqs(); track item.question) {
                <details class="lp-faq-item">
                    <summary>{{ item.question }}</summary>
                    <p>{{ item.answer }}</p>
                </details>
            }
        </section>
    `,
    styles: [`
        :host { display: block; overflow-x: clip; }
        .lp-top-actions { position: absolute; top: 1.7rem; right: 9.5rem; z-index: 5; display: flex; align-items: center; gap: 0.6rem; }
        .lp-demo-top {
            display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.55rem 1.05rem; border-radius: 999px;
            background: #1ab7af; color: #fff; text-decoration: none; font-size: 0.85rem; font-weight: 700;
            animation: lp-demo-pulse 2.4s ease-out infinite; transition: background 0.15s ease, transform 0.15s ease;
        }
        .lp-demo-top:hover { background: #14a29b; transform: translateY(-1px); }
        @keyframes lp-demo-pulse {
            0% { box-shadow: 0 0 0 0 rgba(26, 183, 175, 0.55); }
            70% { box-shadow: 0 0 0 10px rgba(26, 183, 175, 0); }
            100% { box-shadow: 0 0 0 0 rgba(26, 183, 175, 0); }
        }
        @media (prefers-reduced-motion: reduce) { .lp-demo-top { animation: none; } }
        .lp-faq-link {
            display: inline-flex; align-items: center; gap: 0.45rem; cursor: pointer;
            padding: 0.55rem 1rem; border-radius: 999px;
            border: 1px solid var(--brand-blue, #1385b6); background: transparent; color: var(--brand-blue, #1385b6);
            font: inherit; font-size: 0.85rem; font-weight: 600;
        }
        .lp-faq-link:hover { background: rgba(19, 133, 182, 0.08); }
        @media (max-width: 860px) {
            .lp-top-actions { position: static; align-self: center; flex-wrap: wrap; justify-content: center; margin: 1rem 0 0; }
        }
        .lp-faq { max-width: 860px; margin: 0 auto; padding: 3.5rem 1.5rem 4rem; }
        .lp-faq h2 {
            font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
            font-size: 1.5rem; font-weight: 800; color: var(--ex-ink); margin: 0 0 1.25rem;
        }
        .lp-faq-item { border-bottom: 1px solid rgba(127, 127, 127, 0.25); }
        .lp-faq-item summary {
            cursor: pointer; list-style: none; padding: 1rem 2rem 1rem 0; position: relative;
            font-weight: 600; font-size: 1rem; color: var(--ex-ink);
        }
        .lp-faq-item summary::-webkit-details-marker { display: none; }
        .lp-faq-item summary::after {
            content: '+'; position: absolute; right: 0.25rem; top: 50%; transform: translateY(-50%);
            font-size: 1.4rem; font-weight: 400; color: var(--brand-blue, #1385b6);
        }
        .lp-faq-item[open] summary::after { content: '–'; }
        .lp-faq-item p { margin: 0 0 1.1rem; font-size: 0.95rem; line-height: 1.6; color: var(--ex-muted); }
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

        /* Invitación a la demostración (tarjeta del formulario, botón del panel de marca y sección de abajo) */
        .lp-demo-btn {
            display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 1.1rem;
            padding: 0.75rem 1.3rem; border-radius: 0.8rem; text-decoration: none;
            background: #1ab7af; color: #fff; font-size: 0.95rem; font-weight: 700;
            box-shadow: 0 8px 22px rgba(26, 183, 175, 0.35); transition: transform 0.15s ease, background 0.15s ease;
        }
        .lp-demo-btn:hover { background: #14a29b; transform: translateY(-2px); }
        .lp-demo-card {
            margin-top: 1.1rem; padding: 1.1rem 1.15rem 0.9rem; border-radius: 1rem;
            border: 1px solid #1ab7af; background: rgba(26, 183, 175, 0.07); text-align: left;
        }
        .lp-demo-head { display: flex; align-items: center; gap: 0.6rem; }
        .lp-demo-head h3 { margin: 0; font-size: 1rem; font-weight: 800; color: var(--ex-ink); line-height: 1.3; }
        .lp-demo-ico { flex: none; width: 1.7rem; height: 1.7rem; border-radius: 50%; display: grid; place-items: center; background: #1ab7af; color: #fff; font-size: 0.7rem; }
        .lp-demo-card p { margin: 0.7rem 0 0.9rem; font-size: 0.88rem; line-height: 1.5; color: var(--ex-muted); }
        .lp-demo-cta {
            display: block; text-align: center; text-decoration: none; padding: 0.8rem 1rem; border-radius: 0.7rem;
            background: #1ab7af; color: #fff; font-size: 0.95rem; font-weight: 700; transition: background 0.15s ease;
        }
        .lp-demo-cta:hover { background: #14a29b; }
        .lp-demo-card small { display: block; margin-top: 0.7rem; text-align: center; font-size: 0.74rem; color: var(--ex-muted); }
        .lp-explore { max-width: 1040px; margin: 0 auto; padding: 3.5rem 1.5rem 0.5rem; }
        .lp-explore-head { text-align: center; max-width: 640px; margin: 0 auto 1.8rem; }
        .lp-explore-eyebrow { font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #0f8a84; }
        .lp-explore-head h2 { margin: 0.4rem 0 0.6rem; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 1.8rem; font-weight: 800; color: var(--ex-ink); }
        .lp-explore-head p { margin: 0; font-size: 1rem; line-height: 1.6; color: var(--ex-muted); }
        .lp-explore-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.9rem; }
        .lp-explore-card {
            position: relative; display: grid; gap: 0.4rem; align-content: start; padding: 1.1rem 1rem; border-radius: 1rem;
            border: 1px solid rgba(127, 127, 127, 0.25); text-decoration: none; background: rgba(255, 255, 255, 0.6);
            transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .lp-explore-card:hover { transform: translateY(-3px); border-color: #1ab7af; box-shadow: 0 10px 24px rgba(22, 50, 74, 0.1); }
        .lp-explore-card i { font-size: 1.4rem; color: #1385b6; }
        .lp-explore-card b { font-size: 0.95rem; color: var(--ex-ink); line-height: 1.3; }
        .lp-explore-card small { font-size: 0.82rem; line-height: 1.45; color: var(--ex-muted); }
        .lp-explore-no { position: absolute; top: 0.7rem; right: 0.8rem; font-size: 0.78rem; font-weight: 800; color: #1ab7af; }
        .lp-explore-foot { display: grid; justify-items: center; gap: 0.7rem; margin-top: 1.8rem; }
        .lp-explore-foot .lp-demo-cta { padding-left: 2rem; padding-right: 2rem; }
        .lp-explore-foot small { font-size: 0.82rem; color: var(--ex-muted); text-align: center; }
    `]
})
export class Login {
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);
    private readonly pushSvc = inject(PushService);

    private readonly lang = inject(LangService);
    readonly t = computed(() => LOGIN_TX[this.lang.lang()]);
    readonly faqs = computed(() => faqsFor(this.lang.lang()));
    readonly whatsappUrl = computed(() => salesWhatsAppUrl(this.lang.lang()));

    trackWhatsApp(): void {
        gaEvent('generate_lead', { method: 'whatsapp_login' });
    }

    constructor() {
        // Paso 1 del embudo de la demostración: una visita de portada por pestaña.
        trackPortalVisitOnce();
        const seo = inject(SeoService);
        effect(() => {
            const info = LANGS.find((l) => l.code === this.lang.lang());
            seo.set({ title: this.t().seoTitle, description: this.t().seoDescription, path: '/login', lang: info?.htmlLang, ogLocale: info?.ogLocale });
        });
    }

    // Ilustración: torres de atrás hacia adelante (el orden de dibujo es el de la lista), árboles [x, y, radio] y nodos de conexión [x, y].
    readonly towers: Tower[] = [
        { cx: 255, cy: 215, a: 50, b: 25, h: 175, floors: 14 },
        { cx: 352, cy: 262, a: 46, b: 23, h: 125, floors: 10 },
        { cx: 168, cy: 278, a: 46, b: 23, h: 112, floors: 9 }
    ];
    readonly trees: number[][] = [[88, 282, 9], [110, 296, 8], [405, 296, 9], [430, 280, 8], [300, 322, 8], [214, 318, 7], [455, 262, 7]];
    readonly nodes: number[][] = [[255, 245], [352, 288], [168, 304], [300, 205], [210, 215]];
    readonly columns = [0, 1, 2, 3];

    email = '';
    password = '';
    errorMessage = '';
    isSubmitting = false;

    // Baja con desplazamiento suave hasta las preguntas frecuentes (están debajo de la pantalla de ingreso).
    goToFaq(): void {
        document.getElementById('lp-faq')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    floorList(t: Tower): number[] {
        return Array.from({ length: t.floors }, (_, i) => i);
    }

    // Caras de una torre isométrica: izquierda, derecha y techo.
    leftFace(t: Tower): string {
        return `${t.cx - t.a},${t.cy} ${t.cx},${t.cy + t.b} ${t.cx},${t.cy + t.b - t.h} ${t.cx - t.a},${t.cy - t.h}`;
    }

    rightFace(t: Tower): string {
        return `${t.cx},${t.cy + t.b} ${t.cx + t.a},${t.cy} ${t.cx + t.a},${t.cy - t.h} ${t.cx},${t.cy + t.b - t.h}`;
    }

    topFace(t: Tower): string {
        return `${t.cx - t.a},${t.cy - t.h} ${t.cx},${t.cy + t.b - t.h} ${t.cx + t.a},${t.cy - t.h} ${t.cx},${t.cy - t.b - t.h}`;
    }

    // Llevan el cuadrado unitario (u a lo ancho, v hacia arriba) sobre cada cara, para dibujar las ventanas sin calcular cada una.
    leftMatrix(t: Tower): string {
        return `matrix(${t.a} ${t.b} 0 ${-t.h} ${t.cx - t.a} ${t.cy})`;
    }

    rightMatrix(t: Tower): string {
        return `matrix(${t.a} ${-t.b} 0 ${-t.h} ${t.cx} ${t.cy + t.b})`;
    }

    submit(): void {
        if (!this.email || !this.password) {
            this.errorMessage = this.t().errEmpty;
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
                        this.errorMessage = body.message ?? this.t().errMultiCompany;
                    } else if (body?.error === 'web_access_denied') {
                        this.errorMessage = body.message;
                    } else {
                        this.errorMessage = this.t().errGeneric;
                    }
                }
            });
    }
}
