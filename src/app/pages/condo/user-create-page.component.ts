import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { CompaniesApiService } from '../../api/companies-api.service';
import { CondominiumsApiService } from '../../api/condominiums-api.service';
import { UsersApiService } from '../../api/users-api.service';
import { Building, BuildingCapacityItem, Company, Condominium } from '../../api/models';
import { AuthService } from '../../auth/auth.service';
import { roleOptions } from '../../auth/role-labels';

interface PhonePrefix { label: string; value: string; flag: string; }
const PHONE_PREFIXES: PhonePrefix[] = [
  { label: 'PY +595', value: '+595', flag: 'ðŸ‡µðŸ‡¾' },
  { label: 'USA +1',  value: '+1',   flag: 'ðŸ‡ºðŸ‡¸' },
  { label: 'BR +55',  value: '+55',  flag: 'ðŸ‡§ðŸ‡·' },
  { label: 'ARG +54', value: '+54',  flag: 'ðŸ‡¦ðŸ‡·' },
  { label: 'VE +58',  value: '+58',  flag: 'ðŸ‡»ðŸ‡ª' },
];

interface RoleCard { value: string; label: string; desc: string; icon: string; note: string; }
const ALL_ROLE_CARDS: RoleCard[] = [
  {
    value: 'CompanyAdmin',
    label: 'Administrador de empresa',
    desc:  'Acceso completo: ve y edita todos los condominios y edificios de la empresa asignada.',
    icon:  'pi-briefcase',
    note:  'Requiere empresa asignada'
  },
  {
    value: 'CompanyOperator',
    label: 'Operador de condominio',
    desc:  'Ve y edita todos los edificios del condominio asignado y sus unidades.',
    icon:  'pi-building',
    note:  'Se recomienda asignar un condominio'
  },
  {
    value: 'BuildingManager',
    label: 'Encargado de edificio',
    desc:  'Gestiona las unidades, residentes y cobranza de los edificios seleccionados.',
    icon:  'pi-home',
    note:  'Requiere al menos un edificio'
  }
];

