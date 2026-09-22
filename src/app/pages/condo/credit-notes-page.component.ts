import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { AuthService } from '../../auth/auth.service';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { CreditNotesApiService } from '../../api/credit-notes-api.service';
import { Building, CreditNote, CreditNoteStatus } from '../../api/models';

const STATUS_LABEL: Record<CreditNoteStatus, string> = {
  Draft: 'Borrador', Approved: 'Aprobada', Rejected: 'Rechazada', Voided: 'Anulada'
};
const STATUS_SEV: Record<CreditNoteStatus, 'warn' | 'success' | 'danger' | 'secondary'> = {
  Draft: 'warn', Approved: 'success', Rejected: 'danger', Voided: 'secondary'
};

@Component({
  standalone: true,
  selector: 'app-credit-notes-page',
  imports: [CommonModule, FormsModule, RouterLink, Button, Card, Tag, Tooltip],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Notas de Crédito</h1>
            <p>Consulta: ajustes internos sobre facturas emitidas, su estado y el documento fiscal oficial asociado.</p>
          </div>
        </div>
      </div>

      <!-- Resumen -->
      <div class="kpi-grid" *ngIf="!loading">
        <div class="kpi">
          <span class="kpi-label">Total</span>
          <span class="kpi-value">{{ items.length }}</span>
        </div>
        <div class="kpi kpi-warn">
          <span class="kpi-label">Borrador</span>
          <span class="kpi-value">{{ countByStatus('Draft') }}</span>
        </div>
        <div class="kpi kpi-success">
          <span class="kpi-label">Aprobadas</span>
          <span class="kpi-value">{{ countByStatus('Approved') }}</span>
          <span class="kpi-sub">-{{ formatGs(amountByStatus('Approved')) }}</span>
        </div>
        <div class="kpi kpi-danger">
          <span class="kpi-label">Rechazadas</span>
          <span class="kpi-value">{{ countByStatus('Rejected') }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Anuladas</span>
          <span class="kpi-value">{{ countByStatus('Voided') }}</span>
        </div>
      </div>

      <!-- Filtros -->
      <div class="filters-bar">
        <span class="pi pi-filter filters-icon"></span>
        <div class="field-block">
          <span>Edificio</span>
          <select [(ngModel)]="filterBuildingId" name="filterBuildingId" (ngModelChange)="applyFilters()">
            <option value="">Todos</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Estado</span>
          <select [(ngModel)]="filterStatus" name="filterStatus" (ngModelChange)="applyFilters()">
            <option value="">Todos</option>
            <option value="Draft">Borrador</option>
            <option value="Approved">Aprobada</option>
            <option value="Rejected">Rechazada</option>
            <option value="Voided">Anulada</option>
          </select>
        </div>
        <div class="field-block wide">
          <span>Buscar</span>
          <input type="text" [(ngModel)]="filterSearch" name="filterSearch" (ngModelChange)="applyFilters()"
                 placeholder="Motivo, factura, unidad o edificio...">
        </div>
        <p-button label="Limpiar" icon="pi pi-filter-slash" severity="secondary" [outlined]="true" size="small" (onClick)="resetFilters()"></p-button>
      </div>

      <p class="app-state" *ngIf="loading">Cargando notas de crédito...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay notas de crédito registradas.</p>
      <p class="app-state" *ngIf="!loading && items.length && !filteredItems.length">Ningún resultado con estos filtros.</p>

      <!-- Tabla, mismo lenguaje visual que Facturas -->
      <div class="table-wrap" *ngIf="filteredItems.length">
        <table class="ledger">
          <thead>
            <tr>
              <th>N° Nota de crédito</th>
              <th>N° Factura</th>
              <th>Edificio · Unidad</th>
              <th class="num">Importe</th>
              <th>Creada</th>
              <th class="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let cn of filteredItems" (click)="openDetail(cn)" [class.row-selected]="detail?.id === cn.id">
              <td>
                <strong class="monospace">{{ cn.fiscalNumero || 'Borrador' }}</strong>
                <p-tag [value]="statusLabel(cn.status)" [severity]="statusSeverity(cn.status)" styleClass="row-tag"></p-tag>
              </td>
              <td>
                <strong class="monospace">{{ invoiceLabel(cn) }}</strong>
                <small *ngIf="invoiceSubLabel(cn)">{{ invoiceSubLabel(cn) }}</small>
                <small class="motivo-cell" [title]="cn.motivo">{{ cn.motivo }}</small>
              </td>
              <td>
                {{ cn.buildingName }}
                <small>Unidad {{ cn.unitCode }}</small>
              </td>
              <td class="num"><strong class="amount">-{{ formatGs(cn.amount) }}</strong></td>
              <td>
                {{ cn.createdAtUtc | date:'dd/MM/yyyy' }}
                <small>{{ cn.createdByName }}</small>
              </td>
              <td class="actions-col" (click)="$event.stopPropagation()">
                <a [href]="pdfUrl(cn.id)" target="_blank" rel="noopener" style="display:contents">
                  <p-button type="button" icon="pi pi-file-pdf" severity="secondary" [rounded]="true" [text]="true" pTooltip="Descargar PDF"></p-button>
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </p-card>

    <!-- Detalle -->
    <div class="ov-backdrop" *ngIf="detail" (click)="closeDetail()"></div>
    <aside class="drawer" *ngIf="detail" (click)="$event.stopPropagation()">
      <header class="drawer-head">
        <div>
          <strong>NC sobre {{ invoiceLabel(detail) }}</strong>
          <p-tag [value]="statusLabel(detail.status)" [severity]="statusSeverity(detail.status)" styleClass="ml-2"></p-tag>
        </div>
        <button class="ov-close" (click)="closeDetail()">✕</button>
      </header>

      <div class="hero-amount">
        <span>Importe ajustado</span>
        <strong>-{{ formatGs(detail.amount) }}</strong>
        <small>{{ detail.lines.length }} {{ detail.lines.length === 1 ? 'línea' : 'líneas' }}</small>
      </div>

      <div class="drawer-actions" *ngIf="!detailLoading">
        <a [href]="pdfUrl(detail.id)" target="_blank" rel="noopener" style="display:contents">
          <p-button type="button" label="Descargar PDF" icon="pi pi-file-pdf" severity="secondary" [outlined]="true"></p-button>
        </a>
        <a *ngIf="detail.ownerPaymentId" [routerLink]="['/owner-payments', detail.ownerPaymentId]" style="display:contents">
          <p-button type="button" label="Ver pago" icon="pi pi-wallet" severity="secondary" [text]="true"></p-button>
        </a>
      </div>

      <p class="app-state" *ngIf="detailLoading">Cargando detalle...</p>

      <ng-container *ngIf="!detailLoading">
        <!-- Trazabilidad: factura original -> nota de credito -> resolucion -->
        <h4 class="drawer-title">Trazabilidad</h4>
        <ol class="timeline">
          <li *ngFor="let step of timeline(detail)" [class.done]="step.state === 'done'" [class.void]="step.state === 'void'">
            <span class="tl-dot"><i class="pi" [ngClass]="step.icon"></i></span>
            <div class="tl-body">
              <strong>{{ step.title }}</strong>
              <span *ngFor="let l of step.lines">{{ l }}</span>
            </div>
          </li>
        </ol>

        <h4 class="drawer-title">Datos</h4>
        <div class="info-grid">
          <div class="info-card">
            <h5>Cliente</h5>
            <p>{{ detail.clienteNombre || '—' }}</p>
            <small *ngIf="detail.clienteDocumento">CI/RUC {{ detail.clienteDocumento }}</small>
            <small>{{ detail.buildingName }}{{ detail.buildingAddress ? (' ' + detail.buildingAddress) : '' }} · Unidad {{ detail.unitCode }}</small>
          </div>
          <div class="info-card">
            <h5>Emisor y timbrado</h5>
            <p>{{ detail.emisorRazonSocial || '—' }}</p>
            <small *ngIf="detail.emisorRuc">RUC {{ detail.emisorRuc }}</small>
            <small *ngIf="detail.emisorTimbrado">Timbrado {{ detail.emisorTimbrado }}<ng-container *ngIf="detail.emisorEstablecimiento"> · {{ detail.emisorEstablecimiento }}-{{ detail.emisorPuntoExpedicion }}</ng-container></small>
          </div>
          <div class="info-card">
            <h5>Comprobante</h5>
            <p>{{ detail.periodName || '—' }} · Unidad {{ detail.unitCode }}</p>
            <small>Facturado {{ formatGs(detail.invoiceMontoTotal) }}</small>
            <small *ngIf="detail.periodDueDate">Vencimiento {{ detail.periodDueDate | date:'dd/MM/yyyy' }}</small>
          </div>
          <div class="info-card">
            <h5>Pago</h5>
            <p class="mono">{{ detail.paymentReference || '—' }}</p>
            <small *ngIf="detail.paymentDate">{{ detail.paymentDate | date:'dd/MM/yyyy' }}<ng-container *ngIf="detail.paymentAmount"> · {{ formatGs(detail.paymentAmount) }}</ng-container></small>
            <small *ngIf="detail.ownerName">Propietario {{ detail.ownerName }}</small>
          </div>
        </div>

        <div class="void-box" *ngIf="detail.status === 'Rejected' && detail.rejectionReason">
          <strong>Nota de crédito rechazada</strong>
          <span>{{ detail.rejectedByName }}, {{ detail.rejectedAtUtc | date:'dd/MM/yyyy' }} — {{ detail.rejectionReason }}</span>
        </div>

        <div class="void-box" *ngIf="detail.status === 'Voided' && detail.voidReason">
          <strong>Nota de crédito anulada</strong>
          <span>{{ detail.voidedByName }}, {{ detail.voidedAtUtc | date:'dd/MM/yyyy' }} — {{ detail.voidReason }}</span>
        </div>

        <h4 class="drawer-title">Documento fiscal oficial</h4>
        <p class="sub-text" *ngIf="!detail.fiscalNumero && !detail.numero">Sin datos fiscales registrados todavía.</p>
        <div class="info-grid" *ngIf="detail.fiscalNumero || detail.numero">
          <div class="info-card">
            <h5>Número</h5>
            <p>{{ detail.fiscalNumero || '—' }}</p>
            <small *ngIf="detail.numero">Numerada automáticamente</small>
          </div>
          <div class="info-card">
            <h5>Timbrado</h5>
            <p>{{ detail.fiscalTimbrado || '—' }}</p>
            <small *ngIf="detail.fiscalFechaEmisionUtc">Emitida el {{ detail.fiscalFechaEmisionUtc | date:'dd/MM/yyyy' }}</small>
          </div>
          <div class="info-card" *ngIf="detail.fiscalCdc">
            <h5>CDC</h5>
            <p class="mono">{{ detail.fiscalCdc }}</p>
          </div>
          <div class="info-card" *ngIf="detail.fiscalEstado || detail.fiscalObservaciones">
            <h5>Estado</h5>
            <p>{{ detail.fiscalEstado || '—' }}</p>
            <small *ngIf="detail.fiscalObservaciones">{{ detail.fiscalObservaciones }}</small>
          </div>
        </div>

        <ng-container *ngIf="detail.attachments.length">
          <h4 class="drawer-title">Adjuntos</h4>
          <div class="drawer-attachments">
            <a *ngFor="let att of detail.attachments" [href]="att.url" target="_blank" rel="noopener" class="drawer-attachment">
              <i class="pi pi-paperclip"></i> {{ att.fileName }}
            </a>
          </div>
        </ng-container>

        <h4 class="drawer-title">Detalle de la nota de crédito</h4>
        <p class="motivo-text">{{ detail.motivo }}</p>
        <div class="lines">
          <div class="line-row" *ngFor="let l of detail.lines">
            <span>{{ l.concept || l.chargeConcept }}</span>
            <strong>-{{ formatGs(l.amount) }}</strong>
          </div>
          <div class="line-row line-total">
            <span>Total</span>
            <strong>-{{ formatGs(detail.amount) }}</strong>
          </div>
        </div>
      </ng-container>
    </aside>
  `,
  styles: [`
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.9rem; margin-bottom: 1.25rem; }
    .kpi { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.8rem 1rem; border-radius: 12px; background: rgba(20,54,61,0.04); border: 1px solid rgba(20,54,61,0.1); }
    .kpi-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--brand-muted); }
    .kpi-value { font-size: 1.3rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .kpi-sub { font-size: 0.78rem; color: var(--brand-muted); font-family: monospace; }
    .kpi-warn .kpi-value { color: #92400e; }
    .kpi-success .kpi-value { color: #166534; }
    .kpi-danger .kpi-value { color: #991b1b; }

    .filters-bar {
      display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap;
      padding: 0.75rem 1rem; background: rgba(20,54,61,0.04);
      border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; margin-bottom: 1.25rem;
    }
    .filters-icon { color: var(--brand-muted); font-size: 1rem; margin-bottom: 0.35rem; }
    .field-block { display: flex; flex-direction: column; gap: 0.3rem; }
    .field-block.wide { flex: 1; min-width: 200px; }
    .field-block span { font-size: 0.8rem; font-weight: 600; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .field-block select, .field-block input {
      border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px;
      padding: 0.5rem 0.75rem; font-size: 0.92rem; color: var(--brand-ink);
      background: #fff; outline: none; width: 100%; box-sizing: border-box;
    }

    /* Tabla, mismo lenguaje visual que Facturas */
    .table-wrap { overflow-x: auto; border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; background: #fff; }
    table.ledger { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 760px; }
    table.ledger thead th { position: sticky; top: 0; background: #f4f9fc; text-align: left; padding: 0.7rem 0.8rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--brand-muted); border-bottom: 1px solid rgba(20,54,61,0.12); white-space: nowrap; }
    table.ledger tbody td { padding: 0.65rem 0.8rem; border-bottom: 1px solid rgba(20,54,61,0.07); color: var(--brand-ink); vertical-align: top; }
    table.ledger tbody tr { cursor: pointer; transition: background .12s; }
    table.ledger tbody tr:hover { background: rgba(19,133,182,0.05); }
    table.ledger tbody tr.row-selected { background: rgba(19,133,182,0.09); }
    table.ledger td small { display: block; color: var(--brand-muted); font-size: 0.76rem; margin-top: 0.1rem; }
    table.ledger .num { text-align: right !important; white-space: nowrap; }
    .actions-col { width: 52px; text-align: right; }
    .motivo-cell { display: block; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .monospace { font-family: ui-monospace, Menlo, Consolas, monospace; }
    .amount { font-family: ui-monospace, Menlo, Consolas, monospace; color: #b91c1c; }
    :host ::ng-deep .row-tag { display: block; margin-top: 0.2rem; width: fit-content; }
    :host ::ng-deep .row-tag .p-tag { font-size: 0.68rem; padding: 0.1rem 0.45rem; }

    /* DRAWER — mismo lenguaje visual que Facturas */
    .ov-backdrop { position: fixed; inset: 0; background: rgba(15,35,50,0.4); z-index: 1000; backdrop-filter: blur(2px); }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(560px, 100vw); background: #fff; z-index: 1001; overflow-y: auto; padding: 1.4rem 1.5rem 2rem; box-shadow: -24px 0 60px rgba(15,40,60,0.22); }
    .drawer-head { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 0.9rem; border-bottom: 1px solid rgba(20,54,61,0.1); margin-bottom: 1rem; }
    .drawer-head > div { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; }
    .drawer-head strong { font-size: 1.1rem; color: var(--brand-ink); }
    .ov-close { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: var(--brand-muted); width: 34px; height: 34px; border-radius: 50%; }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }
    .hero-amount { display: flex; flex-direction: column; background: linear-gradient(135deg, rgba(220,38,38,0.08), rgba(180,20,20,0.08)); border-radius: 14px; padding: 0.9rem 1.1rem; margin-bottom: 0.9rem; }
    .hero-amount span { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--brand-muted); }
    .hero-amount strong { font-size: 1.7rem; color: #b91c1c; font-family: ui-monospace, Menlo, Consolas, monospace; }
    .hero-amount small { color: var(--brand-muted); }
    .drawer-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
    .drawer-title { margin: 1.2rem 0 0.6rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--brand-muted); }
    .motivo-text { margin: 0 0 0.6rem; font-size: 0.92rem; color: var(--brand-ink); }

    .timeline { list-style: none; margin: 0; padding: 0; position: relative; }
    .timeline li { display: flex; gap: 0.8rem; padding-bottom: 1rem; position: relative; }
    .timeline li:not(:last-child)::before { content: ''; position: absolute; left: 15px; top: 32px; bottom: 0; width: 2px; background: rgba(20,54,61,0.12); }
    .tl-dot { flex: 0 0 32px; height: 32px; border-radius: 50%; background: rgba(20,54,61,0.08); color: var(--brand-muted); display: flex; align-items: center; justify-content: center; font-size: 0.85rem; }
    .timeline li.done .tl-dot { background: #16a34a; color: #fff; }
    .timeline li.void .tl-dot { background: #dc2626; color: #fff; }
    .tl-body { display: flex; flex-direction: column; gap: 0.1rem; padding-top: 0.15rem; }
    .tl-body strong { color: var(--brand-ink); font-size: 0.92rem; }
    .tl-body span { color: var(--brand-muted); font-size: 0.82rem; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
    .info-card { border: 1px solid rgba(20,54,61,0.1); border-radius: 12px; padding: 0.7rem 0.85rem; display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
    .info-card h5 { margin: 0 0 0.25rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--brand-muted); }
    .info-card p { margin: 0; font-weight: 600; color: var(--brand-ink); word-break: break-word; }
    .info-card small { color: var(--brand-muted); font-size: 0.78rem; }
    .mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.82rem; word-break: break-all; }

    .void-box { margin-top: 0.9rem; padding: 0.7rem 0.9rem; border-radius: 12px; background: #fee2e2; border: 1px solid #fca5a5; display: flex; flex-direction: column; gap: 0.2rem; color: #991b1b; }
    .void-box strong { font-size: 0.9rem; }
    .void-box span { font-size: 0.85rem; }

    .lines { border-top: 1px dashed rgba(19,133,182,0.2); }
    .line-row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.4rem 0; border-bottom: 1px dashed rgba(19,133,182,0.12); font-size: 0.88rem; color: var(--brand-ink); }
    .line-row strong { font-family: ui-monospace, Menlo, Consolas, monospace; color: #b91c1c; }
    .line-total { font-weight: 700; border-bottom: none; padding-top: 0.6rem; }

    .drawer-attachments { display: grid; gap: 0.4rem; }
    .drawer-attachment { display: inline-flex; gap: 0.4rem; align-items: center; color: var(--p-primary-color); text-decoration: none; font-size: 0.88rem; }
    .sub-text { color: var(--brand-muted); font-size: 0.85rem; }
    .ml-2 { margin-left: 0.4rem; }

    @media (max-width: 900px) {
      .filters-bar { flex-direction: column; align-items: stretch; }
      .info-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class CreditNotesPageComponent implements OnInit {
  private readonly creditNotesApi = inject(CreditNotesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);
  private readonly auth = inject(AuthService);

  items: CreditNote[] = [];
  filteredItems: CreditNote[] = [];
  buildings: Building[] = [];
  loading = true;

  filterBuildingId = '';
  filterStatus: CreditNoteStatus | '' = '';
  filterSearch = '';

  detail: CreditNote | null = null;
  detailLoading = false;

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    forkJoin({
      items: this.creditNotesApi.getAll(),
      buildings: this.buildingsApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ items, buildings }) => {
        this.items = items;
        this.buildings = buildings;
        this.loading = false;
        this.applyFilters();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar las notas de crédito.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applyFilters(): void {
    const search = this.filterSearch.trim().toLowerCase();
    this.filteredItems = this.items.filter(x =>
      (!this.filterBuildingId || x.buildingId === this.filterBuildingId) &&
      (!this.filterStatus || x.status === this.filterStatus) &&
      (!search ||
        x.motivo.toLowerCase().includes(search) ||
        this.invoiceLabel(x).toLowerCase().includes(search) ||
        x.unitCode.toLowerCase().includes(search) ||
        x.buildingName.toLowerCase().includes(search)));
    this.cdr.markForCheck();
  }

  resetFilters(): void {
    this.filterBuildingId = '';
    this.filterStatus = '';
    this.filterSearch = '';
    this.applyFilters();
  }

  countByStatus(status: CreditNoteStatus): number {
    return this.items.filter(x => x.status === status).length;
  }

  amountByStatus(status: CreditNoteStatus): number {
    return this.items.filter(x => x.status === status).reduce((sum, x) => sum + x.amount, 0);
  }

  openDetail(cn: CreditNote): void {
    this.detail = cn;
    this.detailLoading = true;
    this.creditNotesApi.getById(cn.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: full => { this.detail = full; this.detailLoading = false; this.cdr.markForCheck(); },
      error: err => {
        this.detailLoading = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo cargar el detalle.'), life: 5000 });
        this.cdr.markForCheck();
      }
    });
  }

  closeDetail(): void {
    this.detail = null;
  }

  statusLabel(status: CreditNoteStatus): string { return STATUS_LABEL[status]; }
  pdfUrl(id: string): string { return this.creditNotesApi.getPdfUrl(id, this.auth.getToken() ?? ''); }
  statusSeverity(status: CreditNoteStatus): 'warn' | 'success' | 'danger' | 'secondary' { return STATUS_SEV[status]; }

  // Toda NC se crea sobre una factura ya Emitida (el backend lo exige), así que en el uso normal
  // siempre hay número. Si de todos modos falta (dato viejo o excepcional), se identifica igual con
  // los últimos 8 caracteres del ID de la factura, para no dejar la fila sin ninguna referencia.
  invoiceLabel(cn: CreditNote): string {
    if (cn.invoiceNumeroFormateado) return cn.invoiceNumeroFormateado;
    return `Factura #${cn.invoiceId.slice(-8).toUpperCase()}`;
  }

  invoiceSubLabel(cn: CreditNote): string {
    if (cn.invoiceNumeroFormateado) return '';
    return cn.invoiceStatus === 'Draft' ? 'aún no emitida' : 'sin número asignado';
  }

  // Trazabilidad: factura original emitida -> nota de crédito creada -> su resolución (aprobada/rechazada/anulada).
  timeline(cn: CreditNote): { title: string; icon: string; state: 'done' | 'void' | 'pending'; lines: string[] }[] {
    const steps: { title: string; icon: string; state: 'done' | 'void' | 'pending'; lines: string[] }[] = [
      {
        title: this.invoiceLabel(cn),
        icon: 'pi-file',
        state: 'done',
        lines: [`Monto: ${this.formatGs(cn.invoiceMontoTotal)}`]
      },
      {
        title: 'Nota de crédito creada',
        icon: 'pi-pencil',
        state: 'done',
        lines: [
          cn.createdByName ? `${cn.createdByName} · ${this.fmtDate(cn.createdAtUtc)}` : this.fmtDate(cn.createdAtUtc),
          `Ajuste: -${this.formatGs(cn.amount)}`
        ]
      }
    ];

    if (cn.status === 'Approved' || cn.status === 'Voided') {
      steps.push({
        title: 'Aprobada',
        icon: 'pi-check',
        state: 'done',
        lines: [cn.approvedByName ? `${cn.approvedByName} · ${this.fmtDate(cn.approvedAtUtc)}` : this.fmtDate(cn.approvedAtUtc),
          ...(cn.fiscalNumero ? [`Numerada como ${cn.fiscalNumero}`] : [])]
      });
    } else if (cn.status === 'Rejected') {
      steps.push({
        title: 'Rechazada',
        icon: 'pi-times',
        state: 'void',
        lines: [cn.rejectedByName ? `${cn.rejectedByName} · ${this.fmtDate(cn.rejectedAtUtc)}` : this.fmtDate(cn.rejectedAtUtc)]
      });
    } else {
      steps.push({ title: 'Pendiente de aprobación', icon: 'pi-clock', state: 'pending', lines: [] });
    }

    if (cn.status === 'Voided') {
      steps.push({
        title: 'Anulada',
        icon: 'pi-ban',
        state: 'void',
        lines: [cn.voidedByName ? `${cn.voidedByName} · ${this.fmtDate(cn.voidedAtUtc)}` : this.fmtDate(cn.voidedAtUtc)]
      });
    }

    return steps;
  }

  private fmtDate(value: string | null): string {
    return value ? new Date(value).toLocaleDateString('es-PY') : '';
  }

  formatGs(value: number): string {
    return new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }
}
