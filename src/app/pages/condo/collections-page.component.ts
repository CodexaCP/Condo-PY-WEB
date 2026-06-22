import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { Building, CollectionReport } from '../../api/models';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { CollectionsApiService } from '../../api/collections-api.service';

@Component({
  standalone: true,
  selector: 'app-collections-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag],
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
              <option *ngFor="let building of buildings" [value]="building.id">{{ building.name }}</option>
            </select>
          </label>
          <p-button label="Actualizar" icon="pi pi-refresh" (onClick)="loadReport()"></p-button>
        </div>
      </div>

      <p-message *ngIf="errorMessage" severity="error" [text]="errorMessage"></p-message>
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
            <span>{{ item.collectionRatePercentage }}%</span>
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
    .collections-grid { grid-template-columns: 0.9fr 1fr 0.7fr 0.8fr 0.8fr 0.8fr 0.8fr 1.2fr 0.7fr; }
    .ownership-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .detail-copy { color:var(--brand-muted); }
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  buildings: Building[] = [];
  selectedBuildingId = '';
  report: CollectionReport | null = null;
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

    this.collectionsApi.getReport(this.selectedBuildingId || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.report = report;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo cargar el reporte de cobranza.');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  statusLabel(status: string): string {
    return status === 'Draft' ? 'Borrador' : status === 'Closed' ? 'Cerrado' : status === 'Published' ? 'Publicado' : status;
  }

  statusSeverity(status: string): 'success' | 'warn' | 'info' {
    return status === 'Published' ? 'success' : status === 'Closed' ? 'info' : 'warn';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value ?? 0);
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
