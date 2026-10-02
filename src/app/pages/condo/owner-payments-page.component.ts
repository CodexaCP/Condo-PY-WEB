import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { OwnerPaymentsApiService } from '../../api/owner-payments-api.service';
import { OwnersApiService } from '../../api/owners-api.service';
import { PaymentsApiService } from '../../api/payments-api.service';
import { AuthService } from '../../auth/auth.service';
import { Owner, OwnerPayment, Payment, PaymentMethod, RegisterComprobante, RegisterPreview } from '../../api/models';

const STATUS_LABELS: Record<string, string> = {
  Pending:     'Pendiente',
  UnderReview: 'En Revisión',
  Approved:    'Aprobado',
  Rejected:    'Rechazado'
};

const STATUS_SEVERITY: Record<string, 'warn' | 'info' | 'success' | 'danger' | 'secondary'> = {
  Pending:     'warn',
  UnderReview: 'info',
  Approved:    'success',
  Rejected:    'danger'
};

const METHOD_LABELS: Record<string, string> = {
  Cash: 'Efectivo', BankTransfer: 'Transferencia', Card: 'Tarjeta', Check: 'Cheque', Other: 'Otro'
};

type BuildingGroup = { label: string; items: OwnerPayment[]; pendingCount: number };
type PaymentsTab = 'app' | 'web';

const FILTERS: { label: string; value: string }[] = [
  { label: 'Todos',        value: '' },
  { label: 'Pendiente',    value: 'Pending' },
  { label: 'En Revisión',  value: 'UnderReview' },
  { label: 'Aprobado',     value: 'Approved' },
  { label: 'Rechazado',    value: 'Rejected' }
];

