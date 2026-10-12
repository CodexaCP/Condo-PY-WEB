import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { VatPurchasesBook } from '../../api/building-config.models';
import { FinanceApiService } from '../../api/finance-api.service';
import { FinanceBuildingAccess } from '../../api/models';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { classifyFinanceError, exportErrorMessage, exportFileName, FinanceErrorKind, GsPipe } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

const rateLabel = (rate: number): string => (rate === 0 ? 'Exento' : `${rate} %`);

// Libro de compras: una fila por factura de proveedor (por su monto original y la fecha de la factura) y por nota de crédito del proveedor
// (en negativo), con el IVA incluido discriminado por tasa. Los gastos sin tasa no figuran: se avisa cuántos son para clasificarlos.
@Component({
  standalone: true,
  selector: 'app-finance-vat-purchases-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Button, Card, Tag, GsPipe, FinanceBuildingPickerComponent, FinanceStateComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Libro de compras (IVA)</h1>
            <p>Facturas de proveedores con el IVA incluido, por tasa, para el contador.</p>
          </div>
        </div>
        <div class="controls">
          <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
          <p-button type="button" label="Exportar a Excel" icon="pi pi-file-excel" severity="secondary" [outlined]="true"
                    [loading]="exporting" [disabled]="!data" (onClick)="download()"></p-button>
        </div>
      </div>

      <app-finance-state [loading]="loading && !data" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <div class="filters" *ngIf="buildingId && !noBuilding">
        <label class="field"><span>Desde</span><input type="date" [(ngModel)]="from" (ngModelChange)="reload()" /></label>
        <label class="field"><span>Hasta</span><input type="date" [(ngModel)]="to" (ngModelChange)="reload()" /></label>
      </div>

      <ng-container *ngIf="data as d">
        <div class="notice" *ngIf="d.unclassifiedCount > 0">
          <strong>{{ d.unclassifiedCount }} gastos por {{ d.unclassifiedTotal | gs }}</strong> no tienen tasa de IVA y no figuran en este libro.
          Clasificá las cuentas de egresos en
          <a [routerLink]="['/building-config']" [queryParams]="{ buildingId: d.buildingId, section: 'taxes' }">Centro de configuración → Impuestos</a>
          o elegí la tasa en el propio gasto.
        </div>

        <h3>Resumen por tasa</h3>
        <div class="table-wrap">
          <table class="t">
            <thead><tr><th>Tasa</th><th class="num">Comprobantes</th><th class="num">Total</th><th class="num">Base gravada / exento</th><th class="num">IVA</th></tr></thead>
            <tbody>
              <tr *ngFor="let t of d.totalsByRate">
                <td><strong>{{ rate(t.rate) }}</strong></td>
                <td class="num">{{ t.count }}</td>
                <td class="num">{{ t.total | gs }}</td>
                <td class="num">{{ t.base | gs }}</td>
                <td class="num">{{ t.vat | gs }}</td>
              </tr>
              <tr class="total">
                <td><strong>Total</strong></td><td class="num">{{ count(d) }}</td>
                <td class="num"><strong>{{ d.grandTotal | gs }}</strong></td>
                <td class="num"><strong>{{ d.grandBase | gs }}</strong></td>
                <td class="num"><strong>{{ d.grandVat | gs }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Comprobantes</h3>
        <p class="muted" *ngIf="!d.rows.length">No hay facturas con tasa de IVA en el rango.</p>
        <div class="table-wrap" *ngIf="d.rows.length">
          <table class="t">
            <thead>
              <tr><th>Fecha</th><th>Proveedor</th><th>Timbrado</th><th>N°</th><th>Cuenta</th><th class="num">Total</th><th>Tasa</th><th class="num">Base</th><th class="num">IVA</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of d.rows">
                <td class="nowrap">{{ r.date | date: 'dd/MM/yyyy' }}</td>
                <td>{{ r.supplierName || '—' }}<div class="muted small" *ngIf="r.supplierRuc">RUC {{ r.supplierRuc }}</div></td>
                <td class="nowrap">{{ r.timbrado || '—' }}</td>
                <td class="nowrap">{{ r.documentNumber || '—' }} <p-tag *ngIf="r.isCreditNote" value="NC" severity="warn"></p-tag></td>
                <td><span *ngIf="r.ledgerCategoryCode">{{ r.ledgerCategoryCode }} </span>{{ r.ledgerCategoryName || '' }}<div class="muted small">{{ r.description }}</div></td>
                <td class="num" [class.neg]="r.total < 0">{{ r.total | gs }}</td>
                <td>{{ rate(r.vatRate) }}</td>
                <td class="num" [class.neg]="r.base < 0">{{ r.base | gs }}</td>
                <td class="num" [class.neg]="r.vat < 0">{{ r.vat | gs }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted small">El IVA está incluido en el total de cada comprobante (10 % = total ÷ 11; 5 % = total ÷ 21). Las notas de crédito del proveedor van en negativo.</p>
      </ng-container>
    </p-card>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .controls { display: flex; gap: 0.9rem; align-items: flex-end; flex-wrap: wrap; }
    .filters { display: flex; gap: 0.8rem; flex-wrap: wrap; margin: 0.4rem 0 0.6rem; }
    tr.total td { background: var(--brand-gradient-soft); }
  `]
})
export class FinanceVatPurchasesPageComponent {
  private readonly api = inject(FinanceApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  buildingId = '';
  buildingName = '';
  data: VatPurchasesBook | null = null;
  from = '';
  to = '';
  loading = false;
  exporting = false;
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';

  rate(value: number): string { return rateLabel(value); }
  count(d: VatPurchasesBook): number { return d.totalsByRate.reduce((n, t) => n + t.count, 0); }

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.buildingName = building.buildingName;
    this.from = this.to = '';
    this.load();
  }

  onError(err: unknown): void { this.setError(err); }

  reload(): void { this.load(); }

  download(): void {
    if (this.exporting || !this.data) return;

    this.exporting = true;
    const fileName = exportFileName('libro-de-compras', this.buildingName, `${this.data.from.split('-').join('')}-${this.data.to.split('-').join('')}`);
    this.api.downloadVatPurchases(this.buildingId, this.data.from, this.data.to).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        this.exporting = false;
        this.msg.add({ severity: 'success', summary: 'Excel generado', detail: fileName, life: 4000 });
        this.cdr.markForCheck();
      },
      error: async err => {
        const detail = await exportErrorMessage(err, 'No se pudo generar el Excel.');
        this.exporting = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail, life: 7000 });
        this.cdr.markForCheck();
      }
    });
  }

  private load(): void {
    this.loading = true;
    this.errorKind = '';
    this.api.getVatPurchases(this.buildingId, this.from || undefined, this.to || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data = data;
        // El backend resuelve las fechas por defecto (el mes en curso): se muestran en los filtros.
        this.from = data.from;
        this.to = data.to;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => this.setError(err)
    });
  }

  private setError(err: unknown): void {
    const { kind, message } = classifyFinanceError(err, 'No se pudo cargar el libro de compras.');
    this.data = null;
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }
}
