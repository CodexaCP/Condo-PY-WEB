import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map, of } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { CompaniesApiService } from '../../api/companies-api.service';
import { CondominiumsApiService } from '../../api/condominiums-api.service';
import { UsersApiService } from '../../api/users-api.service';
import { Building, Company, Condominium } from '../../api/models';
import { AuthService } from '../../auth/auth.service';
import { roleOptions } from '../../auth/role-labels';

interface PhonePrefix { label: string; value: string; flag: string; }
const PHONE_PREFIXES: PhonePrefix[] = [
  { label: 'PY +595', value: '+595', flag: '🇵🇾' },
  { label: 'USA +1',  value: '+1',   flag: '🇺🇸' },
  { label: 'BR +55',  value: '+55',  flag: '🇧🇷' },
  { label: 'ARG +54', value: '+54',  flag: '🇦🇷' },
  { label: 'VE +58',  value: '+58',  flag: '🇻🇪' },
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
      <p-message *ngIf="formError" severity="error" [text]="formError" styleClass="mb-4"></p-message>
      <p-message *ngIf="formSuccess" severity="success" [text]="formSuccess" styleClass="mb-4"></p-message>
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

          <div class="field">
            <label for="address">Dirección <span class="optional">(opcional)</span></label>
            <input id="address" type="text" [(ngModel)]="form.address" name="address"
                   placeholder="Calle, número, ciudad" maxlength="200" autocomplete="off" />
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
              <small class="field-hint">
                Solo minúsculas, números, puntos y guiones.
                Único dentro de su empresa o condominio.
              </small>
            </div>
            <div class="field">
              <label for="email">Correo electrónico <span class="required">*</span></label>
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
            <div class="login-sep">ó</div>
            <div class="login-method">
              <i class="pi pi-user"></i>
              <span><strong>Usuario</strong> juan.perez</span>
            </div>
            <p class="login-note" *ngIf="!isEditing">
              Clave inicial: <code>123456</code> — se debe cambiar en el primer ingreso.
            </p>
          </div>

          <div class="field">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
              <span>Usuario activo</span>
            </label>
          </div>
        </section>

        <!-- ══ CONTACTO ══════════════════════════════════════════════ -->
        <section class="form-section">
          <h2 class="section-title">Contacto</h2>
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
        </section>

        <!-- ══ ROL ═══════════════════════════════════════════════════ -->
        <section class="form-section">
          <h2 class="section-title">Rol <span class="required">*</span></h2>
          <p class="section-desc">Selecciona el nivel de acceso del usuario.</p>

          <div class="role-cards">
            <div class="role-card" *ngFor="let r of visibleRoleCards"
                 [class.selected]="form.role === r.value"
                 (click)="form.role = r.value">
              <div class="role-card-icon">
                <i class="pi {{ r.icon }}"></i>
              </div>
              <div class="role-card-body">
                <strong>{{ r.label }}</strong>
                <p>{{ r.desc }}</p>
                <span class="role-scope-note">
                  <i class="pi pi-info-circle"></i> {{ r.note }}
                </span>
              </div>
              <div class="role-check" *ngIf="form.role === r.value">
                <i class="pi pi-check-circle"></i>
              </div>
            </div>
          </div>
        </section>

        <!-- ══ ALCANCE DE ACCESO ══════════════════════════════════════ -->
        <section class="form-section">
          <h2 class="section-title">Alcance de acceso</h2>
          <p class="section-desc">Define qué recursos puede ver y gestionar este usuario al iniciar sesión.</p>

          <!-- Caja de alcance según rol seleccionado -->
          <div class="scope-summary" *ngIf="form.role">
            <div class="scope-level" [class.active]="form.role === 'CompanyAdmin'">
              <i class="pi pi-briefcase"></i>
              <span>Empresa → todos los condominios y edificios</span>
            </div>
            <div class="scope-arrow">›</div>
            <div class="scope-level" [class.active]="form.role === 'CompanyOperator'">
              <i class="pi pi-building"></i>
              <span>Condominio → todos los edificios</span>
            </div>
            <div class="scope-arrow">›</div>
            <div class="scope-level" [class.active]="form.role === 'BuildingManager'">
              <i class="pi pi-home"></i>
              <span>Edificios → unidades y residentes</span>
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

          <!-- Condominio (opcional, filtrado por empresa) -->
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
              El usuario podrá ver y editar todos los edificios de este condominio.
            </small>
          </div>

          <!-- Edificios (requerido ≥ 1) -->
          <div class="field">
            <label>
              Edificios <span class="required">*</span>
              <span class="field-count" *ngIf="form.buildingIds.length">
                {{ form.buildingIds.length }} seleccionado{{ form.buildingIds.length !== 1 ? 's' : '' }}
              </span>
            </label>
            <small class="field-hint">
              Mínimo un edificio requerido. El usuario podrá ver y gestionar las unidades de los
              edificios seleccionados.
            </small>

            <div class="building-grid" *ngIf="filteredBuildings.length; else noBuildings">
              <label class="building-card"
                     *ngFor="let b of filteredBuildings"
                     [class.selected]="form.buildingIds.includes(b.id)">
                <input type="checkbox"
                       [checked]="form.buildingIds.includes(b.id)"
                       (change)="toggleBuilding(b.id, $any($event.target).checked)" />
                <div class="building-card-info">
                  <span class="building-name">{{ b.name }}</span>
                  <span class="building-code">{{ b.code }}</span>
                </div>
                <i class="pi pi-check building-card-check" *ngIf="form.buildingIds.includes(b.id)"></i>
              </label>
            </div>
            <ng-template #noBuildings>
              <p class="no-items-hint">
                No hay edificios disponibles.
              </p>
            </ng-template>
          </div>
        </section>

        <!-- ══ ACCIONES ══════════════════════════════════════════════ -->
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
        <strong>Confirmar eliminación</strong>
        <button class="ov-close" (click)="cancelDelete()">✕</button>
      </div>
      <p class="confirm-text">
        ¿Eliminar al usuario <strong>{{ editingFullName }}</strong> de forma permanente?
        Esta acción no se puede deshacer.
      </p>
      <p-message *ngIf="deleteError" severity="error" [text]="deleteError"></p-message>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDelete()"></p-button>
        <p-button label="Eliminar definitivamente" severity="danger"
                  [loading]="isDeleting" (onClick)="confirmDelete()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    /* ── HEADER ── */
    .create-header { display:flex; align-items:flex-start; gap:1rem; margin-bottom:2rem; }
    .create-header h1 { margin:0 0 0.25rem; }
    .create-header p  { margin:0; color:var(--brand-muted); }
    .back-btn {
      background:none; border:1px solid rgba(19,133,182,0.2); border-radius:50%;
      width:40px; height:40px; display:grid; place-items:center; cursor:pointer;
      color:var(--brand-muted); transition:background 0.15s,color 0.15s; flex-shrink:0; margin-top:4px;
    }
    .back-btn:hover { background:rgba(19,133,182,0.08); color:var(--brand-blue); }

    /* ── FORM LAYOUT ── */
    .create-form { display:flex; flex-direction:column; gap:2.5rem; }
    .form-section { display:flex; flex-direction:column; gap:1.25rem; }
    .section-title {
      font-size:0.88rem; font-weight:700; text-transform:uppercase; letter-spacing:0.07em;
      color:var(--brand-muted); margin:0 0 0.1rem; padding-bottom:0.5rem;
      border-bottom:1px solid rgba(19,133,182,0.1);
    }
    .section-desc { margin:0; color:var(--brand-muted); font-size:0.88rem; }

    /* ── FIELDS ── */
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
    .field-count { font-weight:600; color:var(--brand-blue); font-size:0.82rem; margin-left:0.5rem; }
    .required  { color:#e74c3c; font-weight:600; }
    .optional  { font-weight:400; font-size:0.82rem; color:var(--brand-muted); }
    .checkbox-label { display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:500; }
    .checkbox-label input[type=checkbox] { width:16px; height:16px; cursor:pointer; accent-color:var(--brand-blue); }

    /* ── PHONE ── */
    .phone-row { display:flex; gap:0.6rem; align-items:stretch; }
    .phone-input { flex:1; padding:0.6rem 0.85rem; border:1px solid rgba(19,133,182,0.25);
      border-radius:10px; font:inherit; font-size:0.95rem; color:var(--brand-ink); background:#fff; }
    .phone-input:focus { outline:none; border-color:var(--brand-blue); box-shadow:0 0 0 3px rgba(19,133,182,0.12); }
    :host ::ng-deep .phone-prefix-select { width:145px; flex-shrink:0; }
    :host ::ng-deep .phone-prefix-select .p-select { border-radius:10px; border:1px solid rgba(19,133,182,0.25); height:100%; }
    :host ::ng-deep .full-select { width:100%; }
    :host ::ng-deep .full-select .p-select { border-radius:10px; border:1px solid rgba(19,133,182,0.25); }

    /* ── LOGIN INFO BOX ── */
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

    /* ── ROLE CARDS ── */
    .role-cards { display:flex; flex-direction:column; gap:0.75rem; }
    .role-card {
      display:flex; align-items:flex-start; gap:1rem; padding:1rem 1.1rem;
      border:2px solid rgba(19,133,182,0.15); border-radius:16px; background:#fff;
      cursor:pointer; transition:border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    .role-card:hover { border-color:rgba(19,133,182,0.35); background:#f7fbfe; }
    .role-card.selected {
      border-color:var(--brand-blue); background:#eef7fd;
      box-shadow:0 0 0 3px rgba(19,133,182,0.1);
    }
    .role-card-icon {
      width:40px; height:40px; border-radius:12px;
      background:rgba(19,133,182,0.1); display:grid; place-items:center; flex-shrink:0;
    }
    .role-card.selected .role-card-icon { background:rgba(19,133,182,0.18); }
    .role-card-icon i { color:var(--brand-blue); font-size:1.1rem; }
    .role-card-body { flex:1; display:grid; gap:0.2rem; }
    .role-card-body strong { font-size:0.95rem; color:var(--brand-ink); }
    .role-card-body p { margin:0; font-size:0.83rem; color:var(--brand-muted); line-height:1.45; }
    .role-scope-note { font-size:0.78rem; color:rgba(19,133,182,0.8); display:flex; align-items:center; gap:0.3rem; }
    .role-check { color:var(--brand-blue); font-size:1.25rem; flex-shrink:0; margin-top:2px; }

    /* ── SCOPE SUMMARY ── */
    .scope-summary {
      display:flex; align-items:center; gap:0.5rem; padding:0.85rem 1rem;
      border-radius:14px; background:#f8fbfd; border:1px solid rgba(19,133,182,0.12);
      flex-wrap:wrap;
    }
    .scope-level {
      display:flex; align-items:center; gap:0.4rem; padding:0.3rem 0.7rem;
      border-radius:20px; font-size:0.82rem; color:var(--brand-muted);
      background:rgba(19,133,182,0.05); border:1px solid transparent;
      transition:all 0.2s;
    }
    .scope-level.active {
      color:var(--brand-blue); background:rgba(19,133,182,0.12);
      border-color:rgba(19,133,182,0.25); font-weight:600;
    }
    .scope-level i { font-size:0.85rem; }
    .scope-arrow { color:var(--brand-muted); font-size:1.1rem; font-weight:300; }

    /* ── BUILDING GRID ── */
    .building-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:0.6rem; }
    .building-card {
      display:flex; align-items:center; gap:0.7rem; padding:0.7rem 0.9rem;
      border:1.5px solid rgba(19,133,182,0.15); border-radius:12px; background:#fff;
      cursor:pointer; transition:border-color 0.15s, background 0.15s;
    }
    .building-card:hover { border-color:rgba(19,133,182,0.3); background:#f7fbfe; }
    .building-card.selected { border-color:var(--brand-blue); background:#eef7fd; }
    .building-card input[type=checkbox] { width:auto; accent-color:var(--brand-blue); cursor:pointer; }
    .building-card-info { display:flex; flex-direction:column; flex:1; gap:0.05rem; }
    .building-name { font-size:0.9rem; font-weight:600; color:var(--brand-ink); }
    .building-code { font-size:0.75rem; color:var(--brand-muted); font-family:monospace; }
    .building-card-check { color:var(--brand-blue); font-size:0.9rem; margin-left:auto; }
    .no-items-hint { margin:0; color:var(--brand-muted); font-size:0.85rem; font-style:italic; }

    /* ── FORM ACTIONS ── */
    .form-actions {
      display:flex; justify-content:space-between; align-items:center;
      padding-top:0.75rem; border-top:1px solid rgba(19,133,182,0.08);
    }
    .form-actions-left {}
    .form-actions-right { display:flex; gap:0.75rem; }

    /* ── CONFIRM DIALOG ── */
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

  prefixOptions = PHONE_PREFIXES;
  companyOptions:              { label: string; value: string }[] = [];
  allCondominiums:             Condominium[]                      = [];
  filteredCondominiumOptions:  { label: string; value: string }[] = [];
  allBuildings:                Building[]                         = [];
  filteredBuildings:           Building[]                         = [];

  isEditing     = false;
  editingId     = '';
  editingFullName = '';
  loading       = false;
  loadError     = '';
  isSaving      = false;
  isDeleting    = false;
  formError     = '';
  formSuccess   = '';
  deleteError   = '';
  confirmVisible = false;

  form = this.emptyForm();

  get isSuperAdmin() { return this.auth.hasRole('SuperAdmin'); }

  get visibleRoleCards(): RoleCard[] {
    const allowed = roleOptions(this.isSuperAdmin).map(r => r.value);
    return ALL_ROLE_CARDS.filter(r => allowed.includes(r.value));
  }

  ngOnInit(): void {
    this.loading = true;
    const id = this.route.snapshot.paramMap.get('id');

    forkJoin({
      companies:    this.isSuperAdmin ? this.companiesApi.getAll() : of([] as Company[]),
      condominiums: this.condominiumsApi.getAll(),
      buildings:    this.buildingsApi.getAll(),
      entity:       id
        ? this.api.getAll().pipe(map(list => list.find(u => u.id === id) ?? null))
        : of(null)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ companies, condominiums, buildings, entity }) => {
        this.companyOptions = companies
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(c => ({ label: c.name, value: c.id }));
        this.allCondominiums = condominiums;
        this.allBuildings    = buildings;

        if (id && entity) {
          this.isEditing      = true;
          this.editingId      = id;
          this.editingFullName = entity.fullName || `${entity.firstName} ${entity.lastName}`;
          this.form = {
            companyId:     entity.companyId     ?? '',
            condominiumId: entity.condominiumId ?? '',
            firstName:     entity.firstName     ?? '',
            lastName:      entity.lastName      ?? '',
            username:      entity.username      ?? '',
            email:         entity.email,
            phonePrefix:   entity.phonePrefix   ?? '+595',
            phone:         entity.phone         ?? '',
            address:       entity.address       ?? '',
            role:          entity.role,
            isActive:      entity.isActive,
            buildingIds:   [...(entity.buildingIds ?? [])]
          };
        }

        this.refreshCondominiumOptions();
        this.refreshBuildings();
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
    this.form.buildingIds   = [];
    this.refreshCondominiumOptions();
    this.refreshBuildings();
  }

  onCondominiumChange(): void {
    this.form.buildingIds = [];
    this.refreshBuildings();
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
    // Filtrar por empresa y/o condominio si están seleccionados
    let list = this.allBuildings;
    if (this.form.companyId) {
      list = list.filter(b => b.companyId === this.form.companyId);
    }
    if (this.form.condominiumId) {
      list = list.filter(b => b.condominiumId === this.form.condominiumId);
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
    this.formError   = '';
    this.formSuccess = '';

    const firstName = this.form.firstName.trim();
    const lastName  = this.form.lastName.trim();
    const username  = this.form.username.trim();
    const email     = this.form.email.trim().toLowerCase();
    const companyId    = this.form.companyId    || null;
    const condominiumId = this.form.condominiumId || null;
    const buildingIds  = [...new Set(this.form.buildingIds)];

    if (this.isSuperAdmin && !companyId) { this.formError = 'La empresa es obligatoria.'; return; }
    if (!firstName) { this.formError = 'El nombre es obligatorio.'; return; }
    if (!lastName)  { this.formError = 'Los apellidos son obligatorios.'; return; }
    if (!username)  { this.formError = 'El nombre de usuario es obligatorio.'; return; }
    if (!/^[a-z0-9][a-z0-9.\-_]*$/.test(username)) {
      this.formError = 'Nombre de usuario inválido. Solo minúsculas, números, puntos y guiones.'; return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.formError = 'Correo electrónico inválido.'; return;
    }
    if (!this.form.role) { this.formError = 'Debes seleccionar un rol.'; return; }
    if (buildingIds.length === 0) { this.formError = 'Debes asignar al menos un edificio.'; return; }

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
          this.formSuccess = `Usuario creado. Clave inicial: 123456`;
        } else {
          this.formSuccess = 'Cambios guardados correctamente.';
        }
        this.cdr.markForCheck();
      },
      error: err => {
        this.formError = extractApiErrorMessage(err, 'No se pudo guardar el usuario.');
        this.isSaving  = false;
        this.cdr.markForCheck();
      }
    });
  }

  askDelete():    void { this.confirmVisible = true; this.deleteError = ''; }
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
          this.deleteError = extractApiErrorMessage(err, 'No se pudo eliminar el usuario.');
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
