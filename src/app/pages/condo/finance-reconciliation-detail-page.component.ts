import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { concatMap, from, last, Observable } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { LedgerSourceType, ReconciliationItemRef, ReconciliationMovement, ReconciliationWorkspace } from '../../api/building-config.models';
import { ReconciliationApiService } from '../../api/reconciliation-api.service';
import { CONFIG_SECTION_STYLES } from './config-section.styles';
import { classifyFinanceError, GsPipe, todayParaguay } from './finance-format';

// El backend acepta hasta este número de movimientos por pedido: una selección más grande se manda en tandas.
const MAX_ITEMS_PER_REQUEST = 500;

const SOURCE_LABELS: Record<LedgerSourceType, string> = {
  OwnerPayment: 'Cobro',
  BuildingExpense: 'Gasto',
  BuildingIncome: 'Ingreso',
  SupplierCreditNote: 'NC de proveedor'
};

// Pantalla de trabajo de una conciliación: arriba el saldo del extracto contra el saldo conciliado; abajo, lo pendiente (que se tilda cuando
// aparece en el extracto) y lo ya conciliado. Se cierra solo con diferencia cero y sin movimientos faltantes; una cerrada es de solo lectura
// y se reabre con un motivo (la última de su cuenta). Marcar un movimiento de un mes cerrado se permite; desmarcarlo, no.
@Component({
  standalone: true,
  selector: 'app-finance-reconciliation-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Card, Message, Tag, GsPipe],
  template: `
    <p-card styleClass="app-page-card">
      <a class="back" [routerLink]="['/finance/reconciliation']" [queryParams]="backParams">← Volver a las conciliaciones</a>

      <p-message *ngIf="error" severity="error" [text]="error"></p-message>
      <p class="app-state" *ngIf="loading && !w">Cargando...</p>

      <ng-container *ngIf="w as d">
        <div class="head">
          <div>
            <h1>Conciliación · {{ d.accountName }}</h1>
            <p class="muted">Corte al {{ d.statementDate | date: 'dd/MM/yyyy' }} ·
              <p-tag [value]="d.status === 'Open' ? 'Abierta' : 'Cerrada'" [severity]="d.status === 'Open' ? 'warn' : 'success'"></p-tag>
            </p>
          </div>
          <div class="head-actions" *ngIf="d.canEdit && d.status === 'Open'">
            <button type="button" class="btn secondary" [disabled]="busy" (click)="editing = !editing">Editar extracto</button>
            <button type="button" class="btn secondary danger-text" [disabled]="busy" (click)="discard()">Descartar</button>
          </div>
        </div>

        <form class="edit-box" *ngIf="editing && d.canEdit && d.status === 'Open'" (ngSubmit)="saveStatement()">
          <label class="field"><span>Fecha de corte</span><input type="date" name="date" [(ngModel)]="editDate" [max]="today" required /></label>
          <label class="field"><span>Saldo del extracto (Gs.)</span><input type="number" name="balance" step="1" [(ngModel)]="editBalance" required /></label>
          <label class="field"><span>Notas</span><input type="text" name="notes" maxlength="500" [(ngModel)]="editNotes" /></label>
          <div class="actions"><button type="submit" class="btn sm" [disabled]="busy">Guardar</button><button type="button" class="btn sm secondary" (click)="editing = false">Cancelar</button></div>
        </form>

        <div class="kpis">
          <div class="kpi"><span>Saldo del extracto</span><strong>{{ d.statementBalance | gs }}</strong></div>
          <div class="kpi"><span>Saldo conciliado</span><strong>{{ d.reconciledBalance | gs }}</strong></div>
          <div class="kpi" [class.ok]="d.isBalanced" [class.bad]="!d.isBalanced">
            <span>Diferencia</span><strong>{{ d.difference | gs }}</strong>
            <small>{{ d.isBalanced ? 'Conciliada: el extracto y el libro coinciden.' : (d.difference > 0 ? 'El extracto tiene de más.' : 'El extracto tiene de menos.') }}</small>
          </div>
          <div class="kpi"><span>Saldo del libro</span><strong>{{ d.bookBalance | gs }}</strong>
            <small>Entradas sin marcar {{ d.pendingIn | gs }} · salidas sin marcar {{ d.pendingOut | gs }}</small></div>
        </div>
        <p class="muted small" *ngIf="d.notes">Notas: {{ d.notes }}</p>

        <div class="notice" *ngIf="d.alerts.length">
          <strong>Revisá estos movimientos marcados:</strong>
          <ul><li *ngFor="let a of d.alerts">{{ a }}</li></ul>
        </div>

        <div class="close-bar" *ngIf="d.canEdit && d.status === 'Open'">
          <button type="button" class="btn" [disabled]="busy || !d.isBalanced || d.missingCount > 0" (click)="complete()">Cerrar conciliación</button>
          <span class="muted small" *ngIf="!d.isBalanced">Se cierra cuando la diferencia es cero.</span>
          <span class="muted small" *ngIf="d.isBalanced && d.missingCount > 0">Desmarcá los movimientos que ya no figuran en el libro para poder cerrar.</span>
        </div>

        <div class="reopen-bar" *ngIf="d.canEdit && d.status === 'Completed'">
          <label class="field"><span>Para reabrirla indicá el motivo (queda en el historial). Solo se reabre la última cerrada de la cuenta.</span>
            <input type="text" maxlength="500" [(ngModel)]="reason" name="reason" /></label>
          <button type="button" class="btn secondary" [disabled]="busy || !reason.trim()" (click)="reopen()">Reabrir conciliación</button>
        </div>

        <h3>Pendientes de conciliar <span class="muted small">({{ d.pendingCount }})</span></h3>
        <p class="muted small">Movimientos del libro hasta la fecha de corte que todavía no están conciliados. Tildá los que aparecen en el extracto; los que el banco aún no registró (cheques o depósitos en tránsito) quedan pendientes.</p>
        <p-message *ngIf="d.pendingTruncated" severity="warn" text="Hay más de 1000 pendientes: se muestran los primeros. Conciliá estos y volvé a abrir la pantalla para ver el resto."></p-message>
        <div class="bulk" *ngIf="d.canEdit && d.status === 'Open' && d.pending.length">
          <label class="check"><input type="checkbox" [checked]="allPendingSelected" (change)="togglePending($any($event.target).checked)" /> Seleccionar todos</label>
          <button type="button" class="btn sm" [disabled]="busy || !pendingSel.size" (click)="markSelected()">Marcar {{ pendingSel.size }} como conciliados</button>
        </div>
        <p class="muted" *ngIf="!d.pending.length">No hay movimientos pendientes.</p>
        <div class="table-wrap" *ngIf="d.pending.length">
          <table class="t">
            <thead><tr><th *ngIf="d.canEdit && d.status === 'Open'"></th><th>Fecha</th><th>Tipo</th><th>Detalle</th><th class="num">Importe</th></tr></thead>
            <tbody>
              <tr *ngFor="let m of d.pending">
                <td *ngIf="d.canEdit && d.status === 'Open'"><input type="checkbox" [checked]="pendingSel.has(key(m))" (change)="toggle(pendingSel, m)" [attr.aria-label]="'Marcar ' + m.description" /></td>
                <td class="nowrap">{{ m.date | date: 'dd/MM/yyyy' }}</td>
                <td>{{ sourceLabel(m) }}</td>
                <td>{{ m.description }}<div class="muted small" *ngIf="m.thirdParty || m.reference">{{ m.thirdParty }}<span *ngIf="m.thirdParty && m.reference"> · </span>{{ m.reference }}</div></td>
                <td class="num" [class.pos]="m.amount > 0" [class.neg]="m.amount < 0">{{ m.amount | gs }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Conciliados <span class="muted small">({{ d.marked.length }})</span></h3>
        <div class="bulk" *ngIf="d.canEdit && d.status === 'Open' && ownMarked.length">
          <label class="check"><input type="checkbox" [checked]="allMarkedSelected" (change)="toggleMarked($any($event.target).checked)" /> Seleccionar todos los de esta conciliación</label>
          <button type="button" class="btn sm secondary" [disabled]="busy || !markedSel.size" (click)="unmarkSelected()">Desmarcar {{ markedSel.size }}</button>
        </div>
        <p class="muted" *ngIf="!d.marked.length">Todavía no se concilió ningún movimiento.</p>
        <div class="table-wrap" *ngIf="d.marked.length">
          <table class="t">
            <thead><tr><th *ngIf="d.canEdit && d.status === 'Open'"></th><th>Fecha</th><th>Tipo</th><th>Detalle</th><th class="num">Importe</th><th>Marcado</th></tr></thead>
            <tbody>
              <tr *ngFor="let m of d.marked" [class.warn-row]="m.state !== 'Ok'">
                <td *ngIf="d.canEdit && d.status === 'Open'">
                  <input *ngIf="m.inThisReconciliation" type="checkbox" [checked]="markedSel.has(key(m))" (change)="toggle(markedSel, m)" [attr.aria-label]="'Desmarcar ' + m.description" />
                </td>
                <td class="nowrap">{{ m.date | date: 'dd/MM/yyyy' }}</td>
                <td>{{ sourceLabel(m) }}</td>
                <td>
                  {{ m.description }}
                  <p-tag *ngIf="m.state === 'Changed'" value="Cambió de importe" severity="warn"></p-tag>
                  <p-tag *ngIf="m.state === 'Missing'" value="Ya no figura en el libro" severity="danger"></p-tag>
                  <div class="muted small" *ngIf="m.state === 'Changed'">Se marcó por {{ m.markedAmount | gs }}</div>
                  <div class="muted small" *ngIf="m.thirdParty || m.reference">{{ m.thirdParty }}<span *ngIf="m.thirdParty && m.reference"> · </span>{{ m.reference }}</div>
                </td>
                <td class="num" [class.pos]="m.amount > 0" [class.neg]="m.amount < 0">{{ m.amount | gs }}</td>
                <td class="muted small">
                  <span *ngIf="m.markedAtUtc">{{ m.markedAtUtc | date: 'dd/MM/yyyy' }} · {{ m.markedByName }}</span>
                  <span *ngIf="!m.inThisReconciliation" class="muted"> (conciliación anterior)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>
    </p-card>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .back { color: #1385B6; font-weight: 600; text-decoration: none; display: inline-block; margin-bottom: 0.8rem; }
    .head { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: flex-start; }
    .head h1 { margin: 0 0 0.2rem; font-size: 1.5rem; color: var(--brand-ink); }
    .head p { margin: 0; }
    .head-actions { display: flex; gap: 0.6rem; }
    .danger-text { color: #c9473b; border-color: rgba(201,71,59,0.4); }
    .edit-box { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; margin: 0.8rem 0; padding: 0.8rem 1rem; border: 1px solid var(--brand-border); border-radius: 12px; }
    .edit-box .actions { margin: 0; }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.9rem; margin: 1rem 0; }
    .kpi { display: grid; gap: 0.25rem; padding: 0.9rem 1.1rem; border-radius: 14px; background: var(--p-content-background, #fff); border: 1px solid var(--brand-border); align-content: start; }
    .kpi span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .kpi strong { font-size: 1.25rem; color: var(--brand-ink); }
    .kpi small { color: var(--brand-muted); font-size: 0.78rem; }
    .kpi.ok { border-color: #6AC64A; background: rgba(106,198,74,0.08); }
    .kpi.ok strong { color: #2f8f46; }
    .kpi.bad { border-color: #e0a23b; background: rgba(224,162,59,0.07); }
    .notice ul { margin: 0.3rem 0 0; padding-left: 1.2rem; }
    .close-bar, .reopen-bar { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; margin: 0.8rem 0; }
    .reopen-bar .field { flex: 1; min-width: 18rem; }
    .bulk { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin: 0.5rem 0; }
    tr.warn-row td { background: rgba(224,162,59,0.1); }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } }
  `]
})
export class FinanceReconciliationDetailPageComponent implements OnInit {
  private readonly api = inject(ReconciliationApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly today = todayParaguay();

  id = '';
  w: ReconciliationWorkspace | null = null;
  loading = false;
  busy = false;
  error = '';
  editing = false;
  editDate = '';
  editBalance: number | null = null;
  editNotes = '';
  reason = '';
  readonly pendingSel = new Set<string>();
  readonly markedSel = new Set<string>();

  get backParams(): Record<string, string> { return this.w ? { buildingId: this.w.buildingId } : {}; }
  get ownMarked(): ReconciliationMovement[] { return this.w?.marked.filter(m => m.inThisReconciliation) ?? []; }
  get allPendingSelected(): boolean { return !!this.w?.pending.length && this.pendingSel.size === this.w.pending.length; }
  get allMarkedSelected(): boolean { return !!this.ownMarked.length && this.markedSel.size === this.ownMarked.length; }

  key(m: ReconciliationItemRef): string { return `${m.sourceType}|${m.sourceId}`; }
  sourceLabel(m: ReconciliationMovement): string { return SOURCE_LABELS[m.sourceType] ?? m.sourceType; }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  toggle(set: Set<string>, m: ReconciliationMovement): void {
    const k = this.key(m);
    if (set.has(k)) set.delete(k); else set.add(k);
    this.cdr.markForCheck();
  }

  togglePending(checked: boolean): void {
    this.pendingSel.clear();
    if (checked) this.w?.pending.forEach(m => this.pendingSel.add(this.key(m)));
    this.cdr.markForCheck();
  }

  toggleMarked(checked: boolean): void {
    this.markedSel.clear();
    if (checked) this.ownMarked.forEach(m => this.markedSel.add(this.key(m)));
    this.cdr.markForCheck();
  }

  markSelected(): void {
    this.runBatches(this.pendingSel, items => this.api.mark(this.id, items), 'Movimientos conciliados.');
  }

  unmarkSelected(): void {
    if (!confirm(`¿Desmarcar ${this.markedSel.size} movimientos? Vuelven a figurar como pendientes (no se puede en meses cerrados).`)) return;
    this.runBatches(this.markedSel, items => this.api.unmark(this.id, items), 'Movimientos desmarcados.');
  }

  saveStatement(): void {
    if (!this.editDate || this.editBalance === null) {
      this.msg.add({ severity: 'warn', summary: 'Revisá los datos', detail: 'Indicá la fecha de corte y el saldo del extracto.', life: 5000 });
      return;
    }

    this.run(this.api.update(this.id, { statementDate: this.editDate, statementBalance: Number(this.editBalance), notes: this.editNotes.trim() || null }), 'Extracto actualizado.');
  }

  complete(): void {
    if (!confirm('¿Cerrar la conciliación? Queda firme: para modificarla hay que reabrirla con un motivo.')) return;
    this.run(this.api.complete(this.id), 'Conciliación cerrada.');
  }

  reopen(): void {
    this.run(this.api.reopen(this.id, this.reason.trim()), 'Conciliación reabierta.');
    this.reason = '';
  }

  discard(): void {
    if (!confirm('¿Descartar esta conciliación? Se deshacen sus marcas y se puede empezar otra para la cuenta.')) return;

    this.busy = true;
    this.api.discard(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy = false;
        this.msg.add({ severity: 'success', summary: 'Conciliación descartada', life: 3500 });
        void this.router.navigate(['/finance/reconciliation'], { queryParams: this.backParams });
      },
      error: err => this.fail(err, 'No se pudo descartar la conciliación.')
    });
  }

  // Manda la selección en tandas (el backend acepta un máximo por pedido) y se queda con el último estado.
  private runBatches(selection: Set<string>, call: (items: ReconciliationItemRef[]) => Observable<ReconciliationWorkspace>, success: string): void {
    const items: ReconciliationItemRef[] = [...selection].map(k => {
      const [sourceType, sourceId] = k.split('|');
      return { sourceType: sourceType as LedgerSourceType, sourceId };
    });
    if (!items.length) return;

    const batches: ReconciliationItemRef[][] = [];
    for (let i = 0; i < items.length; i += MAX_ITEMS_PER_REQUEST) batches.push(items.slice(i, i + MAX_ITEMS_PER_REQUEST));

    this.busy = true;
    from(batches).pipe(concatMap(batch => call(batch)), last(), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: workspace => this.apply(workspace, success),
      error: err => {
        this.fail(err, 'No se pudo completar la operación.');
        // Parte de la selección pudo haberse guardado: se vuelve a leer la conciliación.
        this.load();
      }
    });
  }

  private run(call: Observable<ReconciliationWorkspace>, success: string): void {
    this.busy = true;
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: workspace => this.apply(workspace, success),
      error: err => this.fail(err, 'No se pudo completar la operación.')
    });
  }

  private apply(workspace: ReconciliationWorkspace, success: string): void {
    this.setWorkspace(workspace);
    this.busy = false;
    this.editing = false;
    this.msg.add({ severity: 'success', summary: success, life: 3500 });
    this.cdr.markForCheck();
  }

  private fail(err: unknown, fallback: string): void {
    this.busy = false;
    this.msg.add({ severity: 'error', summary: 'No se pudo', detail: classifyFinanceError(err, fallback).message, life: 9000 });
    this.cdr.markForCheck();
  }

  private setWorkspace(workspace: ReconciliationWorkspace): void {
    this.w = workspace;
    this.editDate = workspace.statementDate;
    this.editBalance = workspace.statementBalance;
    this.editNotes = workspace.notes ?? '';
    // La selección conserva solo lo que sigue en su lista.
    const pending = new Set(workspace.pending.map(m => this.key(m)));
    const own = new Set(workspace.marked.filter(m => m.inThisReconciliation).map(m => this.key(m)));
    for (const k of [...this.pendingSel]) if (!pending.has(k)) this.pendingSel.delete(k);
    for (const k of [...this.markedSel]) if (!own.has(k)) this.markedSel.delete(k);
  }

  private load(): void {
    this.loading = true;
    this.error = '';
    this.api.get(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: workspace => {
        this.setWorkspace(workspace);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.w = null;
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo cargar la conciliación.');
        this.cdr.markForCheck();
      }
    });
  }
}
