import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { AccountingApiService } from '../../api/accounting-api.service';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { JournalStatements } from '../../api/building-config.models';
import { exportErrorMessage, NumPipe } from './finance-format';
import { bookFileName, saveBlob } from './journal-download';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

// Balance general (situación patrimonial) a una fecha y estado de resultados del ejercicio, de lo asentado en el Libro diario (Ley 1034/83, arts. 82-83:
// inventario y balance al cierre de cada ejercicio, dentro de los tres primeros meses del año siguiente). Con el ejercicio sin cerrar, el resultado que
// todavía está en las cuentas de ingresos y gastos se suma al patrimonio para que el balance cuadre.
@Component({
  standalone: true,
  selector: 'app-finance-statements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, Message, NumPipe],
  template: `
    <div class="head">
      <p class="muted small">
        Sale de lo asentado en el Libro diario. El balance general es a la fecha indicada; el estado de resultados es del ejercicio hasta esa fecha y no
        cuenta los asientos de cierre. Hasta cerrar el ejercicio, el resultado todavía no pasó a «Resultados acumulados» y se muestra aparte.
      </p>
      <button type="button" class="btn secondary" [disabled]="exporting || !s" (click)="download()">{{ exporting ? 'Generando...' : 'Excel (balance y resultados)' }}</button>
    </div>

    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading && !s">Cargando...</p>

    <ng-container *ngIf="s as st">
      <div class="notice info" *ngIf="st.isBalanced">
        El balance cuadra al {{ st.asOf | date: 'dd/MM/yyyy' }}: activo = pasivo + patrimonio y fondos<span *ngIf="st.pendingResult"> + resultado del ejercicio sin cerrar</span>.
        <span *ngIf="st.yearClosed"> El ejercicio está cerrado.</span>
      </div>
      <div class="notice" *ngIf="!st.isBalanced">
        <strong>El balance NO cuadra</strong> (diferencia Gs. {{ st.difference | num }}).
        <span *ngIf="st.unclassifiedNet">Hay renglones de una clase desconocida por Gs. {{ st.unclassifiedNet | num }}: cuentas que ya no están en el plan.</span>
        Avisá al soporte de CondoPY.
      </div>

      <div class="grid">
        <section>
          <h3>Balance general</h3>
          <table class="t">
            <thead><tr><th>Cuenta</th><th class="num">Gs.</th></tr></thead>
            <tbody>
              <tr class="group"><td colspan="2">Activo</td></tr>
              <tr *ngFor="let a of st.assets"><td><strong>{{ a.code }}</strong> {{ a.name }}</td><td class="num">{{ a.amount | num }}</td></tr>
              <tr class="total"><td>Total activo</td><td class="num">{{ st.totalAssets | num }}</td></tr>

              <tr class="group"><td colspan="2">Pasivo</td></tr>
              <tr *ngFor="let a of st.liabilities"><td><strong>{{ a.code }}</strong> {{ a.name }}</td><td class="num">{{ a.amount | num }}</td></tr>
              <tr class="total"><td>Total pasivo</td><td class="num">{{ st.totalLiabilities | num }}</td></tr>

              <tr class="group"><td colspan="2">Patrimonio y fondos</td></tr>
              <tr *ngFor="let a of st.equity"><td><strong>{{ a.code }}</strong> {{ a.name }}</td><td class="num">{{ a.amount | num }}</td></tr>
              <tr *ngIf="st.pendingResult"><td>Resultado del ejercicio (todavía sin cerrar)</td><td class="num">{{ st.pendingResult | num }}</td></tr>
              <tr class="total"><td>Total patrimonio y fondos<span *ngIf="st.pendingResult"> + resultado</span></td><td class="num">{{ st.totalEquity + st.pendingResult | num }}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h3>Estado de resultados {{ st.fiscalYear }}</h3>
          <p class="muted small">Del {{ st.from | date: 'dd/MM/yyyy' }} al {{ st.asOf | date: 'dd/MM/yyyy' }}.</p>
          <table class="t">
            <thead><tr><th>Cuenta</th><th class="num">Gs.</th></tr></thead>
            <tbody>
              <tr class="group"><td colspan="2">Ingresos</td></tr>
              <tr *ngFor="let a of st.income"><td><strong>{{ a.code }}</strong> {{ a.name }}</td><td class="num">{{ a.amount | num }}</td></tr>
              <tr class="total"><td>Total ingresos</td><td class="num">{{ st.totalIncome | num }}</td></tr>

              <tr class="group"><td colspan="2">Gastos</td></tr>
              <tr *ngFor="let a of st.expenses"><td><strong>{{ a.code }}</strong> {{ a.name }}</td><td class="num">{{ a.amount | num }}</td></tr>
              <tr class="total"><td>Total gastos</td><td class="num">{{ st.totalExpenses | num }}</td></tr>

              <tr class="total result"><td>{{ st.result >= 0 ? 'Superávit del ejercicio' : 'Déficit del ejercicio' }}</td><td class="num">{{ st.result | num }}</td></tr>
            </tbody>
          </table>
        </section>
      </div>
      <p class="muted" *ngIf="!st.assets.length && !st.income.length && !st.expenses.length">No hay asientos asentados hasta esa fecha.</p>
    </ng-container>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .head { display: flex; gap: 1rem; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; }
    .head p { flex: 1 1 24rem; margin: 0 0 0.8rem; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.4rem; align-items: start; }
    tr.group td { background: rgba(19,133,182,0.08); font-weight: 700; color: var(--brand-ink); }
    tr.total td { font-weight: 700; border-top: 1px solid var(--brand-border); }
    tr.result td { border-top: 2px solid var(--brand-border); font-size: 1rem; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  `]
})
export class FinanceStatementsComponent implements OnChanges {
  private readonly api = inject(AccountingApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId = '';
  @Input() buildingName = '';
  @Input() fiscalYear: number | null = null;
  // Cambia cuando se asienta o se cierra algo: obliga a volver a leer.
  @Input() refreshKey = 0;

  s: JournalStatements | null = null;
  loading = false;
  error = '';
  exporting = false;

  ngOnChanges(): void {
    if (!this.buildingId) return;

    this.loading = true;
    this.error = '';
    this.api.getStatements(this.buildingId, this.fiscalYear).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: statements => {
        this.s = statements;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.s = null;
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo cargar el balance general.');
        this.cdr.markForCheck();
      }
    });
  }

  download(): void {
    if (this.exporting || !this.s) return;

    this.exporting = true;
    const year = this.s.fiscalYear;
    this.api.downloadStatements(this.buildingId, year).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        saveBlob(blob, bookFileName('balance-y-resultados', this.buildingName, year, 'xlsx'));
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
