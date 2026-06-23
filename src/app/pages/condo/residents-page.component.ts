import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { CompaniesApiService } from '../../api/companies-api.service';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { Company, Resident } from '../../api/models';
import { ResidentsApiService } from '../../api/residents-api.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-residents-page',
  imports: [CommonModule, FormsModule, Button, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Residentes</h1>
            <p>Propietarios e inquilinos registrados para la operacion inicial.</p>
          </div>
        </div>

        <p-button
          *ngIf="!isReadOnly"
          [label]="showForm ? 'Cerrar formulario' : 'Nuevo residente'"
          [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
          (onClick)="toggleForm()">
        </p-button>
      </div>

      <form class="app-form-grid" *ngIf="showForm" (ngSubmit)="submitResident()">
        <label *ngIf="isSuperAdmin">
          <span>Empresa</span>
          <select [(ngModel)]="form.companyId" name="companyId" required>
            <option value="" disabled>Selecciona una empresa</option>
            <option *ngFor="let company of companies" [value]="company.id">{{ company.name }}</option>
          </select>
        </label>

        <label>
          <span>Nombre completo</span>
          <input [(ngModel)]="form.fullName" name="fullName" type="text" required maxlength="160" />
        </label>

        <label>
          <span>Documento</span>
          <input [(ngModel)]="form.documentNumber" name="documentNumber" type="text" required maxlength="40" />
          <small>Usa letras, numeros, puntos o guiones.</small>
        </label>

        <label>
          <span>Correo</span>
          <input [(ngModel)]="form.email" name="email" type="email" required maxlength="160" />
        </label>

        <label>
          <span>Telefono</span>
          <input [(ngModel)]="form.phoneNumber" name="phoneNumber" type="text" required maxlength="20" />
          <small>Usa numeros y, si hace falta, + ( ) o guiones.</small>
        </label>

        <label class="checkbox">
          <input [(ngModel)]="form.isOwner" name="isOwner" type="checkbox" />
          <span>Es propietario</span>
        </label>

        <label class="checkbox">
          <input [(ngModel)]="form.isActive" name="isActive" type="checkbox" />
          <span>Residente activo</span>
        </label>

        <div class="wide form-actions">
          <p-button type="submit" [loading]="isSaving" [label]="editingId ? 'Guardar cambios' : 'Guardar residente'"></p-button>
          <p-button
            *ngIf="editingId"
            type="button"
            label="Cancelar"
            icon="pi pi-times"
            severity="secondary"
            [text]="true"
            (onClick)="cancelEdit()">
          </p-button>
        </div>
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
    .form-actions { display:flex; gap:0.75rem; justify-content:flex-end; }
    .resident-list { display:grid; gap:0.85rem; }
    .resident-card { display:grid; grid-template-columns:auto 1fr auto; gap:0.9rem; align-items:center; padding:1rem; border-radius:18px; background:#f8fbfa; }
    .avatar { width:48px; height:48px; border-radius:14px; display:grid; place-items:center; background:linear-gradient(145deg, #2bc8b3, #10756e); color:white; font-weight:800; }
    .resident-card strong, .resident-card span, .resident-card small { display:block; }
    .resident-card strong { color:#15373d; }
    .resident-card span, .resident-card small { color:#6b878d; }
    @media (max-width: 860px) { .resident-card { grid-template-columns: 1fr; } }
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
