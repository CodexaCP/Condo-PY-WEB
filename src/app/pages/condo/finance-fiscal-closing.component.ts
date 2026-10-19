import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, Input, OnChanges, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { AccountingApiService } from '../../api/accounting-api.service';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { FiscalYearClosing } from '../../api/building-config.models';
import { NumPipe } from './finance-format';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

// Cierre del ejercicio: salda los ingresos y gastos del ejercicio contra «Resultado del período» y pasa el resultado a «Resultados acumulados»
// (dos asientos fechados el último día del ejercicio). Muestra qué se cierra y qué falta; lo cerrado se corrige reabriendo (contraasientos, con motivo).
@Component({
  standalone: true,
  selector: 'app-finance-fiscal-closing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Message, NumPipe],
  template: `
    <p class="muted small">
      Al cerrar el ejercicio, los ingresos y gastos se saldan contra «Resultado del período» y ese resultado pasa a «Resultados acumulados». El ejercicio siguiente
      arranca con las cuentas de resultado en cero. Se cierra en orden, con el Libro diario asentado hasta el último día y sin diferencias pendientes.
    </p>

    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading && !c">Cargando...</p>

    <ng-container *ngIf="c as cl">
      <div class="state" [class.closed]="cl.isClosed">
        <strong *ngIf="cl.isClosed">Ejercicio {{ cl.fiscalYear }} cerrado</strong>
        <strong *ngIf="!cl.isClosed">Ejercicio {{ cl.fiscalYear }} abierto</strong>
        <span class="muted small">Del {{ cl.start | date: 'dd/MM/yyyy' }} al {{ cl.end | date: 'dd/MM/yyyy' }}</span>
        <span class="muted small" *ngIf="cl.isClosed">Asientos de cierre: {{ cl.closingLabels.join(', ') }}</span>
      </div>

      <div class="kpis">
        <div class="kpi"><span>Ingresos</span><strong>{{ cl.totalIncome | num }}</strong></div>
        <div class="kpi"><span>Gastos</span><strong>{{ cl.totalExpense | num }}</strong></div>
        <div class="kpi" [class.bad]="cl.result < 0"><span>{{ cl.result >= 0 ? 'Superávit' : 'Déficit' }}</span><strong>{{ cl.result | num }}</strong></div>
        <div class="kpi"><span>Resultado va a</span><strong class="small">{{ cl.equityAccount || 'Sin cuenta' }}</strong></div>
      </div>

      <div class="notice" *ngIf="!cl.isClosed && cl.blockers.length">
        <strong>Todavía no se puede cerrar:</strong>
        <ul><li *ngFor="let b of cl.blockers">{{ b }}</li></ul>
      </div>

      <div class="table-wrap" *ngIf="cl.accounts.length">
        <table class="t">
          <thead><tr><th>Cuenta</th><th>Clase</th><th class="num">Importe del ejercicio</th></tr></thead>
          <tbody>
            <tr *ngFor="let a of cl.accounts">
              <td><strong>{{ a.code }}</strong> {{ a.name }}</td>
              <td>{{ a.type === 'Income' ? 'Ingreso' : 'Gasto' }}</td>
              <td class="num">{{ a.amount | num }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted" *ngIf="!cl.accounts.length">No hay ingresos ni gastos asentados en el ejercicio {{ cl.fiscalYear }}.</p>

      <div class="actions" *ngIf="cl.canEdit && !cl.isClosed">
        <button type="button" class="btn" [disabled]="!cl.canClose || busy" (click)="close(cl)">{{ busy ? 'Cerrando...' : 'Cerrar el ejercicio ' + cl.fiscalYear }}</button>
      </div>

      <div class="reopen" *ngIf="cl.canEdit && cl.isClosed">
        <p class="muted small" *ngIf="!cl.canReopen">Para reabrir este ejercicio primero hay que reabrir el siguiente, que depende de este cierre.</p>
        <ng-container *ngIf="cl.canReopen">
          <label class="field">
            <span>Motivo de la reapertura <span class="req">*</span></span>
            <input type="text" maxlength="300" [(ngModel)]="reason" placeholder="Por qué se reabre el ejercicio" />
          </label>
          <div class="actions">
            <button type="button" class="btn danger" [disabled]="!reason.trim() || busy" (click)="reopen(cl)">{{ busy ? 'Reabriendo...' : 'Reabrir el ejercicio ' + cl.fiscalYear }}</button>
          </div>
          <p class="muted small">Reabrir anula los asientos de cierre con contraasientos (no se borra nada). Después se puede volver a cerrar.</p>
        </ng-container>
      </div>
    </ng-container>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .state { display: grid; gap: 0.2rem; padding: 0.8rem 1.1rem; margin: 0.4rem 0 1rem; border-radius: 12px; border: 1px solid #e0a23b; background: rgba(224,162,59,0.08); }
    .state.closed { border-color: #6AC64A; background: rgba(106,198,74,0.1); }
    .state strong { font-size: 1.05rem; color: var(--brand-ink); }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.9rem; margin: 0.8rem 0; }
    .kpi { display: grid; gap: 0.25rem; padding: 0.9rem 1.1rem; border-radius: 14px; background: var(--p-content-background, #fff); border: 1px solid var(--brand-border); }
    .kpi span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .kpi strong { font-size: 1.2rem; color: var(--brand-ink); }
    .kpi strong.small { font-size: 0.9rem; }
    .kpi.bad { border-color: #e0a23b; background: rgba(224,162,59,0.07); }
    .notice ul { margin: 0.4rem 0 0; padding-left: 1.2rem; }
    .reopen { margin-top: 1rem; max-width: 40rem; }
    .req { color: #c9473b; }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } }
  `]
})
export class FinanceFiscalClosingComponent implements OnChanges {
  private readonly api = inject(AccountingApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId = '';
  @Input() fiscalYear: number | null = null;
  // Cambia cuando se asienta algo: obliga a volver a leer.
  @Input() refreshKey = 0;
  // Se cerró o reabrió un ejercicio: la pantalla de arriba vuelve a leer los libros.
  @Output() changed = new EventEmitter<void>();

  c: FiscalYearClosing | null = null;
  loading = false;
  error = '';
  busy = false;
  reason = '';

  ngOnChanges(): void {
    this.load();
  }

  close(cl: FiscalYearClosing): void {
    if (this.busy || !cl.canClose) return;
    if (!confirm(`¿Cerrar el ejercicio ${cl.fiscalYear}? Se generan los asientos de cierre (ingresos y gastos contra el resultado). Se puede reabrir después con motivo.`)) return;

    this.busy = true;
    this.api.closeFiscalYear(this.buildingId, cl.fiscalYear).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => this.done(`Ejercicio ${cl.fiscalYear} cerrado`, `${result.firstLabel} a ${result.lastLabel}`),
      error: err => this.fail(err, 'No se pudo cerrar el ejercicio.')
    });
  }

  reopen(cl: FiscalYearClosing): void {
    if (this.busy || !this.reason.trim()) return;
    if (!confirm(`¿Reabrir el ejercicio ${cl.fiscalYear}? Se anulan sus asientos de cierre con contraasientos.`)) return;

    this.busy = true;
    this.api.reopenFiscalYear(this.buildingId, cl.fiscalYear, this.reason.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.reason = '';
        this.done(`Ejercicio ${cl.fiscalYear} reabierto`, `${result.firstLabel} a ${result.lastLabel}`);
      },
      error: err => this.fail(err, 'No se pudo reabrir el ejercicio.')
    });
  }

  private done(summary: string, detail: string): void {
    this.busy = false;
    this.msg.add({ severity: 'success', summary, detail, life: 5000 });
    this.changed.emit();
    this.load();
  }

  private fail(err: unknown, fallback: string): void {
    this.busy = false;
    this.msg.add({ severity: 'error', summary: 'No se pudo', detail: extractApiErrorMessage(err, fallback), life: 8000 });
    this.cdr.markForCheck();
  }

  private load(): void {
    if (!this.buildingId) return;

    this.loading = true;
    this.error = '';
    this.api.getClosing(this.buildingId, this.fiscalYear).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: closing => {
        this.c = closing;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.c = null;
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo cargar el cierre del ejercicio.');
        this.cdr.markForCheck();
      }
    });
  }
}
