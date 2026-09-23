import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { printPdfFromUrl } from '../../api/print-pdf.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { InvoicesApiService } from '../../api/invoices-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';
import {
  Building, Invoice, InvoiceLedger, InvoiceLedgerQuery, InvoiceLedgerRow, InvoiceStatus, Unit
} from '../../api/models';

const STATUS_LABEL: Record<InvoiceStatus, string> = { Draft: 'Borrador', Issued: 'Emitida', Voided: 'Anulada' };
const STATUS_SEV: Record<InvoiceStatus, 'warn' | 'success' | 'danger'> = { Draft: 'warn', Issued: 'success', Voided: 'danger' };
const LIQUIDATION_LABEL: Record<string, string> = {
  Draft: 'Borrador', Calculated: 'Calculada', Approved: 'Aprobada', Applied: 'Aplicada', Published: 'Publicada'
};
const PERIOD_LABEL: Record<string, string> = { Draft: 'Borrador', Closed: 'Cerrado', Published: 'Publicado' };
const OWNER_PAYMENT_LABEL: Record<string, string> = {
  Pending: 'Pendiente', UnderReview: 'En revisión', Approved: 'Aprobado', Rejected: 'Rechazado'
};

interface TimelineStep {
  icon: string;
  title: string;
  state: 'done' | 'pending' | 'void';
  lines: string[];
}

