import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { CompaniesApiService } from '../../api/companies-api.service';
import { UsersApiService } from '../../api/users-api.service';
import { Building, Company, ManagedUser } from '../../api/models';
import { AuthService } from '../../auth/auth.service';
import { roleLabel, roleOptions } from '../../auth/role-labels';

@Component({
  standalone: true,
  selector: 'app-users-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Usuarios</h1>
            <p>Alta de usuarios con clave inicial 123456 y acceso por alcance.</p>
          </div>
        </div>
        <p-button label="Nuevo usuario" icon="pi pi-plus" (onClick)="openCreate()"></p-button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando usuarios...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay usuarios creados.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header" [class.usr-grid-sa]="isSuperAdmin" [class.usr-grid]="!isSuperAdmin">
          <span *ngIf="isSuperAdmin">Empresa</span>
          <span>Nombre</span>
          <span>Correo</span>
          <span>Rol</span>
          <span>Estado</span>
        </div>
        <div class="app-row" [class.usr-grid-sa]="isSuperAdmin" [class.usr-grid]="!isSuperAdmin"
             *ngFor="let item of items">
          <span *ngIf="isSuperAdmin" class="company-label">{{ companyName(item.companyId) }}</span>
          <button class="row-link" (click)="openFicha(item)">{{ item.fullName }}</button>
          <span>{{ item.email }}</span>
          <span>{{ roleLabel(item.role) }}</span>
          <p-tag [value]="item.isActive ? 'Activo' : 'Inactivo'" [severity]="item.isActive ? 'success' : 'secondary'"></p-tag>
        </div>
      </div>
    </p-card>

    <!-- BACKDROP -->
    <div class="ov-backdrop" *ngIf="dialogVisible" (click)="closeDialog()"></div>

    <!-- FICHA -->
    <div class="ov-panel" *ngIf="dialogVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>{{ selected ? selected.fullName : 'Nuevo usuario' }}</strong>
        <button class="ov-close" (click)="closeDialog()">✕</button>
      </div>

      <p-message *ngIf="dialogError" severity="error" [text]="dialogError"></p-message>
      <p-message *ngIf="dialogSuccess" severity="success" [text]="dialogSuccess"></p-message>

      <form class="ficha-form" (ngSubmit)="save()">
        <label *ngIf="isSuperAdmin">
          <span>Empresa</span>
          <select [(ngModel)]="form.companyId" name="companyId" required>
            <option value="" disabled>Selecciona una empresa</option>
            <option *ngFor="let c of companies" [value]="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label>
          <span>Nombre completo</span>
          <input [(ngModel)]="form.fullName" name="fullName" required maxlength="160" />
        </label>
        <label>
          <span>Correo</span>
          <input [(ngModel)]="form.email" name="email" type="email" required maxlength="160" />
        </label>
        <label>
          <span>Rol</span>
          <select [(ngModel)]="form.role" name="role" required>
            <option *ngFor="let r of availableRoles" [value]="r.value">{{ r.label }}</option>
          </select>
        </label>
        <label class="checkbox">
          <input [(ngModel)]="form.isActive" name="isActive" type="checkbox" />
          <span>Usuario activo</span>
        </label>
        <div class="access-box" *ngIf="requiresBuildingAccess()">
          <strong>Acceso por edificio</strong>
          <p>El usuario solo vera los edificios habilitados aqui.</p>
          <div class="building-list">
            <label class="building-check" *ngFor="let b of visibleBuildings">
              <input type="checkbox"
                     [checked]="form.buildingIds.includes(b.id)"
                     (change)="toggleBuilding(b.id, $any($event.target).checked)" />
              <span>{{ b.name }}</span>
            </label>
          </div>
        </div>
        <div class="ficha-footer">
          <p-button type="submit" [loading]="isSaving" [label]="selected ? 'Guardar cambios' : 'Crear usuario'"></p-button>
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
        ¿Eliminar al usuario <strong>{{ selected?.fullName }}</strong> de forma permanente?
        Esta accion no se puede deshacer.
      </p>
      <p-message *ngIf="dialogError" severity="error" [text]="dialogError"></p-message>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDelete()"></p-button>
        <p-button label="Eliminar definitivamente" severity="danger" [loading]="isDeleting" (onClick)="confirmDelete()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .usr-grid    { grid-template-columns: 1.2fr 1.3fr 0.9fr 0.7fr; }
    .usr-grid-sa { grid-template-columns: 0.9fr 1.2fr 1.3fr 0.9fr 0.7fr; }
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
      width: min(580px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
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
    .access-box { display: grid; gap: 0.5rem; padding: 1rem; border-radius: 18px; background: #f8fbfa; border: 1px solid #d7e5e1; }
    .access-box strong { color: #173a40; }
    .access-box p { margin: 0; color: #69848a; }
    .building-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; }
    .building-check { display: flex; align-items: center; gap: 0.65rem; padding: 0.75rem 0.9rem; border-radius: 14px; background: white; border: 1px solid #e3eeeb; }
    .building-check input { width: auto; }
  `]
})
export class UsersPageComponent implements OnInit {
  private readonly usersApi = inject(UsersApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  items: ManagedUser[] = [];
  companies: Company[] = [];
  buildings: Building[] = [];
  loading = true;
  pageError = '';
  dialogVisible = false;
  confirmVisible = false;
  selected: ManagedUser | null = null;
  form = this.emptyForm();
  isSaving = false;
  isDeleting = false;
  dialogError = '';
  dialogSuccess = '';
  readonly roleLabel = roleLabel;

  get isSuperAdmin(): boolean { return this.auth.hasRole('SuperAdmin'); }
  get availableRoles() { return roleOptions(this.isSuperAdmin); }
  get visibleBuildings(): Building[] {
    return this.isSuperAdmin && this.form.companyId
      ? this.buildings.filter(b => b.companyId === this.form.companyId)
      : this.buildings;
  }

  companyName(id: string | null): string {
    if (!id) return '—';
    return this.companies.find(c => c.id === id)?.name ?? '—';
  }

  requiresBuildingAccess(): boolean {
    return this.form.role === 'CompanyOperator' || this.form.role === 'BuildingManager';
  }

  toggleBuilding(id: string, checked: boolean): void {
    this.form.buildingIds = checked
      ? [...this.form.buildingIds, id]
      : this.form.buildingIds.filter(x => x !== id);
  }

  ngOnInit(): void {
    forkJoin({
      users: this.usersApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      companies: this.isSuperAdmin ? this.companiesApi.getAll() : of([] as Company[])
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ users, buildings, companies }) => {
        this.items = users.sort((a, b) => a.fullName.localeCompare(b.fullName));
        this.buildings = buildings;
        this.companies = companies ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => { this.pageError = extractApiErrorMessage(err, 'No se pudieron cargar los usuarios.'); this.loading = false; this.cdr.markForCheck(); }
    });
  }

  openCreate(): void {
    this.selected = null; this.form = this.emptyForm();
    this.dialogError = ''; this.dialogSuccess = ''; this.dialogVisible = true;
  }

  openFicha(item: ManagedUser): void {
    this.selected = item;
    this.form = { companyId: item.companyId ?? '', fullName: item.fullName,
                  email: item.email, role: item.role, isActive: item.isActive,
                  buildingIds: [...item.buildingIds] };
    this.dialogError = ''; this.dialogSuccess = ''; this.dialogVisible = true;
  }

  closeDialog(): void { this.dialogVisible = false; this.confirmVisible = false; this.selected = null; }

  save(): void {
    this.dialogError = ''; this.dialogSuccess = '';
    const req = {
      companyId: this.form.companyId || null,
      fullName: this.form.fullName.trim(),
      email: this.form.email.trim().toLowerCase(),
      role: this.form.role, isActive: this.form.isActive,
      buildingIds: [...new Set(this.form.buildingIds)],
      password: this.selected ? '' : '123456'
    };
    if (this.isSuperAdmin && !req.companyId) { this.dialogError = 'La empresa es obligatoria.'; return; }
    if (!req.fullName) { this.dialogError = 'El nombre es obligatorio.'; return; }
    if (!req.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.email)) { this.dialogError = 'Correo invalido.'; return; }
    if (!req.role) { this.dialogError = 'El rol es obligatorio.'; return; }
    if ((req.role === 'CompanyOperator' || req.role === 'BuildingManager') && req.buildingIds.length === 0) {
      this.dialogError = 'Debes asignar al menos un edificio para ese rol.'; return;
    }

    this.isSaving = true;
    const op = this.selected ? this.usersApi.update(this.selected.id, req) : this.usersApi.create(req);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: item => {
        this.items = this.selected
          ? this.items.map(x => x.id === item.id ? item : x).sort((a, b) => a.fullName.localeCompare(b.fullName))
          : [...this.items, item].sort((a, b) => a.fullName.localeCompare(b.fullName));
        this.isSaving = false;
        this.dialogSuccess = this.selected ? 'Usuario actualizado.' : 'Usuario creado. Clave inicial: 123456';
        this.selected = item;
        this.cdr.markForCheck();
      },
      error: err => { this.dialogError = extractApiErrorMessage(err, 'No se pudo guardar.'); this.isSaving = false; this.cdr.markForCheck(); }
    });
  }

  askDelete(): void { this.confirmVisible = true; }
  cancelDelete(): void { this.confirmVisible = false; }

  confirmDelete(): void {
    if (!this.selected) return;
    this.isDeleting = true;
    this.usersApi.delete(this.selected.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter(x => x.id !== this.selected!.id);
        this.isDeleting = false; this.confirmVisible = false; this.dialogVisible = false; this.selected = null;
        this.cdr.markForCheck();
      },
      error: err => { this.dialogError = extractApiErrorMessage(err, 'No se pudo eliminar.'); this.isDeleting = false; this.confirmVisible = false; this.cdr.markForCheck(); }
    });
  }

  private emptyForm() {
    return { companyId: '', fullName: '', email: '',
             role: roleOptions(this.isSuperAdmin)[0]?.value ?? 'CompanyOperator',
             isActive: true, buildingIds: [] as string[] };
  }
}
