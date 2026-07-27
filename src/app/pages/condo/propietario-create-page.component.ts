import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { OwnersApiService } from '../../api/owners-api.service';

interface PhonePrefix { label: string; value: string; flag: string; }
const PHONE_PREFIXES: PhonePrefix[] = [
  { label: 'PY +595', value: '+595', flag: '🇵🇾' },
  { label: 'USA +1',  value: '+1',   flag: '🇺🇸' },
  { label: 'BR +55',  value: '+55',  flag: '🇧🇷' },
  { label: 'ARG +54', value: '+54',  flag: '🇦🇷' },
  { label: 'VE +58',  value: '+58',  flag: '🇻🇪' },
];

@Component({
  standalone: true,
  selector: 'app-propietario-create-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Select, Tooltip],
  template: `
    <p-card styleClass="app-page-card">

      <!-- HEADER -->
      <div class="create-header">
        <button class="back-btn" (click)="cancel()" pTooltip="Volver al listado" tooltipPosition="right">
          <i class="pi pi-arrow-left"></i>
        </button>
        <div>
          <h1>{{ isEditing ? 'Editar propietario' : 'Nuevo propietario' }}</h1>
          <p>{{ isEditing ? editingFullName : 'Complete los datos para registrar la ficha del propietario.' }}</p>
        </div>
      </div>

      <p-message *ngIf="loadError" severity="error" [text]="loadError"></p-message>
      <div *ngIf="loading" class="app-state">Cargando datos...</div>

      <form class="create-form" (ngSubmit)="save()" *ngIf="!loading && !loadError">

        <!-- ══ DATOS PERSONALES ══════════════════════════════════════ -->
        <section class="form-section">
          <h2 class="section-title">Datos personales</h2>

          <div class="field-row">
            <div class="field">
              <label for="firstName">Nombre <span class="required">*</span></label>
              <input id="firstName" type="text" [(ngModel)]="form.firstName" name="firstName"
                     placeholder="Ej. Juan" maxlength="80" autocomplete="off" />
            </div>
            <div class="field">
              <label for="lastName">Apellidos <span class="required">*</span></label>
              <input id="lastName" type="text" [(ngModel)]="form.lastName" name="lastName"
                     placeholder="Ej. Pérez García" maxlength="100" autocomplete="off" />
            </div>
          </div>
        </section>

        <!-- ══ ACCESO AL SISTEMA ════════════════════════════════════ -->
        <section class="form-section">
          <h2 class="section-title">Acceso al sistema</h2>

          <div class="field-row">
            <div class="field">
              <label for="username">Nombre de usuario <span class="required">*</span></label>
              <input id="username" type="text" [(ngModel)]="form.username" name="username"
                     placeholder="ej. juan.perez" maxlength="60" autocomplete="off"
                     (input)="onUsernameInput()" />
              <small class="field-hint">Solo minúsculas, números, puntos y guiones.</small>
            </div>
            <div class="field">
              <label for="email">Correo electrónico <span class="required">*</span></label>
              <input id="email" type="email" [(ngModel)]="form.email" name="email"
                     placeholder="propietario@ejemplo.com" maxlength="160" autocomplete="off" />
            </div>
          </div>

          <div class="login-info-box">
            <div class="login-method">
              <i class="pi pi-at"></i>
              <span><strong>Correo</strong> propietario&#64;ejemplo.com</span>
            </div>
            <div class="login-sep">ó</div>
            <div class="login-method">
              <i class="pi pi-user"></i>
              <span><strong>Usuario</strong> juan.perez</span>
            </div>
            <p class="login-note" *ngIf="!isEditing">
              Clave inicial: <code>123456</code> — el propietario deberá cambiarla en su primer ingreso.
            </p>
          </div>

          <div class="field">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
              <span>Propietario activo</span>
            </label>
          </div>
        </section>

        <!-- ══ CONTACTO ══════════════════════════════════════════════ -->
        <section class="form-section">
          <h2 class="section-title">Contacto</h2>

          <div class="field-row">
            <div class="field">
              <label>Teléfono <span class="optional">(opcional)</span></label>
              <div class="phone-row">
                <p-select [options]="prefixOptions" [(ngModel)]="form.phonePrefix" name="phonePrefix"
                          optionLabel="label" optionValue="value" styleClass="phone-prefix-select">
                  <ng-template pTemplate="selectedItem" let-item>
                    <span *ngIf="item">{{ item.flag }} {{ item.value }}</span>
                  </ng-template>
                  <ng-template pTemplate="item" let-item>
                    <span>{{ item.flag }} {{ item.label }}</span>
                  </ng-template>
                </p-select>
                <input type="tel" [(ngModel)]="form.phone" name="phone"
                       placeholder="0981 123 456" class="phone-input"
                       (input)="onPhoneInput()" maxlength="15" />
              </div>
            </div>
            <div class="field">
              <label for="address">Dirección <span class="optional">(opcional)</span></label>
              <input id="address" type="text" [(ngModel)]="form.address" name="address"
                     placeholder="Calle, número, ciudad" maxlength="200" autocomplete="off" />
            </div>
          </div>
        </section>

        <!-- ══ ACCIONES ══════════════════════════════════════════════ -->
        <section class="form-actions">
          <div class="form-actions-left">
            <p-button *ngIf="isEditing" type="button" label="Eliminar propietario"
                      severity="danger" [outlined]="true" [rounded]="true"
                      icon="pi pi-trash" (onClick)="askDelete()">
            </p-button>
          </div>
          <div class="form-actions-right">
            <p-button type="button" label="Cancelar" [text]="true" [rounded]="true"
                      severity="secondary" (onClick)="cancel()">
            </p-button>
            <p-button type="submit" [label]="isEditing ? 'Guardar cambios' : 'Crear propietario'"
                      [text]="true" [rounded]="true" [loading]="isSaving"
                      icon="pi pi-check">
            </p-button>
          </div>
        </section>

      </form>
    </p-card>

    <!-- CONFIRM ELIMINAR -->
    <div class="ov-backdrop" *ngIf="confirmVisible" (click)="cancelDelete()"></div>
    <div class="ov-panel-sm" *ngIf="confirmVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Confirmar eliminación</strong>
        <button class="ov-close" (click)="cancelDelete()">✕</button>
      </div>
      <p class="confirm-text">
        ¿Eliminar la ficha de <strong>{{ editingFullName }}</strong> de forma permanente?
        Esta acción no se puede deshacer.
      </p>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDelete()"></p-button>
        <p-button label="Eliminar definitivamente" severity="danger"
                  [loading]="isDeleting" (onClick)="confirmDelete()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .create-header { display:flex; align-items:flex-start; gap:1rem; margin-bottom:2rem; }
    .create-header h1 { margin:0 0 0.25rem; }
    .create-header p  { margin:0; color:var(--brand-muted); }
    .back-btn {
      background:none; border:1px solid rgba(19,133,182,0.2); border-radius:50%;
      width:40px; height:40px; display:grid; place-items:center; cursor:pointer;
      color:var(--brand-muted); transition:background 0.15s,color 0.15s; flex-shrink:0; margin-top:4px;
    }
    .back-btn:hover { background:rgba(19,133,182,0.08); color:var(--brand-blue); }

    .create-form { display:flex; flex-direction:column; gap:2.5rem; }
    .form-section { display:flex; flex-direction:column; gap:1.25rem; }
    .section-title {
      font-size:0.88rem; font-weight:700; text-transform:uppercase; letter-spacing:0.07em;
      color:var(--brand-muted); margin:0 0 0.1rem; padding-bottom:0.5rem;
      border-bottom:1px solid rgba(19,133,182,0.1);
    }

    .field { display:flex; flex-direction:column; gap:0.4rem; }
    .field label { font-weight:500; font-size:0.92rem; color:var(--brand-ink); }
    .field-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    .field input {
      width:100%; padding:0.6rem 0.85rem; border:1px solid rgba(19,133,182,0.25);
      border-radius:10px; font:inherit; font-size:0.95rem; color:var(--brand-ink);
      background:#fff; transition:border-color 0.15s,box-shadow 0.15s; box-sizing:border-box;
    }
    .field input:focus {
      outline:none; border-color:var(--brand-blue);
      box-shadow:0 0 0 3px rgba(19,133,182,0.12);
    }
    .field-hint  { color:var(--brand-muted); font-size:0.8rem; line-height:1.4; }
    .required  { color:#e74c3c; font-weight:600; }
    .optional  { font-weight:400; font-size:0.82rem; color:var(--brand-muted); }
    .checkbox-label { display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:500; }
    .checkbox-label input[type=checkbox] { width:16px; height:16px; cursor:pointer; accent-color:var(--brand-blue); }

    .phone-row { display:flex; gap:0.6rem; align-items:stretch; }
    .phone-input { flex:1; padding:0.6rem 0.85rem; border:1px solid rgba(19,133,182,0.25);
      border-radius:10px; font:inherit; font-size:0.95rem; color:var(--brand-ink); background:#fff; }
    .phone-input:focus { outline:none; border-color:var(--brand-blue); box-shadow:0 0 0 3px rgba(19,133,182,0.12); }
    :host ::ng-deep .phone-prefix-select { width:145px; flex-shrink:0; }
    :host ::ng-deep .phone-prefix-select .p-select { border-radius:10px; border:1px solid rgba(19,133,182,0.25); height:100%; }

    .login-info-box {
      display:flex; align-items:center; flex-wrap:wrap; gap:0.75rem 1.25rem;
      padding:0.9rem 1.1rem; border-radius:14px;
      background:#f0f8ff; border:1px solid rgba(19,133,182,0.2);
    }
    .login-method { display:flex; align-items:center; gap:0.5rem; font-size:0.9rem; color:var(--brand-ink); }
    .login-method i { color:var(--brand-blue); font-size:1rem; }
    .login-sep { font-size:1.1rem; color:var(--brand-muted); font-weight:600; }
    .login-note { width:100%; margin:0; font-size:0.82rem; color:var(--brand-muted); }
    .login-note code { background:rgba(19,133,182,0.1); color:var(--brand-blue); padding:0.1rem 0.4rem; border-radius:6px; font-size:0.85rem; }

    .form-actions {
      display:flex; justify-content:space-between; align-items:center;
      padding-top:0.75rem; border-top:1px solid rgba(19,133,182,0.08);
    }
    .form-actions-right { display:flex; gap:0.75rem; }

    .ov-backdrop {
      position:fixed; inset:0; background:rgba(15,35,50,0.45);
      z-index:1000; backdrop-filter:blur(2px); animation:fadeIn 0.15s ease;
    }
    .ov-panel-sm {
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      width:min(420px, calc(100vw - 2rem)); background:#fff; border-radius:24px;
      z-index:1001; box-shadow:0 32px 80px rgba(15,40,60,0.28);
      padding:1.6rem; animation:slideUp 0.2s cubic-bezier(.4,0,.2,1);
    }
    @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
    @keyframes slideUp {
      from { opacity:0; transform:translate(-50%, calc(-50% + 16px)); }
      to   { opacity:1; transform:translate(-50%, -50%); }
    }
    .ov-header {
      display:flex; justify-content:space-between; align-items:center;
      margin-bottom:1.2rem; padding-bottom:1rem;
      border-bottom:1px solid rgba(19,133,182,0.1);
    }
    .ov-header strong { font-size:1.1rem; color:var(--brand-ink); }
    .ov-close {
      background:none; border:none; cursor:pointer; font-size:1.1rem;
      color:var(--brand-muted); width:32px; height:32px; border-radius:50%;
      display:grid; place-items:center; transition:background 0.15s;
    }
    .ov-close:hover { background:rgba(19,133,182,0.08); color:var(--brand-ink); }
    .confirm-text { margin:0 0 1.2rem; color:var(--brand-ink); line-height:1.6; }
    .confirm-footer { display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1rem; }
  `]
})
export class PropietarioCreatePageComponent implements OnInit {
  private readonly api        = inject(OwnersApiService);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr        = inject(ChangeDetectorRef);
  private readonly msg        = inject(MessageService);

