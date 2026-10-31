import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { AuthService } from '../../auth/auth.service';
import { LangService } from '../../core/i18n/lang.service';
import { LangSwitcherComponent } from '../../core/i18n/lang-switcher.component';
import { PASSWORD_TX } from './password.i18n';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Card, Message, Password, LangSwitcherComponent],
  template: `
    <div class="auth-page">
      <div class="auth-lang"><app-lang-switcher /></div>
      <p-card styleClass="auth-card">
        <div class="auth-head">
          <img src="/brand/expenses-icon.svg" alt="Expenses" class="auth-logo" />
          <span class="auth-brand">EXPENSES</span>
          <h1>{{ t().reset.title }}</h1>
          <p *ngIf="!invalidToken && !done">{{ t().reset.lead }}</p>
        </div>

        <div *ngIf="invalidToken" class="auth-success">
          <i class="pi pi-times-circle" style="color:#ef4444"></i>
          <p>{{ t().reset.noToken }}</p>
        </div>

        <div *ngIf="!invalidToken && !done">
          <div class="auth-field">
            <label for="rp-pass">{{ t().reset.newLabel }}</label>
            <p-password id="rp-pass" [(ngModel)]="newPassword" [toggleMask]="true" [fluid]="true"
                        [promptLabel]="t().reset.prompt" [weakLabel]="t().reset.weak" [mediumLabel]="t().reset.medium" [strongLabel]="t().reset.strong"
                        (keyup.enter)="submit()">
            </p-password>
            <small class="auth-hint">{{ t().reset.hint }}</small>
          </div>

          <div class="auth-field">
            <label for="rp-pass2">{{ t().reset.confirmLabel }}</label>
            <input id="rp-pass2" type="password" [(ngModel)]="confirmPassword" (keyup.enter)="submit()" />
          </div>

          <p-message *ngIf="errorMessage" severity="error" [text]="errorMessage" styleClass="w-full"></p-message>

          <button class="auth-submit-btn" [disabled]="isSubmitting" (click)="submit()">
            <i class="pi" [class.pi-spin]="isSubmitting" [class.pi-spinner]="isSubmitting" [class.pi-check]="!isSubmitting"></i>
            {{ t().reset.submit }}
          </button>
        </div>

        <div class="auth-success" *ngIf="done">
          <i class="pi pi-check-circle"></i>
          <p>{{ t().reset.done }}</p>
        </div>

        <a class="auth-back-link" routerLink="/login"><i class="pi pi-arrow-left"></i> {{ t().reset.back }}</a>
      </p-card>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 1.5rem; background: var(--ex-bg);
    }
    :host ::ng-deep .auth-card { width: 100%; max-width: 420px; border-radius: 20px; }
    .auth-lang { position: absolute; top: 1rem; right: 1rem; }
    .auth-head { text-align: center; margin-bottom: 1.5rem; }
    .auth-brand { font-weight: 800; letter-spacing: 0.08em; color: var(--brand-blue); font-size: 0.85rem; }
    .auth-head h1 { margin: 0.5rem 0 0.5rem; font-size: 1.3rem; }
    .auth-head p { margin: 0; color: var(--brand-muted); font-size: 0.88rem; }

    .auth-field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.25rem; }
    .auth-field label { font-size: 0.85rem; font-weight: 600; color: var(--brand-ink); }
    .auth-field input {
      padding: 0.7rem 0.9rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.95rem; width: 100%; box-sizing: border-box;
    }
    .auth-field input:focus { outline: none; border-color: var(--brand-blue); box-shadow: 0 0 0 3px rgba(19,133,182,0.12); }
    .auth-hint { color: var(--brand-muted); font-size: 0.78rem; }

    .auth-submit-btn {
      width: 100%; padding: 0.8rem; border: none; border-radius: 10px; cursor: pointer;
      background: var(--brand-blue); color: #fff; font-weight: 700; font-size: 0.95rem;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      transition: opacity 0.15s;
    }
    .auth-submit-btn:disabled { opacity: 0.6; cursor: default; }

    .auth-success { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.75rem; padding: 0.5rem 0 1rem; }
    .auth-success i { font-size: 2.2rem; color: #22c55e; }
    .auth-success p { margin: 0; color: var(--brand-muted); font-size: 0.9rem; line-height: 1.5; }

    .auth-back-link {
      display: flex; align-items: center; justify-content: center; gap: 0.4rem;
      margin-top: 1.25rem; font-size: 0.85rem; color: var(--brand-blue); text-decoration: none;
    }
    .auth-back-link:hover { text-decoration: underline; }
  `]
})
export class ResetPassword implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);
  readonly t = computed(() => PASSWORD_TX[this.lang.lang()]);

  constructor() {
    effect(() => {
      this.lang.lang();
      this.lang.applyHtmlLang();
    });
  }

  token = '';
  invalidToken = false;
  newPassword = '';
  confirmPassword = '';
  errorMessage = '';
  isSubmitting = false;
  done = false;

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.invalidToken = !this.token;
  }

  // El servidor contesta en español: en otro idioma se reconoce el motivo y se muestra el texto propio.
  private serverError(message: unknown): string {
    const m = typeof message === 'string' ? message : '';
    if (this.lang.lang() === 'es' && m) return m;
    return m.includes('contraseña') ? this.t().reset.hint : this.t().reset.errExpired;
  }

  submit(): void {
    if (!this.newPassword || this.newPassword.length < 8) {
      this.errorMessage = this.t().reset.errShort;
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = this.t().reset.errMismatch;
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;

    this.auth.resetPassword(this.token, this.newPassword)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.done = true;
          setTimeout(() => this.router.navigateByUrl('/login'), 3000);
        },
        error: (error) => {
          this.errorMessage = this.serverError(error?.error);
        }
      });
  }
}
