import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { Building } from '../../api/models';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { LibroMovimientosApiService, LibroMovimientosFilters } from '../../api/libro-movimientos-api.service';
import { LibroMovimientosReport, LibroMovimientoType } from '../../api/models';
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
  selector: 'app-reportes-libro-movimientos-page',
  imports: [CommonModule, FormsModule, Button, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-page-head">
        <div>
          <h1>Libro de movimientos</h1>
          <p>Cobros, ingresos y gastos del edificio en orden cronológico, con saldo corriente — listo para el contador.</p>
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

      <p class="app-state" *ngIf="!buildingId">Elegí un edificio para generar el libro de movimientos.</p>
      <p class="app-state" *ngIf="buildingId && loading">Cargando movimientos...</p>

      <ng-container *ngIf="buildingId && !loading && report">
        <section class="stats-grid">
          <div class="summary-card">
            <span>Saldo anterior</span>
            <strong>{{ formatCurrency(report.openingBalance) }}</strong>
          </div>
          <div class="summary-card success">
            <span>Total cobros/ingresos</span>
            <strong>{{ formatCurrency(report.totalCredits) }}</strong>
          </div>
          <div class="summary-card warning">
            <span>Total gastos</span>
            <strong>{{ formatCurrency(report.totalDebits) }}</strong>
          </div>
          <div class="summary-card" [class.success]="report.closingBalance >= 0" [class.warning]="report.closingBalance < 0">
            <span>Saldo final</span>
            <strong>{{ formatCurrency(report.closingBalance) }}</strong>
          </div>
        </section>

        <p class="app-state" *ngIf="!report.items.length">No hay movimientos en el período seleccionado.</p>

        <div class="table-wrap" *ngIf="report.items.length">
          <table class="gap-table">
            <thead>
              <tr>
                <th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Unidad</th><th>Referencia</th>
                <th class="num">Ingreso</th><th class="num">Gasto</th><th class="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of pagedItems">
                <td>{{ item.date | date:'dd/MM/yyyy' }}</td>
                <td><span class="type-chip" [class]="typeClass(item.type)">{{ typeLabel(item.type) }}</span></td>
                <td>{{ item.description }}</td>
                <td>{{ item.unitCode || '-' }}</td>
                <td>{{ item.reference || '-' }}</td>
                <td class="num credit">{{ item.credit > 0 ? formatCurrency(item.credit) : '-' }}</td>
                <td class="num debit">{{ item.debit > 0 ? formatCurrency(item.debit) : '-' }}</td>
                <td class="num" [class.warning-text]="item.runningBalance < 0"><strong>{{ formatCurrency(item.runningBalance) }}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="pager" *ngIf="report.items.length > pageSize">
            <p-button icon="pi pi-angle-left" [text]="true" [disabled]="page === 1" (onClick)="prevPage()"></p-button>
            <span>Página {{ page }} de {{ totalPages }} · {{ report.items.length }} movimientos</span>
            <p-button icon="pi pi-angle-right" [text]="true" [disabled]="page >= totalPages" (onClick)="nextPage()"></p-button>
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

    .stats-grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:1rem; margin-bottom:1.1rem; }
    .summary-card { background:rgba(255,255,255,0.84); border-radius:20px; padding:1rem; display:grid; gap:0.35rem; border:1px solid rgba(19, 133, 182, 0.08); }
    .summary-card span { color:var(--brand-muted); }
    .summary-card strong { color:var(--brand-ink); font-size:1.6rem; }
    .summary-card.warning strong { color:#c94d3f; }
    .summary-card.success strong { color:#1a7f37; }

    .table-wrap { overflow-x: auto; }
    .gap-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .gap-table th { text-align: left; color: var(--brand-muted); font-weight: 700; padding: 0.5rem 0.6rem; border-bottom: 2px solid rgba(20,54,61,0.1); white-space: nowrap; }
    .gap-table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid rgba(20,54,61,0.08); color: var(--brand-ink); }
    .gap-table th.num, .gap-table td.num { text-align: right; }
    .gap-table td.credit { color: #1AB7AF; font-weight: 600; }
    .gap-table td.debit { color: #c94d3f; font-weight: 600; }
    .warning-text { color: #c94d3f; }

    .type-chip { display:inline-block; padding:0.2rem 0.55rem; border-radius:999px; font-size:0.75rem; font-weight:700; }
    .type-cobro { background:#e0f6f5; color:#1385B6; }
    .type-ingreso { background:#e6f4ea; color:#1a7f37; }
    .type-gasto { background:#fdecea; color:#c94d3f; }

    .app-state { color: var(--brand-muted); padding: 1rem 0; }

    .pager { display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin-top: 0.9rem; font-size: 0.85rem; color: var(--brand-muted); }

    @media (max-width: 980px) { .stats-grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 640px) { .stats-grid { grid-template-columns: 1fr; } }
  `]
})
export class ReportesLibroMovimientosPageComponent implements OnInit {
  private readonly libroMovimientosApi = inject(LibroMovimientosApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  buildings: Building[] = [];
  buildingId = '';
  fromDate = firstDayOfMonth();
  toDate = today();
  report: LibroMovimientosReport | null = null;
  loading = false;

  readonly pageSize = 50;
  page = 1;

  get canExport(): boolean {
    return !!(this.buildingId && this.report && this.report.items.length > 0);
  }

  get totalPages(): number {
    if (!this.report) return 1;
    return Math.max(1, Math.ceil(this.report.items.length / this.pageSize));
  }

  get pagedItems(): LibroMovimientosReport['items'] {
    if (!this.report) return [];
    const start = (this.page - 1) * this.pageSize;
    return this.report.items.slice(start, start + this.pageSize);
  }

  prevPage(): void { if (this.page > 1) this.page--; }
  nextPage(): void { if (this.page < this.totalPages) this.page++; }

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
    // El input nativo de fecha emite valores vacios mientras el usuario todavia esta
    // escribiendo un segmento (dia/mes/anio) — no disparar el pedido hasta tener ambas fechas completas.
    if (!this.buildingId || !this.fromDate || !this.toDate) return;
    this.loading = true;
    this.libroMovimientosApi.getReport(this.buildFilters())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: report => { this.report = report; this.page = 1; this.loading = false; this.cdr.markForCheck(); },
        error: error => {
          this.loading = false;
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo generar el libro de movimientos.'), life: 5000 });
          this.cdr.markForCheck();
        }
      });
  }

  get pdfUrl(): string {
    return this.libroMovimientosApi.getPdfUrl(this.buildFilters(), this.auth.getToken() ?? '');
  }

  get excelUrl(): string {
    return this.libroMovimientosApi.getExcelUrl(this.buildFilters(), this.auth.getToken() ?? '');
  }

  private buildFilters(): LibroMovimientosFilters {
    return { buildingId: this.buildingId, fromDate: this.fromDate, toDate: this.toDate };
  }

  typeLabel(type: LibroMovimientoType): string {
    return type === 'Cobro' ? 'Cobro' : type === 'IngresoEdificio' ? 'Ingreso' : 'Gasto';
  }

  typeClass(type: LibroMovimientoType): string {
    return type === 'Cobro' ? 'type-cobro' : type === 'IngresoEdificio' ? 'type-ingreso' : 'type-gasto';
  }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }
}