@Component({
  standalone: true,
  selector: 'app-invoices-page',
  imports: [CommonModule, FormsModule, RouterLink, Button, Card, Tag, Tooltip],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Facturas</h1>
            <p>Consulta y trazabilidad: factura, cliente, comprobante, liquidación y pago asociados.</p>
          </div>
        </div>
        <p-button
          label="Exportar CSV" icon="pi pi-download" severity="secondary" [outlined]="true"
          [loading]="exporting" [disabled]="!ledger || ledger.totalCount === 0" (onClick)="exportCsv()">
        </p-button>
      </div>

      <!-- Resumen del filtro actual -->
      <div class="kpi-grid" *ngIf="ledger">
        <div class="kpi">
          <span class="kpi-label">Facturas</span>
          <strong>{{ ledger.totalCount }}</strong>
          <small>en el filtro actual</small>
        </div>
        <div class="kpi kpi-ok">
          <span class="kpi-label">Emitidas</span>
          <strong>{{ ledger.summary.issuedCount }}</strong>
          <small>{{ formatCurrency(ledger.summary.issuedAmount) }}</small>
        </div>
        <div class="kpi kpi-warn">
          <span class="kpi-label">Borradores</span>
          <strong>{{ ledger.summary.draftCount }}</strong>
          <small>{{ formatCurrency(ledger.summary.draftAmount) }}</small>
        </div>
        <div class="kpi kpi-bad">
          <span class="kpi-label">Anuladas</span>
          <strong>{{ ledger.summary.voidedCount }}</strong>
          <small>{{ formatCurrency(ledger.summary.voidedAmount) }}</small>
        </div>
      </div>

      <!-- Filtros -->
      <div class="filters-bar">
        <div class="field-block search-field">
          <span>Buscar</span>
          <div class="search-box">
            <span class="pi pi-search"></span>
            <input type="text" [(ngModel)]="search" name="search" (ngModelChange)="onSearchInput($event)"
                   placeholder="N° de factura, cliente, unidad, edificio, pago o timbrado" />
          </div>
        </div>
        <div class="field-block">
          <span>Edificio</span>
          <select [(ngModel)]="filters.buildingId" name="fBuilding" (ngModelChange)="onBuildingChange()">
            <option value="">Todos</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Unidad</span>
          <select [(ngModel)]="filters.unitId" name="fUnit" (ngModelChange)="reload(true)">
            <option value="">Todas</option>
            <option *ngFor="let u of unitsForFilter" [value]="u.id">{{ u.code }}{{ filters.buildingId ? '' : ' · ' + u.buildingName }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Estado</span>
          <select [(ngModel)]="filters.status" name="fStatus" (ngModelChange)="reload(true)">
            <option value="">Todos</option>
            <option value="Issued">Emitida</option>
            <option value="Draft">Borrador</option>
            <option value="Voided">Anulada</option>
          </select>
        </div>
        <div class="field-block">
          <span>Período</span>
          <input type="month" [(ngModel)]="periodMonth" name="fPeriod" (ngModelChange)="reload(true)" />
        </div>
        <div class="field-block">
          <span>Emisión desde</span>
          <input type="date" [(ngModel)]="filters.from" name="fFrom" (ngModelChange)="reload(true)" />
        </div>
        <div class="field-block">
          <span>Hasta</span>
          <input type="date" [(ngModel)]="filters.to" name="fTo" (ngModelChange)="reload(true)" />
        </div>
        <p-button type="button" label="Limpiar" icon="pi pi-times" severity="secondary" [outlined]="true" size="small"
                  (onClick)="resetFilters()" [disabled]="!hasFilters"></p-button>
      </div>

      <p class="app-state" *ngIf="loading && !ledger">Cargando facturas...</p>
      <p class="app-state" *ngIf="!loading && ledger && ledger.items.length === 0">No hay facturas que coincidan con el filtro.</p>

      <!-- Tabla -->
      <div class="table-wrap" *ngIf="ledger && ledger.items.length > 0" [class.is-loading]="loading">
        <table class="ledger">
          <thead>
            <tr>
              <th class="sortable" (click)="sort('numero')">N° Factura <span class="sort-ico">{{ sortIcon('numero') }}</span></th>
              <th>Estado</th>
              <th class="sortable" (click)="sort('fecha')">Emisión <span class="sort-ico">{{ sortIcon('fecha') }}</span></th>
              <th class="sortable" (click)="sort('unidad')">Edificio · Unidad <span class="sort-ico">{{ sortIcon('unidad') }}</span></th>
              <th>Cliente</th>
              <th class="sortable" (click)="sort('periodo')">Período <span class="sort-ico">{{ sortIcon('periodo') }}</span></th>
              <th>Liquidación</th>
              <th>Pago</th>
              <th class="num sortable" (click)="sort('monto')">Monto <span class="sort-ico">{{ sortIcon('monto') }}</span></th>
              <th class="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of ledger.items" (click)="openDetail(r)" [class.row-selected]="detail?.id === r.id">
              <td>
                <strong>{{ r.numeroFormateado || 'Sin numerar' }}</strong>
                <small *ngIf="r.seriesNumeroTimbrado">Timbrado {{ r.seriesNumeroTimbrado }}</small>
              </td>
              <td><p-tag [value]="statusLabel(r.status)" [severity]="statusSev(r.status)"></p-tag></td>
              <td>{{ fmtDate(r.fechaEmisionUtc || r.createdAtUtc) }}<small *ngIf="!r.fechaEmisionUtc">creada</small></td>
              <td>{{ r.buildingName }}<small>Unidad {{ r.unitCode }}</small></td>
              <td>{{ r.clienteNombre || '—' }}<small *ngIf="r.clienteDocumento">{{ r.clienteDocumento }}</small></td>
              <td>{{ periodLabel(r) }}<small>vence {{ fmtDate(r.periodDueDate) }}</small></td>
              <td>
                <span class="pill" [class.pill-ok]="r.liquidationStatus === 'Applied' || r.periodStatus === 'Published'">
                  {{ liquidationText(r) }}
                </span>
                <small *ngIf="r.liquidationPublishedAtUtc">publicada {{ fmtDate(r.liquidationPublishedAtUtc) }}</small>
              </td>
              <td>
                <span class="mono">{{ r.ownerPaymentReference || r.paymentReference }}</span>
                <small>{{ fmtDate(r.paymentDate) }}<ng-container *ngIf="r.ownerPaymentStatus"> · {{ ownerPaymentLabel(r.ownerPaymentStatus) }}</ng-container></small>
              </td>
              <td class="num">
                <strong>{{ formatCurrency(r.montoTotal) }}</strong>
                <small *ngIf="r.moraTotal > 0">incl. mora {{ formatCurrency(r.moraTotal) }}</small>
              </td>
              <td class="actions-col" (click)="$event.stopPropagation()">
                <a [href]="getPdfUrl(r.id)" target="_blank" style="display:contents">
                  <p-button type="button" icon="pi pi-file-pdf" severity="secondary" [rounded]="true" [text]="true" pTooltip="Descargar PDF"></p-button>
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div class="pager" *ngIf="ledger && ledger.totalCount > 0">
        <span class="pager-info">Mostrando {{ rangeFrom }}–{{ rangeTo }} de {{ ledger.totalCount }}</span>
        <div class="pager-controls">
          <label class="pager-size">Filas
            <select [(ngModel)]="pageSize" name="pageSize" (ngModelChange)="reload(true)">
              <option [ngValue]="10">10</option>
              <option [ngValue]="25">25</option>
              <option [ngValue]="50">50</option>
              <option [ngValue]="100">100</option>
            </select>
          </label>
          <button class="pg-btn" [disabled]="page <= 1" (click)="goToPage(page - 1)">‹</button>
          <button class="pg-btn" *ngFor="let p of pageNumbers" [class.pg-active]="p === page" (click)="goToPage(p)">{{ p }}</button>
          <button class="pg-btn" [disabled]="page >= totalPages" (click)="goToPage(page + 1)">›</button>
        </div>
      </div>
    </p-card>

    <!-- Detalle y trazabilidad -->
    <div class="ov-backdrop" *ngIf="detail" (click)="closeDetail()"></div>
    <aside class="drawer" *ngIf="detail" (click)="$event.stopPropagation()">
      <header class="drawer-head">
        <div>
          <strong>{{ detail.numeroFormateado || 'Factura en borrador' }}</strong>
          <p-tag [value]="statusLabel(detail.status)" [severity]="statusSev(detail.status)" styleClass="ml-2"></p-tag>
        </div>
        <button class="ov-close" (click)="closeDetail()">✕</button>
      </header>

      <div class="hero-amount">
        <span>Monto total</span>
        <strong>{{ formatCurrency(detail.montoTotal) }}</strong>
        <small>{{ detail.lineCount }} {{ detail.lineCount === 1 ? 'línea' : 'líneas' }}<ng-container *ngIf="detail.moraTotal > 0"> · incluye mora {{ formatCurrency(detail.moraTotal) }}</ng-container></small>
      </div>

      <div class="drawer-actions">
        <a [href]="getPdfUrl(detail.id)" target="_blank" style="display:contents">
          <p-button type="button" label="Descargar PDF" icon="pi pi-file-pdf" severity="secondary" [outlined]="true"></p-button>
        </a>
        <p-button type="button" label="Imprimir" icon="pi pi-print" severity="secondary" [outlined]="true" (onClick)="printDetail()"></p-button>
        <a *ngIf="detail.ownerPaymentId" [routerLink]="['/owner-payments', detail.ownerPaymentId]" style="display:contents">
          <p-button type="button" label="Ver pago" icon="pi pi-wallet" severity="secondary" [text]="true"></p-button>
        </a>
        <a routerLink="/expense-periods" style="display:contents">
          <p-button type="button" label="Ver liquidaciones" icon="pi pi-calculator" severity="secondary" [text]="true"></p-button>
        </a>
        <!-- Anular y NC se hacen desde el detalle del pago (ahi vive la accion real); estos son un
             atajo que navega ahi mismo y abre el formulario ya para esta factura puntual, en vez de
             solo llevarte a la pagina y tener que buscarla vos. -->
        <a *ngIf="detail.ownerPaymentId && detail.status === 'Issued'"
           [routerLink]="['/owner-payments', detail.ownerPaymentId]" [queryParams]="{ action: 'void', invoiceId: detail.id }" style="display:contents">
          <p-button type="button" label="Anular factura" icon="pi pi-times" severity="danger" [text]="true"></p-button>
        </a>
        <a *ngIf="detail.ownerPaymentId && detail.status === 'Issued'"
           [routerLink]="['/owner-payments', detail.ownerPaymentId]" [queryParams]="{ action: 'nc', invoiceId: detail.id }" style="display:contents">
          <p-button type="button" label="Nueva NC" icon="pi pi-plus" severity="secondary" [text]="true"></p-button>
        </a>
      </div>

      <!-- Línea de tiempo: liquidación → comprobante → pago → factura -->
      <h4 class="drawer-title">Trazabilidad</h4>
      <ol class="timeline">
        <li *ngFor="let step of timeline" [class.done]="step.state === 'done'" [class.void]="step.state === 'void'">
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
          <small>{{ detail.buildingName }} · Unidad {{ detail.unitCode }}</small>
        </div>
        <div class="info-card">
          <h5>Emisor y timbrado</h5>
          <p>{{ detail.seriesRazonSocial || '—' }}</p>
          <small *ngIf="detail.seriesRuc">RUC {{ detail.seriesRuc }}</small>
          <small *ngIf="detail.seriesNumeroTimbrado">Timbrado {{ detail.seriesNumeroTimbrado }} · {{ detail.seriesEstablecimiento }}-{{ detail.seriesPuntoExpedicion }}</small>
        </div>
        <div class="info-card">
          <h5>Comprobante</h5>
          <p>{{ periodLabel(detail) }} · Unidad {{ detail.unitCode }}</p>
          <small>Liquidado {{ formatCurrency(detail.comprobanteTotal) }}</small>
          <small>Vencimiento {{ fmtDate(detail.periodDueDate) }}</small>
        </div>
        <div class="info-card">
          <h5>Pago</h5>
          <p class="mono">{{ detail.ownerPaymentReference || detail.paymentReference }}</p>
          <small>{{ fmtDate(detail.paymentDate) }} · {{ formatCurrency(detail.paymentAmount) }}</small>
          <small *ngIf="detail.ownerName">Propietario {{ detail.ownerName }}</small>
        </div>
      </div>

      <div class="void-box" *ngIf="detail.status === 'Voided'">
        <strong>Factura anulada</strong>
        <span>{{ fmtDate(detail.fechaAnulacionUtc) }} — {{ detail.motivoAnulacion || 'Sin motivo registrado' }}</span>
      </div>

      <h4 class="drawer-title">Detalle de la factura</h4>
      <p class="app-state" *ngIf="loadingDetail">Cargando detalle...</p>
      <div class="lines" *ngIf="!loadingDetail">
        <div class="line-row" *ngFor="let line of detailLines">
          <span>{{ line.concepto }}</span>
          <strong>{{ formatCurrency(line.monto) }}</strong>
        </div>
        <div class="line-row line-total">
          <span>Total</span>
          <strong>{{ formatCurrency(detail.montoTotal) }}</strong>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem; margin-bottom: 1.1rem; }
    .kpi { background: #fff; border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; padding: 0.85rem 1rem; display: flex; flex-direction: column; gap: 0.1rem; border-left: 4px solid var(--brand-blue); }
    .kpi-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--brand-muted); }
    .kpi strong { font-size: 1.55rem; color: var(--brand-ink); line-height: 1.15; }
    .kpi small { color: var(--brand-muted); font-size: 0.8rem; }
    .kpi-ok { border-left-color: #16a34a; } .kpi-warn { border-left-color: #f59e0b; } .kpi-bad { border-left-color: #dc2626; }

    .filters-bar { display: flex; align-items: flex-end; gap: 0.85rem; flex-wrap: wrap; padding: 0.8rem 1rem; background: rgba(20,54,61,0.04); border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; margin-bottom: 1.1rem; }
    .field-block { display: flex; flex-direction: column; gap: 0.3rem; min-width: 130px; }
    .field-block span { font-size: 0.72rem; font-weight: 700; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .field-block select, .field-block input { border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px; padding: 0.45rem 0.65rem; font-size: 0.9rem; color: var(--brand-ink); background: #fff; outline: none; width: 100%; }
    .search-field { flex: 1 1 300px; min-width: 260px; }
    .search-box { position: relative; display: flex; align-items: center; }
    .search-box .pi { position: absolute; left: 0.75rem; color: var(--brand-muted); font-size: 0.85rem; }
    .search-box input { padding-left: 2.1rem; }

    .table-wrap { overflow-x: auto; border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; background: #fff; }
    .table-wrap.is-loading { opacity: 0.55; transition: opacity .15s; }
    table.ledger { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 1080px; }
    table.ledger thead th { position: sticky; top: 0; background: #f4f9fc; text-align: left; padding: 0.7rem 0.8rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--brand-muted); border-bottom: 1px solid rgba(20,54,61,0.12); white-space: nowrap; }
    table.ledger th.sortable { cursor: pointer; user-select: none; }
    table.ledger th.sortable:hover { color: var(--brand-ink); }
    .sort-ico { color: var(--brand-blue); font-size: 0.7rem; }
    table.ledger tbody td { padding: 0.65rem 0.8rem; border-bottom: 1px solid rgba(20,54,61,0.07); color: var(--brand-ink); vertical-align: top; }
    table.ledger tbody tr { cursor: pointer; transition: background .12s; }
    table.ledger tbody tr:hover { background: rgba(19,133,182,0.05); }
    table.ledger tbody tr.row-selected { background: rgba(19,133,182,0.09); }
    table.ledger td small { display: block; color: var(--brand-muted); font-size: 0.76rem; margin-top: 0.1rem; }
    .num { text-align: right !important; white-space: nowrap; }
    .actions-col { width: 52px; text-align: right; }
    .mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.82rem; }
    .pill { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: rgba(20,54,61,0.08); color: var(--brand-ink); }
    .pill-ok { background: rgba(22,163,74,0.12); color: #166534; }

    .pager { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.9rem; }
    .pager-info { color: var(--brand-muted); font-size: 0.85rem; }
    .pager-controls { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
    .pager-size { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: var(--brand-muted); margin-right: 0.6rem; }
    .pager-size select { border: 1.5px solid rgba(20,54,61,0.18); border-radius: 8px; padding: 0.25rem 0.4rem; background: #fff; }
    .pg-btn { min-width: 34px; height: 34px; border-radius: 9px; border: 1px solid rgba(20,54,61,0.15); background: #fff; color: var(--brand-ink); cursor: pointer; font-weight: 600; }
    .pg-btn:hover:not([disabled]) { background: rgba(19,133,182,0.08); }
    .pg-btn[disabled] { opacity: 0.4; cursor: default; }
    .pg-active { background: var(--brand-blue); color: #fff; border-color: var(--brand-blue); }
    .ml-2 { margin-left: 0.4rem; }

    /* DRAWER */
    .ov-backdrop { position: fixed; inset: 0; background: rgba(15,35,50,0.4); z-index: 1000; backdrop-filter: blur(2px); }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(560px, 100vw); background: #fff; z-index: 1001; overflow-y: auto; padding: 1.4rem 1.5rem 2rem; box-shadow: -24px 0 60px rgba(15,40,60,0.22); }
    .drawer-head { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 0.9rem; border-bottom: 1px solid rgba(20,54,61,0.1); margin-bottom: 1rem; }
    .drawer-head > div { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; }
    .drawer-head strong { font-size: 1.2rem; color: var(--brand-ink); }
    .ov-close { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: var(--brand-muted); width: 34px; height: 34px; border-radius: 50%; }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }
    .hero-amount { display: flex; flex-direction: column; background: linear-gradient(135deg, rgba(19,133,182,0.1), rgba(26,183,175,0.1)); border-radius: 14px; padding: 0.9rem 1.1rem; margin-bottom: 0.9rem; }
    .hero-amount span { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--brand-muted); }
    .hero-amount strong { font-size: 1.7rem; color: var(--brand-ink); }
    .hero-amount small { color: var(--brand-muted); }
    .drawer-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
    .drawer-title { margin: 1.2rem 0 0.6rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--brand-muted); }

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
    .void-box { margin-top: 0.9rem; padding: 0.7rem 0.9rem; border-radius: 12px; background: #fee2e2; border: 1px solid #fca5a5; display: flex; flex-direction: column; color: #991b1b; }
    .lines { border-top: 1px dashed rgba(19,133,182,0.2); }
    .line-row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.4rem 0; border-bottom: 1px dashed rgba(19,133,182,0.12); font-size: 0.88rem; color: var(--brand-ink); }
    .line-total { font-weight: 700; border-bottom: none; padding-top: 0.6rem; }

    @media (max-width: 900px) {
      .filters-bar { flex-direction: column; align-items: stretch; }
      .info-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class InvoicesPageComponent implements OnInit {
  private readonly invoicesApi = inject(InvoicesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  ledger: InvoiceLedger | null = null;
  buildings: Building[] = [];
  units: Unit[] = [];
  loading = true;
  exporting = false;

  filters = { buildingId: '', unitId: '', status: '' as InvoiceStatus | '', from: '', to: '' };
  search = '';
  periodMonth = ''; // "AAAA-MM"
  page = 1;
  pageSize = 25;
  sortBy = 'fecha';
  sortDir: 'asc' | 'desc' = 'desc';

  detail: InvoiceLedgerRow | null = null;
  detailFull: Invoice | null = null;
  loadingDetail = false;

  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload(true));

    forkJoin({ buildings: this.buildingsApi.getAll(), units: this.unitsApi.getAll() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ buildings, units }) => { this.buildings = buildings; this.units = units; this.cdr.markForCheck(); },
        error: () => { /* los filtros de edificio y unidad quedan vacíos; la lista igual carga */ }
      });

    this.reload(false);
  }

  // ─── Filtros / carga ─────────────────────────────────────────────────────

  get unitsForFilter(): Unit[] {
    return this.filters.buildingId ? this.units.filter(u => u.buildingId === this.filters.buildingId) : this.units;
  }

  get hasFilters(): boolean {
    return !!(this.search || this.filters.buildingId || this.filters.unitId || this.filters.status || this.periodMonth || this.filters.from || this.filters.to);
  }

  onSearchInput(value: string): void { this.search$.next((value ?? '').trim()); }

  onBuildingChange(): void {
    if (!this.unitsForFilter.some(u => u.id === this.filters.unitId)) this.filters.unitId = '';
    this.reload(true);
  }

  resetFilters(): void {
    this.filters = { buildingId: '', unitId: '', status: '', from: '', to: '' };
    this.search = '';
    this.periodMonth = '';
    this.reload(true);
  }

  private buildQuery(): InvoiceLedgerQuery {
    const [year, month] = this.periodMonth ? this.periodMonth.split('-').map(Number) : [null, null];
    return {
      buildingId: this.filters.buildingId,
      unitId: this.filters.unitId,
      status: this.filters.status,
      year, month,
      from: this.filters.from,
      to: this.filters.to,
      search: this.search.trim(),
      sortBy: this.sortBy,
      sortDir: this.sortDir
    };
  }

  reload(resetPage: boolean): void {
    if (resetPage) this.page = 1;
    this.loading = true;
    this.invoicesApi.getLedger({ ...this.buildQuery(), page: this.page, pageSize: this.pageSize })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ledger => { this.ledger = ledger; this.loading = false; this.cdr.markForCheck(); },
        error: error => {
          this.loading = false;
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar las facturas.'), life: 5000 });
          this.cdr.markForCheck();
        }
      });
  }

  // ─── Orden y paginación ──────────────────────────────────────────────────

  sort(column: string): void {
    if (this.sortBy === column) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortBy = column; this.sortDir = column === 'unidad' ? 'asc' : 'desc'; }
    this.reload(true);
  }

  sortIcon(column: string): string {
    if (this.sortBy !== column) return '';
    return this.sortDir === 'asc' ? '▲' : '▼';
  }

  get totalPages(): number { return this.ledger ? Math.max(Math.ceil(this.ledger.totalCount / this.pageSize), 1) : 1; }
  get rangeFrom(): number { return this.ledger && this.ledger.totalCount > 0 ? (this.page - 1) * this.pageSize + 1 : 0; }
  get rangeTo(): number { return this.ledger ? Math.min(this.page * this.pageSize, this.ledger.totalCount) : 0; }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const start = Math.max(1, Math.min(this.page - 2, total - 4));
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages || p === this.page) return;
    this.page = p;
    this.reload(false);
  }

  // ─── Detalle ─────────────────────────────────────────────────────────────

  openDetail(row: InvoiceLedgerRow): void {
    this.detail = row;
    this.detailFull = null;
    this.loadingDetail = true;
    this.invoicesApi.getById(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: full => { this.detailFull = full; this.loadingDetail = false; this.cdr.markForCheck(); },
      error: () => { this.loadingDetail = false; this.cdr.markForCheck(); }
    });
  }

  closeDetail(): void {
    this.detail = null;
    this.detailFull = null;
  }

  // Igual que el PDF: las moras automáticas ("Mora 0.66% (diario) #94 — Mayo 2026") se muestran en una
  // sola línea por porcentaje ("Mora 0.66% (diario) por un total de 12 días") con la suma; el resto tal cual.
  get detailLines(): { concepto: string; monto: number }[] {
    const lines = this.detailFull?.detalle ?? [];
    const result: { concepto: string; monto: number }[] = [];
    const groups = new Map<string, { line: { concepto: string; monto: number }; count: number; rate: string; freq: string }>();

    for (const line of lines) {
      const match = /^Mora\s+([\d.,]+%)\s*\(([^)]+)\)/i.exec(line.concepto ?? '');
      if (!match) { result.push({ concepto: line.concepto, monto: line.monto }); continue; }

      const rate = match[1];
      const freq = match[2].trim();
      const key = `${rate}|${freq}`.toLowerCase();
      const group = groups.get(key);
      if (group) { group.line.monto += line.monto; group.count++; }
      else {
        const merged = { concepto: '', monto: line.monto };
        groups.set(key, { line: merged, count: 1, rate, freq });
        result.push(merged);
      }
    }

    const units: Record<string, string[]> = { diario: ['día', 'días'], semanal: ['semana', 'semanas'], quincenal: ['quincena', 'quincenas'] };
    groups.forEach(g => {
      const unit = units[g.freq.toLowerCase()] ?? ['intervalo', 'intervalos'];
      g.line.concepto = `Mora ${g.rate} (${g.freq}) por un total de ${g.count} ${g.count === 1 ? unit[0] : unit[1]}`;
    });
    return result;
  }

  // Liquidación → Comprobante → Pago → Factura
  get timeline(): TimelineStep[] {
    const r = this.detail;
    if (!r) return [];

    const liquidationDone = r.liquidationStatus === 'Applied' || r.periodStatus === 'Published' || !!r.liquidationPublishedAtUtc;
    const paymentDone = r.ownerPaymentStatus ? r.ownerPaymentStatus === 'Approved' : true;
    const invoiceState: TimelineStep['state'] = r.status === 'Issued' ? 'done' : r.status === 'Voided' ? 'void' : 'pending';

    return [
      {
        icon: 'pi-calculator',
        title: `Liquidación ${r.periodName || this.periodLabel(r)}`,
        state: liquidationDone ? 'done' : 'pending',
        lines: [
          this.liquidationText(r),
          ...(r.liquidationApprovedAtUtc ? [`Aprobada ${this.fmtDate(r.liquidationApprovedAtUtc)}${r.liquidationApprovedBy ? ' por ' + r.liquidationApprovedBy : ''}`] : []),
          ...(r.liquidationPublishedAtUtc ? [`Publicada ${this.fmtDate(r.liquidationPublishedAtUtc)}${r.liquidationPublishedBy ? ' por ' + r.liquidationPublishedBy : ''}`] : [])
        ]
      },
      {
        icon: 'pi-file',
        title: `Comprobante ${this.periodLabel(r)} · Unidad ${r.unitCode}`,
        state: 'done',
        lines: [`Liquidado ${this.formatCurrency(r.comprobanteTotal)}`, `Vence ${this.fmtDate(r.periodDueDate)}`]
      },
      {
        icon: 'pi-wallet',
        title: `Pago ${r.ownerPaymentReference || r.paymentReference}`,
        state: paymentDone ? 'done' : 'pending',
        lines: [
          `${this.fmtDate(r.paymentDate)} · ${this.formatCurrency(r.paymentAmount)}`,
          ...(r.ownerPaymentStatus ? [`${this.ownerPaymentLabel(r.ownerPaymentStatus)}${r.ownerPaymentResolvedAtUtc ? ' el ' + this.fmtDate(r.ownerPaymentResolvedAtUtc) : ''}${r.ownerPaymentReviewedBy ? ' por ' + r.ownerPaymentReviewedBy : ''}`] : [])
        ]
      },
      {
        icon: 'pi-receipt',
        title: r.numeroFormateado ? `Factura ${r.numeroFormateado}` : 'Factura (sin numerar)',
        state: invoiceState,
        lines: [
          this.statusLabel(r.status),
          ...(r.fechaEmisionUtc ? [`Emitida ${this.fmtDate(r.fechaEmisionUtc)}`] : [`Creada ${this.fmtDate(r.createdAtUtc)}`]),
          ...(r.status === 'Voided' ? [`Anulada ${this.fmtDate(r.fechaAnulacionUtc)}`] : [])
        ]
      }
    ];
  }

  // ─── Exportar ────────────────────────────────────────────────────────────

  exportCsv(): void {
    if (this.exporting) return;
    this.exporting = true;
    this.invoicesApi.getLedger({ ...this.buildQuery(), page: 1, pageSize: 2000 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          const header = ['N° Factura', 'Estado', 'Fecha emisión', 'Edificio', 'Unidad', 'Cliente', 'CI/RUC', 'Período', 'Vencimiento',
            'Liquidación', 'Pago', 'Fecha pago', 'Monto', 'Mora incluida', 'Timbrado'];
          const rows = data.items.map(r => [
            r.numeroFormateado ?? 'Sin numerar', this.statusLabel(r.status), this.fmtDate(r.fechaEmisionUtc || r.createdAtUtc),
            r.buildingName, r.unitCode, r.clienteNombre ?? '', r.clienteDocumento ?? '', this.periodLabel(r), this.fmtDate(r.periodDueDate),
            this.liquidationText(r), r.ownerPaymentReference || r.paymentReference, this.fmtDate(r.paymentDate),
            String(Math.round(r.montoTotal)), String(Math.round(r.moraTotal)), r.seriesNumeroTimbrado ?? ''
          ]);
          const csv = [header, ...rows].map(cols => cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
          const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `facturas_${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          this.exporting = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.exporting = false;
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo exportar.'), life: 5000 });
          this.cdr.markForCheck();
        }
      });
  }

  // ─── Formato ─────────────────────────────────────────────────────────────

  getPdfUrl(id: string): string { return this.invoicesApi.getPdfUrl(id, this.auth.getToken() ?? ''); }

  printDetail(): void {
    if (!this.detail) return;
    printPdfFromUrl(this.getPdfUrl(this.detail.id)).catch(() => {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo imprimir la factura.', life: 5000 });
      this.cdr.markForCheck();
    });
  }

  statusLabel(s: InvoiceStatus): string { return STATUS_LABEL[s] ?? s; }
  statusSev(s: InvoiceStatus): 'warn' | 'success' | 'danger' { return STATUS_SEV[s] ?? 'warn'; }
  ownerPaymentLabel(s: string | null): string { return s ? (OWNER_PAYMENT_LABEL[s] ?? s) : ''; }

  periodLabel(r: InvoiceLedgerRow): string {
    return r.periodYear ? `${r.periodYear}-${String(r.periodMonth).padStart(2, '0')}` : '—';
  }

  liquidationText(r: InvoiceLedgerRow): string {
    if (r.periodStatus === 'Published') return 'Publicada';
    return LIQUIDATION_LABEL[r.liquidationStatus ?? ''] ?? PERIOD_LABEL[r.periodStatus] ?? '—';
  }

  // Las fechas sin hora (AAAA-MM-DD) se formatean tal cual, sin pasar por zona horaria (evita mostrar un día menos).
  fmtDate(d: string | null): string {
    if (!d) return '—';
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
    return new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }
}