@Component({
  standalone: true,
  selector: 'app-owner-payments-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag, Tooltip],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Pagos</h1>
            <p>Pagos de propietarios: los que envían desde la app y los que registra el sistema.</p>
          </div>
        </div>
        <p-button
          *ngIf="tab === 'web' && canRegister"
          [label]="showRegister ? 'Cerrar formulario' : 'Registrar pago'"
          [icon]="showRegister ? 'pi pi-times' : 'pi pi-plus'"
          (onClick)="toggleRegister()">
        </p-button>
      </div>

      <!-- Las dos secciones de la pantalla -->
      <div class="main-tabs">
        <button type="button" class="main-tab" [class.active]="tab === 'app'" (click)="setTab('app')">
          <i class="pi pi-mobile"></i> Hechos por el propietario
          <span class="tab-badge" *ngIf="pendingAppCount > 0">{{ pendingAppCount }} por procesar</span>
        </button>
        <button type="button" class="main-tab" [class.active]="tab === 'web'" (click)="setTab('web')">
          <i class="pi pi-desktop"></i> Hechos por el sistema
        </button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>

      <!-- ══════════ Registrar pago (sistema) ══════════ -->
      <form class="panel-box" *ngIf="tab === 'web' && showRegister" (ngSubmit)="submitRegister()">
        <div class="panel-box-title"><span class="pi pi-wallet"></span> Registrar pago de un propietario</div>
        <p class="panel-hint">
          Para el propietario que no usa la app. Se cobra el comprobante completo, del más antiguo al más nuevo,
          igual que un pago aprobado desde la app: genera la referencia PAY-, el borrador de factura y avisa al propietario.
        </p>

        <!-- 1. Propietario -->
        <div class="field-block">
          <span>1. Propietario <em>*</em></span>
          <input type="text" [(ngModel)]="ownerQuery" name="ownerQuery" placeholder="Buscar por nombre, usuario o documento…" autocomplete="off" />
          <div class="owner-list" *ngIf="!selectedOwner">
            <button type="button" class="owner-option" *ngFor="let o of filteredOwners" (click)="selectOwner(o)">
              {{ o.fullName }} <small>{{ o.username }}<ng-container *ngIf="o.documentNumber"> · {{ o.documentNumber }}</ng-container></small>
            </button>
            <p class="app-state" *ngIf="!filteredOwners.length">{{ ownersLoading ? 'Cargando propietarios…' : 'Sin resultados.' }}</p>
          </div>
          <div class="owner-chosen" *ngIf="selectedOwner">
            <strong>{{ selectedOwner.fullName }}</strong>
            <p-button type="button" label="Cambiar" icon="pi pi-pencil" severity="secondary" [text]="true" size="small" (onClick)="clearOwner()"></p-button>
          </div>
        </div>

        <p class="app-state" *ngIf="previewLoading">Cargando comprobantes pendientes…</p>

        <ng-container *ngIf="preview && !previewLoading">
          <p-message *ngIf="preview.pendingOwnerPayments.length" severity="warn"
            [text]="'El propietario tiene un pago enviado desde la app sin resolver (' + preview.pendingOwnerPayments[0].reference + '). Apruébelo o recházalo en la pestaña “Hechos por el propietario” antes de registrar otro.'">
          </p-message>
          <p-message *ngIf="!preview.comprobantes.length" severity="info"
            text="Este propietario no tiene comprobantes pendientes de pago (solo se cobran periodos publicados)."></p-message>

          <!-- 2. Hasta qué comprobante -->
          <div class="field-block" *ngIf="preview.comprobantes.length">
            <span>2. ¿Hasta qué comprobante cubre el pago? <em>*</em></span>
            <p class="panel-hint" *ngIf="preview.availableCredit > 0">
              Saldo a favor del propietario: <strong>{{ formatCurrency(preview.availableCredit) }}</strong>. Se descuenta solo, si hace falta.
            </p>
            <div class="comp-table">
              <div class="comp-row comp-head">
                <span></span><span>Comprobante</span><span class="right">Total</span><span class="right">Acumulado</span><span class="right">Monto a recibir</span>
              </div>
              <div class="comp-block" *ngFor="let c of preview.comprobantes; let i = index">
                <label class="comp-row" [class.selected]="selectedIndex === i" [class.disabled]="!optionEnabled(i)">
                  <input type="radio" name="coverUpTo" [value]="i" [(ngModel)]="selectedIndex" [disabled]="!optionEnabled(i)" />
                  <span>
                    <strong>{{ c.periodMonth | number:'2.0-0' }}/{{ c.periodYear }}</strong> · unidad {{ c.unitCode }}
                    <small>{{ c.buildingName }}</small>
                    <small class="warn" *ngIf="!c.inScope">Edificio fuera de tu alcance</small>
                  </span>
                  <span class="right">{{ formatCurrency(c.total) }}</span>
                  <span class="right">{{ formatCurrency(c.cumulativeTotal) }}</span>
                  <span class="right strong">{{ optionLabel(i) }}</span>
                </label>
                <div class="comp-lines" *ngIf="selectedIndex === i || selectedIndex > i">
                  <span *ngFor="let l of c.lines">{{ l.concept }}: {{ formatCurrency(l.pending) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Datos del cobro -->
          <div class="payment-form" *ngIf="selectedIndex >= 0">
            <div class="field-block">
              <span>Monto recibido</span>
              <strong class="amount-big">{{ formatCurrency(registerAmount) }}</strong>
            </div>
            <div class="field-block">
              <span>Fecha del pago <em>*</em></span>
              <input type="date" [(ngModel)]="form.paymentDate" name="paymentDate" [max]="today" required />
            </div>
            <div class="field-block">
              <span>Método <em>*</em></span>
              <select [(ngModel)]="form.method" name="method" required>
                <option *ngFor="let m of methods" [value]="m">{{ methodLabel(m) }}</option>
              </select>
            </div>
            <div class="field-block">
              <span>N° de transferencia / documento</span>
              <input type="text" [(ngModel)]="form.externalReference" name="externalReference" maxlength="100" placeholder="Ej: TRF-00123" />
            </div>
            <div class="field-block wide2">
              <span>Notas opcionales</span>
              <input type="text" [(ngModel)]="form.notes" name="notes" maxlength="500" placeholder="Observaciones adicionales" />
            </div>
          </div>

          <div class="summary-box" *ngIf="selectedIndex >= 0">
            Se registrará el cobro de <strong>{{ formatCurrency(registerAmount) }}</strong> de
            <strong>{{ preview.ownerFullName }}</strong>, cubriendo {{ selectedIndex + 1 }}
            {{ selectedIndex === 0 ? 'comprobante' : 'comprobantes' }} (el pago no se puede editar; si hay un error se revierte y se vuelve a registrar).
          </div>

          <div class="form-actions">
            <p-button type="submit" icon="pi pi-check" label="Registrar pago"
              [loading]="registering" [disabled]="!canSubmitRegister"></p-button>
          </div>
        </ng-container>
      </form>

      <!-- ══════════ Filtros por estado (solo pagos de la app) ══════════ -->
      <div class="status-tabs" *ngIf="tab === 'app'">
        <button
          *ngFor="let f of filters"
          class="status-tab"
          [class.active]="selectedStatus === f.value"
          (click)="selectFilter(f.value)">
          {{ f.label }}
          <span *ngIf="countFor(f.value) > 0" class="tab-count">{{ countFor(f.value) }}</span>
        </button>
      </div>

      <!-- Búsqueda (pagos del sistema) -->
      <div class="filters-bar" *ngIf="tab === 'web'">
        <span class="pi pi-search"></span>
        <input type="text" [(ngModel)]="webSearch" name="webSearch" (ngModelChange)="applyFilter()" placeholder="Buscar por propietario o referencia" />
      </div>

      <p class="app-state" *ngIf="loading">Cargando pagos...</p>
      <p class="app-state" *ngIf="!loading && !filtered.length && !pageError">
        {{ tab === 'web' ? 'Todavía no hay pagos registrados por el sistema.' : 'No hay pagos ' + (selectedStatus ? 'con este estado' : 'registrados') + '.' }}
      </p>

      <!-- Agrupado por edificio: cada usuario solo recibe del backend los pagos de sus edificios asignados. -->
      <section class="building-group" *ngFor="let group of groups">
        <h2 class="group-title">
          <i class="pi pi-building"></i>
          {{ group.label }}
          <span class="group-count">{{ group.items.length }}</span>
          <span *ngIf="group.pendingCount > 0" class="group-pending">{{ group.pendingCount }} por procesar</span>
        </h2>
        <div class="app-list">
          <div class="app-row header grid-op">
            <span>Referencia</span>
            <span>Propietario</span>
            <span>Fecha Pago</span>
            <span class="right">{{ tab === 'web' ? 'Monto recibido' : 'Monto Declarado' }}</span>
            <span>{{ tab === 'web' ? 'Método' : 'Estado' }}</span>
            <span>{{ tab === 'web' ? 'Registrado' : 'Enviado' }}</span>
          </div>
          <div class="app-row grid-op" *ngFor="let item of group.items">
            <button class="row-link monospace" (click)="goToDetail(item.id)">
              {{ item.reference }}
            </button>
            <span>
              {{ item.ownerFullName }}
              <span *ngIf="item.canProcess === false" class="readonly-hint"
                    title="Incluye unidades de edificios que no tenés asignados: solo lectura.">solo lectura</span>
            </span>
            <span>{{ item.paymentDate | date:'dd/MM/yyyy' }}</span>
            <span class="right amount-col">{{ item.declaredAmount | number:'1.0-2' }}</span>
            <span *ngIf="tab === 'web'">
              {{ methodLabel(item.method) }}
              <p-tag *ngIf="item.reversedAt" value="Revertido" severity="danger"></p-tag>
            </span>
            <p-tag *ngIf="tab === 'app'"
              [value]="statusLabel(item.status)"
              [severity]="statusSeverity(item.status)">
            </p-tag>
            <span class="date-col">{{ item.createdAtUtc | date:'dd/MM/yyyy HH:mm' }}</span>
          </div>
        </div>
      </section>

      <!-- Histórico: pagos cargados a mano antes de unificar el flujo (solo lectura) -->
      <section class="legacy" *ngIf="tab === 'web'">
        <button type="button" class="legacy-head" (click)="toggleLegacy()" [attr.aria-expanded]="legacyOpen">
          <span class="pi" [ngClass]="legacyOpen ? 'pi-chevron-down' : 'pi-chevron-right'"></span>
          Histórico anterior <small>(pagos cargados a mano antes de este cambio, solo lectura)</small>
        </button>
        <ng-container *ngIf="legacyOpen">
          <p class="app-state" *ngIf="legacyLoading">Cargando histórico…</p>
          <p class="app-state" *ngIf="!legacyLoading && !legacy.length">No hay pagos en el histórico anterior.</p>
          <div class="app-list" *ngIf="legacy.length">
            <div class="app-row header grid-legacy">
              <span>Fecha</span><span>Periodo · Edificio</span><span>Unidad</span><span>Método</span><span class="right">Monto</span><span>Referencia</span><span></span>
            </div>
            <div class="app-row grid-legacy" [class.reversed-row]="p.isReversed" *ngFor="let p of legacy">
              <strong>{{ p.paymentDate }}</strong>
              <span>{{ p.expensePeriodName }} · {{ p.buildingName }}
                <p-tag *ngIf="p.isReversed" value="Revertido" severity="danger"></p-tag></span>
              <span>{{ p.unitCode }}</span>
              <span>{{ methodLabel(p.method) }}</span>
              <span class="right amount-col">{{ formatCurrency(p.amount) }}</span>
              <span>{{ p.reference }}</span>
              <span>
                <a [href]="legacyPdfUrl(p.id)" target="_blank" class="pdf-link" title="Descargar PDF"><i class="pi pi-file-pdf"></i></a>
                <p-button *ngIf="canRevertLegacy && !p.isReversed" type="button" icon="pi pi-undo" severity="warn" [rounded]="true" [text]="true"
                  [disabled]="legacyBusy" pTooltip="Revertir" (onClick)="revertLegacy(p)"></p-button>
              </span>
            </div>
          </div>
        </ng-container>
      </section>
    </p-card>
  `,
  styles: [`
    .main-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.2rem; flex-wrap: wrap; border-bottom: 2px solid rgba(20,54,61,0.1); }
    .main-tab {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1.1rem; background: transparent; border: none;
      border-bottom: 3px solid transparent; margin-bottom: -2px; cursor: pointer; font-size: 0.95rem; font-weight: 700;
      color: var(--brand-muted);
    }
    .main-tab.active { color: var(--p-primary-color); border-bottom-color: var(--p-primary-color); }
    .tab-badge { font-size: 0.72rem; font-weight: 700; color: #ea580c; background: rgba(234,88,12,0.1); border-radius: 10px; padding: 0.05rem 0.5rem; }

    .status-tabs   { display: flex; gap: 0.5rem; margin-bottom: 1.2rem; flex-wrap: wrap; }
    .status-tab    {
      padding: 0.3rem 0.9rem; border-radius: 20px; border: 1.5px solid var(--p-primary-color);
      background: transparent; cursor: pointer; font-size: 0.82rem; font-weight: 600;
      color: var(--p-primary-color); transition: all 0.15s; display: flex; align-items: center; gap: 0.35rem;
    }
    .status-tab.active { background: var(--p-primary-color); color: #fff; }
    .status-tab:hover:not(.active) { background: color-mix(in srgb, var(--p-primary-color) 10%, transparent); }
    .tab-count     {
      background: rgba(0,0,0,0.12); border-radius: 10px;
      padding: 0 0.4rem; font-size: 0.75rem; min-width: 1.2rem; text-align: center;
    }
    .active .tab-count { background: rgba(255,255,255,0.25); }
    .filters-bar { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.2rem; max-width: 420px; }
    .filters-bar input { flex: 1; border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px; padding: 0.5rem 0.75rem; font-size: 0.92rem; }

    .building-group { margin-bottom: 1.6rem; }
    .group-title   {
      display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.6rem;
      font-size: 1.05rem; font-weight: 700; color: var(--brand-ink);
    }
    .group-count   {
      background: rgba(0,0,0,0.08); border-radius: 10px; padding: 0 0.5rem;
      font-size: 0.78rem; font-weight: 600;
    }
    .group-pending { font-size: 0.78rem; font-weight: 600; color: var(--p-orange-600, #ea580c); }
    .readonly-hint {
      margin-left: 0.4rem; padding: 0 0.4rem; border-radius: 8px; font-size: 0.7rem;
      background: rgba(0,0,0,0.08); color: var(--brand-muted);
    }
    .grid-op       { grid-template-columns: 1.3fr 1.4fr 0.9fr 1fr 0.9fr 1.1fr; }
    .grid-legacy   { grid-template-columns: 0.8fr 1.6fr 0.6fr 0.9fr 0.9fr 1fr 0.7fr; }
    .reversed-row  { opacity: 0.55; }
    .pdf-link      { color: var(--brand-muted); margin-right: 0.4rem; }
    .monospace     { font-family: monospace; font-size: 0.88rem; }
    .right         { text-align: right; }
    .amount-col    { font-weight: 600; font-family: monospace; }
    .date-col      { font-size: 0.85rem; color: var(--brand-muted); }
    .row-link      {
      background: none; border: none; padding: 0; font: inherit; font-weight: 700;
      color: var(--brand-blue); cursor: pointer; text-align: left; text-decoration: underline dotted;
    }
    .row-link:hover { color: var(--brand-ink); }

    .panel-box { border: 1.5px solid rgba(19,133,182,0.25); background: rgba(235,247,255,0.45); border-radius: 16px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; display: grid; gap: 1rem; }
    .panel-box-title { font-weight: 700; font-size: 0.95rem; color: var(--brand-ink); display: flex; align-items: center; gap: 0.5rem; }
    .panel-box-title .pi { color: var(--brand-blue); }
    .panel-hint { margin: 0; font-size: 0.85rem; color: var(--brand-muted); }
    .field-block { display: flex; flex-direction: column; gap: 0.3rem; }
    .field-block > span { font-size: 0.8rem; font-weight: 600; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .field-block em { color: #e53e3e; font-style: normal; }
    .field-block select, .field-block input[type="text"], .field-block input[type="date"] {
      border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px; padding: 0.5rem 0.75rem; font-size: 0.92rem;
      color: var(--brand-ink); background: #fff; outline: none; width: 100%; box-sizing: border-box;
    }
    .payment-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .wide2 { grid-column: span 2; }
    .amount-big { font-size: 1.4rem; color: var(--brand-ink); }
    .owner-list { max-height: 220px; overflow: auto; border: 1px solid rgba(20,54,61,0.12); border-radius: 10px; background: #fff; }
    .owner-option { display: flex; justify-content: space-between; gap: 1rem; width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.8rem; cursor: pointer; font: inherit; }
    .owner-option:hover { background: rgba(19,133,182,0.08); }
    .owner-option small { color: var(--brand-muted); }
    .owner-chosen { display: flex; align-items: center; gap: 0.75rem; padding: 0.4rem 0.8rem; background: #fff; border: 1.5px solid rgba(26,140,91,0.35); border-radius: 10px; }

    .comp-table { display: grid; gap: 0.35rem; }
    .comp-row { display: grid; grid-template-columns: 2rem 2.2fr 1fr 1fr 1.2fr; align-items: center; gap: 0.5rem; padding: 0.5rem 0.7rem; border-radius: 10px; background: #fff; border: 1.5px solid rgba(20,54,61,0.1); cursor: pointer; }
    .comp-row.comp-head { background: transparent; border: none; cursor: default; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--brand-muted); }
    .comp-row.selected { border-color: var(--p-primary-color); background: color-mix(in srgb, var(--p-primary-color) 8%, #fff); }
    .comp-row.disabled { opacity: 0.5; cursor: not-allowed; }
    .comp-row small { display: block; color: var(--brand-muted); }
    .comp-row small.warn { color: #b45309; }
    .comp-row .strong { font-weight: 700; font-family: monospace; }
    .comp-lines { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; padding: 0.3rem 0.7rem 0.3rem 2.7rem; font-size: 0.8rem; color: var(--brand-muted); }
    .summary-box { padding: 0.8rem 1rem; border-radius: 12px; background: rgba(26,140,91,0.08); border: 1px solid rgba(26,140,91,0.25); font-size: 0.9rem; }
    .form-actions { display: flex; justify-content: flex-end; }

    .legacy { margin-top: 2rem; border-top: 1px solid rgba(20,54,61,0.1); padding-top: 1rem; }
    .legacy-head { display: flex; align-items: center; gap: 0.5rem; background: none; border: none; cursor: pointer; font-size: 0.95rem; font-weight: 700; color: var(--brand-ink); padding: 0.3rem 0; }
    .legacy-head small { font-weight: 400; color: var(--brand-muted); }
  `]
})
export class OwnerPaymentsPageComponent implements OnInit {
  private readonly api         = inject(OwnerPaymentsApiService);
  private readonly ownersApi   = inject(OwnersApiService);
  private readonly paymentsApi = inject(PaymentsApiService);
  private readonly auth        = inject(AuthService);
  private readonly msg         = inject(MessageService);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly destroyRef  = inject(DestroyRef);
  private readonly cdr         = inject(ChangeDetectorRef);

  readonly filters = FILTERS;
  readonly methods: PaymentMethod[] = ['BankTransfer', 'Cash', 'Check', 'Card', 'Other'];
  readonly today = new Date().toISOString().slice(0, 10);

  tab: PaymentsTab = 'app';

  all:            OwnerPayment[] = [];
  filtered:       OwnerPayment[] = [];
  groups:         BuildingGroup[] = [];
  selectedStatus  = '';
  webSearch       = '';
  loading         = true;
  pageError       = '';

  // Registro de un pago por el sistema
  showRegister   = false;
  owners:         Owner[] = [];
  ownersLoading  = false;
  ownerQuery     = '';
  selectedOwner: Owner | null = null;
  preview:       RegisterPreview | null = null;
  previewLoading = false;
  selectedIndex  = -1;
  registering    = false;
  form = this.createInitialForm();

  // Histórico de pagos cargados a mano antes de unificar
  legacyOpen    = false;
  legacyLoading = false;
  legacyBusy    = false;
  legacy:       Payment[] = [];

  get canRegister(): boolean {
    return this.auth.hasRole('SuperAdmin', 'CompanyAdmin', 'BuildingManager', 'CompanyOperator');
  }

  get canRevertLegacy(): boolean { return this.auth.hasRole('SuperAdmin'); }

  get pendingAppCount(): number {
    return this.all.filter(p => p.channel !== 'Web' && (p.status === 'Pending' || p.status === 'UnderReview')).length;
  }

  get filteredOwners(): Owner[] {
    const q = this.ownerQuery.trim().toLowerCase();
    const list = q
      ? this.owners.filter(o => [o.fullName, o.username, o.documentNumber ?? ''].some(v => v.toLowerCase().includes(q)))
      : this.owners;
    return list.slice(0, 30);
  }

  get registerAmount(): number {
    return this.preview?.comprobantes[this.selectedIndex]?.amountToReceive ?? 0;
  }

  get canSubmitRegister(): boolean {
    return !!this.preview && this.selectedIndex >= 0 && this.optionEnabled(this.selectedIndex)
      && !this.preview.pendingOwnerPayments.length && !!this.form.paymentDate && !!this.form.method;
  }

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('tab') === 'web') this.tab = 'web';
    this.load();
  }

  load(): void {
    this.api.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => {
          this.all      = items;
          this.applyFilter();
          this.loading  = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.pageError = 'No se pudieron cargar los pagos.';
          this.loading   = false;
          this.cdr.markForCheck();
        }
      });
  }

  setTab(tab: PaymentsTab): void {
    this.tab = tab;
    this.router.navigate([], { queryParams: { tab: tab === 'web' ? 'web' : null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.applyFilter();
  }

  selectFilter(value: string): void {
    this.selectedStatus = value;
    this.applyFilter();
  }

  countFor(status: string): number {
    if (!status) return 0;
    return this.all.filter(p => p.channel !== 'Web' && p.status === status).length;
  }

  goToDetail(id: string): void {
    this.router.navigate(['/owner-payments', id]);
  }

  statusLabel(status: string): string     { return STATUS_LABELS[status] ?? status; }
  statusSeverity(status: string): 'warn' | 'info' | 'success' | 'danger' | 'secondary' {
    return STATUS_SEVERITY[status] ?? 'secondary';
  }
  methodLabel(method: string): string { return METHOD_LABELS[method] ?? method; }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  applyFilter(): void {
    if (this.tab === 'web') {
      const q = this.webSearch.trim().toLowerCase();
      this.filtered = this.all.filter(p => p.channel === 'Web'
        && (!q || p.ownerFullName.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q)
            || (p.externalReference ?? '').toLowerCase().includes(q)));
    } else {
      const app = this.all.filter(p => p.channel !== 'Web');
      this.filtered = this.selectedStatus ? app.filter(p => p.status === this.selectedStatus) : app;
    }
    this.groups = this.buildGroups(this.filtered);
    this.cdr.markForCheck();
  }

  // ── Registrar pago por el sistema ──────────────────────────────────────

  toggleRegister(): void {
    this.showRegister = !this.showRegister;
    if (this.showRegister && !this.owners.length) this.loadOwners();
    if (!this.showRegister) this.resetRegister();
  }

  private loadOwners(): void {
    this.ownersLoading = true;
    this.ownersApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: owners => {
        this.owners = owners.filter(o => o.isActive).sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
        this.ownersLoading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.ownersLoading = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar los propietarios.'), life: 5000 });
        this.cdr.markForCheck();
      }
    });
  }

  selectOwner(owner: Owner): void {
    this.selectedOwner = owner;
    this.ownerQuery = owner.fullName;
    this.preview = null;
    this.selectedIndex = -1;
    this.previewLoading = true;
    this.api.getRegisterPreview(owner.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: preview => {
        this.preview = preview;
        this.previewLoading = false;
        // Por defecto, el comprobante más antiguo (lo más común: se cobra el mes).
        this.selectedIndex = preview.comprobantes.length && this.optionEnabled(0, preview) ? 0 : -1;
        this.cdr.markForCheck();
      },
      error: error => {
        this.previewLoading = false;
        this.selectedOwner = null;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar los comprobantes del propietario.'), life: 5000 });
        this.cdr.markForCheck();
      }
    });
  }

  clearOwner(): void {
    this.selectedOwner = null;
    this.ownerQuery = '';
    this.preview = null;
    this.selectedIndex = -1;
  }

  // Se puede cubrir hasta el comprobante i si ninguno de los anteriores (ni este) queda fuera del alcance del
  // usuario, el monto a recibir es mayor que cero y no coincide con otro acumulado (el backend probaría ese primero).
  optionEnabled(index: number, preview: RegisterPreview | null = this.preview): boolean {
    if (!preview) return false;
    const rows = preview.comprobantes;
    if (index < 0 || index >= rows.length) return false;
    for (let i = 0; i <= index; i++) if (!rows[i].inScope) return false;
    const amount = rows[index].amountToReceive;
    if (amount <= 0) return false;
    return !rows.some((c: RegisterComprobante, j) => j !== index && preview.availableCredit > 0 && Math.abs(c.cumulativeTotal - amount) <= 0.5);
  }

  optionLabel(index: number): string {
    const c = this.preview?.comprobantes[index];
    if (!c) return '';
    if (c.amountToReceive <= 0) return 'Cubierto por saldo a favor';
    return this.formatCurrency(c.amountToReceive);
  }

  submitRegister(): void {
    if (!this.canSubmitRegister || !this.preview) return;
    this.registering = true;
    this.api.register({
      ownerId: this.preview.ownerId,
      paymentDate: this.form.paymentDate,
      amount: this.registerAmount,
      method: this.form.method,
      externalReference: this.form.externalReference.trim(),
      notes: this.form.notes.trim()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: payment => {
        this.registering = false;
        this.msg.add({ severity: 'success', summary: 'Pago registrado', detail: `Referencia ${payment.reference}. El borrador de factura quedó preparado y el propietario fue notificado.`, life: 6000 });
        this.resetRegister();
        this.showRegister = false;
        this.goToDetail(payment.id);
      },
      error: error => {
        this.registering = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo registrar el pago.'), life: 7000 });
        this.cdr.markForCheck();
      }
    });
  }

  private resetRegister(): void {
    this.clearOwner();
    this.form = this.createInitialForm();
  }

  private createInitialForm() {
    return {
      paymentDate: new Date().toISOString().slice(0, 10),
      method: 'BankTransfer' as PaymentMethod,
      externalReference: '',
      notes: ''
    };
  }

  // ── Histórico anterior ─────────────────────────────────────────────────

  toggleLegacy(): void {
    this.legacyOpen = !this.legacyOpen;
    if (this.legacyOpen && !this.legacy.length && !this.legacyLoading) this.loadLegacy();
  }

  private loadLegacy(): void {
    this.legacyLoading = true;
    this.paymentsApi.getAll({ legacyOnly: true }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => { this.legacy = items; this.legacyLoading = false; this.cdr.markForCheck(); },
      error: error => {
        this.legacyLoading = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el histórico.'), life: 5000 });
        this.cdr.markForCheck();
      }
    });
  }

  legacyPdfUrl(id: string): string {
    return this.paymentsApi.getReceiptPdfUrl(id, this.auth.getToken() ?? '');
  }

  revertLegacy(item: Payment): void {
    this.legacyBusy = true;
    this.paymentsApi.delete(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.legacy = this.legacy.map(p => p.id === item.id ? { ...p, isReversed: true, reversedAt: new Date().toISOString() } : p);
        this.legacyBusy = false;
        this.msg.add({ severity: 'warn', summary: 'Revertido', detail: 'El pago fue revertido. Los cargos imputados quedaron liberados.', life: 5000 });
        this.cdr.markForCheck();
      },
      error: error => {
        this.legacyBusy = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo revertir el pago.'), life: 6000 });
        this.cdr.markForCheck();
      }
    });
  }

  // Un pago va bajo el edificio de sus unidades; si abarca varios edificios, bajo la combinacion
  // ("Edificio A + Edificio B") para que no aparezca duplicado en cada uno.
  private buildGroups(items: OwnerPayment[]): BuildingGroup[] {
    const byLabel = new Map<string, OwnerPayment[]>();

    for (const payment of items) {
      const names = [...new Set(payment.units.map(u => u.buildingName).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'));
      const label = names.length ? names.join(' + ') : 'Sin edificio';
      const bucket = byLabel.get(label);
      if (bucket) bucket.push(payment); else byLabel.set(label, [payment]);
    }

    return [...byLabel.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([label, groupItems]) => ({
        label,
        items: groupItems,
        pendingCount: groupItems.filter(p => p.status === 'Pending' || p.status === 'UnderReview').length
      }));
  }
}
