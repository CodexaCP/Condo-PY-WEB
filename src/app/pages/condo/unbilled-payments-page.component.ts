import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import * as XLSX from 'xlsx';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { InvoicesApiService } from '../../api/invoices-api.service';
import { Building, InvoiceFunnel } from '../../api/models';
import { MessageService } from 'primeng/api';

const PAGE_SIZE = 25;

@Component({
  standalone: true,
  selector: 'app-unbilled-payments-page',
  imports: [CommonModule, FormsModule, Button, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Pagos sin facturar</h1>
            <p>Pagos aprobados que todavía no tienen ninguna factura (ni borrador ni emitida) — el resto del embudo de facturación también queda a la vista acá.</p>
          </div>
        </div>
        <p-button
          label="Exportar Excel" icon="pi pi-file-excel" severity="secondary" [outlined]="true"
          [loading]="exporting" [disabled]="!funnel || funnel.paymentsWithoutInvoice === 0" (onClick)="exportExcel()">
        </p-button>
      </div>

      <div class="kpi-grid" *ngIf="funnel">
        <div class="kpi" [class.kpi-bad]="funnel.paymentsWithoutInvoice > 0">
          <span class="kpi-label">Pagos sin factura</span>
          <strong>{{ funnel.paymentsWithoutInvoice }}</strong>
          <small>en el filtro actual</small>
        </div>
        <div class="kpi kpi-warn">
          <span class="kpi-label">Borradores sin emitir</span>
          <strong>{{ funnel.draftsNotEmitted }}</strong>
          <small>esperando timbrado</small>
        </div>
        <div class="kpi kpi-ok">
          <span class="kpi-label">Emitidas</span>
          <strong>{{ funnel.issued }}</strong>
          <small>en el edificio filtrado</small>
        </div>
      </div>

      <div class="filters-bar">
        <div class="field-block search-field">
          <span>Buscar</span>
          <div class="search-box">
            <span class="pi pi-search"></span>
            <input type="text" [(ngModel)]="search" name="fSearch" (ngModelChange)="onSearchInput($event)"
                   placeholder="Referencia o unidad" />
          </div>
        </div>
        <div class="field-block">
          <span>Edificio</span>
          <select [(ngModel)]="buildingId" name="fBuilding" (ngModelChange)="reload()">
            <option value="">Todos</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Pago desde</span>
          <input type="date" [(ngModel)]="from" name="fFrom" (ngModelChange)="reload()" />
        </div>
        <div class="field-block">
          <span>Hasta</span>
          <input type="date" [(ngModel)]="to" name="fTo" (ngModelChange)="reload()" />
        </div>
        <p-button type="button" label="Limpiar" icon="pi pi-times" severity="secondary" [outlined]="true" size="small"
                  (onClick)="resetFilters()" [disabled]="!hasFilters"></p-button>
      </div>

      <p class="app-state" *ngIf="loading">Cargando...</p>
      <p class="app-state" *ngIf="!loading && funnel && funnel.paymentsWithoutInvoiceItems.length === 0">
        No hay pagos sin facturar en este filtro. 🎉
      </p>

      <div class="table-wrap" *ngIf="!loading && funnel && funnel.paymentsWithoutInvoiceItems.length > 0">
        <table class="gap-table">
          <thead>
            <tr><th>Edificio</th><th>Unidad</th><th>Fecha</th><th>Monto</th><th>Referencia</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of funnel.paymentsWithoutInvoiceItems">
              <td>{{ item.buildingName }}</td>
              <td>{{ item.unitCode }}</td>
              <td>{{ item.paymentDate | date:'dd/MM/yyyy' }}</td>
              <td>{{ formatCurrency(item.amount) }}</td>
              <td>{{ item.reference }}</td>
            </tr>
          </tbody>
        </table>

        <div class="pager" *ngIf="funnel.paymentsWithoutInvoice > pageSize">
          <p-button icon="pi pi-angle-left" [text]="true" [disabled]="page === 1" (onClick)="prevPage()"></p-button>
          <span>Página {{ page }} de {{ totalPages }}</span>
          <p-button icon="pi pi-angle-right" [text]="true" [disabled]="page >= totalPages" (onClick)="nextPage()"></p-button>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .app-toolbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.1rem; flex-wrap: wrap; }
    .app-page-head p { color: var(--brand-muted); font-size: 0.88rem; margin: 0.2rem 0 0; max-width: 560px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem; margin-bottom: 1.1rem; }
    .kpi { background: #fff; border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; padding: 0.85rem 1rem; display: flex; flex-direction: column; gap: 0.1rem; border-left: 4px solid var(--brand-blue); }
    .kpi-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--brand-muted); }
    .kpi strong { font-size: 1.55rem; color: var(--brand-ink); line-height: 1.15; }
    .kpi small { color: var(--brand-muted); font-size: 0.8rem; }
    .kpi-ok { border-left-color: #16a34a; } .kpi-warn { border-left-color: #f59e0b; } .kpi-bad { border-left-color: #dc2626; }

    .filters-bar { display: flex; align-items: flex-end; gap: 0.85rem; flex-wrap: wrap; padding: 0.8rem 1rem; background: rgba(20,54,61,0.04); border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; margin-bottom: 1.1rem; }
    .field-block { display: flex; flex-direction: column; gap: 0.3rem; min-width: 170px; }
    .field-block span { font-size: 0.75rem; font-weight: 700; color: var(--brand-muted); }
    .field-block select, .field-block input[type="date"] { padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid rgba(20,54,61,0.15); }
    .search-field { min-width: 220px; flex: 1 1 220px; }
    .search-box { display: flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid rgba(20,54,61,0.15); background: #fff; }
    .search-box input { border: none; outline: none; flex: 1; font-size: 0.85rem; }
    .search-box .pi { color: var(--brand-muted); }

    .table-wrap { overflow-x: auto; }
    .gap-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .gap-table th { text-align: left; color: var(--brand-muted); font-weight: 700; padding: 0.5rem 0.6rem; border-bottom: 2px solid rgba(20,54,61,0.1); }
    .gap-table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid rgba(20,54,61,0.08); color: var(--brand-ink); }

    .pager { display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin-top: 0.9rem; font-size: 0.85rem; color: var(--brand-muted); }
    .app-state { color: var(--brand-muted); padding: 1rem 0; }
  `]
})
export class UnbilledPaymentsPageComponent implements OnInit {
  private readonly invoicesApi = inject(InvoicesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  funnel: InvoiceFunnel | null = null;
  buildings: Building[] = [];
  buildingId = '';
  from = '';
  to = '';
  search = '';
  page = 1;
  readonly pageSize = PAGE_SIZE;
  loading = true;
  exporting = false;

  private readonly search$ = new Subject<string>();

  get totalPages(): number {
    if (!this.funnel) return 1;
    return Math.max(1, Math.ceil(this.funnel.paymentsWithoutInvoice / this.pageSize));
  }

  get hasFilters(): boolean {
    return !!(this.buildingId || this.from || this.to || this.search);
  }

  ngOnInit(): void {
    this.search$.pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());

    this.buildingsApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: buildings => { this.buildings = buildings; this.cdr.markForCheck(); },
      error: () => { /* el filtro de edificio queda vacío; la lista igual carga */ }
    });
    this.reload();
  }

  onSearchInput(value: string): void { this.search$.next((value ?? '').trim()); }

  resetFilters(): void {
    this.buildingId = '';
    this.from = '';
    this.to = '';
    this.search = '';
    this.reload();
  }

  reload(): void {
    this.page = 1;
    this.load();
  }

  prevPage(): void { if (this.page > 1) { this.page--; this.load(); } }
  nextPage(): void { if (this.page < this.totalPages) { this.page++; this.load(); } }

  private buildFilters() {
    return {
      buildingId: this.buildingId || undefined,
      from: this.from || undefined,
      to: this.to || undefined,
      search: this.search.trim() || undefined
    };
  }

  private load(): void {
    this.loading = true;
    this.invoicesApi.getFunnel(this.buildFilters(), this.page, this.pageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: funnel => { this.funnel = funnel; this.loading = false; this.cdr.markForCheck(); },
        error: error => {
          this.loading = false;
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el embudo de facturación.'), life: 5000 });
          this.cdr.markForCheck();
        }
      });
  }

  exportExcel(): void {
    if (this.exporting) return;
    this.exporting = true;
    this.invoicesApi.getFunnel(this.buildFilters(), 1, 5000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          const rows = data.paymentsWithoutInvoiceItems.map(r => ({
            'Edificio': r.buildingName,
            'Unidad': r.unitCode,
            'Fecha': this.fmtDate(r.paymentDate),
            'Monto': r.amount,
            'Referencia': r.reference
          }));
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Pagos sin facturar');
          XLSX.writeFile(wb, `pagos_sin_facturar_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

  private fmtDate(value: string): string {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PY');
  }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }
}
