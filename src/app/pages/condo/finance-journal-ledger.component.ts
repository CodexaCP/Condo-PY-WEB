import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { AccountingApiService } from '../../api/accounting-api.service';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { JournalLedger, JournalLedgerAccount } from '../../api/building-config.models';
import { exportErrorMessage, NumPipe } from './finance-format';
import { bookFileName, saveBlob } from './journal-download';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

// Libro Mayor del ejercicio: por cuenta, saldo inicial, sumas del debe y del haber y saldo final, de lo asentado en el Libro diario. Se abre
// una cuenta para ver sus movimientos con el número de asiento y el saldo acumulado. El Excel trae todas las cuentas con su detalle.
@Component({
  standalone: true,
  selector: 'app-finance-journal-ledger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, Message, NumPipe],
  template: `
    <div class="head">
      <p class="muted small">
        Sale de lo asentado en el Libro diario (con sus contraasientos). Saldo positivo = deudor, negativo = acreedor. El saldo inicial es todo lo asentado antes
        del período; hasta que exista el asiento de cierre del ejercicio (fase siguiente), las cuentas de resultado arrastran su saldo de un ejercicio al otro.
      </p>
      <button type="button" class="btn secondary" [disabled]="exporting || !ledger?.accounts?.length" (click)="download()">
        {{ exporting ? 'Generando...' : 'Excel del Libro Mayor' }}
      </button>
    </div>

    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading && !ledger">Cargando...</p>

    <ng-container *ngIf="ledger as l">
      <p class="muted" *ngIf="!l.accounts.length">No hay asientos asentados en el ejercicio {{ l.fiscalYear }}.</p>

      <div class="table-wrap" *ngIf="l.accounts.length">
        <table class="t">
          <thead>
            <tr>
              <th>Cuenta</th><th class="num">Saldo inicial</th><th class="num">Debe</th><th class="num">Haber</th><th class="num">Saldo final</th><th></th>
            </tr>
          </thead>
          <tbody>
            <ng-container *ngFor="let a of l.accounts">
              <tr [class.open]="openCode === a.code">
                <td><strong>{{ a.code }}</strong> {{ a.name }}<span class="muted small" *ngIf="a.externalCode"> · contador {{ a.externalCode }}</span></td>
                <td class="num">{{ a.openingBalance | num }}</td>
                <td class="num">{{ a.debit | num }}</td>
                <td class="num">{{ a.credit | num }}</td>
                <td class="num"><strong>{{ a.closingBalance | num }}</strong></td>
                <td class="num">
                  <button type="button" class="link" *ngIf="a.movementCount > 0" (click)="toggle(a)">
                    {{ openCode === a.code ? 'Ocultar' : 'Ver ' + a.movementCount + ' movimientos' }}
                  </button>
                </td>
              </tr>
              <tr *ngIf="openCode === a.code" class="detail">
                <td colspan="6">
                  <p class="app-state" *ngIf="loadingDetail">Cargando...</p>
                  <table class="t inner" *ngIf="detail && !loadingDetail">
                    <thead><tr><th>Fecha</th><th>N° asiento</th><th>Glosa</th><th class="num">Debe</th><th class="num">Haber</th><th class="num">Saldo</th></tr></thead>
                    <tbody>
                      <tr class="muted"><td colspan="5">Saldo inicial</td><td class="num">{{ detail.openingBalance | num }}</td></tr>
                      <tr *ngFor="let m of detail.movements">
                        <td class="nowrap">{{ m.date | date: 'dd/MM/yyyy' }}</td>
                        <td class="nowrap"><strong>{{ m.entryLabel }}</strong></td>
                        <td>{{ m.description }}</td>
                        <td class="num">{{ m.debit ? (m.debit | num) : '' }}</td>
                        <td class="num">{{ m.credit ? (m.credit | num) : '' }}</td>
                        <td class="num">{{ m.balance | num }}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </ng-container>
          </tbody>
          <tfoot>
            <tr><td><strong>Totales del período</strong></td><td></td><td class="num"><strong>{{ l.totalDebit | num }}</strong></td><td class="num"><strong>{{ l.totalCredit | num }}</strong></td><td colspan="2"></td></tr>
          </tfoot>
        </table>
      </div>
    </ng-container>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .head { display: flex; gap: 1rem; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; }
    .head p { flex: 1 1 24rem; margin: 0 0 0.8rem; }
    tr.open td { background: rgba(19,133,182,0.06); }
    tr.detail > td { padding: 0.3rem 0.7rem 0.9rem 2rem; background: rgba(19,133,182,0.03); }
    table.inner { font-size: 0.85rem; }
    tfoot td { border-top: 2px solid var(--brand-border); padding: 0.5rem 0.7rem; }
    .link { background: none; border: none; color: #1385B6; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; padding: 0; }
  `]
})
export class FinanceJournalLedgerComponent implements OnChanges {
  private readonly api = inject(AccountingApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId = '';
  @Input() buildingName = '';
  @Input() fiscalYear: number | null = null;
  // Cambia cuando se asienta algo: obliga a volver a leer.
  @Input() refreshKey = 0;

  ledger: JournalLedger | null = null;
  loading = false;
  error = '';
  exporting = false;
  openCode = '';
  detail: JournalLedgerAccount | null = null;
  loadingDetail = false;

  ngOnChanges(): void {
    if (!this.buildingId) return;

    this.openCode = '';
    this.detail = null;
    this.loading = true;
    this.error = '';
    this.api.getLedger(this.buildingId, this.fiscalYear).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ledger => {
        this.ledger = ledger;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.ledger = null;
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo cargar el Libro Mayor.');
        this.cdr.markForCheck();
      }
    });
  }

  toggle(account: JournalLedgerAccount): void {
    if (this.openCode === account.code) {
      this.openCode = '';
      this.detail = null;
      return;
    }

    this.openCode = account.code;
    this.detail = null;
    this.loadingDetail = true;
    this.api.getLedger(this.buildingId, this.ledger?.fiscalYear ?? this.fiscalYear, account.code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ledger => {
        this.detail = ledger.accounts.find(a => a.code === account.code) ?? null;
        this.loadingDetail = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.loadingDetail = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudieron cargar los movimientos.'), life: 6000 });
        this.cdr.markForCheck();
      }
    });
  }

  download(): void {
    if (this.exporting || !this.ledger) return;

    this.exporting = true;
    const year = this.ledger.fiscalYear;
    this.api.downloadLedger(this.buildingId, year).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        saveBlob(blob, bookFileName('libro-mayor', this.buildingName, year, 'xlsx'));
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