@Component({
  standalone: true,
  selector: 'app-user-create-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Select, Tooltip],
  styleUrl: './user-create-page.component.css',
  template: `
    <p-card styleClass="app-page-card">

      <!-- HEADER -->
      <div class="create-header">
        <button class="back-btn" (click)="cancel()" pTooltip="Volver al listado" tooltipPosition="right">
          <i class="pi pi-arrow-left"></i>
        </button>
        <div>
          <h1>{{ isEditing ? 'Editar usuario' : 'Nuevo usuario' }}</h1>
          <p>{{ isEditing ? editingFullName : 'Complete los datos para registrar un nuevo usuario en el sistema.' }}</p>
        </div>
      </div>

      <p-message *ngIf="loadError" severity="error" [text]="loadError"></p-message>
      <div *ngIf="loading" class="app-state">Cargando datos...</div>

      <form class="create-form" (ngSubmit)="save()" *ngIf="!loading && !loadError">

        <!-- â•â• DATOS PERSONALES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
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
                     placeholder="Ej. PÃ©rez GarcÃ­a" maxlength="100" autocomplete="off" />
            </div>
          </div>

          <div class="field">
            <label for="address">DirecciÃ³n <span class="optional">(opcional)</span></label>
            <input id="address" type="text" [(ngModel)]="form.address" name="address"
                   placeholder="Calle, nÃºmero, ciudad" maxlength="200" autocomplete="off" />
          </div>
        </section>

        <!-- â•â• ACCESO AL SISTEMA â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
        <section class="form-section">
          <h2 class="section-title">Acceso al sistema</h2>

          <div class="field-row">
            <div class="field">
              <label for="username">Nombre de usuario <span class="required">*</span></label>
              <input id="username" type="text" [(ngModel)]="form.username" name="username"
                     placeholder="ej. juan.perez" maxlength="60" autocomplete="off"
                     (input)="onUsernameInput()" />
              <small class="field-hint">
                Solo minÃºsculas, nÃºmeros, puntos y guiones.
                Ãšnico dentro de su empresa o condominio.
              </small>
            </div>
            <div class="field">
              <label for="email">Correo electrÃ³nico <span class="required">*</span></label>
              <input id="email" type="email" [(ngModel)]="form.email" name="email"
                     placeholder="usuario@ejemplo.com" maxlength="160" autocomplete="off" />
            </div>
          </div>

          <!-- Login methods info -->
          <div class="login-info-box">
            <div class="login-method">
              <i class="pi pi-at"></i>
              <span><strong>Correo</strong> usuario&#64;ejemplo.com</span>
            </div>
            <div class="login-sep">Ã³</div>
            <div class="login-method">
              <i class="pi pi-user"></i>
              <span><strong>Usuario</strong> juan.perez</span>
            </div>
            <p class="login-note" *ngIf="!isEditing">
              Clave inicial: <code>123456</code> â€” se debe cambiar en el primer ingreso.
            </p>
          </div>

          <div class="field">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
              <span>Usuario activo</span>
            </label>
          </div>
        </section>

        <!-- â•â• ROL â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
        <section class="form-section">
          <h2 class="section-title">Rol <span class="required">*</span></h2>
          <p class="section-desc">Selecciona el nivel de acceso del usuario.</p>

          <div class="role-cards">
            <div class="role-card" *ngFor="let r of visibleRoleCards"
                 [class.selected]="form.role === r.value"
                 (click)="form.role = r.value">
              <div class="role-card-head">
                <div class="role-card-icon"><i class="pi {{ r.icon }}"></i></div>
                <div class="role-check" *ngIf="form.role === r.value">
                  <i class="pi pi-check-circle"></i>
                </div>
              </div>
              <div class="role-card-body">
                <strong>{{ r.label }}</strong>
                <p>{{ r.desc }}</p>
                <span class="role-scope-note">
                  <i class="pi pi-info-circle"></i> {{ r.note }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- â•â• ALCANCE DE ACCESO â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
        <section class="form-section">
          <h2 class="section-title">Alcance de acceso</h2>
          <p class="section-desc">Define quÃ© recursos puede ver y gestionar este usuario al iniciar sesiÃ³n.</p>

          <!-- Caja de alcance segÃºn rol seleccionado -->
          <div class="scope-summary" *ngIf="form.role">
            <div class="scope-level" [class.active]="form.role === 'CompanyAdmin'">
              <i class="pi pi-briefcase"></i>
              <span>Empresa â†’ todos los condominios y edificios</span>
            </div>
            <div class="scope-arrow">â€º</div>
            <div class="scope-level" [class.active]="form.role === 'CompanyOperator'">
              <i class="pi pi-building"></i>
              <span>Condominio â†’ todos los edificios</span>
            </div>
            <div class="scope-arrow">â€º</div>
            <div class="scope-level" [class.active]="form.role === 'BuildingManager'">
              <i class="pi pi-home"></i>
              <span>Edificios â†’ unidades y residentes</span>
            </div>
          </div>

          <!-- Empresa (SuperAdmin solamente) -->
          <div class="field" *ngIf="isSuperAdmin">
            <label for="company">
              Empresa <span class="required">*</span>
            </label>
            <p-select id="company" [options]="companyOptions" [(ngModel)]="form.companyId"
                      name="companyId" optionLabel="label" optionValue="value"
                      placeholder="Seleccionar empresa..." styleClass="full-select"
                      (onChange)="onCompanyChange()">
            </p-select>
          </div>

          <!-- Condominio + TelÃ©fono en la misma fila -->
          <div class="field-row">
            <div class="field">
              <label for="condominium">
                Condominio <span class="optional">(opcional)</span>
              </label>
              <p-select id="condominium" [options]="filteredCondominiumOptions"
                        [(ngModel)]="form.condominiumId" name="condominiumId"
                        optionLabel="label" optionValue="value"
                        placeholder="Sin condominio asignado" [showClear]="true"
                        styleClass="full-select"
                        (onChange)="onCondominiumChange()">
              </p-select>
              <small class="field-hint" *ngIf="form.condominiumId">
                El usuario podrÃ¡ ver y editar todos los edificios de este condominio.
              </small>
            </div>
            <div class="field">
              <label>TelÃ©fono <span class="optional">(opcional)</span></label>
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
          </div>

          <!-- Edificios (requerido solo para BuildingManager) -->
          <div class="field" *ngIf="form.role !== 'CompanyAdmin'">
            <label>
              Edificios
              <span class="required" *ngIf="form.role === 'BuildingManager'">*</span>
              <span class="optional" *ngIf="form.role !== 'BuildingManager'">(opcional)</span>
              <span class="field-count" *ngIf="!singleBuildingLocked && form.buildingIds.length">
                {{ form.buildingIds.length }} seleccionado{{ form.buildingIds.length !== 1 ? 's' : '' }}
              </span>
            </label>
            <small class="field-hint" *ngIf="!singleBuildingLocked && form.role === 'BuildingManager'">
              Mínimo un edificio requerido. El usuario podrá ver y gestionar las unidades de los
              edificios seleccionados.
            </small>
            <small class="field-hint" *ngIf="!singleBuildingLocked && form.role !== 'BuildingManager'">
              Podés asignar edificios específicos o dejar vacío para acceso según condominio.
            </small>

            <!-- Edificio Ãºnico bloqueado (CompanyAdmin con solo 1 edificio) -->
            <div class="locked-badge" *ngIf="singleBuildingLocked">
              <i class="pi pi-home"></i>
              <span>{{ filteredBuildings[0]?.name }}</span>
              <span class="locked-badge-sub">{{ filteredBuildings[0]?.code }}</span>
              <span class="locked-tag">Asignado automÃ¡ticamente</span>
            </div>

            <div class="building-grid" *ngIf="!singleBuildingLocked && filteredBuildings.length; else noBuildings">
              <label class="building-card"
                     *ngFor="let b of filteredBuildings"
                     [class.selected]="form.buildingIds.includes(b.id)"
                     [class.at-capacity]="isBuildingAtCapacity(b.id)"
                     [pTooltip]="isBuildingAtCapacity(b.id) ? capacityLimitLabel(b.id) : ''"
                     tooltipPosition="top">
                <input type="checkbox"
                       [checked]="form.buildingIds.includes(b.id)"
                       [disabled]="isBuildingAtCapacity(b.id) && !form.buildingIds.includes(b.id)"
                       (change)="toggleBuilding(b.id, $any($event.target).checked)" />
                <div class="building-card-info">
                  <span class="building-name">{{ b.name }}</span>
                  <span class="building-code">{{ b.code }}</span>
                  <span class="capacity-badges" *ngIf="isCompanyAdmin && form.role">
                    <span class="cap-badge" [class.cap-full]="getCapacity(b.id).buildingManagerCount >= 2">
                      <i class="pi pi-user"></i>{{ getCapacity(b.id).buildingManagerCount }}/2
                    </span>
                    <span class="cap-badge" [class.cap-full]="getCapacity(b.id).companyOperatorCount >= 5">
                      <i class="pi pi-users"></i>{{ getCapacity(b.id).companyOperatorCount }}/5
                    </span>
                  </span>
                </div>
                <i class="pi pi-check building-card-check" *ngIf="form.buildingIds.includes(b.id)"></i>
              </label>
            </div>
            <ng-template #noBuildings>
              <p class="no-items-hint" *ngIf="!singleBuildingLocked">
                No hay edificios disponibles.
              </p>
            </ng-template>
          </div>
        </section>

        <!-- â•â• ACCIONES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
        <section class="form-actions">
          <div class="form-actions-left">
            <p-button *ngIf="isEditing" type="button" label="Eliminar usuario"
                      severity="danger" [outlined]="true" [rounded]="true"
                      icon="pi pi-trash" (onClick)="askDelete()">
            </p-button>
          </div>
          <div class="form-actions-right">
            <p-button type="button" label="Cancelar" [text]="true" [rounded]="true"
                      severity="secondary" (onClick)="cancel()">
            </p-button>
            <p-button type="submit" [label]="isEditing ? 'Guardar cambios' : 'Crear usuario'"
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
        <strong>Confirmar eliminaciÃ³n</strong>
        <button class="ov-close" (click)="cancelDelete()">âœ•</button>
      </div>
      <p class="confirm-text">
        Â¿Eliminar al usuario <strong>{{ editingFullName }}</strong> de forma permanente?
        Esta acciÃ³n no se puede deshacer.
      </p>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDelete()"></p-button>
        <p-button label="Eliminar definitivamente" severity="danger"
                  [loading]="isDeleting" (onClick)="confirmDelete()"></p-button>
      </div>
    </div>
  `,
})
export class UserCreatePageComponent implements OnInit {
  private readonly api             = inject(UsersApiService);
  private readonly companiesApi    = inject(CompaniesApiService);
  private readonly condominiumsApi = inject(CondominiumsApiService);
  private readonly buildingsApi    = inject(BuildingsApiService);
  private readonly auth            = inject(AuthService);
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);
  private readonly destroyRef      = inject(DestroyRef);
  private readonly cdr             = inject(ChangeDetectorRef);
  private readonly msg             = inject(MessageService);

  prefixOptions = PHONE_PREFIXES;
  companyOptions:              { label: string; value: string }[] = [];
  allCondominiums:             Condominium[]                      = [];
  filteredCondominiumOptions:  { label: string; value: string }[] = [];
  allBuildings:                Building[]                         = [];
  filteredBuildings:           Building[]                         = [];
  capacityMap = new Map<string, BuildingCapacityItem>();

  isEditing     = false;
  editingId     = '';
  editingFullName = '';
  loading       = true;
  loadError     = '';
  isSaving      = false;
  isDeleting    = false;
  confirmVisible = false;

  form = this.emptyForm();

  get isSuperAdmin()   { return this.auth.hasRole('SuperAdmin'); }
  get isCompanyAdmin() { return this.auth.hasRole('CompanyAdmin'); }

  get singleBuildingLocked(): boolean {
    return this.isCompanyAdmin && !this.isEditing && this.filteredBuildings.length === 1;
  }

  get visibleRoleCards(): RoleCard[] {
    const allowed = roleOptions(this.isSuperAdmin).map(r => r.value);
    return ALL_ROLE_CARDS.filter(r => allowed.includes(r.value));
  }

  getCapacity(buildingId: string): BuildingCapacityItem {
    return this.capacityMap.get(buildingId)
      ?? { buildingId, buildingManagerCount: 0, companyOperatorCount: 0 };
  }

  isBuildingAtCapacity(buildingId: string): boolean {
    const cap = this.getCapacity(buildingId);
    if (this.form.role === 'BuildingManager')  return cap.buildingManagerCount  >= 2;
    if (this.form.role === 'CompanyOperator') return cap.companyOperatorCount >= 5;
    return false;
  }

  capacityLimitLabel(buildingId: string): string {
    const cap = this.getCapacity(buildingId);
    if (this.form.role === 'BuildingManager')  return `MÃ¡ximo de encargados alcanzado (${cap.buildingManagerCount}/2)`;
    if (this.form.role === 'CompanyOperator') return `MÃ¡ximo de operadores alcanzado (${cap.companyOperatorCount}/5)`;
    return '';
  }

  ngOnInit(): void {
    this.loading = true;
    const id = this.route.snapshot.paramMap.get('id');

    forkJoin({
      companies:    this.isSuperAdmin ? this.companiesApi.getAll() : of([] as Company[]),
      condominiums: this.condominiumsApi.getAll(),
      buildings:    this.buildingsApi.getAll(),
      capacity:     this.isCompanyAdmin ? this.api.getCapacity() : of({ items: [] }),
      entity:       id ? this.api.getById(id) : of(null)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ companies, condominiums, buildings, capacity, entity }) => {
        this.companyOptions = companies
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(c => ({ label: c.name, value: c.id }));
        this.allCondominiums = condominiums;
        this.allBuildings    = buildings;

        this.capacityMap = new Map(capacity.items.map(i => [i.buildingId, i]));

        if (id && !entity) {
          this.loadError = 'No se encontrÃ³ el usuario solicitado.';
          this.loading   = false;
          this.cdr.markForCheck();
          return;
        }

        if (id && entity) {
          this.isEditing       = true;
          this.editingId       = id;
          this.editingFullName = entity.fullName
            || `${entity.firstName ?? ''} ${entity.lastName ?? ''}`.trim();

          const nameParts = (entity.fullName ?? '').trim().split(/\s+/);
          const firstName = entity.firstName?.trim() || nameParts[0] || '';
          const lastName  = entity.lastName?.trim()  || nameParts.slice(1).join(' ') || '';

          this.form = {
            companyId:     entity.companyId     ?? '',
            condominiumId: entity.condominiumId ?? '',
            firstName,
            lastName,
            username:    entity.username    ?? '',
            email:       entity.email       ?? '',
            phonePrefix: entity.phonePrefix ?? '+595',
            phone:       entity.phone       ?? '',
            address:     entity.address     ?? '',
            role:        entity.role        || this.visibleRoleCards[0]?.value || '',
            isActive:    entity.isActive    ?? true,
            buildingIds: [...(entity.buildingIds ?? [])]
          };
        }

        this.refreshCondominiumOptions();
        this.refreshBuildings();

        // Auto-assign single building for CompanyAdmin in create mode
        if (this.isCompanyAdmin && !id && this.filteredBuildings.length === 1) {
          this.form.buildingIds = [this.filteredBuildings[0].id];
        }

        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError = 'No se pudieron cargar los datos necesarios.';
        this.loading   = false;
        this.cdr.markForCheck();
      }
    });
  }

  onCompanyChange(): void {
    this.form.condominiumId = '';
    this.form.buildingIds   = [];     // el usuario cambiÃ³ empresa â†’ limpiar selecciÃ³n
    this.refreshCondominiumOptions();
    this.refreshBuildings();
    this.cdr.markForCheck();
  }

  onCondominiumChange(): void {
    this.form.buildingIds = [];       // el usuario cambiÃ³ condominio â†’ limpiar selecciÃ³n
    this.refreshBuildings();
    this.cdr.markForCheck();
  }

  private refreshCondominiumOptions(): void {
    // Si hay empresa seleccionada: filtrar por ella; si no: mostrar todos
    let list = this.allCondominiums;
    if (this.form.companyId) {
      list = list.filter(c => c.companyId === this.form.companyId);
    }
    this.filteredCondominiumOptions = list
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => ({ label: c.name, value: c.id }));
  }

  private refreshBuildings(): void {
    let list = this.allBuildings;
    if (this.form.companyId) {
      list = list.filter(b => b.companyId === this.form.companyId);
    }
    if (this.form.condominiumId) {
      list = list.filter(b => b.condominiumId === this.form.condominiumId);
    }
    // Siempre incluir los edificios ya asignados aunque no pasen el filtro actual
    if (this.form.buildingIds.length) {
      const inList = new Set(list.map(b => b.id));
      const missing = this.allBuildings.filter(
        b => this.form.buildingIds.includes(b.id) && !inList.has(b.id)
      );
      list = [...list, ...missing];
    }
    this.filteredBuildings = list.sort((a, b) => a.name.localeCompare(b.name));
  }

  onUsernameInput(): void {
    this.form.username = this.form.username
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]/g, '');
  }

  onPhoneInput(): void {
    this.form.phone = this.form.phone.replace(/[^\d\s\-]/g, '');
  }

  toggleBuilding(id: string, checked: boolean): void {
    this.form.buildingIds = checked
      ? [...this.form.buildingIds, id]
      : this.form.buildingIds.filter(x => x !== id);
  }

  save(): void {
    const firstName = this.form.firstName.trim();
    const lastName  = this.form.lastName.trim();
    const username  = this.form.username.trim();
    const email     = this.form.email.trim().toLowerCase();
    const companyId    = this.form.companyId    || null;
    const condominiumId = this.form.condominiumId || null;
    const buildingIds  = [...new Set(this.form.buildingIds)];

    if (this.isSuperAdmin && !companyId) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'La empresa es obligatoria.', life: 5000 }); return; }
    if (!firstName) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El nombre es obligatorio.', life: 5000 }); return; }
    if (!lastName)  { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Los apellidos son obligatorios.', life: 5000 }); return; }
    if (!username)  { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El nombre de usuario es obligatorio.', life: 5000 }); return; }
    if (!/^[a-z0-9][a-z0-9.\-_]*$/.test(username)) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Nombre de usuario invÃ¡lido. Solo minÃºsculas, nÃºmeros, puntos y guiones.', life: 5000 }); return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Correo electrÃ³nico invÃ¡lido.', life: 5000 }); return;
    }
    if (!this.form.role) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Debes seleccionar un rol.', life: 5000 }); return; }
    if (buildingIds.length === 0 && this.form.role === 'BuildingManager') { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Debes asignar al menos un edificio.', life: 5000 }); return; }

    const req = {
      companyId, condominiumId, firstName, lastName,
      fullName: `${firstName} ${lastName}`,
      username, email,
      phonePrefix: this.form.phonePrefix || null,
      phone:       this.form.phone.trim() || null,
      address:     this.form.address.trim() || null,
      role:        this.form.role,
      isActive:    this.form.isActive,
      buildingIds,
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
          this.isEditing = true;
          this.editingId = saved.id;
          this.msg.add({ severity: 'success', summary: 'Ã‰xito', detail: 'Usuario creado. Clave inicial: 123456', life: 4000 });
        } else {
          this.msg.add({ severity: 'success', summary: 'Ã‰xito', detail: 'Cambios guardados correctamente.', life: 4000 });
        }
        this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar el usuario.'), life: 5000 });
        this.isSaving  = false;
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
          this.isDeleting    = false;
          this.confirmVisible = false;
          this.router.navigate(['/users']);
        },
        error: err => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo eliminar el usuario.'), life: 5000 });
          this.isDeleting  = false;
          this.cdr.markForCheck();
        }
      });
  }

  cancel(): void { this.router.navigate(['/users']); }

  private emptyForm() {
    return {
      companyId:     '',
      condominiumId: '',
      firstName:     '',
      lastName:      '',
      username:      '',
      email:         '',
      phonePrefix:   '+595',
      phone:         '',
      address:       '',
      role:          roleOptions(this.auth.hasRole('SuperAdmin'))[0]?.value ?? 'CompanyOperator',
      isActive:      true,
      buildingIds:   [] as string[]
    };
  }
}
