import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { AccountingApiService } from '../../api/accounting-api.service';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { JournalTrialBalance } from '../../api/building-config.models';
import { exportErrorMessage, NumPipe } from './finance-format';
import { bookFileName, saveBlob } from './journal-download';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

// Balance de sumas y saldos del ejercicio, de lo asentado en el Libro diario: por cuenta, saldo inicial, sumas del debe y del haber y saldo final,
// separados en deudor y acreedor, y si el balance cuadra (sumas iguales y saldos deudores = acreedores).
@Component({
  standalone: true,
  selector: 'app-finance-trial-balance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, Message, NumPipe],
  template: `
    <div class="head">
      <p class="muted small">
        Sale de lo asentado en el Libro diario (con sus contraasientos). El saldo inicial es todo lo asentado antes del período; hasta que exista el asiento de
        cierre del ejercicio (fase siguiente), las cuentas de resultado arrastran su saldo de un ejercicio al otro.
      </p>
      <button type="button" class="btn secondary" [disabled]="exporting || !balance?.rows?.length" (click)="download()">
        {{ exporting ? 'Generando...' : 'Excel de sumas y saldos' }}
      </button>
    </div>

    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading && !balance">Cargando...</p>

    <ng-container *ngIf="balance as b">
      <p class="muted" *ngIf="!b.rows.length">No hay asientos asentados en el ejercicio {{ b.fiscalYear }}.</p>

      <ng-container *ngIf="b.rows.length">
        <div class="notice info" *ngIf="b.isBalanced">El balance cuadra: las sumas del debe y del haber coinciden y los saldos deudores igualan a los acreedores.</div>
        <div class="notice" *ngIf="!b.isBalanced">
          <strong>El balance NO cuadra</strong> (diferencia de saldos Gs. {{ b.difference | num }}). Eso indica un asiento descuadrado: avisá al soporte de CondoPY.
        </div>

        <div class="table-wrap">
          <table class="t">
            <thead>
              <tr>
                <th rowspan="2">Cuenta</th>
                <th class="num" colspan="2">Saldo inicial</th><th class="num" colspan="2">Sumas del período</th><th class="num" colspan="2">Saldo final</th>
              </tr>
              <tr>
                <th class="num">Deudor</th><th class="num">Acreedor</th><th class="num">Debe</th><th class="num">Haber</th><th class="num">Deudor</th><th class="num">Acreedor</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of b.rows">
                <td><strong>{{ r.code }}</strong> {{ r.name }}<span class="muted small" *ngIf="r.externalCode"> · contador {{ r.externalCode }}</span></td>
                <td class="num">{{ r.openingDebit ? (r.openingDebit | num) : '' }}</td>
                <td class="num">{{ r.openingCredit ? (r.openingCredit | num) : '' }}</td>
                <td class="num">{{ r.debit | num }}</td>
                <td class="num">{{ r.credit | num }}</td>
                <td class="num">{{ r.closingDebit ? (r.closingDebit | num) : '' }}</td>
                <td class="num">{{ r.closingCredit ? (r.closingCredit | num) : '' }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Totales</strong></td>
                <td class="num"><strong>{{ b.totals.openingDebit | num }}</strong></td><td class="num"><strong>{{ b.totals.openingCredit | num }}</strong></td>
                <td class="num"><strong>{{ b.totals.debit | num }}</strong></td><td class="num"><strong>{{ b.totals.credit | num }}</strong></td>
                <td class="num"><strong>{{ b.totals.closingDebit | num }}</strong></td><td class="num"><strong>{{ b.totals.closingCredit | num }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ng-container>
    </ng-container>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .head { display: flex; gap: 1rem; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; }
    .head p { flex: 1 1 24rem; margin: 0 0 0.8rem; }
    tfoot td { border-top: 2px solid var(--brand-border); padding: 0.5rem 0.7rem; }
  `]
})
export class FinanceTrialBalanceComponent implements OnChanges {
  private readonly api = inject(AccountingApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId = '';
  @Input() buildingName = '';
  @Input() fiscalYear: number | null = null;
  // Cambia cuando se asienta algo: obliga a volver a leer.
  @Input() refreshKey = 0;

  balance: JournalTrialBalance | null = null;
  loading = false;
  error = '';
  exporting = false;

  ngOnChanges(): void {
    if (!this.buildingId) return;

    this.loading = true;
    this.error = '';
    this.api.getTrialBalance(this.buildingId, this.fiscalYear).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: balance => {
        this.balance = balance;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.balance = null;
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo cargar el balance de sumas y saldos.');
        this.cdr.markForCheck();
      }
    });
  }

  download(): void {
    if (this.exporting || !this.balance) return;

    this.exporting = true;
    const year = this.balance.fiscalYear;
    this.api.downloadTrialBalance(this.buildingId, year).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        saveBlob(blob, bookFileName('sumas-y-saldos', this.buildingName, year, 'xlsx'));
        this.exporting = false;
        this.msg.add({ severity: 'success', summary: 'Excel generado', life: 3500 });
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
}
