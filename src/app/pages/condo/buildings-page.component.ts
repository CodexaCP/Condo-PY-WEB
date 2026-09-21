import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { CompaniesApiService } from '../../api/companies-api.service';
import { CondominiumsApiService } from '../../api/condominiums-api.service';
import { Building, Company, Condominium, LateFeeFrequency } from '../../api/models';
import { AuthService } from '../../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-buildings-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Edificios</h1>
            <p>Gestion de edificios, con condominio opcional y alcance por empresa.</p>
          </div>
        </div>
        <p-button *ngIf="canCreate" label="Nuevo edificio" icon="pi pi-plus" (onClick)="goToCreate()"></p-button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando edificios...</p>
      <p class="app-state" *ngIf="!loading && !pageError && !items.length">No hay edificios cargados.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header" [class.bld-grid-sa]="isSuperAdmin" [class.bld-grid]="!isSuperAdmin">
          <span *ngIf="isSuperAdmin">Empresa</span>
          <span>Nombre</span>
          <span>Codigo</span>
          <span>Condominio</span>
          <span>Direccion</span>
          <span>Estado</span>
        </div>
        <div class="app-row" [class.bld-grid-sa]="isSuperAdmin" [class.bld-grid]="!isSuperAdmin"
             *ngFor="let item of items">
          <span *ngIf="isSuperAdmin" class="company-label">{{ companyName(item.companyId) }}</span>
          <button class="row-link" (click)="goToEdit(item.id)">{{ item.name }}</button>
          <span>{{ item.code }}</span>
          <span>{{ item.condominiumName || 'Directo' }}</span>
          <span>{{ item.address }}</span>
          <p-tag [value]="item.isActive ? 'Activo' : 'Inactivo'" [severity]="item.isActive ? 'success' : 'secondary'"></p-tag>
        </div>
      </div>
    </p-card>

    <!-- BACKDROP -->
    <div class="ov-backdrop" *ngIf="dialogVisible" (click)="closeDialog()"></div>

    <!-- FICHA -->
    <div class="ov-panel" *ngIf="dialogVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>{{ selected ? selected.name : 'Nuevo edificio' }}</strong>
        <button class="ov-close" (click)="closeDialog()">✕</button>
      </div>

      <form class="ficha-form" (ngSubmit)="save()">
        <label *ngIf="isSuperAdmin">
          <span>Empresa</span>
          <select [(ngModel)]="form.companyId" name="companyId" required>
            <option value="" disabled>Selecciona una empresa</option>
            <option *ngFor="let c of companies" [value]="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label *ngIf="availableCondominiums.length">
          <span>Condominio <small>(opcional)</small></span>
          <select [(ngModel)]="form.condominiumId" name="condominiumId">
            <option value="">Sin condominio</option>
            <option *ngFor="let c of availableCondominiums" [value]="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label>
          <span>Nombre</span>
          <input [(ngModel)]="form.name" name="name" required maxlength="120" />
        </label>
        <label>
          <span>Codigo</span>
          <input [(ngModel)]="form.code" name="code" required maxlength="40" />
          <small>Solo letras mayusculas, numeros y guiones medios.</small>
        </label>
        <label>
          <span>Direccion</span>
          <input [(ngModel)]="form.address" name="address" required maxlength="200" />
        </label>
        <label>
          <span>Tasa de interés por mora (%) <small>(opcional)</small></span>
          <input [(ngModel)]="form.lateFeeRatePercentage" name="lateFeeRatePercentage"
                 type="number" min="0" max="100" step="0.01" placeholder="Ej: 2" />
          <small>Interés simple sobre la expensa original vencida. Vacío = sin mora.</small>
        </label>
        <label *ngIf="form.lateFeeRatePercentage">
          <span>Incremento de la mora</span>
          <select [(ngModel)]="form.lateFeeFrequency" name="lateFeeFrequency">
            <option value="" disabled>— Seleccionar —</option>
            <option value="Daily">Diario</option>
            <option value="Weekly">Semanal</option>
            <option value="Biweekly">Quincenal</option>
          </select>
          <small>Cada intervalo suma la tasa sobre el monto original adeudado. Al cambiar la config se notifica a todos los miembros del edificio.</small>
        </label>
        <label class="checkbox">
          <input [(ngModel)]="form.isActive" name="isActive" type="checkbox" />
          <span>Edificio activo</span>
        </label>
        <label class="checkbox">
          <input [(ngModel)]="form.blockOverdueAmenityReservations" name="blockOverdueAmenityReservations" type="checkbox" />
          <span>Bloquear reservas de amenities a unidades en mora</span>
        </label>
        <div class="ficha-footer">
          <p-button type="submit" [loading]="isSaving" [label]="selected ? 'Guardar cambios' : 'Crear edificio'"></p-button>
          <p-button *ngIf="selected" type="button" label="Eliminar" severity="danger"
                    [outlined]="true" (onClick)="askDelete()"></p-button>
        </div>
      </form>
    </div>

    <!-- BACKDROP CONFIRM -->
    <div class="ov-backdrop ov-backdrop-top" *ngIf="confirmVisible" (click)="cancelDelete()"></div>

    <!-- CONFIRM -->
    <div class="ov-panel ov-panel-sm" *ngIf="confirmVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Confirmar eliminacion</strong>
        <button class="ov-close" (click)="cancelDelete()">✕</button>
      </div>
      <p class="confirm-text">
        ¿Eliminar el edificio <strong>{{ selected?.name }}</strong> de forma permanente?
        Esta accion no se puede deshacer.
      </p>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDelete()"></p-button>
        <p-button label="Eliminar definitivamente" severity="danger" [loading]="isDeleting" (onClick)="confirmDelete()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .bld-grid    { grid-template-columns: 1.1fr 0.7fr 1fr 1.2fr 0.7fr; }
    .bld-grid-sa { grid-template-columns: 0.9fr 1.1fr 0.7fr 1fr 1.2fr 0.7fr; }
    .company-label { color: var(--brand-blue); font-weight: 600; font-size: 0.88rem; }
    .row-link { background: none; border: none; padding: 0; font: inherit; font-weight: 700;
                color: var(--brand-blue); cursor: pointer; text-align: left; text-decoration: underline dotted; }
    .row-link:hover { color: var(--brand-ink); }
    .ov-backdrop {
      position: fixed; inset: 0; background: rgba(15,35,50,0.45);
      z-index: 1000; backdrop-filter: blur(2px); animation: fadeIn 0.15s ease;
    }
    .ov-backdrop-top { z-index: 1002; }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(560px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28);
      padding: 1.6rem; animation: slideUp 0.2s cubic-bezier(.4,0,.2,1);
    }
    .ov-panel-sm { width: min(420px, calc(100vw - 2rem)); z-index: 1003; }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)); }
                         to   { opacity: 1; transform: translate(-50%, -50%); } }
    .ov-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.2rem; padding-bottom: 1rem;
      border-bottom: 1px solid rgba(19,133,182,0.1);
    }
    .ov-header strong { font-size: 1.2rem; color: var(--brand-ink); }
    .ov-close {
      background: none; border: none; cursor: pointer; font-size: 1.1rem;
      color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%;
      display: grid; place-items: center; transition: background 0.15s;
    }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }
    .ficha-form { display: grid; gap: 1rem; }
    .ficha-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; }
    .confirm-text { margin: 0 0 1.2rem; color: var(--brand-ink); line-height: 1.6; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
  `]
})
export class BuildingsPageComponent implements OnInit {
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly condominiumsApi = inject(CondominiumsApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  items: Building[] = [];
  companies: Company[] = [];
  condominiums: Condominium[] = [];
  loading = true;
  pageError = '';
  dialogVisible = false;
  confirmVisible = false;
  selected: Building | null = null;
  form = this.emptyForm();
  isSaving = false;
  isDeleting = false;

  get isSuperAdmin(): boolean { return this.auth.hasRole('SuperAdmin'); }

  // Por ahora solo el administrador de empresa (y el superadmin) crea edificios; el encargado no ve el botón.
  get canCreate(): boolean { return this.auth.hasRole('SuperAdmin', 'CompanyAdmin'); }

  get availableCondominiums(): Condominium[] {
    if (this.isSuperAdmin && this.form.companyId) {
      return this.condominiums.filter(x => x.companyId === this.form.companyId || !x.companyId);
    }
    return this.condominiums;
  }

  companyName(id: string): string { return this.companies.find(c => c.id === id)?.name ?? '—'; }

  ngOnInit(): void {
    forkJoin({
      buildings: this.buildingsApi.getAll(),
      companies: this.isSuperAdmin ? this.companiesApi.getAll() : of([] as Company[]),
      condominiums: this.condominiumsApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ buildings, companies, condominiums }) => {
        this.items = buildings.sort((a, b) => a.name.localeCompare(b.name));
        this.companies = companies;
        this.condominiums = condominiums;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.pageError = 'No se pudo cargar el listado de edificios.'; this.loading = false; this.cdr.markForCheck(); }
    });
  }

  goToCreate(): void { this.router.navigate(['/buildings/create']); }
  goToEdit(id: string): void { this.router.navigate(['/buildings', id]); }

  openCreate(): void {
    this.selected = null; this.form = this.emptyForm();
    this.dialogVisible = true;
  }

  openFicha(item: Building): void {
    this.selected = item;
    this.form = { companyId: item.companyId ?? '', condominiumId: item.condominiumId ?? '',
                  name: item.name, code: item.code, address: item.address, isActive: item.isActive,
                  lateFeeRatePercentage: item.lateFeeRatePercentage ?? null,
                  lateFeeFrequency: item.lateFeeFrequency ?? '',
                  blockOverdueAmenityReservations: item.blockOverdueAmenityReservations ?? false };
    this.dialogVisible = true;
  }

  closeDialog(): void { this.dialogVisible = false; this.confirmVisible = false; this.selected = null; }

  save(): void {
    const req = {
      companyId: this.form.companyId || null, condominiumId: this.form.condominiumId || null,
      name: this.form.name.trim(), code: this.form.code.trim().toUpperCase(),
      address: this.form.address.trim(), isActive: this.form.isActive,
      lateFeeRatePercentage: this.form.lateFeeRatePercentage || null,
      lateFeeFrequency: (this.form.lateFeeRatePercentage && this.form.lateFeeFrequency) ? this.form.lateFeeFrequency : null,
      blockOverdueAmenityReservations: this.form.blockOverdueAmenityReservations
    };
    if (req.lateFeeRatePercentage && !req.lateFeeFrequency) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Definí el incremento de la mora (diario, semanal o quincenal).', life: 5000 }); return;
    }
    if (this.isSuperAdmin && !req.companyId) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'La empresa es obligatoria.', life: 5000 }); return; }
    if (!req.name) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El nombre es obligatorio.', life: 5000 }); return; }
    if (!req.code) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El codigo es obligatorio.', life: 5000 }); return; }
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(req.code)) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Codigo invalido.', life: 5000 }); return; }
    if (!req.address) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'La direccion es obligatoria.', life: 5000 }); return; }

    this.isSaving = true;
    const op = this.selected ? this.buildingsApi.update(this.selected.id, req) : this.buildingsApi.create(req);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: item => {
        this.items = this.selected
          ? this.items.map(x => x.id === item.id ? item : x).sort((a, b) => a.name.localeCompare(b.name))
          : [...this.items, item].sort((a, b) => a.name.localeCompare(b.name));
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: this.selected ? 'Edificio actualizado.' : 'Edificio creado.', life: 4000 });
        this.selected = item;
        this.cdr.markForCheck();
      },
      error: err => { this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar.'), life: 5000 }); this.isSaving = false; this.cdr.markForCheck(); }
    });
  }

  askDelete(): void { this.confirmVisible = true; }
  cancelDelete(): void { this.confirmVisible = false; }

  confirmDelete(): void {
    if (!this.selected) return;
    this.isDeleting = true;
    this.buildingsApi.delete(this.selected.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter(x => x.id !== this.selected!.id);
        this.isDeleting = false; this.confirmVisible = false; this.dialogVisible = false; this.selected = null;
        this.cdr.markForCheck();
      },
      error: err => { this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo eliminar.'), life: 5000 }); this.isDeleting = false; this.confirmVisible = false; this.cdr.markForCheck(); }
    });
  }

  private emptyForm() {
    return { companyId: '', condominiumId: '', name: '', code: '', address: '', isActive: true,
             lateFeeRatePercentage: null as number | null, lateFeeFrequency: '' as '' | LateFeeFrequency,
             blockOverdueAmenityReservations: false };
  }
}
