import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { FinanceApiService } from '../../api/finance-api.service';
import { FinanceBuildingAccess, FinanceMovementsPage, FinancialAccount, LedgerCategory, LedgerDirection } from '../../api/models';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { classifyFinanceError, FinanceErrorKind, GsPipe } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';

// Opciones del selector de rubro: el rubro principal incluye a sus subrubros.
interface RubroOption { id: string; label: string; }

// Movimientos del libro del edificio: cobros a propietarios, ingresos y gastos desde la fecha de arranque (hasta hoy), por
// cuenta y rubro, con saldo corrido. Se arman con lo que ya existe: un pago revertido no figura.
@Component({
  standalone: true,
  selector: 'app-finance-movements-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Tag, GsPipe, FinanceBuildingPickerComponent, FinanceStateComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Movimientos</h1>
            <p>Entradas y salidas de cada cuenta, con su rubro y el saldo corrido.</p>
          </div>
        </div>
        <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
      </div>

      <app-finance-state [loading]="loadingMeta" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="ready">
        <div class="filters">
          <label><span>Desde</span><input type="date" [(ngModel)]="from" (ngModelChange)="apply()" [min]="startDate" /></label>
          <label><span>Hasta</span><input type="date" [(ngModel)]="to" (ngModelChange)="apply()" [min]="startDate" /></label>
          <label>
            <span>Cuenta</span>
            <select [(ngModel)]="accountFilter" (ngModelChange)="apply()">
              <option value="">Todas</option>
              <option *ngFor="let a of accounts" [value]="a.id">{{ a.name }}</option>
              <option value="__none">Sin cuenta asignada</option>
            </select>
          </label>
          <label>
            <span>Rubro</span>
            <select [(ngModel)]="categoryFilter" (ngModelChange)="apply()">
              <option value="">Todos</option>
              <option *ngFor="let o of rubroOptions" [value]="o.id">{{ o.label }}</option>
            </select>
          </label>
          <label>
            <span>Tipo</span>
            <select [(ngModel)]="directionFilter" (ngModelChange)="apply()">
              <option value="">Entradas y salidas</option>
              <option value="In">Solo entradas</option>
              <option value="Out">Solo salidas</option>
            </select>
          </label>
          <label>
            <span>Orden</span>
            <select [(ngModel)]="newestFirst" (ngModelChange)="apply()">
              <option [ngValue]="true">Más recientes primero</option>
              <option [ngValue]="false">Más antiguos primero</option>
            </select>
          </label>
        </div>

        <p class="app-state error" *ngIf="rangeError">{{ rangeError }}</p>
        <p class="app-state" *ngIf="loading">Cargando movimientos...</p>

        <ng-container *ngIf="page as p">
          <div class="summary">
            <div><span>Entradas</span><strong class="pos">{{ p.totalIn | gs }}</strong></div>
            <div><span>Salidas</span><strong class="neg">{{ p.totalOut | gs }}</strong></div>
            <div *ngIf="p.openingBalance !== null"><span>Saldo al comienzo</span><strong>{{ p.openingBalance | gs }}</strong></div>
            <div *ngIf="p.closingBalance !== null"><span>Saldo al final</span><strong>{{ p.closingBalance | gs }}</strong></div>
          </div>

          <p class="app-state" *ngIf="!p.items.length && !loading">No hay movimientos con estos filtros.</p>

          <div class="table-wrap" *ngIf="p.items.length">
            <table class="mv-table">
              <thead>
                <tr>
                  <th>Fecha</th><th>Cuenta</th><th>Rubro</th><th>Detalle</th>
                  <th class="num">Entrada</th><th class="num">Salida</th><th class="num" *ngIf="p.openingBalance !== null">Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let m of p.items">
                  <td class="nowrap">{{ m.date | date: 'dd/MM/yyyy' }}</td>
                  <td>{{ m.accountName }}</td>
                  <td><code>{{ m.categoryCode }}</code> {{ m.categoryName }}</td>
                  <td>
                    {{ m.description }}
                    <small class="muted" *ngIf="m.thirdParty || m.reference"><br />{{ m.thirdParty }}<ng-container *ngIf="m.thirdParty && m.reference"> · </ng-container>{{ m.reference }}</small>
                    <p-tag *ngIf="m.sourceType === 'OwnerPayment'" value="Cobro" severity="success" styleClass="tag-sm"></p-tag>
                    <p-tag *ngIf="m.sourceType === 'BuildingExpense'" value="Gasto" severity="danger" styleClass="tag-sm"></p-tag>
                    <p-tag *ngIf="m.sourceType === 'BuildingIncome'" value="Ingreso" severity="info" styleClass="tag-sm"></p-tag>
                  </td>
                  <td class="num pos">{{ m.direction === 'In' ? (m.amount | gs) : '' }}</td>
                  <td class="num neg">{{ m.direction === 'Out' ? (m.amount | gs) : '' }}</td>
                  <td class="num" *ngIf="p.openingBalance !== null"><strong>{{ m.runningBalance | gs }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pager" *ngIf="p.totalCount > p.pageSize">
            <p-button type="button" label="Anterior" icon="pi pi-arrow-left" severity="secondary" [outlined]="true" [disabled]="p.page <= 1 || loading" (onClick)="go(p.page - 1)"></p-button>
            <span>Página {{ p.page }} de {{ pages(p) }} · {{ p.totalCount }} movimientos</span>
            <p-button type="button" label="Siguiente" icon="pi pi-arrow-right" iconPos="right" severity="secondary" [outlined]="true" [disabled]="p.page >= pages(p) || loading" (onClick)="go(p.page + 1)"></p-button>
          </div>
          <p class="muted small" *ngIf="p.totalCount <= p.pageSize">{{ p.totalCount }} movimientos.</p>
        </ng-container>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .filters { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.8rem; margin-bottom: 1rem; }
    .filters label { display: grid; gap: 0.25rem; font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .filters input, .filters select {
      width: 100%; min-width: 0; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.92rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .summary { display: flex; gap: 1.2rem; flex-wrap: wrap; margin: 0.5rem 0 1rem; }
    .summary div { display: grid; gap: 0.15rem; padding: 0.7rem 1rem; border-radius: 12px; background: var(--brand-gradient-soft); min-width: 150px; }
    .summary span { font-size: 0.8rem; font-weight: 600; color: var(--brand-muted); }
    .summary strong { font-size: 1.1rem; color: var(--brand-ink); }
    .table-wrap { overflow-x: auto; }
    .mv-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .mv-table th { text-align: left; padding: 0.5rem 0.6rem; color: var(--brand-muted); font-weight: 700; border-bottom: 1px solid var(--brand-border); white-space: nowrap; }
    .mv-table td { padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--brand-border); vertical-align: top; }
    .num { text-align: right !important; white-space: nowrap; }
    .nowrap { white-space: nowrap; }
    .pos { color: #2f8f46; }
    .neg { color: #c9473b; }
    .muted { color: var(--brand-muted); }
    .small { font-size: 0.85rem; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; color: var(--brand-muted); }
    :host ::ng-deep .tag-sm .p-tag { font-size: 0.65rem; padding: 0.05rem 0.4rem; margin-left: 0.4rem; }
    .pager { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 1rem; flex-wrap: wrap; color: var(--brand-ink-soft); }
  `]
})
export class FinanceMovementsPageComponent {
  private readonly api = inject(FinanceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  buildingId = '';
  noBuilding = false;
  loadingMeta = false;
  ready = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';

  accounts: FinancialAccount[] = [];
  rubroOptions: RubroOption[] = [];
  startDate = '';

  from = '';
  to = '';
  accountFilter = '';
  categoryFilter = '';
  directionFilter: LedgerDirection | '' = '';
  newestFirst = true;

  page: FinanceMovementsPage | null = null;
  loading = false;
  rangeError = '';
  private readonly pageSize = 50;

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.ready = false;
    this.page = null;
    this.errorKind = '';
    this.loadingMeta = true;
    this.accountFilter = this.categoryFilter = this.directionFilter = '';
    this.from = this.to = '';

    forkJoin({ accounts: this.api.getAccounts(this.buildingId), categories: this.api.getCategories(this.buildingId) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ accounts, categories }) => {
          this.accounts = accounts;
          this.rubroOptions = this.buildOptions(categories);
          this.loadingMeta = false;
          this.ready = true;
          this.fetch(1);
        },
        error: err => this.setError(err)
      });
  }

  onError(err: unknown): void { this.setError(err); }

  apply(): void { this.fetch(1); }

  go(page: number): void { this.fetch(page); }

  pages(p: FinanceMovementsPage): number { return Math.max(1, Math.ceil(p.totalCount / p.pageSize)); }

  private fetch(page: number): void {
    this.loading = true;
    this.rangeError = '';
    this.api.getMovements(this.buildingId, {
      from: this.from || null,
      to: this.to || null,
      accountId: this.accountFilter && this.accountFilter !== '__none' ? this.accountFilter : null,
      unassigned: this.accountFilter === '__none',
      categoryId: this.categoryFilter || null,
      direction: this.directionFilter || null,
      newestFirst: this.newestFirst,
      page,
      pageSize: this.pageSize
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.page = result;
        this.loading = false;
        this.errorKind = '';
        // El servidor acota el rango (arranque y hoy): se muestran las fechas que realmente se usaron.
        this.from = result.from;
        this.to = result.to;
        this.startDate = this.startDate || result.from;
        this.cdr.markForCheck();
      },
      error: err => {
        const { kind, message } = classifyFinanceError(err, 'No se pudieron cargar los movimientos.');
        this.loading = false;
        if (kind === 'other') {
          // Rango invalido u otro error de validacion: se informa sobre el filtro y se conserva lo anterior.
          this.rangeError = message;
        } else {
          this.setError(err);
        }
        this.cdr.markForCheck();
      }
    });
  }

  private buildOptions(categories: LedgerCategory[]): RubroOption[] {
    const groups = categories.filter(c => !c.parentId);
    const options: RubroOption[] = [];
    for (const group of groups) {
      const children = categories.filter(c => c.parentId === group.id);
      options.push({ id: group.id, label: children.length ? `${group.code} · ${group.name} (todo)` : `${group.code} · ${group.name}` });
      for (const child of children) {
        options.push({ id: child.id, label: `   ${child.code} · ${child.name}` });
      }
    }

    return options;
  }

  private setError(err: unknown): void {
    const { kind, message } = classifyFinanceError(err, 'No se pudieron cargar los movimientos.');
    this.ready = false;
    this.page = null;
    this.loadingMeta = false;
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }
}
