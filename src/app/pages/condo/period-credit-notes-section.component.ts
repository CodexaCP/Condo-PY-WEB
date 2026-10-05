import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges, SimpleChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingExpensesApiService } from '../../api/building-expenses-api.service';
import { resolveUploadUrl } from '../../api/file-url.util';
import { PeriodSupplierCreditNote } from '../../api/models';
import { AuthService } from '../../auth/auth.service';

// Anexo de la liquidación: notas de crédito que los proveedores emitieron sobre los gastos del período, con qué se hizo con cada una
// (descontada del gasto, acreditada como saldo a favor de las unidades, devuelta al fondo de reserva). Se descarga en Excel para el contador.
@Component({
  standalone: true,
  selector: 'app-period-credit-notes-section',
  imports: [CommonModule, Button, Card, Tag],
  template: `
    <p-card styleClass="app-page-card" *ngIf="loading || notes.length || error">
      <div class="head">
        <div>
          <strong>Notas de crédito de proveedor del período</strong>
          <small>Anexo de la liquidación: lo que los proveedores descontaron de los gastos de este período.</small>
        </div>
        <a *ngIf="notes.length" [href]="excelUrl()" target="_blank" rel="noopener">
          <p-button type="button" label="Descargar Excel" icon="pi pi-file-excel" severity="secondary" [outlined]="true" size="small"></p-button>
        </a>
      </div>

      <p class="muted" *ngIf="loading">Cargando...</p>
      <p class="error" *ngIf="error">{{ error }}</p>

      <div class="table-wrap" *ngIf="notes.length">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Proveedor · gasto</th><th>Nº / timbrado</th><th class="num">Monto</th><th>Qué se hizo</th><th>Documento</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let n of notes" [class.voided]="n.status === 'Voided'">
              <td>{{ n.issueDate | date: 'dd/MM/yyyy' }}</td>
              <td>
                <strong>{{ n.supplierName || '—' }}</strong>
                <small>{{ n.expenseDescription }}</small>
              </td>
              <td>
                {{ n.numero }}
                <small *ngIf="n.timbrado">Timbrado {{ n.timbrado }}</small>
              </td>
              <td class="num">
                <strong>{{ gs(n.amount) }}</strong>
                <p-tag *ngIf="n.status === 'Voided'" value="Anulada" severity="secondary"></p-tag>
              </td>
              <td>
                {{ n.treatment }}
                <small *ngIf="n.allocationsCount">{{ n.allocationsCount }} {{ n.allocationsCount === 1 ? 'unidad' : 'unidades' }} · {{ gs(n.allocatedAmount) }}</small>
                <small *ngIf="n.status === 'Voided'" class="void">Anulada: {{ n.voidReason }}</small>
              </td>
              <td>
                <a *ngIf="n.documentUrl" [href]="fileUrl(n.documentUrl)" target="_blank" rel="noopener"><i class="pi pi-paperclip"></i> Ver</a>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td colspan="3">Total aplicado (sin anuladas)</td><td class="num"><strong>{{ gs(total) }}</strong></td><td colspan="2"></td></tr>
          </tfoot>
        </table>
      </div>
    </p-card>
  `,
  styles: [`
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
    .head strong { display: block; font-size: 1rem; }
    .head small { color: var(--brand-muted, #64748b); }
    .muted { color: var(--brand-muted, #64748b); font-size: 0.9rem; }
    .error { color: #b91c1c; font-size: 0.9rem; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
    th, td { padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--p-surface-200, #e2e8f0); text-align: left; vertical-align: top; }
    th { font-size: 0.78rem; color: var(--brand-muted, #64748b); text-transform: uppercase; letter-spacing: 0.02em; }
    td small { display: block; color: var(--brand-muted, #64748b); font-size: 0.78rem; }
    td small.void { color: #b91c1c; }
    .num { text-align: right; white-space: nowrap; }
    tr.voided td { opacity: 0.6; }
    tfoot td { border-bottom: none; font-weight: 700; }
    a { color: var(--p-primary-color); text-decoration: none; }
  `]
})
export class PeriodCreditNotesSectionComponent implements OnChanges {
  @Input({ required: true }) buildingId = '';
  @Input({ required: true }) periodId = '';

  private readonly api = inject(BuildingExpensesApiService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly fileUrl = resolveUploadUrl;

  notes: PeriodSupplierCreditNote[] = [];
  loading = false;
  error = '';

  get total(): number {
    return this.notes.filter(n => n.status === 'Applied').reduce((sum, n) => sum + n.amount, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['buildingId'] || changes['periodId']) this.load();
  }

  excelUrl(): string {
    return this.api.getCreditNotesExcelUrl(this.buildingId, this.periodId || undefined, this.auth.getToken() ?? '');
  }

  gs(value: number | null | undefined): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private load(): void {
    if (!this.buildingId) return;
    this.loading = true;
    this.error = '';
    this.api.getCreditNotesByPeriod(this.buildingId, this.periodId || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: notes => { this.notes = notes; this.loading = false; this.cdr.markForCheck(); },
      // Es un anexo informativo: si falla no se muestra un error ruidoso, solo se oculta.
      error: err => { this.notes = []; this.loading = false; this.error = extractApiErrorMessage(err, ''); this.cdr.markForCheck(); }
    });
  }
}
