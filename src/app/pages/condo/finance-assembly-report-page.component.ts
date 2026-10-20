import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { AssemblyReportApiService } from '../../api/assembly-report-api.service';
import { AssemblyReport, AssemblyReportRequest } from '../../api/building-config.models';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { FinanceBuildingAccess, FinanceBudgetVsActualLine } from '../../api/models';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { classifyFinanceError, exportErrorMessage, FinanceErrorKind, GsPipe, todayParaguay } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

const NOTES_MAX = 4000;

const ACCOUNT_TYPE_LABELS: Record<string, string> = { Cash: 'caja', Bank: 'banco', ReserveFund: 'fondo de reserva', Clearing: 'cobros online por liquidar' };

// Informe para la asamblea de propietarios: saldos por cuenta, estado de resultados por rubro (criterio de caja), ejecución presupuestaria
// del ejercicio, fondo de reserva, morosidad por antigüedad, cuentas por pagar y las notas del administrador. Se ve en pantalla y se baja en
// PDF; usa los mismos números que las pantallas de Finanzas. La morosidad va solo agregada: no figura ninguna unidad ni propietario.
@Component({
  standalone: true,
  selector: 'app-finance-assembly-report-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Message, GsPipe, FinanceBuildingPickerComponent, FinanceStateComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Informe de asamblea</h1>
            <p>El estado financiero del edificio para presentar a los propietarios.</p>
          </div>
        </div>
        <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
      </div>

      <app-finance-state [loading]="false" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="buildingId && !noBuilding && !errorKind">
        <form class="form" (ngSubmit)="preview()">
          <label class="field">
            <span>Desde</span>
            <input type="date" name="from" [(ngModel)]="from" [max]="today" />
            <span class="hint">Vacío: desde el comienzo del ejercicio.</span>
          </label>
          <label class="field">
            <span>Hasta</span>
            <input type="date" name="to" [(ngModel)]="to" [max]="today" />
            <span class="hint">Vacío: hasta hoy. El rango no puede superar los 400 días.</span>
          </label>
          <label class="field wide">
            <span>Notas del administrador (opcional)</span>
            <textarea name="notes" rows="5" [maxLength]="notesMax" [(ngModel)]="notes" placeholder="Aprobaciones pendientes, obras en curso, aclaraciones sobre los números..."></textarea>
            <span class="hint">{{ notes.length }} / {{ notesMax }} caracteres. No se guardan: van solo en el informe que generes ahora.</span>
          </label>
          <div class="actions wide">
            <p-button type="submit" label="Ver informe" icon="pi pi-eye" [loading]="loading"></p-button>
            <p-button type="button" label="Descargar PDF" icon="pi pi-file-pdf" severity="secondary" [outlined]="true" [loading]="downloading" (onClick)="download()"></p-button>
          </div>
        </form>

        <p-message *ngIf="error" severity="error" [text]="error"></p-message>

        <ng-container *ngIf="report as r">
          <h2>{{ r.buildingName }} · {{ r.from | date: 'dd/MM/yyyy' }} al {{ r.to | date: 'dd/MM/yyyy' }}</h2>

          <div class="kpis">
            <div class="kpi"><span>Saldo inicial</span><strong>{{ r.openingBalance | gs }}</strong></div>
            <div class="kpi"><span>Ingresos</span><strong class="pos">{{ r.totalIncome | gs }}</strong></div>
            <div class="kpi"><span>Egresos</span><strong class="neg">{{ r.totalExpense | gs }}</strong></div>
            <div class="kpi main"><span>Saldo final</span><strong>{{ r.closingBalance | gs }}</strong></div>
          </div>

          <div class="notice" *ngIf="r.warnings.length">
            <strong>Observaciones</strong>
            <ul><li *ngFor="let w of r.warnings">{{ w }}</li></ul>
          </div>

          <h3>Saldos por cuenta</h3>
          <div class="table-wrap">
            <table class="t">
              <thead><tr><th>Cuenta</th><th class="num">Saldo inicial</th><th class="num">Entradas</th><th class="num">Salidas</th><th class="num">Saldo final</th></tr></thead>
              <tbody>
                <tr *ngFor="let a of r.accounts">
                  <td>{{ a.name }} <span class="muted small" *ngIf="!a.isUnassigned">({{ typeLabel(a.type) }})</span></td>
                  <td class="num">{{ a.opening | gs }}</td><td class="num">{{ a.inflows | gs }}</td><td class="num">{{ a.outflows | gs }}</td><td class="num"><strong>{{ a.closing | gs }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Estado de resultados <span class="muted small">· criterio de caja</span></h3>
          <div class="two">
            <div class="table-wrap">
              <table class="t">
                <thead><tr><th colspan="2">Ingresos</th><th class="num"></th></tr></thead>
                <tbody>
                  <tr *ngFor="let l of r.incomeLines"><td class="nowrap">{{ l.code }}</td><td>{{ l.name }}</td><td class="num">{{ l.amount | gs }}</td></tr>
                  <tr *ngIf="!r.incomeLines.length"><td colspan="3" class="muted">Sin ingresos en el rango.</td></tr>
                  <tr class="total"><td colspan="2"><strong>Total ingresos</strong></td><td class="num"><strong>{{ r.totalIncome | gs }}</strong></td></tr>
                </tbody>
              </table>
            </div>
            <div class="table-wrap">
              <table class="t">
                <thead><tr><th colspan="2">Egresos</th><th class="num"></th></tr></thead>
                <tbody>
                  <tr *ngFor="let l of r.expenseLines"><td class="nowrap">{{ l.code }}</td><td>{{ l.name }}</td><td class="num">{{ l.amount | gs }}</td></tr>
                  <tr *ngIf="!r.expenseLines.length"><td colspan="3" class="muted">Sin egresos en el rango.</td></tr>
                  <tr class="total"><td colspan="2"><strong>Total egresos</strong></td><td class="num"><strong>{{ r.totalExpense | gs }}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <p class="result" [class.pos]="r.netResult >= 0" [class.neg]="r.netResult < 0">
            {{ r.netResult >= 0 ? 'Superávit del período' : 'Déficit del período' }}: <strong>{{ r.netResult | gs }}</strong>
          </p>

          <ng-container *ngIf="r.budget as b">
            <h3>Ejecución presupuestaria</h3>
            <p class="muted small">Acumulado del ejercicio {{ b.fiscalYear }} ({{ b.fiscalYearStart | date: 'dd/MM/yyyy' }} al {{ b.asOf | date: 'dd/MM/yyyy' }}).
              Ingresos: {{ b.incomeBasis.toLowerCase() }} · Gastos: {{ b.expenseBasis.toLowerCase() }}.</p>
            <div class="table-wrap">
              <table class="t">
                <thead><tr><th>Cuenta</th><th class="num">Presupuestado</th><th class="num">Real</th><th class="num">Desvío</th><th class="num">%</th></tr></thead>
                <tbody>
                  <ng-container *ngFor="let section of budgetSections(b)">
                    <tr class="section"><td colspan="5">{{ section.title }}</td></tr>
                    <tr *ngFor="let l of section.lines">
                      <td>{{ l.code }} {{ l.name }}</td>
                      <td class="num">{{ l.ytdBudget | gs }}</td>
                      <td class="num">{{ l.ytdActual | gs }}</td>
                      <td class="num" [class.neg]="l.ytdStatus === 'Red'" [class.warn]="l.ytdStatus === 'Amber'">{{ l.ytdVariance | gs }}</td>
                      <td class="num">{{ l.ytdVariancePct === null ? '—' : l.ytdVariancePct + ' %' }}</td>
                    </tr>
                    <tr class="total"><td><strong>Total {{ section.title.toLowerCase() }}</strong></td><td class="num"><strong>{{ section.totals.ytdBudget | gs }}</strong></td><td class="num"><strong>{{ section.totals.ytdActual | gs }}</strong></td><td class="num"><strong>{{ section.totals.ytdActual - section.totals.ytdBudget | gs }}</strong></td><td></td></tr>
                  </ng-container>
                </tbody>
              </table>
            </div>
          </ng-container>

          <ng-container *ngIf="r.reserve as f">
            <h3>Fondo de reserva</h3>
            <p class="muted small">Cuenta «{{ f.accountName }}»<span *ngIf="f.reserveFundPercentage !== null"> · aporte previsto: {{ f.reserveFundPercentage }} % de las expensas</span>.</p>
            <div class="kpis">
              <div class="kpi"><span>Saldo inicial</span><strong>{{ f.opening | gs }}</strong></div>
              <div class="kpi"><span>Aportes</span><strong class="pos">{{ f.contributions | gs }}</strong></div>
              <div class="kpi"><span>Usos</span><strong class="neg">{{ f.uses | gs }}</strong></div>
              <div class="kpi main"><span>Saldo final</span><strong>{{ f.closing | gs }}</strong></div>
            </div>
          </ng-container>

          <h3>Morosidad por antigüedad</h3>
          <p class="muted small">Situación al {{ r.snapshotDate | date: 'dd/MM/yyyy' }} (fecha de emisión), sobre las expensas publicadas. Resumen agregado: no se identifican unidades ni propietarios.</p>
          <div class="kpis">
            <div class="kpi"><span>Cobrado</span><strong class="pos">{{ r.receivables.totalCollected | gs }}</strong><small>{{ r.receivables.collectionRatePercentage }} % de lo emitido</small></div>
            <div class="kpi"><span>Pendiente</span><strong>{{ r.receivables.totalPending | gs }}</strong></div>
            <div class="kpi"><span>Vencido</span><strong class="neg">{{ r.receivables.overdueAmount | gs }}</strong><small>{{ r.receivables.overdueUnits }} {{ r.receivables.overdueUnits === 1 ? 'unidad' : 'unidades' }}</small></div>
          </div>
          <div class="table-wrap">
            <table class="t">
              <thead><tr><th>Antigüedad</th><th class="num">Unidades-período</th><th class="num">Monto</th></tr></thead>
              <tbody><tr *ngFor="let b of r.receivables.aging"><td>{{ b.label }}</td><td class="num">{{ b.count }}</td><td class="num">{{ b.total | gs }}</td></tr></tbody>
            </table>
          </div>

          <h3>Cuentas por pagar</h3>
          <p class="muted small">Facturas de proveedores con vencimiento y sin pago registrado, al {{ r.snapshotDate | date: 'dd/MM/yyyy' }} (fecha de emisión).</p>
          <div class="kpis">
            <div class="kpi"><span>A pagar</span><strong>{{ r.payables.pendingTotal | gs }}</strong><small>{{ r.payables.pendingCount }} facturas</small></div>
            <div class="kpi"><span>Vencido</span><strong class="neg">{{ r.payables.overdueTotal | gs }}</strong><small>{{ r.payables.overdueCount }} facturas</small></div>
            <div class="kpi"><span>Vence en 7 días</span><strong>{{ r.payables.dueNext7DaysTotal | gs }}</strong></div>
          </div>
          <div class="table-wrap">
            <table class="t">
              <thead><tr><th>Antigüedad</th><th class="num">Facturas</th><th class="num">Monto</th></tr></thead>
              <tbody><tr *ngFor="let b of r.payables.aging"><td>{{ b.label }}</td><td class="num">{{ b.count }}</td><td class="num">{{ b.total | gs }}</td></tr></tbody>
            </table>
          </div>

          <ng-container *ngIf="r.notes">
            <h3>Notas del administrador</h3>
            <p class="notes">{{ r.notes }}</p>
          </ng-container>
        </ng-container>
      </ng-container>
    </p-card>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .form { max-width: 52rem; }
    .field textarea { resize: vertical; }
    .actions.wide { grid-column: 1 / -1; }
    h2 { margin-top: 1.6rem; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.9rem; margin: 0.8rem 0; }
    .kpi { display: grid; gap: 0.25rem; padding: 0.9rem 1.1rem; border-radius: 14px; background: var(--p-content-background, #fff); border: 1px solid var(--brand-border); align-content: start; }
    .kpi span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .kpi strong { font-size: 1.2rem; color: var(--brand-ink); }
    .kpi small { color: var(--brand-muted); font-size: 0.78rem; }
    .kpi.main { background: var(--brand-gradient-soft); border-color: transparent; }
    .two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .result { margin: 0.8rem 0; font-size: 1.05rem; }
    tr.total td { background: var(--brand-gradient-soft); }
    tr.section td { font-weight: 700; color: var(--brand-muted); background: rgba(19,133,182,0.05); }
    .warn { color: #b7791f; }
    .notes { white-space: pre-wrap; border: 1px solid var(--brand-border); border-radius: 12px; padding: 0.8rem 1rem; }
    .notice ul { margin: 0.3rem 0 0; padding-left: 1.2rem; }
    @media (max-width: 900px) { .two { grid-template-columns: 1fr; } }
  `]
})
export class FinanceAssemblyReportPageComponent {
  private readonly api = inject(AssemblyReportApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly today = todayParaguay();
  readonly notesMax = NOTES_MAX;

  buildingId = '';
  buildingName = '';
  from = '';
  to = '';
  notes = '';
  report: AssemblyReport | null = null;
  loading = false;
  downloading = false;
  error = '';
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';

  typeLabel(type: string): string { return ACCOUNT_TYPE_LABELS[type] ?? type; }

  // Las secciones de la ejecución presupuestaria: solo los renglones con presupuesto o con movimiento.
  budgetSections(b: NonNullable<AssemblyReport['budget']>): { title: string; lines: FinanceBudgetVsActualLine[]; totals: { ytdBudget: number; ytdActual: number } }[] {
    const keep = (lines: FinanceBudgetVsActualLine[]) => lines.filter(l => l.ytdBudget !== 0 || l.ytdActual !== 0);
    return [
      { title: 'Ingresos', lines: keep(b.incomeLines), totals: b.incomeTotals },
      { title: 'Gastos', lines: keep(b.expenseLines), totals: b.expenseTotals }
    ].filter(s => s.lines.length > 0);
  }

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.buildingName = building.buildingName;
    this.report = null;
    this.error = '';
    this.errorKind = '';
    this.cdr.markForCheck();
  }

  onError(err: unknown): void {
    const { kind, message } = classifyFinanceError(err, 'No se pudo cargar el módulo Finanzas.');
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }

  private request(): AssemblyReportRequest | null {
    if (this.from && this.to && this.to < this.from) {
      this.msg.add({ severity: 'warn', summary: 'Revisá las fechas', detail: 'La fecha desde no puede ser posterior a la fecha hasta.', life: 5000 });
      return null;
    }

    return { buildingId: this.buildingId, from: this.from || null, to: this.to || null, notes: this.notes.trim() || null };
  }

  preview(): void {
    const request = this.request();
    if (!request) return;

    this.loading = true;
    this.error = '';
    this.api.preview(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: report => {
        this.report = report;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.report = null;
        this.loading = false;
        const { kind, message } = classifyFinanceError(err, 'No se pudo armar el informe.');
        if (kind === 'other') {
          this.error = message;
        } else {
          this.errorKind = kind;
          this.errorMessage = message;
        }

        this.cdr.markForCheck();
      }
    });
  }

  download(): void {
    const request = this.request();
    if (!request || this.downloading) return;

    this.downloading = true;
    this.api.downloadPdf(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        const slug = this.buildingName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'edificio';
        const period = `${(this.report?.from ?? this.from ?? '').split('-').join('')}-${(this.report?.to ?? this.to ?? this.today).split('-').join('')}`.replace(/^-/, '');
        const fileName = `informe-asamblea-${slug}-${period || 'actual'}.pdf`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        this.downloading = false;
        this.msg.add({ severity: 'success', summary: 'PDF generado', detail: fileName, life: 4000 });
        this.cdr.markForCheck();
      },
      error: async err => {
        const detail = await exportErrorMessage(err, 'No se pudo generar el PDF.');
        this.downloading = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: detail || extractApiErrorMessage(err, 'No se pudo generar el PDF.'), life: 8000 });
        this.cdr.markForCheck();
      }
    });
  }
}
