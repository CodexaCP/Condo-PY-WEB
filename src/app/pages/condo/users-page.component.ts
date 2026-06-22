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
import { CondominiumsApiService } from '../../api/condominiums-api.service';
import { UsersApiService } from '../../api/users-api.service';
import { Building, Company, Condominium, ManagedUser } from '../../api/models';
import { AuthService } from '../../auth/auth.service';
import { roleLabel, roleOptions } from '../../auth/role-labels';

type PanelMode = 'ficha' | 'form';

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
            <p>Gestión de usuarios con clave inicial 123456 y acceso por alcance.</p>
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
          <p-tag [value]="item.isActive ? 'Activo' : 'Inactivo'"
                 [severity]="item.isActive ? 'success' : 'secondary'"></p-tag>
        </div>
      </div>
    </p-card>

    <!-- BACKDROP -->
    <div class="ov-backdrop" *ngIf="panelMode" (click)="closePanel()"></div>

    <!-- ══════ FICHA (vista de solo lectura) ══════ -->
    <div class="ov-panel" *ngIf="panelMode === 'ficha' && selected" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Detalle de usuario</strong>
        <button class="ov-close" (click)="closePanel()">✕</button>
      </div>

      <!-- Avatar + nombre -->
      <div class="ficha-hero">
        <div class="ficha-avatar">{{ userInitials(selected.fullName) }}</div>
        <div class="ficha-hero-info">
          <h2 class="ficha-name">{{ selected.fullName }}</h2>
          <p class="ficha-email">{{ selected.email }}</p>
          <div class="ficha-badges">
            <p-tag [value]="roleLabel(selected.role)" severity="info"></p-tag>
            <p-tag [value]="selected.isActive ? 'Activo' : 'Inactivo'"
                   [severity]="selected.isActive ? 'success' : 'secondary'"></p-tag>
          </div>
        </div>
      </div>

      <!-- Campos de detalle -->
      <div class="ficha-grid">
        <div class="ficha-field" *ngIf="isSuperAdmin && selected.companyId">
          <span class="ficha-label">Empresa</span>
          <span class="ficha-val scope-company">{{ companyName(selected.companyId) }}</span>
        </div>
        <div class="ficha-field" *ngIf="selected.condominiumId">
          <span class="ficha-label">Condominio</span>
          <span class="ficha-val scope-condo">{{ condominiumName(selected.condominiumId) }}</span>
        </div>
        <div class="ficha-field" *ngIf="selected.phonePrefix || selected.phone">
          <span class="ficha-label">Teléfono</span>
          <span class="ficha-val">{{ selected.phonePrefix }} {{ selected.phone }}</span>
        </div>
      </div>

      <!-- Edificios asignados -->
      <div class="ficha-buildings" *ngIf="selected.buildingIds?.length">
        <span class="ficha-label">Edificios asignados</span>
        <div class="building-chips">
          <span class="building-chip" *ngFor="let bid of selected.buildingIds">
            {{ buildingName(bid) }}
          </span>
        </div>
      </div>

      <!-- Descripción de alcance -->
      <div class="scope-info" [ngClass]="scopeClass(selected)">
        <i class="pi pi-shield"></i>
        <span>{{ scopeDescription(selected) }}</span>
      </div>

      <div class="ficha-footer">
        <p-button label="Editar" icon="pi pi-pencil" (onClick)="openEdit()"></p-button>
        <p-button label="Eliminar" severity="danger" [outlined]="true" (onClick)="askDelete()"></p-button>
      </div>
    </div>

    <!-- ══════ FORMULARIO (crear / editar) ══════ -->
    <div class="ov-panel" *ngIf="panelMode === 'form'" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <div class="ov-header-left">
          <button class="ov-back" *ngIf="selected" (click)="backToFicha()" title="Volver al detalle">
            <i class="pi pi-arrow-left"></i>
          </button>
          <strong>{{ selected ? 'Editar usuario' : 'Nuevo usuario' }}</strong>
        </div>
        <button class="ov-close" (click)="closePanel()">✕</button>
      </div>

      <p-message *ngIf="dialogError"   severity="error"   [text]="dialogError"></p-message>
      <p-message *ngIf="dialogSuccess" severity="success" [text]="dialogSuccess"></p-message>

      <form class="ficha-form" (ngSubmit)="save()">

        <!-- EMPRESA (solo SuperAdmin) -->
        <label *ngIf="isSuperAdmin">
          <span>Empresa <em>*</em></span>
          <select [(ngModel)]="form.companyId" name="companyId"
                  (ngModelChange)="onCompanyChange()" required>
            <option value="" disabled>Selecciona una empresa</option>
            <option *ngFor="let c of companies" [value]="c.id">{{ c.name }}</option>
          </select>
        </label>

        <!-- NOMBRE -->
        <label>
          <span>Nombre completo <em>*</em></span>
          <input [(ngModel)]="form.fullName" name="fullName" required
                 maxlength="160" placeholder="Ej. Juan Pérez García" />
        </label>

        <!-- EMAIL -->
        <label>
          <span>Correo electrónico <em>*</em></span>
          <input [(ngModel)]="form.email" name="email" type="email" required
                 maxlength="160" placeholder="usuario@ejemplo.com" />
        </label>

        <!-- TELÉFONO -->
        <div class="phone-row">
          <label>
            <span>Prefijo</span>
            <input [(ngModel)]="form.phonePrefix" name="phonePrefix"
                   maxlength="6" placeholder="+58" />
          </label>
          <label>
            <span>Teléfono</span>
            <input [(ngModel)]="form.phone" name="phone"
                   maxlength="20" placeholder="0412 555 6789" />
          </label>
        </div>

        <!-- ROL -->
        <label>
          <span>Rol <em>*</em></span>
          <select [(ngModel)]="form.role" name="role" required>
            <option *ngFor="let r of availableRoles" [value]="r.value">{{ r.label }}</option>
          </select>
        </label>

        <!-- ACTIVO -->
        <label class="checkbox">
          <input [(ngModel)]="form.isActive" name="isActive" type="checkbox" />
          <span>Usuario activo</span>
        </label>

        <!-- ── ALCANCE DE ACCESO ── -->
        <div class="scope-section">
          <div class="scope-title">
            <strong>Alcance de acceso</strong>
            <span class="scope-hint">Define qué puede ver el usuario al iniciar sesión</span>
          </div>

          <!-- Condominio (opcional) -->
          <div class="scope-block">
            <div class="scope-block-header">
              <i class="pi pi-building"></i>
              <div>
                <strong>Condominio <span class="opt-label">(opcional)</span></strong>
                <p>Al asignar un condominio, el usuario podrá ver y editar
                   todos los edificios de ese condominio.</p>
              </div>
            </div>
            <select [(ngModel)]="form.condominiumId" name="condominiumId"
                    (ngModelChange)="onCondominiumChange()">
              <option value="">Sin condominio asignado</option>
              <option *ngFor="let c of visibleCondominiums" [value]="c.id">{{ c.name }}</option>
            </select>
          </div>

          <!-- Edificios (requerido ≥ 1) -->
          <div class="scope-block required-scope">
            <div class="scope-block-header">
              <i class="pi pi-home"></i>
              <div>
                <strong>Edificios <em>*</em></strong>
                <p>Mínimo un edificio requerido. El usuario podrá ver, crear
                   y editar las unidades de los edificios seleccionados.</p>
              </div>
            </div>
            <div class="building-list" *ngIf="visibleBuildings.length; else noBuildings">
              <label class="building-check" *ngFor="let b of visibleBuildings">
                <input type="checkbox"
                       [checked]="form.buildingIds.includes(b.id)"
                       (change)="toggleBuilding(b.id, $any($event.target).checked)" />
                <span>{{ b.name }}</span>
              </label>
            </div>
            <ng-template #noBuildings>
              <p class="no-items-hint">
                {{ (isSuperAdmin && !form.companyId) ? 'Selecciona una empresa primero.' : 'No hay edificios disponibles.' }}
              </p>
            </ng-template>
          </div>
        </div>

        <div class="ficha-footer">
          <p-button type="submit" [loading]="isSaving"
                    [label]="selected ? 'Guardar cambios' : 'Crear usuario'"></p-button>
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
        <strong>Confirmar eliminación</strong>
        <button class="ov-close" (click)="cancelDelete()">✕</button>
      </div>
      <p class="confirm-text">
        ¿Eliminar al usuario <strong>{{ selected?.fullName }}</strong> de forma permanente?
        Esta acción no se puede deshacer.
      </p>
      <p-message *ngIf="dialogError" severity="error" [text]="dialogError"></p-message>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDelete()"></p-button>
        <p-button label="Eliminar definitivamente" severity="danger"
                  [loading]="isDeleting" (onClick)="confirmDelete()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .usr-grid    { grid-template-columns: 1.2fr 1.3fr 0.9fr 0.7fr; }
    .usr-grid-sa { grid-template-columns: 0.9fr 1.2fr 1.3fr 0.9fr 0.7fr; }
    .company-label { color: var(--brand-blue); font-weight: 600; font-size: 0.88rem; }
    .row-link {
      background: none; border: none; padding: 0; font: inherit; font-weight: 700;
      color: var(--brand-blue); cursor: pointer; text-align: left;
      text-decoration: underline dotted;
    }
    .row-link:hover { color: var(--brand-ink); }

    /* ── PANEL BASE ── */
    .ov-backdrop {
      position: fixed; inset: 0; background: rgba(15,35,50,0.45);
      z-index: 1000; backdrop-filter: blur(2px); animation: fadeIn 0.15s ease;
    }
    .ov-backdrop-top { z-index: 1002; }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(600px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28);
      padding: 1.6rem; animation: slideUp 0.2s cubic-bezier(.4,0,.2,1);
    }
    .ov-panel-sm { width: min(420px, calc(100vw - 2rem)); z-index: 1003; }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp {
      from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)); }
      to   { opacity: 1; transform: translate(-50%, -50%); }
    }
    .ov-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.4rem; padding-bottom: 1rem;
      border-bottom: 1px solid rgba(19,133,182,0.12);
    }
    .ov-header-left { display: flex; align-items: center; gap: 0.6rem; }
    .ov-header strong { font-size: 1.15rem; color: var(--brand-ink); }
    .ov-close {
      background: none; border: none; cursor: pointer; font-size: 1.1rem;
      color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%;
      display: grid; place-items: center; transition: background 0.15s;
    }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }
    .ov-back {
      background: none; border: 1px solid rgba(19,133,182,0.25); cursor: pointer;
      color: var(--brand-blue); width: 30px; height: 30px; border-radius: 50%;
      display: grid; place-items: center; transition: background 0.15s; font-size: 0.78rem;
    }
    .ov-back:hover { background: rgba(19,133,182,0.08); }

    /* ── FICHA HERO ── */
    .ficha-hero {
      display: flex; gap: 1.1rem; align-items: flex-start; margin-bottom: 1.2rem;
    }
    .ficha-avatar {
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-blue,#1385b6), #0a6fa8);
      color: #fff; font-size: 1.25rem; font-weight: 700;
      display: grid; place-items: center; flex-shrink: 0; letter-spacing: 1px;
    }
    .ficha-hero-info { flex: 1; }
    .ficha-name { margin: 0 0 0.2rem; font-size: 1.2rem; color: var(--brand-ink); font-weight: 700; }
    .ficha-email { margin: 0 0 0.6rem; color: var(--brand-muted); font-size: 0.88rem; }
    .ficha-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    /* ── FICHA DETAIL GRID ── */
    .ficha-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem; margin-bottom: 1rem;
    }
    .ficha-field { display: flex; flex-direction: column; gap: 0.2rem; }
    .ficha-label {
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--brand-muted);
    }
    .ficha-val { font-size: 0.95rem; color: var(--brand-ink); font-weight: 500; }
    .scope-company { color: #0052a3; }
    .scope-condo   { color: #6b5000; }

    /* ── BUILDING CHIPS ── */
    .ficha-buildings { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .building-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .building-chip {
      background: rgba(19,133,182,0.1); color: var(--brand-blue,#1385b6);
      border: 1px solid rgba(19,133,182,0.2); border-radius: 20px;
      padding: 0.25rem 0.8rem; font-size: 0.82rem; font-weight: 600;
    }

    /* ── SCOPE INFO BOX ── */
    .scope-info {
      display: flex; align-items: flex-start; gap: 0.65rem;
      padding: 0.9rem 1rem; border-radius: 14px; margin-bottom: 1.4rem;
      font-size: 0.875rem; line-height: 1.55;
    }
    .scope-info.scope-co  { background: #eaf3fc; color: #0052a3; border: 1px solid #c5ddf5; }
    .scope-info.scope-cnd { background: #fefce8; color: #7c6400; border: 1px solid #eedd88; }
    .scope-info.scope-bld { background: #f0faf4; color: #1a6b42; border: 1px solid #b8e4cc; }

    /* ── FORM ── */
    .ficha-form { display: grid; gap: 1rem; }
    .phone-row { display: grid; grid-template-columns: 110px 1fr; gap: 0.75rem; }
    em { color: #dc2626; font-style: normal; }
    .opt-label { color: var(--brand-muted); font-weight: 400; font-size: 0.85em; }

    /* ── SCOPE SECTION ── */
    .scope-section { display: grid; gap: 0.75rem; }
    .scope-title { display: flex; flex-direction: column; gap: 0.15rem; margin-bottom: 0.1rem; }
    .scope-title strong { color: var(--brand-ink); font-size: 0.95rem; }
    .scope-hint { font-size: 0.82rem; color: var(--brand-muted); }
    .scope-block {
      display: grid; gap: 0.6rem; padding: 1rem 1rem 1rem;
      border-radius: 16px; background: #f8fbfa; border: 1px solid #d7e5e1;
    }
    .required-scope { border-color: rgba(19,133,182,0.22); background: #f4f9fd; }
    .scope-block-header { display: flex; align-items: flex-start; gap: 0.7rem; }
    .scope-block-header > i { color: var(--brand-blue,#1385b6); margin-top: 3px; font-size: 1rem; }
    .scope-block-header > div { display: grid; gap: 0.1rem; }
    .scope-block-header strong { color: var(--brand-ink); font-size: 0.92rem; }
    .scope-block-header p { margin: 0; font-size: 0.81rem; color: var(--brand-muted); line-height: 1.45; }
    .building-list {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(195px, 1fr)); gap: 0.5rem;
    }
    .building-check {
      display: flex; align-items: center; gap: 0.6rem;
      padding: 0.6rem 0.85rem; border-radius: 12px;
      background: white; border: 1px solid #deeae8; font-size: 0.88rem; cursor: pointer;
    }
    .building-check:hover { border-color: rgba(19,133,182,0.3); background: #f5fafd; }
    .building-check input { width: auto; cursor: pointer; }
    .no-items-hint { margin: 0; font-size: 0.84rem; color: var(--brand-muted); font-style: italic; }

    /* ── FOOTERS ── */
    .ficha-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; }
    .confirm-text { margin: 0 0 1.2rem; color: var(--brand-ink); line-height: 1.6; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
  `]
})
export class UsersPageComponent implements OnInit {
  private readonly usersApi         = inject(UsersApiService);
  private readonly companiesApi     = inject(CompaniesApiService);
  private readonly condominiumsApi  = inject(CondominiumsApiService);
  private readonly buildingsApi     = inject(BuildingsApiService);
  private readonly auth             = inject(AuthService);
  private readonly destroyRef       = inject(DestroyRef);
  private readonly cdr              = inject(ChangeDetectorRef);

  items:        ManagedUser[]  = [];
  companies:    Company[]      = [];
  condominiums: Condominium[]  = [];
  buildings:    Building[]     = [];

  loading      = true;
  pageError    = '';
  panelMode:   PanelMode | null = null;
  confirmVisible = false;
  selected:    ManagedUser | null = null;
  form         = this.emptyForm();
  isSaving     = false;
  isDeleting   = false;
  dialogError  = '';
  dialogSuccess = '';
  readonly roleLabel = roleLabel;

  get isSuperAdmin(): boolean { return this.auth.hasRole('SuperAdmin'); }
  get availableRoles()        { return roleOptions(this.isSuperAdmin); }

  get visibleCondominiums(): Condominium[] {
    if (this.isSuperAdmin && this.form.companyId) {
      return this.condominiums.filter(c => c.companyId === this.form.companyId);
    }
    return this.condominiums;
  }

  get visibleBuildings(): Building[] {
    let list = this.buildings;
    if (this.isSuperAdmin && this.form.companyId) {
      list = list.filter(b => b.companyId === this.form.companyId);
    }
    if (this.form.condominiumId) {
      list = list.filter(b => b.condominiumId === this.form.condominiumId);
    }
    return list;
  }

  companyName(id: string | null): string {
    if (!id) return '—';
    return this.companies.find(c => c.id === id)?.name ?? '—';
  }

  condominiumName(id: string | null): string {
    if (!id) return '—';
    return this.condominiums.find(c => c.id === id)?.name ?? '—';
  }

  buildingName(id: string): string {
    return this.buildings.find(b => b.id === id)?.name ?? id;
  }

  userInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  }

  scopeClass(user: ManagedUser): string {
    if (user.companyId)     return 'scope-co';
    if (user.condominiumId) return 'scope-cnd';
    return 'scope-bld';
  }

  scopeDescription(user: ManagedUser): string {
    if (user.companyId) {
      return `Puede ver y editar todos los condominios y edificios de ${this.companyName(user.companyId)}.`;
    }
    if (user.condominiumId) {
      return `Puede ver y editar todos los edificios del condominio ${this.condominiumName(user.condominiumId)}.`;
    }
    const n = user.buildingIds?.length ?? 0;
    return `Puede ver, crear y editar unidades de ${n} edificio${n !== 1 ? 's' : ''} asignado${n !== 1 ? 's' : ''}.`;
  }

  onCompanyChange(): void {
    this.form.condominiumId = '';
    this.form.buildingIds   = [];
    this.cdr.markForCheck();
  }

  onCondominiumChange(): void {
    this.form.buildingIds = [];
    this.cdr.markForCheck();
  }

  toggleBuilding(id: string, checked: boolean): void {
    this.form.buildingIds = checked
      ? [...this.form.buildingIds, id]
      : this.form.buildingIds.filter(x => x !== id);
  }

  ngOnInit(): void {
    forkJoin({
      users:        this.usersApi.getAll(),
      buildings:    this.buildingsApi.getAll(),
      condominiums: this.condominiumsApi.getAll(),
      companies:    this.isSuperAdmin ? this.companiesApi.getAll() : of([] as Company[])
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ users, buildings, condominiums, companies }) => {
        this.items        = users.sort((a, b) => a.fullName.localeCompare(b.fullName));
        this.buildings    = buildings;
        this.condominiums = condominiums;
        this.companies    = companies ?? [];
        this.loading      = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.pageError = extractApiErrorMessage(err, 'No se pudieron cargar los usuarios.');
        this.loading   = false;
        this.cdr.markForCheck();
      }
    });
  }

  openCreate(): void {
    this.selected     = null;
    this.form         = this.emptyForm();
    this.dialogError  = '';
    this.dialogSuccess = '';
    this.panelMode    = 'form';
  }

  openFicha(item: ManagedUser): void {
    this.selected      = item;
    this.dialogError   = '';
    this.dialogSuccess = '';
    this.panelMode     = 'ficha';
  }

  openEdit(): void {
    if (!this.selected) return;
    const u = this.selected;
    this.form = {
      companyId:     u.companyId      ?? '',
      condominiumId: u.condominiumId  ?? '',
      fullName:      u.fullName,
      email:         u.email,
      phonePrefix:   u.phonePrefix    ?? '',
      phone:         u.phone          ?? '',
      role:          u.role,
      isActive:      u.isActive,
      buildingIds:   [...u.buildingIds]
    };
    this.dialogError   = '';
    this.dialogSuccess = '';
    this.panelMode     = 'form';
  }

  backToFicha(): void {
    this.dialogError = '';
    this.panelMode   = 'ficha';
  }

  closePanel(): void {
    this.panelMode     = null;
    this.confirmVisible = false;
    this.selected      = null;
  }

  save(): void {
    this.dialogError   = '';
    this.dialogSuccess = '';

    const req = {
      companyId:     this.form.companyId     || null,
      condominiumId: this.form.condominiumId || null,
      fullName:      this.form.fullName.trim(),
      email:         this.form.email.trim().toLowerCase(),
      phonePrefix:   this.form.phonePrefix.trim() || null,
      phone:         this.form.phone.trim()       || null,
      role:          this.form.role,
      isActive:      this.form.isActive,
      buildingIds:   [...new Set(this.form.buildingIds)],
      password:      this.selected ? undefined : '123456'
    };

    if (this.isSuperAdmin && !req.companyId) {
      this.dialogError = 'La empresa es obligatoria.'; return;
    }
    if (!req.fullName) {
      this.dialogError = 'El nombre es obligatorio.'; return;
    }
    if (!req.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.email)) {
      this.dialogError = 'Correo electrónico inválido.'; return;
    }
    if (!req.role) {
      this.dialogError = 'El rol es obligatorio.'; return;
    }
    if (req.buildingIds.length === 0) {
      this.dialogError = 'Debes asignar al menos un edificio.'; return;
    }

    this.isSaving = true;
    const op = this.selected
      ? this.usersApi.update(this.selected.id, req)
      : this.usersApi.create(req);

    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: item => {
        this.items = this.selected
          ? this.items.map(x => x.id === item.id ? item : x)
              .sort((a, b) => a.fullName.localeCompare(b.fullName))
          : [...this.items, item]
              .sort((a, b) => a.fullName.localeCompare(b.fullName));
        this.isSaving      = false;
        this.dialogSuccess = this.selected
          ? 'Usuario actualizado correctamente.'
          : 'Usuario creado. Clave inicial: 123456';
        this.selected  = item;
        this.panelMode = 'ficha';
        this.cdr.markForCheck();
      },
      error: err => {
        this.dialogError = extractApiErrorMessage(err, 'No se pudo guardar el usuario.');
        this.isSaving    = false;
        this.cdr.markForCheck();
      }
    });
  }

  askDelete():    void { this.confirmVisible = true; }
  cancelDelete(): void { this.confirmVisible = false; }

  confirmDelete(): void {
    if (!this.selected) return;
    this.isDeleting = true;
    this.usersApi.delete(this.selected.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items          = this.items.filter(x => x.id !== this.selected!.id);
          this.isDeleting     = false;
          this.confirmVisible = false;
          this.panelMode      = null;
          this.selected       = null;
          this.cdr.markForCheck();
        },
        error: err => {
          this.dialogError    = extractApiErrorMessage(err, 'No se pudo eliminar el usuario.');
          this.isDeleting     = false;
          this.confirmVisible = false;
          this.cdr.markForCheck();
        }
      });
  }

  private emptyForm() {
    return {
      companyId:     '',
      condominiumId: '',
      fullName:      '',
      email:         '',
      phonePrefix:   '',
      phone:         '',
      role:          roleOptions(this.isSuperAdmin)[0]?.value ?? 'CompanyOperator',
      isActive:      true,
      buildingIds:   [] as string[]
    };
  }
}
