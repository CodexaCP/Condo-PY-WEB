import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tooltip } from 'primeng/tooltip';
import { CompaniesApiService } from '../../api/companies-api.service';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { Company, Resident } from '../../api/models';
import { ResidentsApiService } from '../../api/residents-api.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-residents-page',
  imports: [CommonModule, FormsModule, RouterLink, Button, Card, Tooltip],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Residentes</h1>
            <p>
              Propietarios e inquilinos registrados para la operacion inicial.
              Para asignarlos a una unidad o finalizar su residencia, andá a
              <a routerLink="/assignments">Asignaciones</a>.
            </p>
          </div>
        </div>

        <p-button
          *ngIf="!isReadOnly"
          [label]="showForm ? 'Cerrar formulario' : 'Nuevo residente'"
          [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
          (onClick)="toggleForm()">
        </p-button>
      </div>

      <form class="create-form" *ngIf="showForm" (ngSubmit)="submitResident()">

        <!-- Empresa (solo SuperAdmin) -->
        <section class="form-section" *ngIf="isSuperAdmin">
          <h2 class="section-title">Empresa</h2>
          <div class="field">
            <label for="companyId">Empresa <span class="required">*</span></label>
            <select id="companyId" [(ngModel)]="form.companyId" name="companyId" required>
              <option value="" disabled>Selecciona una empresa</option>
              <option *ngFor="let company of companies" [value]="company.id">{{ company.name }}</option>
            </select>
          </div>
        </section>

        <!-- Datos personales -->
        <section class="form-section">
          <h2 class="section-title">Datos personales</h2>
          <div class="field-row">
            <div class="field">
              <label for="fullName">Nombre completo <span class="required">*</span></label>
              <input id="fullName" [(ngModel)]="form.fullName" name="fullName" type="text"
                     placeholder="Ej. María González" maxlength="160" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="documentType">Tipo de documento</label>
              <select id="documentType" [(ngModel)]="form.documentType" name="documentType">
                <option value="">— Sin especificar —</option>
                <option value="CedulaParaguaya">Cédula paraguaya</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="DocumentoExtranjero">Documento extranjero</option>
              </select>
            </div>
            <div class="field">
              <label for="documentNumber">Número de documento <span class="required">*</span></label>
              <input id="documentNumber" [(ngModel)]="form.documentNumber" name="documentNumber"
                     type="text" placeholder="Ej. 1234567 o AB-123456" maxlength="40" />
              <small class="field-hint">Letras, números o guiones.</small>
            </div>
          </div>
        </section>

        <!-- Contacto -->
        <section class="form-section">
          <h2 class="section-title">Contacto</h2>
          <div class="field-row">
            <div class="field">
              <label for="email">Correo electrónico <span class="required">*</span></label>
              <input id="email" [(ngModel)]="form.email" name="email" type="email"
                     placeholder="residente@ejemplo.com" maxlength="160" />
            </div>
            <div class="field">
              <label for="phoneNumber">Teléfono <span class="required">*</span></label>
              <input id="phoneNumber" [(ngModel)]="form.phoneNumber" name="phoneNumber"
                     type="text" placeholder="0981 123 456" maxlength="20" />
              <small class="field-hint">Números, +, ( ) o guiones.</small>
            </div>
          </div>
        </section>

        <!-- Tipo y estado -->
        <section class="form-section">
          <h2 class="section-title">Tipo y estado</h2>
          <div class="check-row">
            <label class="checkbox-label">
              <input [(ngModel)]="form.isOwner" name="isOwner" type="checkbox" />
              <span>Es propietario</span>
            </label>
            <label class="checkbox-label">
              <input [(ngModel)]="form.isActive" name="isActive" type="checkbox" />
              <span>Residente activo</span>
            </label>
          </div>
        </section>

        <!-- Acciones -->
        <section class="form-footer">
          <div>
            <p-button *ngIf="editingId" type="button" label="Cancelar edición"
                      severity="secondary" [text]="true" [rounded]="true"
                      icon="pi pi-times" (onClick)="cancelEdit()">
            </p-button>
          </div>
          <div class="form-footer-right">
            <p-button type="submit" [loading]="isSaving"
                      [label]="editingId ? 'Guardar cambios' : 'Crear residente'"
                      [rounded]="true" icon="pi pi-check">
            </p-button>
          </div>
        </section>

      </form>

      <p class="app-state" *ngIf="loading">Cargando residentes...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay residentes cargados.</p>

      <div class="resident-list" *ngIf="items.length">
        <article class="resident-card" *ngFor="let item of items">
          <div class="avatar">{{ initials(item.fullName) }}</div>
          <div>
            <strong>{{ item.fullName }}</strong>
            <span>{{ item.email }}</span>
            <small>{{ item.isOwner ? 'Propietario' : 'Inquilino' }} · {{ item.phoneNumber }}</small>
            <small class="linked-badge" *ngIf="item.hasLinkedAccount" pTooltip="Este residente tiene una cuenta de acceso vinculada (puede ser un propietario u otro usuario del sistema)">
              <i class="pi pi-link"></i> Vinculado a cuenta de acceso
            </small>
          </div>
          <div class="app-actions" *ngIf="!isReadOnly">
            <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" (onClick)="startEdit(item)"></p-button>
            <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSaving" (onClick)="deleteResident(item)"></p-button>
          </div>
        </article>
      </div>
    </p-card>
  `,
  styles: [`
    /* ── Formulario ──────────────────────────────────── */
    .create-form {
      display:flex; flex-direction:column; gap:2rem;
      margin-top:1.5rem; padding:1.5rem;
      background:rgba(19,133,182,0.025);
      border-radius:18px; border:1px solid rgba(19,133,182,0.1);
    }
    .form-section { display:flex; flex-direction:column; gap:1.1rem; }
    .section-title {
      font-size:0.82rem; font-weight:700; text-transform:uppercase;
      letter-spacing:0.07em; color:var(--brand-muted);
      margin:0 0 0.1rem; padding-bottom:0.5rem;
      border-bottom:1px solid rgba(19,133,182,0.1);
    }
    .field { display:flex; flex-direction:column; gap:0.4rem; }
    .field label { font-weight:500; font-size:0.92rem; color:var(--brand-ink); }
    .field-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    .field input, .field select {
      width:100%; padding:0.6rem 0.85rem;
      border:1px solid rgba(19,133,182,0.25);
      border-radius:10px; font:inherit; font-size:0.95rem;
      color:var(--brand-ink); background:#fff;
      transition:border-color 0.15s, box-shadow 0.15s; box-sizing:border-box;
    }
    .field input:focus, .field select:focus {
      outline:none; border-color:var(--brand-blue);
      box-shadow:0 0 0 3px rgba(19,133,182,0.12);
    }
    .field-hint { color:var(--brand-muted); font-size:0.8rem; line-height:1.4; }
    .required { color:#e74c3c; font-weight:600; }
    .check-row { display:flex; gap:2rem; flex-wrap:wrap; }
    .checkbox-label { display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:500; font-size:0.92rem; }
    .checkbox-label input[type=checkbox] { width:16px; height:16px; cursor:pointer; accent-color:var(--brand-blue); }
    .form-footer {
      display:flex; justify-content:space-between; align-items:center;
      padding-top:0.75rem; border-top:1px solid rgba(19,133,182,0.08);
    }
    .form-footer-right { display:flex; gap:0.75rem; }

    /* ── Lista de residentes ─────────────────────────── */
    .resident-list { display:grid; gap:0.85rem; }
    .resident-card {
      display:grid; grid-template-columns:auto 1fr auto;
      gap:0.9rem; align-items:center; padding:1rem;
      border-radius:18px; background:#f8fbfa;
    }
    .avatar {
      width:48px; height:48px; border-radius:14px;
      display:grid; place-items:center;
      background:linear-gradient(145deg, #2bc8b3, #10756e);
      color:white; font-weight:800;
    }
    .resident-card strong, .resident-card span, .resident-card small { display:block; }
    .resident-card strong { color:#15373d; }
    .resident-card span, .resident-card small { color:#6b878d; }
    .linked-badge {
      display:inline-flex !important; align-items:center; gap:0.3rem; width:fit-content;
      margin-top:0.2rem; padding:0.1rem 0.5rem; border-radius:20px;
      background:rgba(16,117,110,0.1); color:#10756e; font-weight:600; font-size:0.72rem;
    }
    .linked-badge i { font-size:0.68rem; }

    @media (max-width: 860px) {
      .field-row { grid-template-columns:1fr; }
      .resident-card { grid-template-columns:1fr; }
    }
  `]
})
export class ResidentsPageComponent implements OnInit {
  private readonly residentsApi = inject(ResidentsApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  items: Resident[] = [];
  companies: Company[] = [];
  loading = true;
  isSaving = false;
  showForm = false;
  editingId: string | null = null;
  form = this.createInitialForm();

  get isSuperAdmin(): boolean {
    return this.auth.hasRole('SuperAdmin');
  }

  get isReadOnly(): boolean {
    return this.auth.hasRole('CompanyAdmin');
  }

  ngOnInit(): void {
    this.loadResidents();
  }

  toggleForm(): void {
    if (this.showForm && this.editingId) {
      this.cancelEdit();
      return;
    }

    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.form = this.createInitialForm();
    }
  }

  startEdit(item: Resident): void {
    this.editingId = item.id;
    this.showForm = true;
    this.form = {
      companyId: '',
      fullName: item.fullName,
      documentType: item.documentType || '',
      documentNumber: item.documentNumber,
      email: item.email,
      phoneNumber: item.phoneNumber,
      isOwner: item.isOwner,
      isActive: item.isActive
    };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.showForm = false;
    this.form = this.createInitialForm();
  }

  submitResident(): void {
    const request = {
      companyId: this.form.companyId || null,
      fullName: this.form.fullName.trim(),
      documentType: this.form.documentType || null,
      documentNumber: this.form.documentNumber.trim(),
      email: this.form.email.trim().toLowerCase(),
      phoneNumber: this.form.phoneNumber.trim(),
      isOwner: this.form.isOwner,
      isActive: this.form.isActive
    };

    const validationError = this.validateForm(request);
    if (validationError) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: validationError, life: 5000 });
      return;
    }

    this.isSaving = true;

    const operation = this.editingId
      ? this.residentsApi.update(this.editingId, request)
      : this.residentsApi.create(request);

    operation
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resident) => {
          this.items = this.editingId
            ? this.items.map((item) => item.id === resident.id ? resident : item).sort((a, b) => a.fullName.localeCompare(b.fullName))
            : [...this.items, resident].sort((a, b) => a.fullName.localeCompare(b.fullName));
          this.form = this.createInitialForm();
          this.isSaving = false;
          this.showForm = false;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: this.editingId ? 'Residente actualizado correctamente.' : 'Residente creado correctamente.', life: 4000 });
          this.editingId = null;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(
            error,
            this.editingId ? 'No se pudo actualizar el residente.' : 'No se pudo guardar el residente.'
          ), life: 5000 });
          this.isSaving = false;
          this.cdr.markForCheck();
        }
      });
  }

  deleteResident(item: Resident): void {
    this.isSaving = true;

    this.residentsApi
      .delete(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items = this.items.filter((current) => current.id !== item.id);
          if (this.editingId === item.id) {
            this.cancelEdit();
          }
          this.isSaving = false;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Residente eliminado correctamente.', life: 4000 });
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo eliminar el residente.'), life: 5000 });
          this.isSaving = false;
          this.cdr.markForCheck();
        }
      });
  }

  initials(fullName: string): string {
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  private loadResidents(): void {
    if (this.isSuperAdmin) {
      this.companiesApi
        .getAll()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (items) => {
            this.companies = items;
            this.cdr.markForCheck();
          }
        });
    }

    this.residentsApi
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items = items;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el listado de residentes.'), life: 5000 });
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private createInitialForm() {
    return {
      companyId: '',
      fullName: '',
      documentType: '',
      documentNumber: '',
      email: '',
      phoneNumber: '',
      isOwner: true,
      isActive: true
    };
  }


  private validateForm(form: {
    companyId: string | null;
    fullName: string;
    documentNumber: string;
    email: string;
    phoneNumber: string;
  }): string | null {
    if (this.isSuperAdmin && !form.companyId) {
      return 'La empresa es obligatoria.';
    }

    if (!form.fullName) {
      return 'El nombre completo es obligatorio.';
    }

    if (!form.documentNumber) {
      return 'El documento es obligatorio.';
    }

    if (!/^[A-Za-z0-9.-]+$/.test(form.documentNumber)) {
      return 'El documento solo puede contener letras, numeros, puntos o guiones.';
    }

    if (!form.email) {
      return 'El correo es obligatorio.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return 'El correo no tiene un formato valido.';
    }

    if (!form.phoneNumber) {
      return 'El telefono es obligatorio.';
    }

    if (!/^[0-9+()\-\s]{6,20}$/.test(form.phoneNumber)) {
      return 'El telefono solo puede contener numeros, espacios, parentesis, mas o guiones.';
    }

    return null;
  }
}