  prefixOptions = PHONE_PREFIXES;

  isEditing      = false;
  editingId      = '';
  editingFullName = '';
  loading        = true;
  loadError      = '';
  isSaving       = false;
  isDeleting     = false;
  confirmVisible = false;

  form = this.emptyForm();

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.loading = false;
      return;
    }

    this.api.getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: owner => {
          this.isEditing       = true;
          this.editingId       = id;
          this.editingFullName = owner.fullName
            || `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim();

          this.form = {
            firstName:   owner.firstName?.trim()  || '',
            lastName:    owner.lastName?.trim()   || '',
            username:    owner.username?.trim()   || '',
            email:       owner.email?.trim()      || '',
            phonePrefix: owner.phonePrefix        || '+595',
            phone:       owner.phone              || '',
            address:     owner.address            || '',
            isActive:    owner.isActive           ?? true
          };

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadError = 'No se encontró el propietario solicitado.';
          this.loading   = false;
          this.cdr.markForCheck();
        }
      });
  }

  onUsernameInput(): void {
    this.form.username = this.form.username
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]/g, '');
  }

  onPhoneInput(): void {
    this.form.phone = this.form.phone.replace(/[^\d\s\-]/g, '');
  }

  save(): void {
    const firstName = this.form.firstName.trim();
    const lastName  = this.form.lastName.trim();
    const username  = this.form.username.trim();
    const email     = this.form.email.trim().toLowerCase();

    if (!firstName) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El nombre es obligatorio.', life: 5000 }); return; }
    if (!lastName)  { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Los apellidos son obligatorios.', life: 5000 }); return; }
    if (!username)  { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El nombre de usuario es obligatorio.', life: 5000 }); return; }
    if (!/^[a-z0-9][a-z0-9.\-_]*$/.test(username)) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Nombre de usuario inválido. Solo minúsculas, números, puntos y guiones.', life: 5000 }); return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Correo electrónico inválido.', life: 5000 }); return;
    }

    const req = {
      firstName, lastName,
      fullName: `${firstName} ${lastName}`,
      username, email,
      phonePrefix: this.form.phonePrefix || null,
      phone:       this.form.phone.trim() || null,
      address:     this.form.address.trim() || null,
      isActive:    this.form.isActive,
      password:    this.isEditing ? undefined : '123456'
    };

    this.isSaving = true;
    const op = this.isEditing
      ? this.api.update(this.editingId, req)
      : this.api.create(req);

    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.isSaving        = false;
        this.editingFullName = saved.fullName || `${saved.firstName} ${saved.lastName}`;
        if (!this.isEditing) {
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Propietario creado. Clave inicial: 123456', life: 4000 });
          this.router.navigate(['/propietarios']);
        } else {
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Cambios guardados correctamente.', life: 4000 });
          this.router.navigate(['/propietarios']);
        }
        this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar el propietario.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  askDelete():    void { this.confirmVisible = true; }
  cancelDelete(): void { this.confirmVisible = false; }

  confirmDelete(): void {
    this.isDeleting = true;
    this.api.delete(this.editingId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isDeleting     = false;
          this.confirmVisible = false;
          this.router.navigate(['/propietarios']);
        },
        error: err => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo eliminar el propietario.'), life: 5000 });
          this.isDeleting = false;
          this.cdr.markForCheck();
        }
      });
  }

  cancel(): void { this.router.navigate(['/propietarios']); }

  private emptyForm() {
    return {
      firstName:   '',
      lastName:    '',
      username:    '',
      email:       '',
      phonePrefix: '+595',
      phone:       '',
      address:     '',
      isActive:    true
    };
  }
}
