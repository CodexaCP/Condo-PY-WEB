import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { MorosityApiService } from '../../api/morosity-api.service';
import { Building, MorosityReport } from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-morosity-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag],
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
              <option *ngFor="let building of buildings" [value]="building.id">{{ building.name }}</option>
            </select>
          </label>
          <p-button label="Actualizar" icon="pi pi-refresh" (onClick)="loadReport()"></p-button>
        </div>
      </div>

      <p-message *ngIf="errorMessage" severity="error" [text]="errorMessage"></p-message>
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
            <span>Responsable</span>
            <span>Vencimiento</span>
            <span>Dias</span>
            <span>Detalle</span>
            <span>Saldo</span>
          </div>

          <div class="app-row morosity-grid" *ngFor="let item of report.items">
            <strong>{{ item.unitCode }}</strong>
            <span>{{ item.buildingName }}</span>
            <span>{{ item.expensePeriodName }}</span>
            <span class="detail-copy">{{ responsibilityLabel(item) }}</span>
            <span>{{ item.dueDate }}</span>
            <p-tag [value]="item.daysOverdue + ' dias'" [severity]="item.daysOverdue >= 60 ? 'danger' : item.daysOverdue >= 30 ? 'warn' : 'info'"></p-tag>
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
      min-width: 280px;
      border: 1px solid #d7e5e1;
      border-radius: 14px;
      padding: 0.85rem 0.9rem;
      font: inherit;
      background: white;
      color: #18353a;
    }
    .stats-grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:1rem; margin-bottom:1rem; }
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
    .morosity-grid { grid-template-columns: 0.7fr 1.1fr 0.9fr 1.1fr 0.7fr 0.6fr 1.3fr 0.8fr; }
    .detail-copy { color:var(--brand-muted); }
    @media (max-width: 900px) {
      .stats-grid { grid-template-columns: 1fr; }
      .morosity-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class MorosityPageComponent implements OnInit {
  private readonly morosityApi = inject(MorosityApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  buildings: Building[] = [];
  selectedBuildingId = '';
  report: MorosityReport | null = null;
  loading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.buildingsApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (buildings) => {
        this.buildings = buildings;
        this.loadReport();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = extractApiErrorMessage(error, 'No se pudieron cargar los edificios.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadReport(): void {
    this.loading = true;
    this.errorMessage = '';

    this.morosityApi.getReport(this.selectedBuildingId || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.report = report;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo cargar el reporte de morosidad.');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value ?? 0);
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
