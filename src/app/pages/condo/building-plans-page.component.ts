import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingPlansApiService } from '../../api/building-plans-api.service';
import { PlansApiService } from '../../api/plans-api.service';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { CompaniesApiService } from '../../api/companies-api.service';
import { CondominiumsApiService } from '../../api/condominiums-api.service';
import {
  Building, BuildingPlan, BuildingPlanAssignRequest,
  BuildingPlanBulkAssignRequest, BuildingPlanSetRenewalRequest,
  BuildingPlanStatus, Company, Condominium, Plan,
} from '../../api/models';

const STATUS_LABEL: Record<BuildingPlanStatus, string> = {
  Active: 'Activo', ExpiringSoon: 'Por vencer', Expired: 'Vencido',
  Suspended: 'Suspendido', Archived: 'Archivado',
};
const STATUS_SEV: Record<BuildingPlanStatus, 'success' | 'warn' | 'danger' | 'secondary'> = {
  Active: 'success', ExpiringSoon: 'warn', Expired: 'danger',
  Suspended: 'danger', Archived: 'secondary',
};

type AssignTab = 'individual' | 'bulk';

@Component({
  standalone: true,
  selector: 'app-building-plans-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Asignaciones de planes</h1>
            <p>Planes asignados a edificios, condominios o empresas.</p>
          </div>
        </div>
        <p-button label="Asignar plan" icon="pi pi-plus" (onClick)="openAssign()"></p-button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>

      <!-- Filtros -->
      <div class="filter-bar">
        <select [(ngModel)]="filterStatus" (ngModelChange)="applyFilters()">
          <option value="">Todos los estados</option>
          <option value="Active">Activo</option>
          <option value="ExpiringSoon">Por vencer</option>
          <option value="Expired">Vencido</option>
          <option value="Suspended">Suspendido</option>
          <option value="Archived">Archivado</option>
        </select>
        <select [(ngModel)]="filterPlanId" (ngModelChange)="applyFilters()">
          <option value="">Todos los planes</option>
          <option *ngFor="let p of plans" [value]="p.id">{{ p.name }}</option>
        </select>
        <input [(ngModel)]="filterText" (ngModelChange)="applyFilters()"
               placeholder="Buscar edificio o empresa..." class="filter-input" />
      </div>

      <p class="app-state" *ngIf="loading">Cargando asignaciones...</p>
      <p class="app-state" *ngIf="!loading && !filtered.length && !pageError">No hay asignaciones para mostrar.</p>

      <div class="app-list" *ngIf="filtered.length">
        <div class="app-row header bp-grid">
          <span>Edificio</span>
          <span>Empresa</span>
          <span>Plan</span>
          <span>Estado</span>
          <span>Vencimiento</span>
          <span>Días</span>
          <span>Pagado</span>
        </div>
        <div class="app-row bp-grid" *ngFor="let item of filtered" [class.row-archived]="item.isArchived">
          <button class="row-link" (click)="openDetail(item)">{{ item.buildingName }}</button>
          <span class="text-muted">{{ item.companyName }}</span>
          <span>{{ item.planName }}</span>
          <p-tag [value]="statusLabel(item.status)" [severity]="statusSev(item.status)"></p-tag>
          <span>{{ fmtDate(item.endDate) }}</span>
          <span [class.days-warn]="item.daysUntilExpiry <= 5 && !item.isArchived"
                [class.days-danger]="item.daysUntilExpiry < 0 && !item.isArchived">
            {{ item.isArchived ? '—' : item.daysUntilExpiry + 'd' }}
          </span>
          <span>
            <span *ngIf="item.isPaid" class="icon-ok" title="Pagado">✓</span>
            <span *ngIf="!item.isPaid && item.hasPendingPayment" class="icon-pending" title="Pago pendiente de revisión">⏳</span>
            <span *ngIf="!item.isPaid && !item.hasPendingPayment" class="icon-no" title="Sin pago">✗</span>
          </span>
        </div>
      </div>
    </p-card>

    <!-- ═══════════════════════════════════ DETAIL PANEL ═══════════════════════════════════ -->
    <div class="ov-backdrop" *ngIf="detailVisible" (click)="closeDetail()"></div>
    <div class="ov-panel ov-panel-wide" *ngIf="detailVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <div>
          <strong>{{ detail?.buildingName }}</strong>
          <p-tag [value]="statusLabel(detail!.status)" [severity]="statusSev(detail!.status)" styleClass="ml-2"></p-tag>
        </div>
        <button class="ov-close" (click)="closeDetail()">✕</button>
      </div>

      <div class="detail-grid" *ngIf="detail">
        <div class="detail-row"><span class="dl">Plan</span><span class="dv">{{ detail.planName }}</span></div>
        <div class="detail-row"><span class="dl">Empresa</span><span class="dv">{{ detail.companyName }}</span></div>
        <div class="detail-row"><span class="dl">Ámbito</span><span class="dv">{{ detail.assignmentScope }}</span></div>
        <div class="detail-row"><span class="dl">Inicio</span><span class="dv">{{ fmtDate(detail.startDate) }}</span></div>
        <div class="detail-row"><span class="dl">Vencimiento</span><span class="dv">{{ fmtDate(detail.endDate) }}</span></div>
        <div class="detail-row"><span class="dl">Días restantes</span><span class="dv">{{ detail.daysUntilExpiry }}</span></div>
        <div class="detail-row">
          <span class="dl">Pagado</span>
          <span class="dv">
            {{ detail.isPaid ? 'Sí' : 'No' }}
            <span *ngIf="detail.isPaid && detail.paidByFullName"> — {{ detail.paidByFullName }}</span>
          </span>
        </div>
        <div class="detail-row" *ngIf="detail.renewalStartDate">
          <span class="dl">Renovación</span>
          <span class="dv">{{ fmtDate(detail.renewalStartDate!) }} → {{ fmtDate(detail.renewalEndDate!) }}</span>
        </div>
        <div class="detail-row">
          <span class="dl">Asignado por</span>
          <span class="dv">{{ detail.assignedByFullName }}</span>
        </div>
        <div class="detail-row" *ngIf="detail.hasPendingPayment">
          <span class="dl">Pago</span>
          <span class="dv warn-text">Hay un comprobante pendiente de revisión.</span>
        </div>
      </div>

      <!-- Renovación -->
      <div class="renewal-section" *ngIf="detail && !detail.isArchived && detail.status !== 'Suspended'">
        <h3>Establecer renovación</h3>
        <form class="ficha-form" (ngSubmit)="saveRenewal()">
          <div class="date-row">
            <label>
              <span>Inicio renovación</span>
              <input type="date" [(ngModel)]="renewalForm.renewalStartDate" name="rStart" required />
            </label>
            <label>
              <span>Fin renovación</span>
              <input type="date" [(ngModel)]="renewalForm.renewalEndDate" name="rEnd" required />
            </label>
          </div>
          <div class="renewal-footer">
            <p-button type="submit" [loading]="isSavingRenewal" label="Guardar renovación"
                      icon="pi pi-refresh"></p-button>
          </div>
        </form>
      </div>
    </div>

    <!-- ═══════════════════════════════════ ASSIGN MODAL ══════════════════════════════════ -->
    <div class="ov-backdrop" *ngIf="assignVisible" (click)="closeAssign()"></div>
    <div class="ov-panel" *ngIf="assignVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Asignar plan</strong>
        <button class="ov-close" (click)="closeAssign()">✕</button>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn" [class.active]="assignTab === 'individual'" (click)="assignTab = 'individual'">Individual</button>
        <button class="tab-btn" [class.active]="assignTab === 'bulk'" (click)="assignTab = 'bulk'">Por ámbito (bulk)</button>
      </div>

      <!-- Tab Individual -->
      <form class="ficha-form" *ngIf="assignTab === 'individual'" (ngSubmit)="saveAssign()">
        <label>
          <span>Plan <span class="req">*</span></span>
          <select [(ngModel)]="assignForm.planId" name="planId" required>
            <option value="">Seleccionar plan...</option>
            <option *ngFor="let p of plans" [value]="p.id">{{ p.name }} ({{ p.price === 0 ? 'Gratis' : p.price }})</option>
          </select>
        </label>
        <label>
          <span>Edificio <span class="req">*</span></span>
          <select [(ngModel)]="assignForm.buildingId" name="buildingId" required>
            <option value="">Seleccionar edificio...</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </label>
        <div class="date-row">
          <label>
            <span>Inicio <span class="req">*</span></span>
            <input type="date" [(ngModel)]="assignForm.startDate" name="startDate" required />
          </label>
          <label>
            <span>Fin <span class="req">*</span></span>
            <input type="date" [(ngModel)]="assignForm.endDate" name="endDate" required />
          </label>
        </div>
        <div class="ficha-footer">
          <span></span>
          <p-button type="submit" [loading]="isAssigning" label="Asignar"></p-button>
        </div>
      </form>

      <!-- Tab Bulk -->
      <form class="ficha-form" *ngIf="assignTab === 'bulk'" (ngSubmit)="saveBulkAssign()">
        <label>
          <span>Plan <span class="req">*</span></span>
          <select [(ngModel)]="bulkForm.planId" name="bPlanId" required>
            <option value="">Seleccionar plan...</option>
            <option *ngFor="let p of plans" [value]="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label>
          <span>Ámbito <span class="req">*</span></span>
          <select [(ngModel)]="bulkForm.scope" name="scope" (ngModelChange)="bulkForm.scopeEntityId = ''" required>
            <option value="">Seleccionar...</option>
            <option value="Company">Empresa</option>
            <option value="Condominium">Condominio</option>
          </select>
        </label>
        <label *ngIf="bulkForm.scope === 'Company'">
          <span>Empresa <span class="req">*</span></span>
          <select [(ngModel)]="bulkForm.scopeEntityId" name="scopeEntity" required>
            <option value="">Seleccionar empresa...</option>
            <option *ngFor="let c of companies" [value]="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label *ngIf="bulkForm.scope === 'Condominium'">
          <span>Condominio <span class="req">*</span></span>
          <select [(ngModel)]="bulkForm.scopeEntityId" name="scopeEntityCond" required>
            <option value="">Seleccionar condominio...</option>
            <option *ngFor="let c of condominiums" [value]="c.id">{{ c.name }}</option>
          </select>
        </label>
        <div class="date-row">
          <label>
            <span>Inicio <span class="req">*</span></span>
            <input type="date" [(ngModel)]="bulkForm.startDate" name="bStartDate" required />
          </label>
          <label>
            <span>Fin <span class="req">*</span></span>
            <input type="date" [(ngModel)]="bulkForm.endDate" name="bEndDate" required />
          </label>
        </div>
        <p class="bulk-hint">Se asignará el plan a todos los edificios activos dentro del ámbito seleccionado.
          Si algún edificio falla, se mostrará el detalle del error.</p>
        <div class="ficha-footer">
          <span></span>
          <p-button type="submit" [loading]="isAssigning" label="Asignar en bulk"></p-button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .bp-grid { grid-template-columns: 1.8fr 1.4fr 1.2fr 1fr 1fr 0.6fr 0.6fr; }
    .row-archived { opacity: 0.55; }
    .row-link {
      background: none; border: none; padding: 0; font: inherit; font-weight: 700;
      color: var(--brand-blue); cursor: pointer; text-align: left; text-decoration: underline dotted;
    }
    .row-link:hover { color: var(--brand-ink); }
    .text-muted { color: var(--brand-muted); font-size: 0.9rem; }
    .days-warn { color: #b45309; font-weight: 600; }
    .days-danger { color: #dc2626; font-weight: 700; }
    .icon-ok  { color: #16a34a; font-weight: 700; }
    .icon-pending { color: #d97706; }
    .icon-no  { color: #9ca3af; }
    .warn-text { color: #d97706; font-weight: 600; }

    .filter-bar { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .filter-bar select, .filter-input {
      padding: 0.4rem 0.7rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.9rem; background: var(--surface-ground, #f8fafc);
    }
    .filter-input { flex: 1; min-width: 180px; }

    /* OVERLAY */
    .ov-backdrop {
      position: fixed; inset: 0; background: rgba(15,35,50,0.45);
      z-index: 1000; backdrop-filter: blur(2px); animation: fadeIn 0.15s ease;
    }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(540px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28);
      padding: 1.6rem; animation: slideUp 0.2s cubic-bezier(.4,0,.2,1);
    }
    .ov-panel-wide { width: min(640px, calc(100vw - 2rem)); }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)); }
                         to   { opacity: 1; transform: translate(-50%, -50%); } }
    .ov-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 1.2rem; padding-bottom: 1rem;
      border-bottom: 1px solid rgba(19,133,182,0.1);
    }
    .ov-header > div { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .ov-header strong { font-size: 1.2rem; color: var(--brand-ink); }
    .ml-2 { margin-left: 0.5rem; }
    .ov-close {
      background: none; border: none; cursor: pointer; font-size: 1.1rem;
      color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%;
      display: grid; place-items: center; transition: background 0.15s; flex-shrink: 0;
    }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }

    .detail-grid { display: grid; gap: 0.5rem; margin-bottom: 1.5rem; }
    .detail-row { display: grid; grid-template-columns: 140px 1fr; gap: 0.5rem; padding: 0.35rem 0;
                  border-bottom: 1px solid rgba(19,133,182,0.06); }
    .dl { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .dv { font-size: 0.9rem; color: var(--brand-ink); }

    .renewal-section { border-top: 1px solid rgba(19,133,182,0.12); padding-top: 1.2rem; }
    .renewal-section h3 { margin: 0 0 1rem; font-size: 1rem; color: var(--brand-ink); }
    .renewal-footer { display: flex; justify-content: flex-end; padding-top: 0.5rem; }

    .ficha-form { display: grid; gap: 1rem; }
    .ficha-form label > span:first-child { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted);
                                           display: block; margin-bottom: 0.25rem; }
    .ficha-form input, .ficha-form select {
      width: 100%; padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25);
      border-radius: 10px; font: inherit; font-size: 0.95rem; color: var(--brand-ink);
      background: var(--surface-ground, #f8fafc); transition: border-color 0.15s;
    }
    .ficha-form input:focus, .ficha-form select:focus { outline: none; border-color: var(--brand-blue); }
    .date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .ficha-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; }
    .req { color: var(--red-400); }

    .tabs { display: flex; gap: 0.25rem; margin-bottom: 1.2rem; border-bottom: 2px solid rgba(19,133,182,0.1); }
    .tab-btn {
      background: none; border: none; padding: 0.5rem 1.1rem; cursor: pointer; font: inherit;
      font-size: 0.9rem; font-weight: 600; color: var(--brand-muted);
      border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color 0.15s, border-color 0.15s;
    }
    .tab-btn.active { color: var(--brand-blue); border-bottom-color: var(--brand-blue); }
    .bulk-hint {
      font-size: 0.82rem; color: var(--brand-muted); background: rgba(19,133,182,0.06);
      border-radius: 8px; padding: 0.5rem 0.75rem; line-height: 1.5;
    }
  `]
})
export class BuildingPlansPageComponent implements OnInit {
  private readonly api = inject(BuildingPlansApiService);
  private readonly plansApi = inject(PlansApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly condominiumsApi = inject(CondominiumsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  items: BuildingPlan[] = [];
  filtered: BuildingPlan[] = [];
  plans: Plan[] = [];
  buildings: Building[] = [];
  companies: Company[] = [];
  condominiums: Condominium[] = [];
  loading = true;
  pageError = '';

  filterStatus = '';
  filterPlanId = '';
  filterText = '';

  detailVisible = false;
  detail: BuildingPlan | null = null;
  renewalForm: BuildingPlanSetRenewalRequest = { renewalStartDate: '', renewalEndDate: '' };
  isSavingRenewal = false;

  assignVisible = false;
  assignTab: AssignTab = 'individual';
  assignForm: BuildingPlanAssignRequest = { planId: '', buildingId: '', startDate: '', endDate: '' };
  bulkForm: BuildingPlanBulkAssignRequest = { planId: '', scope: 'Company', scopeEntityId: '', startDate: '', endDate: '' };
  isAssigning = false;

  ngOnInit(): void {
    forkJoin({
      bplans: this.api.getAll(),
      plans: this.plansApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      companies: this.companiesApi.getAll(),
      condominiums: this.condominiumsApi.getAll(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ bplans, plans, buildings, companies, condominiums }) => {
        this.items = bplans;
        this.plans = plans;
        this.buildings = buildings.filter(b => b.isActive).sort((a, b) => a.name.localeCompare(b.name));
        this.companies = companies.filter(c => c.isActive).sort((a, b) => a.name.localeCompare(b.name));
        this.condominiums = condominiums.filter(c => c.isActive).sort((a, b) => a.name.localeCompare(b.name));
        this.applyFilters();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.pageError = 'No se pudieron cargar las asignaciones.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applyFilters(): void {
    const text = this.filterText.toLowerCase();
    this.filtered = this.items.filter(x =>
      (!this.filterStatus || x.status === this.filterStatus) &&
      (!this.filterPlanId || x.planId === this.filterPlanId) &&
      (!text || x.buildingName.toLowerCase().includes(text) || x.companyName.toLowerCase().includes(text))
    );
  }

  openDetail(item: BuildingPlan): void {
    this.detail = item;
    this.renewalForm = {
      renewalStartDate: item.renewalStartDate ? this.toDateInput(item.renewalStartDate) : '',
      renewalEndDate: item.renewalEndDate ? this.toDateInput(item.renewalEndDate) : '',
    };
    this.detailVisible = true;
  }

  closeDetail(): void {
    this.detailVisible = false;
    this.detail = null;
  }

  saveRenewal(): void {
    if (this.isSavingRenewal || !this.detail) return;
    if (!this.renewalForm.renewalStartDate || !this.renewalForm.renewalEndDate) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Ambas fechas de renovación son obligatorias.', life: 5000 });
      return;
    }
    this.isSavingRenewal = true;
    this.api.setRenewal(this.detail.id, this.renewalForm).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.items = this.items.map(x => x.id === updated.id ? updated : x);
        this.detail = updated;
        this.applyFilters();
        this.isSavingRenewal = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Renovación guardada.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar la renovación.'), life: 5000 });
        this.isSavingRenewal = false;
        this.cdr.markForCheck();
      }
    });
  }

  openAssign(): void {
    this.assignTab = 'individual';
    this.assignForm = { planId: '', buildingId: '', startDate: '', endDate: '' };
    this.bulkForm = { planId: '', scope: 'Company', scopeEntityId: '', startDate: '', endDate: '' };
    this.assignVisible = true;
  }

  closeAssign(): void { this.assignVisible = false; }

  saveAssign(): void {
    if (this.isAssigning) return;
    const { planId, buildingId, startDate, endDate } = this.assignForm;
    if (!planId || !buildingId || !startDate || !endDate) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Todos los campos son obligatorios.', life: 5000 });
      return;
    }
    this.isAssigning = true;
    this.api.assign({ planId, buildingId, startDate, endDate }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: bp => {
        this.items = [bp, ...this.items];
        this.applyFilters();
        this.isAssigning = false;
        this.closeAssign();
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Plan asignado a "${bp.buildingName}".`, life: 4000 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo asignar el plan.'), life: 5000 });
        this.isAssigning = false;
        this.cdr.markForCheck();
      }
    });
  }

  saveBulkAssign(): void {
    if (this.isAssigning) return;
    const { planId, scope, scopeEntityId, startDate, endDate } = this.bulkForm;
    if (!planId || !scope || !scopeEntityId || !startDate || !endDate) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Todos los campos son obligatorios.', life: 5000 });
      return;
    }
    this.isAssigning = true;
    this.api.bulkAssign({ planId, scope: scope as 'Company' | 'Condominium', scopeEntityId, startDate, endDate })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (bps: BuildingPlan[]) => {
          this.items = [...bps, ...this.items];
          this.applyFilters();
          this.isAssigning = false;
          this.closeAssign();
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: `${bps.length} edificio(s) asignados.`, life: 4000 });
          this.cdr.markForCheck();
        },
        error: err => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'Error en asignación bulk.'), life: 5000 });
          this.isAssigning = false;
          this.cdr.markForCheck();
        }
      });
  }

  statusLabel(s: BuildingPlanStatus): string { return STATUS_LABEL[s] ?? s; }
  statusSev(s: BuildingPlanStatus): 'success' | 'warn' | 'danger' | 'secondary' { return STATUS_SEV[s] ?? 'secondary'; }

  fmtDate(d: string | null): string {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private toDateInput(d: string): string {
    return new Date(d).toISOString().substring(0, 10);
  }
}
