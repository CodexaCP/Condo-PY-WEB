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

const MONTHS = [
  { value: 1, label: 'Ene' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
  { value: 4, label: 'Abr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' }, { value: 8, label: 'Ago' }, { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dic' }
];

@Component({
  standalone: true,
  selector: 'app-collections-page',
  imports: [CommonModule, FormsModule, Button, Card, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Cobranza</h1>
            <p>Reporte de emitido, cobrado, pendiente y recuperacion por periodo.</p>
          </div>
        </div>

        <div class="filter-row">
          <label>
            <span>Edificio</span>
            <select [(ngModel)]="selectedBuildingId" name="selectedBuildingId">
              <option value="">Todos</option>
              <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
            </select>
          </label>
          <label>
            <span>Año</span>
            <select [(ngModel)]="selectedYear" name="selectedYear">
              <option [value]="null">Todos</option>
              <option *ngFor="let y of yearOptions" [value]="y">{{ y }}</option>
            </select>
          </label>
          <label>
            <span>Mes desde</span>
            <select [(ngModel)]="selectedFromMonth" name="selectedFromMonth">
              <option [value]="null">Todos</option>
              <option *ngFor="let m of months" [value]="m.value">{{ m.label }}</option>
            </select>
          </label>
          <label>
            <span>Mes hasta</span>
            <select [(ngModel)]="selectedToMonth" name="selectedToMonth">
              <option [value]="null">Todos</option>
              <option *ngFor="let m of months" [value]="m.value">{{ m.label }}</option>
            </select>
          </label>
          <p-button label="Actualizar" icon="pi pi-refresh" (onClick)="loadReport()"></p-button>
          <a [href]="pdfUrl" target="_blank" style="display:contents" *ngIf="report?.items?.length">
            <p-button label="Exportar PDF" icon="pi pi-file-pdf" severity="secondary" [outlined]="true"></p-button>
          </a>
        </div>
      </div>

      <p class="app-state" *ngIf="loading">Cargando reporte de cobranza...</p>

      <ng-container *ngIf="!loading && report">
        <section class="stats-grid">
          <div class="summary-card">
            <span>Total emitido</span>
            <strong>{{ formatCurrency(report.summary.totalChargedAmount) }}</strong>
          </div>
          <div class="summary-card">
            <span>Total cobrado</span>
            <strong>{{ formatCurrency(report.summary.totalCollectedAmount) }}</strong>
          </div>
          <div class="summary-card warning">
            <span>Total pendiente</span>
            <strong>{{ formatCurrency(report.summary.totalPendingAmount) }}</strong>
          </div>
          <div class="summary-card success">
            <span>Recuperacion</span>
            <strong>{{ report.summary.collectionRatePercentage }}%</strong>
          </div>
          <div class="summary-card" *ngIf="report.summary.totalCreditBalanceAmount > 0">
            <span>Creditos a favor</span>
            <strong>{{ formatCurrency(report.summary.totalCreditBalanceAmount) }}</strong>
          </div>
        </section>

        <section class="stats-grid ownership-grid">
          <div class="summary-card">
            <span>Emitido a residentes</span>
            <strong>{{ formatCurrency(report.summary.residentChargedAmount) }}</strong>
          </div>
          <div class="summary-card warning">
            <span>Pendiente residentes</span>
            <strong>{{ formatCurrency(report.summary.residentPendingAmount) }}</strong>
          </div>
          <div class="summary-card">
            <span>Emitido propietario</span>
            <strong>{{ formatCurrency(report.summary.ownerChargedAmount) }}</strong>
          </div>
          <div class="summary-card warning">
            <span>Pendiente propietario</span>
            <strong>{{ formatCurrency(report.summary.ownerPendingAmount) }}</strong>
          </div>
        </section>

        <section class="type-breakdown">
          <div class="summary-chip">Ordinaria {{ formatCurrency(report.summary.ordinaryChargedAmount) }}</div>
          <div class="summary-chip">Reserva {{ formatCurrency(report.summary.reserveFundChargedAmount) }}</div>
          <div class="summary-chip">Extraordinario {{ formatCurrency(report.summary.extraordinaryChargedAmount) }}</div>
          <div class="summary-chip">Individual {{ formatCurrency(report.summary.individualChargedAmount) }}</div>
          <div class="summary-chip">Ajuste {{ formatCurrency(report.summary.adjustmentChargedAmount) }}</div>
        </section>

        <p class="app-state" *ngIf="!report.items.length">No hay periodos para el filtro actual.</p>

        <div class="app-list" *ngIf="report.items.length">
          <div class="app-row header collections-grid">
            <span>Periodo</span>
            <span>Edificio</span>
            <span>Estado</span>
            <span>Emitido</span>
            <span>Cobrado</span>
            <span>Pendiente</span>
            <span>Residentes / Prop.</span>
            <span>Detalle</span>
            <span>Recuperacion</span>
          </div>

          <div class="app-row collections-grid" *ngFor="let item of report.items">
            <strong>{{ item.expensePeriodName }}</strong>
            <span>{{ item.buildingName }}</span>
            <p-tag [value]="statusLabel(item.status)" [severity]="statusSeverity(item.status)"></p-tag>
            <span>{{ formatCurrency(item.totalChargedAmount) }}</span>
            <span>{{ formatCurrency(item.totalCollectedAmount) }}</span>
            <strong [class.warning-text]="item.pendingAmount > 0">{{ formatCurrency(item.pendingAmount) }}</strong>
            <span class="detail-copy">{{ occupancyBreakdownLabel(item) }}</span>
            <span class="detail-copy">{{ chargeBreakdownLabel(item) }}</span>
            <span class="rate-cell">
              {{ item.collectionRatePercentage }}%
              <span *ngIf="item.previousPeriodCollectionRatePercentage != null"
                    [class.delta-up]="item.collectionRatePercentage >= item.previousPeriodCollectionRatePercentage"
                    [class.delta-down]="item.collectionRatePercentage < item.previousPeriodCollectionRatePercentage"
                    class="delta">
                {{ formatDelta(item.collectionRatePercentage, item.previousPeriodCollectionRatePercentage) }}
              </span>
            </span>
          </div>
        </div>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .filter-row { display:flex; gap:0.75rem; align-items:end; flex-wrap:wrap; }
    .filter-row label { display:grid; gap:0.4rem; color:#29484f; font-weight:700; }
    .filter-row select {
      min-width: 160px;
      border: 1px solid #d7e5e1;
      border-radius: 14px;
      padding: 0.85rem 0.9rem;
      font: inherit;
      background: white;
      color: #18353a;
    }
    .stats-grid { display:grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap:1rem; margin-bottom:1rem; }
    .type-breakdown { display:flex; flex-wrap:wrap; gap:0.75rem; margin-bottom:1rem; }
    .summary-chip {
      padding:0.65rem 0.9rem;
      border-radius:999px;
      background:var(--brand-gradient-soft);
      color:var(--brand-ink-soft);
      font-weight:700;
    }
    .summary-card {
      background:rgba(255, 255, 255, 0.84);
      border-radius:20px;
      padding:1rem;
      display:grid;
      gap:0.35rem;
      border:1px solid rgba(19, 133, 182, 0.08);
    }
    .summary-card span { color:var(--brand-muted); }
    .summary-card strong { color:var(--brand-ink); font-size:1.8rem; }
    .summary-card.warning strong, .warning-text { color:#c94d3f; }
    .summary-card.success strong { color:var(--brand-blue); }
    .collections-grid { grid-template-columns: 0.9fr 1fr 0.7fr 0.8fr 0.8fr 0.8fr 0.8fr 1.2fr 0.9fr; }
    .ownership-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .detail-copy { color:var(--brand-muted); }
    .rate-cell { display:flex; align-items:center; gap:0.35rem; }
    .delta { font-size:0.78rem; font-weight:700; border-radius:999px; padding:0.15rem 0.45rem; }
    .delta-up { background:#e6f4ea; color:#1a7f37; }
    .delta-down { background:#fdecea; color:#c94d3f; }
    @media (max-width: 980px) {
      .stats-grid { grid-template-columns: 1fr 1fr; }
      .collections-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .stats-grid { grid-template-columns: 1fr; }
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

  statusLabel(status: string): string {
    return status === 'Draft' ? 'Borrador' : status === 'Closed' ? 'Cerrado' : status === 'Published' ? 'Publicado' : status;
  }

  statusSeverity(status: string): 'success' | 'warn' | 'info' {
    return status === 'Published' ? 'success' : status === 'Closed' ? 'info' : 'warn';
  }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  formatDelta(current: number, previous: number): string {
    const diff = current - previous;
    return (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
  }

  chargeBreakdownLabel(item: CollectionReport['items'][number]): string {
    return [
      item.ordinaryChargedAmount ? `Ord ${this.formatCurrency(item.ordinaryChargedAmount)}` : '',
      item.reserveFundChargedAmount ? `Res ${this.formatCurrency(item.reserveFundChargedAmount)}` : '',
      item.extraordinaryChargedAmount ? `Ext ${this.formatCurrency(item.extraordinaryChargedAmount)}` : '',
      item.individualChargedAmount ? `Ind ${this.formatCurrency(item.individualChargedAmount)}` : '',
      item.adjustmentChargedAmount ? `Adj ${this.formatCurrency(item.adjustmentChargedAmount)}` : ''
    ].filter(Boolean).join(' - ');
  }

  occupancyBreakdownLabel(item: CollectionReport['items'][number]): string {
    return `Res ${this.formatCurrency(item.residentChargedAmount)} / Prop ${this.formatCurrency(item.ownerChargedAmount)}`;
  }
}
