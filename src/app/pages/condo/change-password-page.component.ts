import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { FloatLabel } from 'primeng/floatlabel';
import { InputText } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-change-password-page',
  imports: [CommonModule, FormsModule, Button, Card, FloatLabel, InputText],
  template: `
    <section class="password-page">
      <p-card styleClass="password-card">
      <form (ngSubmit)="submit()">
        <div>
          <h1>Cambio obligatorio de contraseña</h1>
          <p>Antes de continuar, define una nueva clave segura para tu cuenta.</p>
        </div>

        <p-floatlabel variant="on">
          <input pInputText [(ngModel)]="currentPassword" name="currentPassword" type="password" required />
          <label>Contraseña actual</label>
        </p-floatlabel>

        <p-floatlabel variant="on">
          <input pInputText [(ngModel)]="newPassword" name="newPassword" type="password" required />
          <label>Nueva contraseña</label>
        </p-floatlabel>

        <p-floatlabel variant="on">
          <input pInputText [(ngModel)]="confirmPassword" name="confirmPassword" type="password" required />
          <label>Confirmar nueva contraseña</label>
        </p-floatlabel>

        <p class="hint">Debe tener mínimo 8 caracteres, mayúscula, minúscula y caracter especial.</p>

        <p-button type="submit" [loading]="isSubmitting" label="Actualizar contraseña"></p-button>
      </form>
      </p-card>
    </section>
  `,
  styles: [`
    .password-page { min-height:100vh; display:grid; place-items:center; background:radial-gradient(circle at top left, rgba(26, 183, 175, 0.22), transparent 24%), radial-gradient(circle at right center, rgba(19, 133, 182, 0.18), transparent 24%), linear-gradient(135deg, #f3fbfb 0%, #eef9fa 48%, #f4fbf2 100%); padding:2rem; }
    .password-card { width:min(520px, 100%); }
    :host ::ng-deep .password-card.p-card { background:rgba(255,255,255,0.92); border:1px solid rgba(19, 133, 182, 0.1); border-radius:28px; box-shadow:0 24px 60px rgba(17, 54, 74, 0.14); }
    :host ::ng-deep .password-card .p-card-body { padding:2rem; }
    form { display:grid; gap:1rem; }
    h1 { margin:0 0 0.5rem; color:var(--brand-ink); }
    p { margin:0; color:var(--brand-muted); }
    .hint { color:var(--brand-muted); font-size:0.92rem; }
  `]
})
export class ChangePasswordPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  currentPassword = '123456';
  newPassword = '';
  confirmPassword = '';
  isSubmitting = false;

  submit(): void {
    if (this.newPassword !== this.confirmPassword) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'La confirmación no coincide.', life: 5000 });
      return;
    }

    if (!this.isValidPassword(this.newPassword)) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'La nueva contraseña no cumple la política mínima.', life: 5000 });
      return;
    }

    this.isSubmitting = true;
    this.auth
      .changePassword(this.currentPassword, this.newPassword)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          void this.router.navigateByUrl('/dashboard');
          this.cdr.markForCheck();
        },
        error: () => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar la contraseña.', life: 5000 });
          this.cdr.markForCheck();
        }
      });
  }

  private isValidPassword(password: string): boolean {
    return password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[^A-Za-z0-9]/.test(password);
  }
}
