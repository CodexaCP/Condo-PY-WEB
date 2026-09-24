import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Card, Message],
  template: `
    <div class="auth-page">
      <p-card styleClass="auth-card">
        <div class="auth-head">
          <span class="auth-brand">CONDOPY</span>
          <h1>¿Olvidaste tu contraseña?</h1>
          <p>Ingresá tu correo o usuario y te mandamos instrucciones para restablecerla.</p>
        </div>

        <div *ngIf="!sent">
          <div class="auth-field">
            <label for="fp-id">Correo o nombre de usuario</label>
            <input id="fp-id" type="text" [(ngModel)]="identifier" (keyup.enter)="submit()"
                   placeholder="correo@empresa.com" autocomplete="username" />
          </div>

          <p-message *ngIf="errorMessage" severity="error" [text]="errorMessage" styleClass="w-full"></p-message>

          <button class="auth-submit-btn" [disabled]="isSubmitting" (click)="submit()">
            <i class="pi" [class.pi-spin]="isSubmitting" [class.pi-spinner]="isSubmitting" [class.pi-send]="!isSubmitting"></i>
            Enviar instrucciones
          </button>
        </div>

        <div class="auth-success" *ngIf="sent">
          <i class="pi pi-check-circle"></i>
          <p>Si el dato ingresado corresponde a una cuenta activa, te llegó un correo con el link para restablecer tu contraseña. Revisá también spam.</p>
        </div>

        <a class="auth-back-link" routerLink="/login"><i class="pi pi-arrow-left"></i> Volver al inicio de sesión</a>
      </p-card>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 1.5rem; background: linear-gradient(135deg, #0d2d3e 0%, #0e3a50 50%, #0d3325 100%);
    }
    :host ::ng-deep .auth-card { width: 100%; max-width: 420px; border-radius: 20px; }
    .auth-head { text-align: center; margin-bottom: 1.5rem; }
    .auth-brand { font-weight: 800; letter-spacing: 0.08em; color: var(--brand-blue); font-size: 0.85rem; }
    .auth-head h1 { margin: 0.5rem 0 0.5rem; font-size: 1.3rem; }
    .auth-head p { margin: 0; color: var(--brand-muted); font-size: 0.88rem; }

    .auth-field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.25rem; }
    .auth-field label { font-size: 0.85rem; font-weight: 600; color: var(--brand-ink); }
    .auth-field input {
      padding: 0.7rem 0.9rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.95rem;
    }
    .auth-field input:focus { outline: none; border-color: var(--brand-blue); box-shadow: 0 0 0 3px rgba(19,133,182,0.12); }

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
export class ForgotPassword {
  private readonly auth = inject(AuthService);

  identifier = '';
  errorMessage = '';
  isSubmitting = false;
  sent = false;

  submit(): void {
    if (!this.identifier.trim()) {
      this.errorMessage = 'Ingresá tu correo o nombre de usuario.';
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;

    this.auth.forgotPassword(this.identifier)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => { this.sent = true; },
        // Ante cualquier error tambien mostramos el mensaje generico: no revela si el dato existe.
        error: () => { this.sent = true; }
      });
  }
}
