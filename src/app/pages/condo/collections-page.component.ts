import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { Building, CollectionReport } from '../../api/models';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { CollectionsApiService } from '../../api/collections-api.service';
import { AuthService } from '../../auth/auth.service';

type CollectionItem = CollectionReport['items'][number];
type StatusFilter = 'all' | 'Published' | 'Closed';
type SortKey = 'period' | 'pending' | 'rate';

const MONTHS = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

// Composición del emitido: color fijo por tipo de cargo (la barra y la leyenda usan el mismo).
const TYPES: { key: string; label: string; color: string; field: keyof CollectionReport['summary'] }[] = [
  { key: 'ord', label: 'Ordinaria', color: '#1385b6', field: 'ordinaryChargedAmount' },
  { key: 'res', label: 'Fondo de reserva', color: '#1ab7af', field: 'reserveFundChargedAmount' },
  { key: 'ext', label: 'Extraordinario', color: '#8b5cf6', field: 'extraordinaryChargedAmount' },
  { key: 'ind', label: 'Individual', color: '#f59e0b', field: 'individualChargedAmount' },
  { key: 'adj', label: 'Ajuste', color: '#94a3b8', field: 'adjustmentChargedAmount' }
];

@Component({
  standalone: true,
  selector: 'app-collections-page',
  imports: [CommonModule, FormsModule, Button, Card, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="page-head">
        <div>
          <h1>Cobranza</h1>
          <p>Qué se emitió, cuánto se cobró y cuánto falta, por período.</p>
        </div>
        <a [href]="pdfUrl" target="_blank" style="display:contents" *ngIf="report?.items?.length">
          <p-button label="Exportar PDF" icon="pi pi-file-pdf" severity="secondary" [outlined]="true"></p-button>
        </a>
      </div>

      <!-- Filtros: se aplican solos al cambiar -->
      <div class="filters">
        <label class="f-field f-wide">
          <span>Edificio</span>
          <select [(ngModel)]="selectedBuildingId" (ngModelChange)="loadReport()" name="selectedBuildingId">
            <option [ngValue]="''">Todos los edificios</option>
            <option *ngFor="let b of buildings" [ngValue]="b.id">{{ b.name }}</option>
          </select>
        </label>
        <label class="f-field">
          <span>Año</span>
          <select [(ngModel)]="selectedYear" (ngModelChange)="loadReport()" name="selectedYear">
            <option [ngValue]="null">Todos</option>
            <option *ngFor="let y of yearOptions" [ngValue]="y">{{ y }}</option>
          </select>
        </label>
        <label class="f-field">
          <span>Desde</span>
          <select [(ngModel)]="selectedFromMonth" (ngModelChange)="loadReport()" name="selectedFromMonth">
            <option [ngValue]="null">Enero</option>
            <option *ngFor="let m of months" [ngValue]="m.value">{{ m.label }}</option>
          </select>
        </label>
        <label class="f-field">
          <span>Hasta</span>
          <select [(ngModel)]="selectedToMonth" (ngModelChange)="loadReport()" name="selectedToMonth">
            <option [ngValue]="null">Diciembre</option>
            <option *ngFor="let m of months" [ngValue]="m.value">{{ m.label }}</option>
          </select>
        </label>
        <button type="button" class="f-clear" *ngIf="hasActiveFilters" (click)="clearFilters()">
          <i class="pi pi-times"></i> Limpiar
        </button>
      </div>

      <p class="app-state" *ngIf="loading">Cargando cobranza...</p>

      <ng-container *ngIf="!loading && report as r">

        <!-- Resumen principal -->
        <section class="hero">
          <div class="hero-main">
            <div class="hero-rate" [ngClass]="rateClass(r.summary.collectionRatePercentage)">
              {{ r.summary.collectionRatePercentage | number:'1.0-1' }}<small>%</small>
            </div>
            <div class="hero-rate-label">recuperado</div>
          </div>

          <div class="hero-body">
            <div class="bar" role="img" [attr.aria-label]="'Cobrado ' + r.summary.collectionRatePercentage + '%'">
              <div class="bar-fill" [ngClass]="rateClass(r.summary.collectionRatePercentage)"
                   [style.width.%]="clamp(r.summary.collectionRatePercentage)"></div>
            </div>
            <div class="hero-stats">
              <div class="stat">
                <span class="stat-label">Emitido</span>
                <strong>{{ money(r.summary.totalChargedAmount) }}</strong>
              </div>
              <div class="stat">
                <span class="stat-label">Cobrado</span>
                <strong class="ok">{{ money(r.summary.totalCollectedAmount) }}</strong>
              </div>
              <div class="stat">
                <span class="stat-label">Pendiente</span>
                <strong [class.bad]="r.summary.totalPendingAmount > 0">{{ money(r.summary.totalPendingAmount) }}</strong>
              </div>
              <div class="stat" *ngIf="r.summary.totalCreditBalanceAmount > 0">
                <span class="stat-label">Créditos a favor</span>
                <strong>{{ money(r.summary.totalCreditBalanceAmount) }}</strong>
              </div>
            </div>
          </div>
        </section>

        <!-- Quién debe y de qué -->
        <section class="split">
          <div class="panel">
            <h3>¿Quién debe?</h3>
            <div class="who" *ngFor="let w of who(r.summary)">
              <div class="who-head">
                <span>{{ w.label }}</span>
                <span><strong [class.bad]="w.pending > 0">{{ money(w.pending) }}</strong> <small>de {{ money(w.charged) }}</small></span>
              </div>
              <div class="bar thin"><div class="bar-fill bad" [style.width.%]="clamp(w.pendingPct)"></div></div>
            </div>
          </div>

          <div class="panel">
            <h3>¿De qué se compone lo emitido?</h3>
            <div class="stack" *ngIf="composition(r.summary).length">
              <div *ngFor="let t of composition(r.summary)" class="stack-seg"
                   [style.width.%]="t.pct" [style.background]="t.color" [title]="t.label + ' ' + money(t.amount)"></div>
            </div>
            <ul class="legend">
              <li *ngFor="let t of composition(r.summary)">
                <i [style.background]="t.color"></i>
                <span>{{ t.label }}</span>
                <strong>{{ money(t.amount) }}</strong>
                <small>{{ t.pct | number:'1.0-0' }}%</small>
              </li>
            </ul>
          </div>
        </section>

        <!-- Detalle por período -->
        <div class="list-head">
          <h2>Detalle por período <small>({{ visibleItems.length }})</small></h2>
          <div class="list-tools">
            <div class="seg">
              <button type="button" [class.on]="statusFilter === 'all'" (click)="statusFilter = 'all'">Todos</button>
              <button type="button" [class.on]="statusFilter === 'Published'" (click)="statusFilter = 'Published'">Publicados</button>
              <button type="button" [class.on]="statusFilter === 'Closed'" (click)="statusFilter = 'Closed'">Cerrados</button>
            </div>
            <label class="check">
              <input type="checkbox" [(ngModel)]="onlyPending" name="onlyPending" />
              <span>Solo con saldo pendiente</span>
            </label>
            <label class="f-field inline">
              <span>Ordenar</span>
              <select [(ngModel)]="sortKey" name="sortKey">
                <option value="period">Más recientes</option>
                <option value="pending">Mayor pendiente</option>
                <option value="rate">Menor recuperación</option>
              </select>
            </label>
          </div>
        </div>

        <p class="app-state" *ngIf="!visibleItems.length">No hay períodos para el filtro actual.</p>

        <div class="table" *ngIf="visibleItems.length">
          <div class="t-row t-head">
            <span>Período</span>
            <span>Estado</span>
            <span class="num">Emitido</span>
            <span class="num">Cobrado</span>
            <span class="num">Pendiente</span>
            <span>Recuperación</span>
            <span></span>
          </div>

          <ng-container *ngFor="let item of visibleItems; trackBy: trackItem">
            <div class="t-row t-item" [class.open]="isOpen(item)" (click)="toggle(item)">
              <span class="t-period">
                <strong>{{ item.expensePeriodName }}</strong>
                <small>{{ item.buildingName }}</small>
              </span>
              <span class="t-status">
                <p-tag [value]="statusLabel(item.status)" [severity]="statusSeverity(item.status)"></p-tag>
              </span>
              <span class="num" data-label="Emitido">{{ money(item.totalChargedAmount) }}</span>
              <span class="num" data-label="Cobrado">{{ money(item.totalCollectedAmount) }}</span>
              <span class="num" data-label="Pendiente">
                <strong [class.bad]="item.pendingAmount > 0">{{ money(item.pendingAmount) }}</strong>
                <small class="late" *ngIf="isOverdue(item)">vencido</small>
              </span>
              <span class="t-rate">
                <span class="rate-top">
                  <strong [ngClass]="rateClass(item.collectionRatePercentage)">{{ item.collectionRatePercentage | number:'1.0-1' }}%</strong>
                  <span *ngIf="item.previousPeriodCollectionRatePercentage != null" class="delta"
                        [class.up]="item.collectionRatePercentage >= item.previousPeriodCollectionRatePercentage"
                        [class.down]="item.collectionRatePercentage < item.previousPeriodCollectionRatePercentage"
                        title="Variación contra el período anterior">
                    {{ delta(item.collectionRatePercentage, item.previousPeriodCollectionRatePercentage) }}
                  </span>
                </span>
                <span class="bar thin"><span class="bar-fill" [ngClass]="rateClass(item.collectionRatePercentage)"
                      [style.width.%]="clamp(item.collectionRatePercentage)"></span></span>
              </span>
              <span class="t-toggle"><i class="pi" [ngClass]="isOpen(item) ? 'pi-chevron-up' : 'pi-chevron-down'"></i></span>
            </div>

            <!-- Detalle desplegable -->
            <div class="t-detail" *ngIf="isOpen(item)">
              <div class="d-block">
                <h4>Vencimiento</h4>
                <p>{{ item.dueDate | date:'dd/MM/yyyy' }}</p>
              </div>
              <div class="d-block">
                <h4>Residentes</h4>
                <p>Emitido {{ money(item.residentChargedAmount) }}</p>
                <p>Pendiente <strong [class.bad]="item.residentPendingAmount > 0">{{ money(item.residentPendingAmount) }}</strong></p>
              </div>
              <div class="d-block">
                <h4>Propietarios</h4>
                <p>Emitido {{ money(item.ownerChargedAmount) }}</p>
                <p>Pendiente <strong [class.bad]="item.ownerPendingAmount > 0">{{ money(item.ownerPendingAmount) }}</strong></p>
              </div>
              <div class="d-block d-wide">
                <h4>Composición</h4>
                <p class="chips">
                  <span class="chip" *ngFor="let t of itemTypes(item)">
                    <i [style.background]="t.color"></i>{{ t.label }} {{ money(t.amount) }}
                  </span>
                </p>
              </div>
            </div>
          </ng-container>

          <!-- Totales de lo que se está viendo -->
          <div class="t-row t-total">
            <span>Total ({{ visibleItems.length }})</span>
            <span></span>
            <span class="num">{{ money(totals.charged) }}</span>
            <span class="num">{{ money(totals.collected) }}</span>
            <span class="num"><strong [class.bad]="totals.pending > 0">{{ money(totals.pending) }}</strong></span>
            <span><strong [ngClass]="rateClass(totals.rate)">{{ totals.rate | number:'1.0-1' }}%</strong></span>
            <span></span>
          </div>
        </div>
      </ng-container>
    </p-card>
  `,
  styles: [`
    :host { --ok: #2f9e44; --warn: #e08a00; --bad: #c94d3f; }

    .page-head { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; margin-bottom:1rem; }
    .page-head h1 { margin:0; }
    .page-head p { margin:0.25rem 0 0; color:var(--brand-muted); }

    /* Filtros */
    .filters { display:flex; gap:0.75rem; align-items:flex-end; flex-wrap:wrap; padding:0.9rem 1rem; margin-bottom:1.25rem;
      background:var(--brand-gradient-soft); border-radius:16px; }
    .f-field { display:grid; gap:0.3rem; font-size:0.78rem; font-weight:700; color:var(--brand-ink-soft, #214c60); }
    .f-field.f-wide { min-width:220px; flex:1 1 220px; }
    .f-field select { border:1px solid #d7e5e1; border-radius:12px; padding:0.6rem 0.75rem; font:inherit; font-size:0.9rem;
      background:#fff; color:#18353a; min-width:120px; }
    .f-field.inline { display:flex; align-items:center; gap:0.5rem; }
    .f-field.inline select { padding:0.45rem 0.6rem; min-width:0; }
    .f-clear { border:none; background:none; color:#1385b6; font:inherit; font-weight:700; font-size:0.85rem; cursor:pointer; padding:0.6rem 0.4rem; }
    .f-clear:hover { text-decoration:underline; }

    /* Resumen principal */
    .hero { display:flex; gap:1.5rem; align-items:center; background:#fff; border:1px solid rgba(19,133,182,0.1);
      border-radius:20px; padding:1.25rem 1.5rem; margin-bottom:1rem; box-shadow:0 2px 12px rgba(17,54,74,0.05); }
    .hero-main { text-align:center; min-width:130px; }
    .hero-rate { font-size:3.2rem; font-weight:800; line-height:1; letter-spacing:-0.04em; }
    .hero-rate small { font-size:1.4rem; margin-left:2px; }
    .hero-rate-label { color:var(--brand-muted); font-weight:600; margin-top:0.25rem; }
    .hero-body { flex:1; min-width:0; }
    .hero-stats { display:flex; gap:2rem; flex-wrap:wrap; margin-top:0.9rem; }
    .stat { display:grid; gap:0.15rem; }
    .stat-label { font-size:0.78rem; color:var(--brand-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.04em; }
    .stat strong { font-size:1.35rem; color:var(--brand-ink); }
    .ok { color:var(--ok) !important; } .bad { color:var(--bad) !important; } .mid { color:var(--warn); } .good { color:var(--ok); }

    .bar { height:12px; background:#e8eff3; border-radius:999px; overflow:hidden; display:block; }
    .bar.thin { height:7px; }
    .bar-fill { display:block; height:100%; border-radius:999px; transition:width .3s; }
    .bar-fill.good { background:var(--ok); } .bar-fill.mid { background:var(--warn); } .bar-fill.bad { background:var(--bad); }

    /* Quién debe / composición */
    .split { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem; }
    .panel { background:#fff; border:1px solid rgba(19,133,182,0.1); border-radius:18px; padding:1rem 1.25rem; }
    .panel h3 { margin:0 0 0.8rem; font-size:0.95rem; color:var(--brand-ink); }
    .who { margin-bottom:0.85rem; } .who:last-child { margin-bottom:0; }
    .who-head { display:flex; justify-content:space-between; gap:0.5rem; margin-bottom:0.35rem; font-size:0.9rem; flex-wrap:wrap; }
    .who-head small { color:var(--brand-muted); }
    .stack { display:flex; height:14px; border-radius:999px; overflow:hidden; background:#e8eff3; margin-bottom:0.8rem; }
    .stack-seg { height:100%; }
    .legend { list-style:none; margin:0; padding:0; display:grid; gap:0.4rem; }
    .legend li { display:flex; align-items:center; gap:0.5rem; font-size:0.88rem; }
    .legend i, .chip i { width:10px; height:10px; border-radius:3px; flex-shrink:0; display:inline-block; }
    .legend span { flex:1; color:var(--brand-ink-soft, #214c60); }
    .legend strong { white-space:nowrap; }
    .legend small { color:var(--brand-muted); width:2.6rem; text-align:right; }

    /* Encabezado de la lista */
    .list-head { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; margin-bottom:0.75rem; }
    .list-head h2 { margin:0; font-size:1.1rem; } .list-head h2 small { color:var(--brand-muted); font-weight:600; }
    .list-tools { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; }
    .seg { display:inline-flex; background:#eef3f6; border-radius:999px; padding:3px; }
    .seg button { border:none; background:none; padding:0.35rem 0.85rem; border-radius:999px; font:inherit; font-size:0.82rem;
      font-weight:700; color:var(--brand-muted); cursor:pointer; }
    .seg button.on { background:#1385b6; color:#fff; }
    .check { display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; color:var(--brand-ink-soft, #214c60); cursor:pointer; }

    /* Tabla */
    .table { border:1px solid rgba(19,133,182,0.12); border-radius:16px; overflow:hidden; background:#fff; }
    .t-row { display:grid; grid-template-columns:1.6fr 0.9fr 1fr 1fr 1fr 1.3fr 36px; gap:0.75rem; align-items:center; padding:0.8rem 1rem; }
    .t-head { background:#f3f7fa; font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--brand-muted); }
    .t-item { border-top:1px solid rgba(19,133,182,0.08); cursor:pointer; font-size:0.92rem; }
    .t-item:hover { background:#f8fbfd; } .t-item.open { background:#f3f9fc; }
    .num { text-align:right; font-variant-numeric:tabular-nums; }
    .t-head .num { text-align:right; }
    .t-period { display:grid; gap:0.1rem; } .t-period small { color:var(--brand-muted); }
    .num small.late { display:block; color:var(--bad); font-weight:700; font-size:0.72rem; }
    .t-rate { display:grid; gap:0.3rem; } .rate-top { display:flex; align-items:center; gap:0.4rem; }
    .delta { font-size:0.72rem; font-weight:700; border-radius:999px; padding:0.1rem 0.4rem; }
    .delta.up { background:#e6f4ea; color:#1a7f37; } .delta.down { background:#fdecea; color:var(--bad); }
    .t-toggle { color:var(--brand-muted); text-align:center; }
    .t-total { border-top:2px solid rgba(19,133,182,0.18); background:#f3f7fa; font-weight:700; }

    .t-detail { display:grid; grid-template-columns:repeat(3, 1fr) 2fr; gap:1rem; padding:0.9rem 1rem 1.1rem;
      background:#f8fbfd; border-top:1px dashed rgba(19,133,182,0.18); }
    .d-block h4 { margin:0 0 0.3rem; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--brand-muted); }
    .d-block p { margin:0.1rem 0; font-size:0.88rem; color:var(--brand-ink-soft, #214c60); }
    .chips { display:flex; flex-wrap:wrap; gap:0.4rem; }
    .chip { display:inline-flex; align-items:center; gap:0.4rem; background:#fff; border:1px solid rgba(19,133,182,0.15);
      border-radius:999px; padding:0.2rem 0.65rem; font-size:0.8rem; }

    @media (max-width: 1100px) {
      .t-row { grid-template-columns:1.5fr 0.9fr 1fr 1fr 1fr 1.2fr 30px; font-size:0.85rem; }
      .t-detail { grid-template-columns:1fr 1fr; }
      .d-wide { grid-column:1 / -1; }
    }
    @media (max-width: 820px) {
      .hero { flex-direction:column; align-items:stretch; }
      .hero-main { display:flex; align-items:baseline; gap:0.6rem; justify-content:center; }
      .split { grid-template-columns:1fr; }
      .t-head { display:none; }
      .t-row { grid-template-columns:1fr 1fr; gap:0.4rem 1rem; }
      .t-item { padding:0.9rem 1rem; }
      .t-period { grid-column:1; } .t-status { grid-column:2; text-align:right; }
      .num { text-align:left; }
      .num::before { content:attr(data-label); display:block; font-size:0.7rem; text-transform:uppercase; color:var(--brand-muted); font-weight:700; }
      .t-rate { grid-column:1 / -1; } .t-toggle { display:none; }
      .t-total { grid-template-columns:1fr 1fr 1fr; } .t-total span:nth-child(2), .t-total span:nth-child(7) { display:none; }
    }
  `]
})
export class CollectionsPageComponent implements OnInit {
  private readonly collectionsApi = inject(CollectionsApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  readonly months = MONTHS;
  readonly yearOptions: number[] = (() => {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  })();

  buildings: Building[] = [];
  selectedBuildingId = '';
  selectedYear: number | null = new Date().getFullYear();
  selectedFromMonth: number | null = null;
  selectedToMonth: number | null = null;
  report: CollectionReport | null = null;
  loading = true;

  // Filtros de la lista (en el navegador, sin volver a pedir datos)
  statusFilter: StatusFilter = 'all';
  onlyPending = false;
  sortKey: SortKey = 'period';
  private readonly openIds = new Set<string>();

  ngOnInit(): void {
    this.buildingsApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (buildings) => {
        this.buildings = buildings;
        this.loadReport();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar los edificios.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadReport(): void {
    this.loading = true;
    this.openIds.clear();
    this.collectionsApi.getReport({
      buildingId: this.selectedBuildingId || undefined,
      year: this.selectedYear ?? undefined,
      fromMonth: this.selectedFromMonth ?? undefined,
      toMonth: this.selectedToMonth ?? undefined
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (report) => {
        this.report = report;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el reporte de cobranza.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get hasActiveFilters(): boolean {
    return !!this.selectedBuildingId || this.selectedFromMonth !== null || this.selectedToMonth !== null
      || this.selectedYear !== new Date().getFullYear();
  }

  clearFilters(): void {
    this.selectedBuildingId = '';
    this.selectedYear = new Date().getFullYear();
    this.selectedFromMonth = null;
    this.selectedToMonth = null;
    this.loadReport();
  }

  get pdfUrl(): string {
    return this.collectionsApi.getReportPdfUrl(
      {
        buildingId: this.selectedBuildingId || undefined,
        year: this.selectedYear ?? undefined,
        fromMonth: this.selectedFromMonth ?? undefined,
        toMonth: this.selectedToMonth ?? undefined
      },
      this.auth.getToken() ?? ''
    );
  }

  // ── Lista filtrada y ordenada ─────────────────────────────────────────────
  get visibleItems(): CollectionItem[] {
    let items = [...(this.report?.items ?? [])];

    if (this.statusFilter !== 'all') items = items.filter(i => i.status === this.statusFilter);
    if (this.onlyPending) items = items.filter(i => i.pendingAmount > 0);

    switch (this.sortKey) {
      case 'pending': return items.sort((a, b) => b.pendingAmount - a.pendingAmount);
      case 'rate': return items.sort((a, b) => a.collectionRatePercentage - b.collectionRatePercentage);
      default: return items.sort((a, b) => b.year - a.year || b.month - a.month || a.buildingName.localeCompare(b.buildingName));
    }
  }

  // Totales de lo que se está viendo (cambian con los filtros de la lista).
  get totals(): { charged: number; collected: number; pending: number; rate: number } {
    const items = this.visibleItems;
    const charged = items.reduce((s, i) => s + i.totalChargedAmount, 0);
    const collected = items.reduce((s, i) => s + i.totalCollectedAmount, 0);
    const pending = items.reduce((s, i) => s + i.pendingAmount, 0);
    return { charged, collected, pending, rate: charged > 0 ? (collected / charged) * 100 : 0 };
  }

  trackItem = (_: number, item: CollectionItem) => item.expensePeriodId;
  isOpen(item: CollectionItem): boolean { return this.openIds.has(item.expensePeriodId); }
  toggle(item: CollectionItem): void {
    if (!this.openIds.delete(item.expensePeriodId)) this.openIds.add(item.expensePeriodId);
  }

  // ── Bloques del resumen ───────────────────────────────────────────────────
  who(s: CollectionReport['summary']): { label: string; charged: number; pending: number; pendingPct: number }[] {
    const row = (label: string, charged: number, pending: number) =>
      ({ label, charged, pending, pendingPct: charged > 0 ? (pending / charged) * 100 : 0 });
    return [
      row('Propietarios', s.ownerChargedAmount, s.ownerPendingAmount),
      row('Residentes', s.residentChargedAmount, s.residentPendingAmount)
    ];
  }

  composition(s: CollectionReport['summary']): { label: string; color: string; amount: number; pct: number }[] {
    const total = s.totalChargedAmount > 0 ? s.totalChargedAmount : 0;
    return TYPES
      .map(t => ({ label: t.label, color: t.color, amount: Number(s[t.field] ?? 0) }))
      .filter(t => t.amount > 0)
      .map(t => ({ ...t, pct: total > 0 ? (t.amount / total) * 100 : 0 }));
  }

  itemTypes(item: CollectionItem): { label: string; color: string; amount: number }[] {
    const values: Record<string, number> = {
      ordinaryChargedAmount: item.ordinaryChargedAmount,
      reserveFundChargedAmount: item.reserveFundChargedAmount,
      extraordinaryChargedAmount: item.extraordinaryChargedAmount,
      individualChargedAmount: item.individualChargedAmount,
      adjustmentChargedAmount: item.adjustmentChargedAmount
    };
    return TYPES.map(t => ({ label: t.label, color: t.color, amount: values[t.field as string] ?? 0 })).filter(t => t.amount !== 0);
  }

  // ── Formato ───────────────────────────────────────────────────────────────
  // Verde desde 90 %, ámbar desde 70 %, rojo por debajo.
  rateClass(rate: number): 'good' | 'mid' | 'bad' {
    return rate >= 90 ? 'good' : rate >= 70 ? 'mid' : 'bad';
  }

  clamp(value: number): number { return Math.max(0, Math.min(100, value ?? 0)); }

  isOverdue(item: CollectionItem): boolean {
    return item.pendingAmount > 0 && new Date(item.dueDate) < new Date(new Date().toDateString());
  }

  statusLabel(status: string): string {
    return status === 'Draft' ? 'Borrador' : status === 'Closed' ? 'Cerrado' : status === 'Published' ? 'Publicado' : status;
  }

  statusSeverity(status: string): 'success' | 'warn' | 'info' {
    return status === 'Published' ? 'success' : status === 'Closed' ? 'info' : 'warn';
  }

  money(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  delta(current: number, previous: number): string {
    const diff = current - previous;
    return (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
  }
}
