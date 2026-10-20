import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { CompaniesApiService } from '../../api/companies-api.service';
import { Building, Company } from '../../api/models';
import { OnlinePayment, OnlinePaymentStatus } from '../../api/online-payments.models';
import { OnlinePaymentsApiService } from '../../api/online-payments-api.service';
import { AuthService } from '../../auth/auth.service';
import { GsPipe } from './finance-format';

const STATUS_LABELS: Record<OnlinePaymentStatus, string> = {
  Open: 'En curso',
  Paid: 'Pagado',
  Closed: 'Cerrado',
  ReviewRequired: 'Requiere revisión',
  Reversed: 'Revertido'
};

const STATUS_SEVERITY: Record<OnlinePaymentStatus, 'info' | 'success' | 'secondary' | 'danger' | 'warn'> = {
  Open: 'info',
  Paid: 'success',
  Closed: 'secondary',
  ReviewRequired: 'danger',
  Reversed: 'warn'
};

const CLOSE_REASONS: Record<string, string> = {
  Expired: 'Venció el plazo para pagar',
  Rejected: 'El proveedor rechazó el pago',
  Cancelled: 'Cancelado',
  ProviderError: 'El proveedor no pudo abrir el pago',
  Simulated: 'Cobro simulado: no se aplicó a la deuda real'
};

const ATTEMPT_LABELS: Record<string, string> = {
  Created: 'Creado', Pending: 'Esperando el pago', Confirmed: 'Confirmado', Rejected: 'Rechazado', Cancelled: 'Cancelado', Expired: 'Vencido', Reversed: 'Revertido'
};

const OUTCOME_LABELS: Record<string, string> = {
  Created: 'Sesión abierta', Applied: 'Aplicado', Simulated: 'Simulado', Duplicate: 'Repetido (ignorado)', Ignored: 'Registrado', ProviderRejected: 'Rechazado por el proveedor',
  ReviewRequired: 'No se pudo aplicar', AmountMismatch: 'Importe distinto', UnknownAttempt: 'Cobro desconocido', InvalidSignature: 'Firma inválida',
  InvalidPayload: 'Aviso ilegible', Failed: 'Falla técnica', Expired: 'Vencido'
};

const FILTERS: { label: string; value: string }[] = [
  { label: 'Todos', value: '' },
  { label: 'En curso', value: 'Open' },
  { label: 'Pagados', value: 'Paid' },
  { label: 'Requieren revisión', value: 'ReviewRequired' },
  { label: 'Cerrados', value: 'Closed' }
];

