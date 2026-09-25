import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingComparisonReport } from '../../api/models';
import { BuildingComparisonApiService, BuildingComparisonFilters } from '../../api/building-comparison-api.service';
import { AuthService } from '../../auth/auth.service';

function firstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  standalone: true,
  selector: 'app-reportes-comparativo-edificios-page',
  imports: [CommonModule, FormsModule, Button, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-page-head">
        <div>
          <h1>Comparativo de edificios</h1>
          <p>Toda tu cartera lado a lado — cobrado, gastos, resultado y morosidad actual, ordenado por el que necesita más atención.</p>
        </div>
      </div>

      <div class="filters-bar">
        <div class="field-block">
          <span>Desde</span>
          <input type="date" [(ngModel)]="fromDate" name="fFrom" (ngModelChange)="loadReport()" />
        </div>
        <div class="field-block">
          <span>Hasta</span>
          <input type="date" [(ngModel)]="toDate" name="fTo" (ngModelChange)="loadReport()" />
        </div>
        <p-button label="Actualizar" icon="pi pi-refresh" (onClick)="loadReport()"></p-button>
        <a [href]="pdfUrl" target="_blank" style="display:contents" *ngIf="canExport">
          <p-button label="Exportar PDF" icon="pi pi-file-pdf" severity="secondary" [outlined]="true"></p-button>
        </a>
        <a [href]="excelUrl" target="_blank" style="display:contents" *ngIf="canExport">
          <p-button label="Exportar Excel" icon="pi pi-file-excel" severity="secondary" [outlined]="true"></p-button>
        </a>
      </div>

      <p class="app-state" *ngIf="loading">Cargando comparativo...</p>
      <p class="app-state" *ngIf="!loading && report && !report.items.length">No hay edificios accesibles para este usuario.</p>

      <div class="table-wrap" *ngIf="!loading && report && report.items.length">
        <table class="gap-table">
          <thead>
            <tr>
              <th>Edificio</th>
              <th class="num">Cobrado</th>
              <th class="num">Gastos</th>
              <th class="num">Resultado</th>
              <th class="num">Morosidad actual</th>
              <th class="num">Unid. morosas</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of report.items" [class.overdue-row]="item.overdueAmount > 0">
              <td><strong>{{ item.buildingName }}</strong></td>
              <td class="num credit">{{ formatCurrency(item.totalCollected) }}</td>
              <td class="num debit">{{ formatCurrency(item.totalExpenses) }}</td>
              <td class="num" [class.warning-text]="item.netResult < 0"><strong>{{ formatCurrency(item.netResult) }}</strong></td>
              <td class="num" [class.warning-text]="item.overdueAmount > 0"><strong>{{ formatCurrency(item.overdueAmount) }}</strong></td>
              <td class="num">{{ item.unitsWithOverdueBalance }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </p-card>
  `,
  styles: [`
    .filters-bar { display: flex; align-items: flex-end; gap: 0.85rem; flex-wrap: wrap; padding: 0.8rem 1rem; background: rgba(20,54,61,0.04); border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; margin-bottom: 1.1rem; }
    .field-block { display: flex; flex-direction: column; gap: 0.3rem; min-width: 170px; }
    .field-block span { font-size: 0.75rem; font-weight: 700; color: var(--brand-muted); }
    .field-block input[type="date"] { padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid rgba(20,54,61,0.15); }

    .table-wrap { overflow-x: auto; }
    .gap-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .gap-table th { text-align: left; color: var(--brand-muted); font-weight: 700; padding: 0.55rem 0.7rem; border-bottom: 2px solid rgba(20,54,61,0.1); white-space: nowrap; }
    .gap-table td { padding: 0.55rem 0.7rem; border-bottom: 1px solid rgba(20,54,61,0.08); color: var(--brand-ink); }
    .gap-table th.num, .gap-table td.num { text-align: right; }
    .gap-table td.credit { color: #1AB7AF; font-weight: 600; }
    .gap-table td.debit { color: #c94d3f; font-weight: 600; }
    .warning-text { color: #c94d3f; }
    .overdue-row { background: rgba(201, 77, 63, 0.04); }

    .app-state { color: var(--brand-muted); padding: 1rem 0; }
  `]
})
export class ReportesComparativoEdificiosPageComponent implements OnInit {
  private readonly comparisonApi = inject(BuildingComparisonApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  fromDate = firstDayOfMonth();
  toDate = today();
  report: BuildingComparisonReport | null = null;
  loading = false;

  get canExport(): boolean {
    return !!(this.report && this.report.items.length > 0);
  }

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    // El input nativo de fecha emite valores vacios mientras el usuario todavia esta
    // escribiendo un segmento (dia/mes/anio) — no disparar el pedido hasta tener ambas fechas completas.
    if (!this.fromDate || !this.toDate) return;
    this.loading = true;
    this.comparisonApi.getReport(this.buildFilters())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: report => { this.report = report; this.loading = false; this.cdr.markForCheck(); },
        error: error => {
          this.loading = false;
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo generar el comparativo de edificios.'), life: 5000 });
          this.cdr.markForCheck();
        }
      });
  }

  get pdfUrl(): string {
    return this.comparisonApi.getPdfUrl(this.buildFilters(), this.auth.getToken() ?? '');
  }

  get excelUrl(): string {
    return this.comparisonApi.getExcelUrl(this.buildFilters(), this.auth.getToken() ?? '');
  }

  private buildFilters(): BuildingComparisonFilters {
    return { fromDate: this.fromDate, toDate: this.toDate };
  }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }
}
