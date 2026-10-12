import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { ReconciliationAccount, ReconciliationOverview, ReconciliationSummary } from '../../api/building-config.models';
import { FinanceBuildingAccess } from '../../api/models';
import { ReconciliationApiService } from '../../api/reconciliation-api.service';
import { CONFIG_SECTION_STYLES } from './config-section.styles';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { classifyFinanceError, FinanceErrorKind, GsPipe, todayParaguay } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';

// Conciliación bancaria manual: por cada cuenta bancaria se tildan los movimientos del libro que aparecen en el extracto y se compara el saldo
// del extracto con el saldo conciliado. La cierran solo el SuperAdmin y el Administrador de empresa (control interno: quien concilia no es
// quien carga los movimientos); los demás roles la consultan.
@Component({
  standalone: true,
  selector: 'app-finance-reconciliation-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Card, Message, Tag, GsPipe, FinanceBuildingPickerComponent, FinanceStateComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Conciliación bancaria</h1>
            <p>Compará lo que registró el sistema con el extracto de cada cuenta bancaria.</p>
          </div>
        </div>
        <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
      </div>

      <app-finance-state [loading]="loading && !overview" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="overview as o">
        <p class="muted small" *ngIf="!o.canEdit">Solo el SuperAdmin y el Administrador de empresa pueden armar, cerrar y reabrir conciliaciones. Acá podés consultarlas.</p>
        <p-message *ngIf="!o.accounts.length" severity="info"
                   text="El edificio no tiene cuentas bancarias cargadas en Finanzas. Creá una en Finanzas → Configuración → Cuentas."></p-message>

        <div class="table-wrap" *ngIf="o.accounts.length">
          <table class="t">
            <thead><tr><th>Cuenta</th><th class="num">Saldo del libro</th><th>Última conciliación cerrada</th><th>En curso</th><th></th></tr></thead>
            <tbody>
              <ng-container *ngFor="let a of o.accounts">
                <tr [class.inactive]="!a.isActive">
                  <td><strong>{{ a.accountName }}</strong> <span class="muted small" *ngIf="!a.isActive">(inactiva)</span></td>
                  <td class="num">{{ a.bookBalance | gs }}</td>
                  <td>
                    <span *ngIf="a.lastCompletedDate">{{ a.lastCompletedDate | date: 'dd/MM/yyyy' }} · extracto {{ a.lastStatementBalance | gs }}</span>
                    <span class="muted" *ngIf="!a.lastCompletedDate">Todavía no se concilió</span>
                  </td>
                  <td>
                    <p-tag *ngIf="a.openReconciliationId" [value]="'Abierta · corte ' + (a.openStatementDate | date: 'dd/MM/yyyy')" severity="warn"></p-tag>
                    <span class="muted" *ngIf="!a.openReconciliationId">—</span>
                  </td>
                  <td class="num">
                    <a class="btn sm" *ngIf="a.openReconciliationId" [routerLink]="['/finance/reconciliation', a.openReconciliationId]">Continuar</a>
                    <button type="button" class="btn sm" *ngIf="!a.openReconciliationId && o.canEdit && a.isActive" (click)="startNew(a)">Nueva conciliación</button>
                  </td>
                </tr>
                <tr *ngIf="creating === a.accountId">
                  <td colspan="5">
                    <form class="start-box" (ngSubmit)="start(a)">
                      <label class="field"><span>Fecha de corte del extracto *</span>
                        <input type="date" name="date" [(ngModel)]="statementDate" [max]="today" [min]="minDate(a)" required />
                      </label>
                      <label class="field"><span>Saldo del extracto a esa fecha (Gs.) *</span>
                        <input type="number" name="balance" step="1" [(ngModel)]="statementBalance" required />
                      </label>
                      <label class="field"><span>Notas</span>
                        <input type="text" name="notes" maxlength="500" [(ngModel)]="notes" />
                      </label>
                      <div class="actions">
                        <button type="submit" class="btn sm" [disabled]="busy">{{ busy ? 'Creando...' : 'Empezar' }}</button>
                        <button type="button" class="btn sm secondary" (click)="creating = ''">Cancelar</button>
                      </div>
                    </form>
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>

        <h3 *ngIf="history.length">Conciliaciones cerradas</h3>
        <div class="table-wrap" *ngIf="history.length">
          <table class="t">
            <thead><tr><th>Corte</th><th>Cuenta</th><th class="num">Extracto</th><th class="num">Conciliado</th><th class="num">Marcados</th><th>Cerrada</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let h of history">
                <td class="nowrap">{{ h.statementDate | date: 'dd/MM/yyyy' }}</td>
                <td>{{ h.accountName }}</td>
                <td class="num">{{ h.statementBalance | gs }}</td>
                <td class="num">{{ h.reconciledBalanceAtCompletion | gs }}</td>
                <td class="num">{{ h.markedCount }}</td>
                <td>{{ h.completedAtUtc | date: 'dd/MM/yyyy HH:mm' }} <span class="muted small" *ngIf="h.completedByName">· {{ h.completedByName }}</span></td>
                <td class="num"><a class="link" [routerLink]="['/finance/reconciliation', h.id]">Ver</a></td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>
    </p-card>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    a.btn { text-decoration: none; display: inline-block; }
    .link { color: #1385B6; font-weight: 600; text-decoration: none; }
    tr.inactive td { opacity: 0.65; }
    .start-box { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; padding: 0.4rem 0; }
    .start-box .field { min-width: 14rem; }
    .start-box .actions { margin: 0; }
  `]
})
export class FinanceReconciliationPageComponent {
  private readonly api = inject(ReconciliationApiService);
  private readonly msg = inject(MessageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly today = todayParaguay();

  buildingId = '';
  overview: ReconciliationOverview | null = null;
  history: ReconciliationSummary[] = [];
  loading = false;
  busy = false;
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';
  creating = '';
  statementDate = '';
  statementBalance: number | null = null;
  notes = '';

  // Una conciliación nueva empieza después del último corte cerrado de la cuenta.
  minDate(a: ReconciliationAccount): string {
    if (!a.lastCompletedDate) return '';
    const next = new Date(`${a.lastCompletedDate}T00:00:00`);
    next.setDate(next.getDate() + 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  }

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.creating = '';
    this.load();
  }

  onError(err: unknown): void { this.setError(err); }

  startNew(a: ReconciliationAccount): void {
    this.creating = a.accountId;
    this.statementDate = this.today;
    this.statementBalance = null;
    this.notes = '';
  }

  start(a: ReconciliationAccount): void {
    if (!this.statementDate || this.statementBalance === null) {
      this.msg.add({ severity: 'warn', summary: 'Revisá los datos', detail: 'Indicá la fecha de corte y el saldo del extracto.', life: 5000 });
      return;
    }

    this.busy = true;
    this.api.start({
      buildingId: this.buildingId, accountId: a.accountId, statementDate: this.statementDate,
      statementBalance: Number(this.statementBalance), notes: this.notes.trim() || null
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: workspace => {
        this.busy = false;
        void this.router.navigate(['/finance/reconciliation', workspace.id]);
      },
      error: err => {
        this.busy = false;
        this.msg.add({ severity: 'error', summary: 'No se pudo empezar', detail: extractApiErrorMessage(err, 'No se pudo empezar la conciliación.'), life: 8000 });
        this.cdr.markForCheck();
      }
    });
  }

  private load(): void {
    this.loading = true;
    this.errorKind = '';
    forkJoin({ overview: this.api.getOverview(this.buildingId), history: this.api.getHistory(this.buildingId) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ overview, history }) => {
          this.overview = overview;
          this.history = history;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: err => this.setError(err)
      });
  }

  private setError(err: unknown): void {
    const { kind, message } = classifyFinanceError(err, 'No se pudo cargar la conciliación bancaria.');
    this.overview = null;
    this.history = [];
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }
}
