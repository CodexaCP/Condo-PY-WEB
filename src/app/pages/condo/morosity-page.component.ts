import * as XLSX from 'xlsx';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { MorosityApiService } from '../../api/morosity-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { Building, ExpensePeriod, MorosityReport, Unit } from '../../api/models';

const AGING_BUCKETS = [
  { value: '0-30', label: '0-30 días', severity: 'info' as const },
  { value: '31-60', label: '31-60 días', severity: 'warn' as const },
  { value: '61-90', label: '61-90 días', severity: 'warn' as const },
  { value: '+90', label: '+90 días', severity: 'danger' as const }
];

@Component({
  standalone: true,
  selector: 'app-morosity-page',
  imports: [CommonModule, FormsModule, Button, Card, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Morosidad</h1>
            <p>Reporte formal de saldos vencidos por unidad y periodo.</p>
          </div>
        </div>

        <div class="filter-row">
          <label>
            <span>Edificio</span>
            <select [(ngModel)]="selectedBuildingId" name="selectedBuildingId" (ngModelChange)="onBuildingChange()">
              <option value="">Todos</option>
              <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
            </select>
          </label>
          <label>
            <span>Periodo</span>
            <select [(ngModel)]="selectedPeriodId" name="selectedPeriodId" (ngModelChange)="reload(true)">
              <option value="">Todos</option>
              <option *ngFor="let p of periodsForFilter" [value]="p.id">{{ p.name }} · {{ p.buildingName }}</option>
            </select>
          </label>
          <label>
            <span>Unidad</span>
            <select [(ngModel)]="selectedUnitId" name="selectedUnitId" (ngModelChange)="reload(true)">
              <option value="">Todas</option>
              <option *ngFor="let u of unitsForFilter" [value]="u.id">{{ u.code }}{{ selectedBuildingId ? '' : ' · ' + u.buildingName }}</option>
            </select>
          </label>
          <label class="owner-field">
            <span>Propietario / responsable</span>
            <input type="text" [(ngModel)]="ownerSearch" name="ownerSearch" (ngModelChange)="onOwnerSearchInput($event)"
                   placeholder="Buscar por nombre..." />
          </label>
          <label>
            <span>Antiguedad</span>
            <select [(ngModel)]="selectedAgingBucket" name="selectedAgingBucket" (ngModelChange)="reload(true)">
              <option value="">Todos</option>
              <option *ngFor="let b of agingBuckets" [value]="b.value">{{ b.label }}</option>
            </select>
          </label>
          <p-button label="Limpiar" icon="pi pi-times" severity="secondary" [outlined]="true" (onClick)="resetFilters()" [disabled]="!hasFilters"></p-button>
          <p-button label="Exportar Excel" icon="pi pi-download" severity="secondary" [outlined]="true" (onClick)="exportCsv()" [disabled]="!report || !report.totalCount"></p-button>
        </div>
      </div>

      <p class="app-state" *ngIf="loading && !report">Cargando reporte de morosidad...</p>

      <ng-container *ngIf="report">
        <!-- Todas las cards de resumen en una sola fila -->
        <section class="stats-grid">
          <div class="summary-card">
            <span>Unidades en mora</span>
            <strong>{{ report.summary.totalUnitsInArrears }}</strong>
          </div>
          <div class="summary-card">
            <span>Periodos vencidos</span>
            <strong>{{ report.summary.totalOverduePeriods }}</strong>
          </div>
          <div class="summary-card danger">
            <span>Total vencido</span>
            <strong>{{ formatCurrency(report.summary.totalOverdueAmount) }}</strong>
          </div>
          <div class="summary-card" *ngIf="report.summary.totalCreditBalanceAmount > 0">
            <span>Creditos a favor</span>
            <strong>{{ formatCurrency(report.summary.totalCreditBalanceAmount) }}</strong>
          </div>
          <div class="aging-card bucket-30" (click)="selectBucket('0-30')" [class.active]="selectedAgingBucket === '0-30'">
            <span class="bucket-label">0 – 30 días</span>
            <strong>{{ report.summary.units0To30 }} un.</strong>
            <span class="bucket-amount">{{ formatCurrency(report.summary.amount0To30) }}</span>
          </div>
          <div class="aging-card bucket-60" (click)="selectBucket('31-60')" [class.active]="selectedAgingBucket === '31-60'">
            <span class="bucket-label">31 – 60 días</span>
            <strong>{{ report.summary.units31To60 }} un.</strong>
            <span class="bucket-amount">{{ formatCurrency(report.summary.amount31To60) }}</span>
          </div>
          <div class="aging-card bucket-90" (click)="selectBucket('61-90')" [class.active]="selectedAgingBucket === '61-90'">
            <span class="bucket-label">61 – 90 días</span>
            <strong>{{ report.summary.units61To90 }} un.</strong>
            <span class="bucket-amount">{{ formatCurrency(report.summary.amount61To90) }}</span>
          </div>
          <div class="aging-card bucket-over" (click)="selectBucket('+90')" [class.active]="selectedAgingBucket === '+90'">
            <span class="bucket-label">+ 90 días</span>
            <strong>{{ report.summary.unitsOver90 }} un.</strong>
            <span class="bucket-amount">{{ formatCurrency(report.summary.amountOver90) }}</span>
          </div>
        </section>

        <section class="type-breakdown">
          <div class="summary-chip">Ordinaria {{ formatCurrency(report.summary.ordinaryOverdueAmount) }}</div>
          <div class="summary-chip">Reserva {{ formatCurrency(report.summary.reserveFundOverdueAmount) }}</div>
          <div class="summary-chip">Extraordinario {{ formatCurrency(report.summary.extraordinaryOverdueAmount) }}</div>
          <div class="summary-chip">Individual {{ formatCurrency(report.summary.individualOverdueAmount) }}</div>
          <div class="summary-chip">Ajuste {{ formatCurrency(report.summary.adjustmentOverdueAmount) }}</div>
        </section>

        <p class="app-state" *ngIf="!loading && !report.items.length">No hay deuda vencida para el filtro actual.</p>

        <div class="app-list" *ngIf="report.items.length" [class.is-loading]="loading">
          <div class="app-row header morosity-grid">
            <span>Unidad</span>
            <span>Edificio</span>
            <span>Periodo</span>
            <span>Propietario</span>
            <span>Responsable</span>
            <span>Vencimiento</span>
            <span>Antiguedad</span>
            <span>Detalle</span>
            <span>Saldo</span>
          </div>

          <div class="app-row morosity-grid" *ngFor="let item of report.items">
            <strong>{{ item.unitCode }}</strong>
            <span>{{ item.buildingName }}</span>
            <span>{{ item.expensePeriodName }}</span>
            <span class="detail-copy">{{ item.ownerName || '—' }}</span>
            <span class="detail-copy">{{ responsibilityLabel(item) }}</span>
            <span>{{ item.dueDate }}</span>
            <p-tag [value]="agingBucketLabel(item)" [severity]="agingBucketSeverity(item)"></p-tag>
            <span class="detail-copy">{{ chargeBreakdownLabel(item) }}</span>
            <strong class="danger-text">{{ formatCurrency(item.balance) }}</strong>
          </div>
        </div>

        <!-- Paginación -->
        <div class="pager" *ngIf="report.totalCount > 0">
          <span class="pager-info">Mostrando {{ rangeFrom }}–{{ rangeTo }} de {{ report.totalCount }}</span>
          <div class="pager-controls">
            <label class="pager-size">Filas
              <select [(ngModel)]="pageSize" name="pageSize" (ngModelChange)="reload(true)">
                <option [ngValue]="25">25</option>
                <option [ngValue]="50">50</option>
                <option [ngValue]="100">100</option>
                <option [ngValue]="200">200</option>
              </select>
            </label>
            <button class="pg-btn" [disabled]="page <= 1" (click)="goToPage(page - 1)">‹</button>
            <button class="pg-btn" *ngFor="let p of pageNumbers" [class.pg-active]="p === page" (click)="goToPage(p)">{{ p }}</button>
            <button class="pg-btn" [disabled]="page >= totalPages" (click)="goToPage(page + 1)">›</button>
          </div>
        </div>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .filter-row { display:flex; gap:0.65rem; align-items:end; flex-wrap:wrap; }
    .filter-row label { display:grid; gap:0.35rem; color:#29484f; font-weight:700; font-size:0.85rem; }
    .filter-row select, .filter-row input {
      min-width: 160px;
      border: 1px solid #d7e5e1;
      border-radius: 12px;
      padding: 0.6rem 0.75rem;
      font: inherit;
      font-size: 0.9rem;
      background: white;
      color: #18353a;
    }
    .owner-field input { min-width: 200px; }

    /* Cards de resumen y de antiguedad, compactas y cuadradas, todas en la misma fila */
    .stats-grid {
      display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap:0.6rem; margin-bottom:0.85rem;
    }
    .aging-card {
      border-radius:14px;
      padding:0.7rem 0.8rem;
      display:grid;
      gap:0.2rem;
      cursor:pointer;
      transition:box-shadow 0.15s, transform 0.1s;
      border:2px solid transparent;
      aspect-ratio: 1.15;
      align-content: center;
    }
    .aging-card:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,0.08); }
    .aging-card.active { border-color: currentColor; }
    .bucket-30 { background:#e8f4fd; color:#1565c0; }
    .bucket-60 { background:#fff3e0; color:#e65100; }
    .bucket-90 { background:#fce4ec; color:#ad1457; }
    .bucket-over { background:#fdecea; color:#b71c1c; }
    .aging-card .bucket-label { font-size:0.72rem; font-weight:700; opacity:0.75; }
    .aging-card strong { font-size:1.15rem; }
    .aging-card .bucket-amount { font-size:0.76rem; font-weight:700; }
    .type-breakdown { display:flex; flex-wrap:wrap; gap:0.6rem; margin-bottom:0.85rem; }
    .summary-chip {
      padding:0.45rem 0.8rem;
      border-radius:999px;
      background:var(--brand-gradient-soft);
      color:var(--brand-ink-soft);
      font-weight:700;
      font-size:0.82rem;
    }
    .summary-card {
      background:rgba(255, 255, 255, 0.84);
      border-radius:14px;
      padding:0.7rem 0.8rem;
      display:grid;
      gap:0.2rem;
      align-content: center;
      border:1px solid rgba(19, 133, 182, 0.08);
      aspect-ratio: 1.15;
    }
    .summary-card span { color:var(--brand-muted); font-size:0.72rem; font-weight:600; line-height:1.25; }
    .summary-card strong { color:var(--brand-ink); font-size:1.25rem; }
    .summary-card.danger strong, .danger-text { color:#c94d3f; }
    .morosity-grid { grid-template-columns: 0.6fr 1fr 0.9fr 1fr 1fr 0.7fr 0.7fr 1.2fr 0.8fr; }
    .detail-copy { color:var(--brand-muted); }
    .app-list.is-loading { opacity: 0.55; transition: opacity .15s; }

    .pager { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.9rem; }
    .pager-info { color: var(--brand-muted); font-size: 0.85rem; }
    .pager-controls { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
    .pager-size { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: var(--brand-muted); margin-right: 0.6rem; font-weight: 400; }
    .pager-size select { min-width: auto; border: 1.5px solid rgba(20,54,61,0.18); border-radius: 8px; padding: 0.25rem 0.4rem; background: #fff; }
    .pg-btn { min-width: 34px; height: 34px; border-radius: 9px; border: 1px solid rgba(20,54,61,0.15); background: #fff; color: var(--brand-ink); cursor: pointer; font-weight: 600; }
    .pg-btn:hover:not([disabled]) { background: rgba(19,133,182,0.08); }
    .pg-btn[disabled] { opacity: 0.4; cursor: default; }
    .pg-active { background: var(--brand-blue); color: #fff; border-color: var(--brand-blue); }

    @media (max-width: 900px) {
      .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .morosity-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `]
})
export class MorosityPageComponent implements OnInit {
  private readonly morosityApi = inject(MorosityApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  readonly agingBuckets = AGING_BUCKETS;

  buildings: Building[] = [];
  units: Unit[] = [];
  periods: ExpensePeriod[] = [];

  selectedBuildingId = '';
  selectedUnitId = '';
  selectedPeriodId = '';
  selectedAgingBucket = '';
  ownerSearch = '';

  page = 1;
  pageSize = 25;

  report: MorosityReport | null = null;
  loading = true;

  private readonly ownerSearch$ = new Subject<string>();

  get unitsForFilter(): Unit[] {
    return this.selectedBuildingId ? this.units.filter(u => u.buildingId === this.selectedBuildingId) : this.units;
  }

  get periodsForFilter(): ExpensePeriod[] {
    return this.selectedBuildingId ? this.periods.filter(p => p.buildingId === this.selectedBuildingId) : this.periods;
  }

  get hasFilters(): boolean {
    return !!(this.selectedBuildingId || this.selectedUnitId || this.selectedPeriodId || this.selectedAgingBucket || this.ownerSearch);
  }

  get totalPages(): number { return this.report ? Math.max(Math.ceil(this.report.totalCount / this.pageSize), 1) : 1; }
  get rangeFrom(): number { return this.report && this.report.totalCount > 0 ? (this.page - 1) * this.pageSize + 1 : 0; }
  get rangeTo(): number { return this.report ? Math.min(this.page * this.pageSize, this.report.totalCount) : 0; }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const start = Math.max(1, Math.min(this.page - 2, total - 4));
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  ngOnInit(): void {
    this.ownerSearch$.pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload(true));

    forkJoin({
      buildings: this.buildingsApi.getAll(),
      units: this.unitsApi.getAll(),
      periods: this.periodsApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ buildings, units, periods }) => {
        this.buildings = buildings;
        this.units = units;
        this.periods = periods;
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

  onBuildingChange(): void {
    if (!this.unitsForFilter.some(u => u.id === this.selectedUnitId)) this.selectedUnitId = '';
    if (!this.periodsForFilter.some(p => p.id === this.selectedPeriodId)) this.selectedPeriodId = '';
    this.reload(true);
  }

  onOwnerSearchInput(value: string): void { this.ownerSearch$.next((value ?? '').trim()); }

  resetFilters(): void {
    this.selectedBuildingId = '';
    this.selectedUnitId = '';
    this.selectedPeriodId = '';
    this.selectedAgingBucket = '';
    this.ownerSearch = '';
    this.reload(true);
  }

  reload(resetPage: boolean): void {
    if (resetPage) this.page = 1;
    this.loadReport();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages || p === this.page) return;
    this.page = p;
    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;
    this.morosityApi.getReport({
      buildingId: this.selectedBuildingId || undefined,
      unitId: this.selectedUnitId || undefined,
      expensePeriodId: this.selectedPeriodId || undefined,
      ownerSearch: this.ownerSearch.trim() || undefined,
      agingBucket: this.selectedAgingBucket || undefined,
      page: this.page,
      pageSize: this.pageSize
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (report) => {
        this.report = report;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el reporte de morosidad.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectBucket(bucket: string): void {
    this.selectedAgingBucket = this.selectedAgingBucket === bucket ? '' : bucket;
    this.reload(true);
  }

  exportCsv(): void {
    if (!this.report?.totalCount) return;

    this.morosityApi.getReport({
      buildingId: this.selectedBuildingId || undefined,
      unitId: this.selectedUnitId || undefined,
      expensePeriodId: this.selectedPeriodId || undefined,
      ownerSearch: this.ownerSearch.trim() || undefined,
      agingBucket: this.selectedAgingBucket || undefined,
      page: 1,
      pageSize: 5000
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (full) => {
        const rows = full.items.map(item => ({
          'Unidad':            item.unitCode,
          'Edificio':          item.buildingName,
          'Periodo':           item.expensePeriodName,
          'Propietario':       item.ownerName || '',
          'Telefono propietario': item.ownerPhone || '',
          'Email propietario': item.ownerEmail || '',
          'Responsable':       item.responsibleName,
          'Tipo responsable':  item.responsibleType === 'ResidentAssigned' ? 'Residente asignado' : 'Propietario / administracion',
          'Telefono responsable': item.responsiblePhone || '',
          'Email responsable': item.responsibleEmail || '',
          'Vencimiento':       item.dueDate,
          'Dias vencido':      item.daysOverdue,
          'Antiguedad':        item.agingBucket,
          'Total cargos':      item.totalCharges,
          'Total pagado':      item.totalPayments,
          'Saldo pendiente':   item.balance
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Morosidad');
        XLSX.writeFile(wb, 'morosidad.xlsx');
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo exportar.'), life: 5000 });
      }
    });
  }

  agingBucketLabel(item: MorosityReport['items'][number]): string {
    return item.daysOverdue + ' días';
  }

  agingBucketSeverity(item: MorosityReport['items'][number]): 'danger' | 'warn' | 'info' {
    if (item.agingBucket === '+90' || item.agingBucket === '61-90') return 'danger';
    if (item.agingBucket === '31-60') return 'warn';
    return 'info';
  }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  chargeBreakdownLabel(item: MorosityReport['items'][number]): string {
    return [
      item.ordinaryBalance ? `Ord ${this.formatCurrency(item.ordinaryBalance)}` : '',
      item.reserveFundBalance ? `Res ${this.formatCurrency(item.reserveFundBalance)}` : '',
      item.extraordinaryBalance ? `Ext ${this.formatCurrency(item.extraordinaryBalance)}` : '',
      item.individualBalance ? `Ind ${this.formatCurrency(item.individualBalance)}` : '',
      item.adjustmentBalance ? `Adj ${this.formatCurrency(item.adjustmentBalance)}` : ''
    ].filter(Boolean).join(' - ');
  }

  responsibilityLabel(item: MorosityReport['items'][number]): string {
    return item.isOccupied ? item.responsibleName : 'Propietario / administracion';
  }
}
