import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { MorosityApiService } from '../../api/morosity-api.service';
import { Building, MorosityReport } from '../../api/models';

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
            <select [(ngModel)]="selectedBuildingId" name="selectedBuildingId">
              <option value="">Todos</option>
              <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
            </select>
          </label>
          <label>
            <span>Antiguedad</span>
            <select [(ngModel)]="selectedAgingBucket" name="selectedAgingBucket">
              <option value="">Todos</option>
              <option *ngFor="let b of agingBuckets" [value]="b.value">{{ b.label }}</option>
            </select>
          </label>
          <p-button label="Actualizar" icon="pi pi-refresh" (onClick)="loadReport()"></p-button>
          <p-button label="Exportar CSV" icon="pi pi-download" severity="secondary" [outlined]="true" (onClick)="exportCsv()" [disabled]="!report || !report.items.length"></p-button>
        </div>
      </div>

      <p class="app-state" *ngIf="loading">Cargando reporte de morosidad...</p>

      <ng-container *ngIf="!loading && report">
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
        </section>

        <!-- Aging buckets -->
        <section class="aging-grid">
          <div class="aging-card bucket-30" (click)="selectBucket('0-30')" [class.active]="selectedAgingBucket === '0-30'">
            <span class="bucket-label">0 – 30 días</span>
            <strong>{{ report.summary.units0To30 }} unidades</strong>
            <span class="bucket-amount">{{ formatCurrency(report.summary.amount0To30) }}</span>
          </div>
          <div class="aging-card bucket-60" (click)="selectBucket('31-60')" [class.active]="selectedAgingBucket === '31-60'">
            <span class="bucket-label">31 – 60 días</span>
            <strong>{{ report.summary.units31To60 }} unidades</strong>
            <span class="bucket-amount">{{ formatCurrency(report.summary.amount31To60) }}</span>
          </div>
          <div class="aging-card bucket-90" (click)="selectBucket('61-90')" [class.active]="selectedAgingBucket === '61-90'">
            <span class="bucket-label">61 – 90 días</span>
            <strong>{{ report.summary.units61To90 }} unidades</strong>
            <span class="bucket-amount">{{ formatCurrency(report.summary.amount61To90) }}</span>
          </div>
          <div class="aging-card bucket-over" (click)="selectBucket('+90')" [class.active]="selectedAgingBucket === '+90'">
            <span class="bucket-label">+ 90 días</span>
            <strong>{{ report.summary.unitsOver90 }} unidades</strong>
            <span class="bucket-amount">{{ formatCurrency(report.summary.amountOver90) }}</span>
          </div>
        </section>

        <section class="stats-grid occupancy-grid">
          <div class="summary-card">
            <span>Unidades ocupadas en mora</span>
            <strong>{{ report.summary.occupiedUnitsInArrears }}</strong>
          </div>
          <div class="summary-card danger">
            <span>Saldo ocupado vencido</span>
            <strong>{{ formatCurrency(report.summary.occupiedOverdueAmount) }}</strong>
          </div>
          <div class="summary-card">
            <span>Unidades vacias en mora</span>
            <strong>{{ report.summary.vacantUnitsInArrears }}</strong>
          </div>
          <div class="summary-card danger">
            <span>Saldo propietario vencido</span>
            <strong>{{ formatCurrency(report.summary.vacantOverdueAmount) }}</strong>
          </div>
        </section>

        <section class="type-breakdown">
          <div class="summary-chip">Ordinaria {{ formatCurrency(report.summary.ordinaryOverdueAmount) }}</div>
          <div class="summary-chip">Reserva {{ formatCurrency(report.summary.reserveFundOverdueAmount) }}</div>
          <div class="summary-chip">Extraordinario {{ formatCurrency(report.summary.extraordinaryOverdueAmount) }}</div>
          <div class="summary-chip">Individual {{ formatCurrency(report.summary.individualOverdueAmount) }}</div>
          <div class="summary-chip">Ajuste {{ formatCurrency(report.summary.adjustmentOverdueAmount) }}</div>
        </section>

        <p class="app-state" *ngIf="!report.items.length">No hay deuda vencida para el filtro actual.</p>

        <div class="app-list" *ngIf="report.items.length">
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
      </ng-container>
    </p-card>
  `,
  styles: [`
    .filter-row { display:flex; gap:0.75rem; align-items:end; flex-wrap:wrap; }
    .filter-row label { display:grid; gap:0.4rem; color:#29484f; font-weight:700; }
    .filter-row select {
      min-width: 200px;
      border: 1px solid #d7e5e1;
      border-radius: 14px;
      padding: 0.85rem 0.9rem;
      font: inherit;
      background: white;
      color: #18353a;
    }
    .stats-grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:1rem; margin-bottom:1rem; }
    .aging-grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:1rem; margin-bottom:1rem; }
    .aging-card {
      border-radius:20px;
      padding:1rem 1.1rem;
      display:grid;
      gap:0.3rem;
      cursor:pointer;
      transition:box-shadow 0.15s, transform 0.1s;
      border:2px solid transparent;
    }
    .aging-card:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,0.08); }
    .aging-card.active { border-color: currentColor; }
    .bucket-30 { background:#e8f4fd; color:#1565c0; }
    .bucket-60 { background:#fff3e0; color:#e65100; }
    .bucket-90 { background:#fce4ec; color:#ad1457; }
    .bucket-over { background:#fdecea; color:#b71c1c; }
    .aging-card .bucket-label { font-size:0.78rem; font-weight:700; opacity:0.75; }
    .aging-card strong { font-size:1.5rem; }
    .aging-card .bucket-amount { font-size:0.85rem; font-weight:700; }
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
    .summary-card.danger strong, .danger-text { color:#c94d3f; }
    .occupancy-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .morosity-grid { grid-template-columns: 0.6fr 1fr 0.9fr 1fr 1fr 0.7fr 0.7fr 1.2fr 0.8fr; }
    .detail-copy { color:var(--brand-muted); }
    @media (max-width: 900px) {
      .stats-grid, .aging-grid { grid-template-columns: 1fr 1fr; }
      .morosity-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .aging-grid { grid-template-columns: 1fr 1fr; }
    }
  `]
})
export class MorosityPageComponent implements OnInit {
  private readonly morosityApi = inject(MorosityApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  readonly agingBuckets = AGING_BUCKETS;

  buildings: Building[] = [];
  selectedBuildingId = '';
  selectedAgingBucket = '';
  report: MorosityReport | null = null;
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
    this.morosityApi.getReport({
      buildingId: this.selectedBuildingId || undefined,
      agingBucket: this.selectedAgingBucket || undefined
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
    this.loadReport();
  }

  exportCsv(): void {
    if (!this.report?.items.length) return;

    const headers = ['Unidad', 'Edificio', 'Periodo', 'Propietario', 'Responsable', 'Tipo responsable', 'Vencimiento', 'Dias vencido', 'Antiguedad', 'Total cargos', 'Total pagado', 'Saldo pendiente'];
    const rows = this.report.items.map(item => [
      item.unitCode,
      item.buildingName,
      item.expensePeriodName,
      item.ownerName || '',
      item.responsibleName,
      item.responsibleType === 'ResidentAssigned' ? 'Residente asignado' : 'Propietario / administracion',
      item.dueDate,
      item.daysOverdue,
      item.agingBucket,
      item.totalCharges,
      item.totalPayments,
      item.balance
    ]);

    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'morosidad.csv';
    a.click();
    URL.revokeObjectURL(url);
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
