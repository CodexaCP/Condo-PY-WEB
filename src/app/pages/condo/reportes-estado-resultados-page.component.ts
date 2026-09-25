import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { Building, EstadoResultadosReport } from '../../api/models';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { EstadoResultadosApiService, EstadoResultadosFilters } from '../../api/estado-resultados-api.service';
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
  selector: 'app-reportes-estado-resultados-page',
  imports: [CommonModule, FormsModule, Button, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-page-head">
        <div>
          <h1>Estado de resultados</h1>
          <p>Ingresos y gastos del edificio agrupados por rubro, listos para cargar en la contabilidad.</p>
        </div>
      </div>

      <div class="filters-bar">
        <div class="field-block">
          <span>Edificio</span>
          <select [(ngModel)]="buildingId" name="fBuilding" (ngModelChange)="onFiltersChange()">
            <option value="" disabled>Seleccionar edificio</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Desde</span>
          <input type="date" [(ngModel)]="fromDate" name="fFrom" (ngModelChange)="onFiltersChange()" />
        </div>
        <div class="field-block">
          <span>Hasta</span>
          <input type="date" [(ngModel)]="toDate" name="fTo" (ngModelChange)="onFiltersChange()" />
        </div>
        <p-button label="Actualizar" icon="pi pi-refresh" [disabled]="!buildingId" (onClick)="loadReport()"></p-button>
        <a [href]="pdfUrl" target="_blank" style="display:contents" *ngIf="canExport">
          <p-button label="Exportar PDF" icon="pi pi-file-pdf" severity="secondary" [outlined]="true"></p-button>
        </a>
        <a [href]="excelUrl" target="_blank" style="display:contents" *ngIf="canExport">
          <p-button label="Exportar Excel" icon="pi pi-file-excel" severity="secondary" [outlined]="true"></p-button>
        </a>
      </div>

      <p class="app-state" *ngIf="!buildingId">Elegí un edificio para generar el estado de resultados.</p>
      <p class="app-state" *ngIf="buildingId && loading">Cargando estado de resultados...</p>

      <ng-container *ngIf="buildingId && !loading && report">
        <section class="stats-grid">
          <div class="summary-card success">
            <span>Total ingresos</span>
            <strong>{{ formatCurrency(report.totalIncome) }}</strong>
          </div>
          <div class="summary-card warning">
            <span>Total gastos</span>
            <strong>{{ formatCurrency(report.totalExpense) }}</strong>
          </div>
          <div class="summary-card" [class.success]="report.netResult >= 0" [class.warning]="report.netResult < 0">
            <span>{{ report.netResult >= 0 ? 'Superávit del período' : 'Déficit del período' }}</span>
            <strong>{{ formatCurrency(report.netResult) }}</strong>
          </div>
        </section>

        <div class="sections-grid">
          <div class="section-card">
            <div class="section-head income">Ingresos</div>
            <p class="app-state" *ngIf="!report.incomeLines.length">Sin movimientos en el período.</p>
            <table class="gap-table" *ngIf="report.incomeLines.length">
              <tbody>
                <tr *ngFor="let line of report.incomeLines">
                  <td>{{ line.label }}</td>
                  <td class="num">{{ formatCurrency(line.amount) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="total-row income">
                  <td>Total ingresos</td>
                  <td class="num">{{ formatCurrency(report.totalIncome) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="section-card">
            <div class="section-head expense">Gastos</div>
            <p class="app-state" *ngIf="!report.expenseLines.length">Sin movimientos en el período.</p>
            <table class="gap-table" *ngIf="report.expenseLines.length">
              <tbody>
                <tr *ngFor="let line of report.expenseLines">
                  <td>{{ line.label }}</td>
                  <td class="num">{{ formatCurrency(line.amount) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="total-row expense">
                  <td>Total gastos</td>
                  <td class="num">{{ formatCurrency(report.totalExpense) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .filters-bar { display: flex; align-items: flex-end; gap: 0.85rem; flex-wrap: wrap; padding: 0.8rem 1rem; background: rgba(20,54,61,0.04); border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; margin-bottom: 1.1rem; }
    .field-block { display: flex; flex-direction: column; gap: 0.3rem; min-width: 170px; }
    .field-block span { font-size: 0.75rem; font-weight: 700; color: var(--brand-muted); }
    .field-block select, .field-block input[type="date"] { padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid rgba(20,54,61,0.15); }

    .stats-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:1rem; margin-bottom:1.1rem; }
    .summary-card { background:rgba(255,255,255,0.84); border-radius:20px; padding:1rem; display:grid; gap:0.35rem; border:1px solid rgba(19, 133, 182, 0.08); }
    .summary-card span { color:var(--brand-muted); }
    .summary-card strong { color:var(--brand-ink); font-size:1.6rem; }
    .summary-card.warning strong { color:#c94d3f; }
    .summary-card.success strong { color:#1a7f37; }

    .sections-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 1.1rem; }
    .section-card { border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; overflow: hidden; }
    .section-head { padding: 0.6rem 1rem; font-weight: 700; color: #fff; }
    .section-head.income { background: #1AB7AF; }
    .section-head.expense { background: #c94d3f; }

    .gap-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .gap-table td { padding: 0.55rem 1rem; border-bottom: 1px solid rgba(20,54,61,0.08); color: var(--brand-ink); }
    .gap-table td.num { text-align: right; }
    .total-row td { font-weight: 700; border-top: 2px solid rgba(20,54,61,0.15); border-bottom: none; }
    .total-row.income td { color: #1a7f37; }
    .total-row.expense td { color: #c94d3f; }

    .app-state { color: var(--brand-muted); padding: 1rem; margin: 0; }

    @media (max-width: 980px) { .stats-grid { grid-template-columns: 1fr; } .sections-grid { grid-template-columns: 1fr; } }
  `]
})
export class ReportesEstadoResultadosPageComponent implements OnInit {
  private readonly estadoResultadosApi = inject(EstadoResultadosApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  buildings: Building[] = [];
  buildingId = '';
  fromDate = firstDayOfMonth();
  toDate = today();
  report: EstadoResultadosReport | null = null;
  loading = false;

  get canExport(): boolean {
    return !!(this.buildingId && this.report && (this.report.incomeLines.length > 0 || this.report.expenseLines.length > 0));
  }

  ngOnInit(): void {
    this.buildingsApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: buildings => {
        this.buildings = buildings;
        if (buildings.length === 1) {
          this.buildingId = buildings[0].id;
          this.loadReport();
        }
        this.cdr.markForCheck();
      },
      error: error => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar los edificios.'), life: 5000 });
        this.cdr.markForCheck();
      }
    });
  }

  onFiltersChange(): void {
    if (this.buildingId) this.loadReport();
  }

  loadReport(): void {
    if (!this.buildingId) return;
    this.loading = true;
    this.estadoResultadosApi.getReport(this.buildFilters())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: report => { this.report = report; this.loading = false; this.cdr.markForCheck(); },
        error: error => {
          this.loading = false;
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo generar el estado de resultados.'), life: 5000 });
          this.cdr.markForCheck();
        }
      });
  }

  get pdfUrl(): string {
    return this.estadoResultadosApi.getPdfUrl(this.buildFilters(), this.auth.getToken() ?? '');
  }

  get excelUrl(): string {
    return this.estadoResultadosApi.getExcelUrl(this.buildFilters(), this.auth.getToken() ?? '');
  }

  private buildFilters(): EstadoResultadosFilters {
    return { buildingId: this.buildingId, fromDate: this.fromDate, toDate: this.toDate };
  }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }
}