// Cobros online de expensas, para el personal: qué se cobró, a quién, con qué proveedor y cómo terminó. El dinero no pasa por Condo-PY: acá solo
// se ve el registro. Con el simulador de cobros encendido en el servidor se puede responder un cobro de prueba como lo haría el proveedor.
@Component({
  standalone: true,
  selector: 'app-online-payments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Button, Card, Message, Tag, DatePipe, GsPipe],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Cobros online</h1>
            <p>Pagos de expensas que los propietarios hacen con tarjeta. El dinero va directo al comercio del titular: acá solo se ve el registro.</p>
          </div>
        </div>
        <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" [loading]="loading" (onClick)="load()"></p-button>
      </div>

      <div class="filters">
        <label *ngIf="isSuperAdmin">
          <span>Empresa</span>
          <select [(ngModel)]="companyId" (ngModelChange)="onCompanyChange()">
            <option value="">Elegí una empresa</option>
            <option *ngFor="let c of companies" [value]="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label>
          <span>Edificio</span>
          <select [(ngModel)]="buildingId" (ngModelChange)="load()">
            <option value="">Todos</option>
            <option *ngFor="let b of visibleBuildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </label>
        <div class="chips">
          <button type="button" class="chip" *ngFor="let f of filters" [class.on]="status === f.value" (click)="selectStatus(f.value)">
            {{ f.label }}<span class="chip-count" *ngIf="f.value === 'ReviewRequired' && reviewCount">{{ reviewCount }}</span>
          </button>
        </div>
      </div>

      <p-message *ngIf="error" severity="error" [text]="error"></p-message>
      <p-message *ngIf="isSuperAdmin && !companyId" severity="info" text="Elegí una empresa para ver sus cobros online."></p-message>
      <p class="app-state" *ngIf="loading">Cargando cobros...</p>
      <p class="app-state" *ngIf="!loading && !error && (companyId || !isSuperAdmin) && !items.length">
        Todavía no hay cobros online{{ status ? ' con este estado' : '' }}.
      </p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header op-grid">
          <span>Cobro</span><span>Edificio y propietario</span><span class="num">Importe</span><span>Estado</span><span>Fecha</span>
        </div>
        <button type="button" class="app-row op-grid row-btn" *ngFor="let p of items" [class.sel]="selected?.id === p.id" (click)="select(p)">
          <span><strong>CP-{{ p.number | number: '6.0-0' }}</strong><small class="muted" *ngIf="p.isSimulated"> · simulado</small></span>
          <span>{{ p.buildingName }}<small class="muted"> · {{ p.ownerFullName }}</small></span>
          <span class="num">{{ p.amount | gs }}</span>
          <span><p-tag [value]="statusLabel(p.status)" [severity]="statusSeverity(p.status)"></p-tag></span>
          <span>{{ p.createdAtUtc | date: 'dd/MM/yyyy HH:mm' }}</span>
        </button>
      </div>

      <!-- Detalle -->
      <section class="detail" *ngIf="selected as d">
        <header class="detail-head">
          <div>
            <h2>Cobro CP-{{ d.number | number: '6.0-0' }}</h2>
            <div class="muted small">{{ d.buildingName }} · {{ d.ownerFullName }}</div>
          </div>
          <div class="tags">
            <p-tag [value]="statusLabel(d.status)" [severity]="statusSeverity(d.status)"></p-tag>
            <p-tag *ngIf="d.isSimulated" value="Simulado" severity="secondary"></p-tag>
          </div>
        </header>

        <p-message *ngIf="d.status === 'ReviewRequired'" severity="error"
          [text]="'El proveedor cobró pero el pago no se pudo aplicar: ' + d.reviewReason + ' La plata del propietario hay que devolverla con el proveedor si no la devolvió solo.'"></p-message>
        <p-message *ngIf="d.status === 'Closed' && d.closeReason" severity="info" [text]="closeReason(d.closeReason)"></p-message>

        <dl class="facts">
          <dt>Importe</dt><dd><strong>{{ d.amount | gs }}</strong></dd>
          <dt>Titular del comercio</dt><dd>{{ d.holderName }} · {{ d.holderTaxId }}</dd>
          <dt>Medio de pago</dt><dd>{{ d.connectionName }}</dd>
          <dt>Intento</dt>
          <dd>
            <ng-container *ngIf="d.attemptNumber">N° {{ d.attemptNumber }} · {{ attemptLabel(d.attemptStatus) }}</ng-container>
            <ng-container *ngIf="!d.attemptNumber">—</ng-container>
          </dd>
          <ng-container *ngIf="d.providerTransactionId">
            <dt>Transacción del proveedor</dt>
            <dd><code>{{ d.providerTransactionId }}</code><ng-container *ngIf="d.authorizationCode"> · autorización {{ d.authorizationCode }}</ng-container></dd>
          </ng-container>
          <ng-container *ngIf="d.cardLast4">
            <dt>Tarjeta</dt><dd>{{ d.cardBrand }} ····{{ d.cardLast4 }}</dd>
          </ng-container>
          <ng-container *ngIf="d.status === 'Open' && d.expiresAtUtc">
            <dt>Vence</dt><dd>{{ d.expiresAtUtc | date: 'dd/MM/yyyy HH:mm' }}</dd>
          </ng-container>
          <ng-container *ngIf="d.ownerPaymentId">
            <dt>Pago registrado</dt>
            <dd><a [routerLink]="['/owner-payments', d.ownerPaymentId]">{{ d.ownerPaymentReference }}</a></dd>
          </ng-container>
        </dl>

        <h3>Comprobantes</h3>
        <ul class="items">
          <li *ngFor="let i of d.items"><span>{{ i.periodMonth | number: '2.0-0' }}/{{ i.periodYear }} · unidad {{ i.unitCode }}</span><strong>{{ i.amount | gs }}</strong></li>
        </ul>

        <!-- Simulador: solo para conexiones del proveedor falso -->
        <div class="sim" *ngIf="canSimulate(d)">
          <h3>Simulador de cobros</h3>
          <p class="muted small">
            Responde este cobro como lo haría el proveedor: arma el aviso firmado y lo procesa por el mismo camino que el aviso real. Un cobro de prueba se aplica
            a la deuda solo si el edificio está marcado «de prueba» en la conexión.
          </p>
          <div class="sim-actions">
            <p-button label="Simular pago aprobado" icon="pi pi-check" [loading]="simulating" (onClick)="simulate(d, 'confirm')"></p-button>
            <p-button label="Simular pago rechazado" icon="pi pi-times" severity="secondary" [loading]="simulating" (onClick)="simulate(d, 'reject')"></p-button>
            <p-button label="Simular importe distinto" icon="pi pi-exclamation-triangle" severity="warn" [outlined]="true" [loading]="simulating" (onClick)="simulate(d, 'confirm', true)"></p-button>
          </div>
          <p-message *ngIf="simResult" [severity]="simResult.success ? 'success' : 'warn'" [text]="simResult.text"></p-message>
        </div>

        <!-- Registro técnico: solo SuperAdmin y Administrador de empresa -->
        <ng-container *ngIf="d.events">
          <h3>Registro de eventos</h3>
          <p class="muted" *ngIf="!d.events.length">Sin eventos.</p>
          <ul class="events" *ngIf="d.events.length">
            <li *ngFor="let e of d.events">
              <span class="muted small">{{ e.receivedAtUtc | date: 'dd/MM/yyyy HH:mm:ss' }}</span>
              <span>{{ e.direction === 'Inbound' ? 'Aviso del proveedor' : e.direction === 'Outbound' ? 'Pedido al proveedor' : 'Interno' }} · {{ e.kind }}</span>
              <strong>{{ outcomeLabel(e.outcome) }}</strong>
              <small class="muted" *ngIf="e.signatureOk !== null && e.signatureOk !== undefined">firma {{ e.signatureOk ? 'válida' : 'inválida' }}</small>
              <small class="err" *ngIf="e.error">{{ e.error }}</small>
            </li>
          </ul>
        </ng-container>
      </section>
    </p-card>
  `,
  styles: [`
    .filters { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; margin: 0.8rem 0 1rem; }
    .filters label span { display: block; font-size: 0.8rem; font-weight: 600; color: var(--brand-muted); margin-bottom: 0.2rem; }
    .filters select { padding: 0.45rem 0.7rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px; font: inherit; min-width: 14rem; background: #fff; }
    .chips { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .chip { border: 1px solid rgba(19,133,182,0.25); background: #fff; border-radius: 999px; padding: 0.3rem 0.8rem; font: inherit; font-size: 0.85rem; cursor: pointer; color: var(--brand-ink); }
    .chip.on { background: var(--brand-blue, #1385B6); color: #fff; border-color: var(--brand-blue, #1385B6); }
    .chip-count { margin-left: 0.4rem; background: #dc2626; color: #fff; border-radius: 999px; padding: 0 0.45rem; font-size: 0.75rem; }
    .op-grid { grid-template-columns: 1fr 2fr 1.2fr 1.3fr 1.3fr; }
    .row-btn { text-align: left; width: 100%; cursor: pointer; font: inherit; background: transparent; border: 0; }
    .row-btn.sel { background: rgba(19,133,182,0.08); }
    .num { text-align: right; }
    .detail { margin-top: 1.4rem; border-top: 1px solid var(--brand-border, rgba(19,133,182,0.15)); padding-top: 1rem; }
    .detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
    .detail-head h2 { margin: 0 0 0.15rem; }
    .tags { display: flex; gap: 0.4rem; }
    .facts { display: grid; grid-template-columns: minmax(10rem, 14rem) 1fr; gap: 0.35rem 1rem; margin: 0.8rem 0; font-size: 0.9rem; }
    .facts dt { color: var(--brand-muted); font-weight: 600; }
    .facts dd { margin: 0; word-break: break-word; }
    .items, .events { list-style: none; margin: 0.4rem 0 1rem; padding: 0; display: grid; gap: 0.3rem; }
    .items li { display: flex; justify-content: space-between; gap: 1rem; max-width: 28rem; font-size: 0.9rem; }
    .events li { display: flex; gap: 0.8rem; flex-wrap: wrap; align-items: baseline; font-size: 0.88rem; padding-bottom: 0.3rem; border-bottom: 1px solid rgba(19,133,182,0.1); }
    .err { color: #b91c1c; }
    .sim { margin: 1rem 0; padding: 0.8rem 1rem; border: 1px dashed rgba(19,133,182,0.4); border-radius: 12px; background: rgba(19,133,182,0.04); }
    .sim h3 { margin-top: 0; }
    .sim-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; margin: 0.6rem 0; }
    @media (max-width: 900px) { .op-grid { grid-template-columns: 1fr 1fr; } .app-row.header { display: none; } .facts { grid-template-columns: 1fr; } }
  `]
})
export class OnlinePaymentsPageComponent implements OnInit {
  private readonly api = inject(OnlinePaymentsApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly auth = inject(AuthService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly filters = FILTERS;

  items: OnlinePayment[] = [];
  selected: OnlinePayment | null = null;
  buildings: Building[] = [];
  companies: Company[] = [];
  companyId = '';
  buildingId = '';
  status = '';
  loading = false;
  simulating = false;
  error = '';
  reviewCount = 0;
  simResult: { success: boolean; text: string } | null = null;

  get isSuperAdmin(): boolean { return this.auth.hasRole('SuperAdmin'); }

  // Edificios de la empresa elegida (el SuperAdmin ve los de todas las empresas hasta elegir una).
  get visibleBuildings(): Building[] {
    return this.companyId ? this.buildings.filter(b => b.companyId === this.companyId) : this.buildings;
  }

  ngOnInit(): void {
    this.buildingsApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: buildings => {
        this.buildings = [...buildings].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        this.cdr.markForCheck();
      },
      error: () => undefined
    });

    if (this.isSuperAdmin) {
      this.companiesApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: companies => {
          this.companies = [...companies].sort((a, b) => a.name.localeCompare(b.name, 'es'));
          this.cdr.markForCheck();
        },
        error: () => undefined
      });
      return;
    }

    this.load();
  }

  onCompanyChange(): void {
    this.buildingId = '';
    this.selected = null;
    this.load();
  }

  selectStatus(value: string): void {
    this.status = value;
    this.load();
  }

  load(): void {
    if (this.isSuperAdmin && !this.companyId) {
      this.items = [];
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.error = '';
    this.api.getAll({ companyId: this.companyId || undefined, buildingId: this.buildingId || undefined, status: this.status || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => {
          this.items = items;
          if (!this.status) this.reviewCount = items.filter(i => i.status === 'ReviewRequired').length;
          this.selected = this.selected ? items.find(i => i.id === this.selected!.id) ?? null : null;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.error = extractApiErrorMessage(error, 'No se pudieron cargar los cobros online.');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  // El detalle trae el registro de eventos (solo para quien puede verlo).
  select(p: OnlinePayment): void {
    this.simResult = null;
    this.selected = p;
    this.api.getById(p.id, this.companyId || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => {
        if (this.selected?.id === detail.id) this.selected = detail;
        this.cdr.markForCheck();
      },
      error: error => {
        this.msg.add({ severity: 'error', summary: 'Cobros online', detail: extractApiErrorMessage(error, 'No se pudo cargar el detalle.'), life: 5000 });
      }
    });
  }

  // Solo un intento que espera el pago (o uno vencido, para probar el aviso tardío) del simulador.
  canSimulate(p: OnlinePayment): boolean {
    return p.connectionProviderCode === 'Fake' && !!p.attemptNumber && (p.attemptStatus === 'Pending' || p.attemptStatus === 'Expired')
      && this.auth.hasRole('SuperAdmin', 'CompanyAdmin');
  }

  simulate(p: OnlinePayment, outcome: 'confirm' | 'reject', wrongAmount = false): void {
    if (!p.attemptNumber) return;
    this.simulating = true;
    this.simResult = null;
    this.api.simulate(p.attemptNumber, outcome, wrongAmount ? Math.max(1, p.amount - 1) : undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.simulating = false;
        this.simResult = {
          success: result.success,
          text: result.success
            ? 'El aviso se procesó y se respondió éxito al proveedor.'
            : `El proveedor recibió un error (${result.webhookStatusCode})${result.message ? ': ' + result.message : ''}. Así se rechaza un cobro que no se puede aplicar.`
        };
        if (result.payment) this.selected = result.payment;
        this.load();
        this.cdr.markForCheck();
      },
      error: error => {
        this.simulating = false;
        this.simResult = { success: false, text: extractApiErrorMessage(error, 'No se pudo simular la respuesta del proveedor.') };
        this.cdr.markForCheck();
      }
    });
  }

  statusLabel(s: OnlinePaymentStatus): string { return STATUS_LABELS[s] ?? s; }
  statusSeverity(s: OnlinePaymentStatus) { return STATUS_SEVERITY[s] ?? 'secondary'; }
  closeReason(reason: string): string { return CLOSE_REASONS[reason] ?? reason; }
  attemptLabel(status: string | null | undefined): string { return status ? ATTEMPT_LABELS[status] ?? status : '—'; }
  outcomeLabel(outcome: string): string { return OUTCOME_LABELS[outcome] ?? outcome; }
}
