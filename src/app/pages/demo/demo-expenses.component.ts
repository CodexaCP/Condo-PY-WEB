import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { formatGs } from '../condo/finance-format';
import { EXPENSE_CATEGORIES, hasVat, vatOf } from './demo.data';
import { DEMO_PAGE_STYLES } from './demo.styles';
import { DemoStore } from './demo.store';

// Misión 3: registrar un gasto simulado. Queda solo en esta sesión; el panel, los informes y el libro diario lo reflejan.
@Component({
  standalone: true,
  selector: 'app-demo-expenses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  template: `
    <h1>Gastos del edificio</h1>
    <p class="sub">Registra un gasto de prueba y mira cómo cambia el panel y el libro diario. No se guarda: es solo una simulación.</p>

    <div class="grid2">
      <div class="card">
        <h2><i class="pi pi-plus-circle"></i> Registrar un gasto simulado</h2>
        <form class="form" (ngSubmit)="submit()">
          <label class="fld">Concepto
            <input name="concept" [ngModel]="concept()" (ngModelChange)="concept.set($event)" placeholder="Ej.: Reparación del portón del garaje" maxlength="80" />
          </label>
          <label class="fld">Proveedor (opcional)
            <input name="supplier" [ngModel]="supplier()" (ngModelChange)="supplier.set($event)" placeholder="Ej.: Taller Central" maxlength="60" />
          </label>
          <div class="two">
            <label class="fld">Rubro
              <select name="category" [ngModel]="category()" (ngModelChange)="category.set($event)">
                @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
              </select>
            </label>
            <label class="fld">Importe en guaraníes (con IVA)
              <input name="amount" type="number" min="0" step="1000" [ngModel]="amount()" (ngModelChange)="amount.set($event)" placeholder="Ej.: 850000" />
            </label>
          </div>
          @if (amount() > 0) {
            <p class="preview">Estás por registrar <b>{{ gs(amount()) }}</b>@if (vat() > 0) { · incluye IVA 10 % de {{ gs(vat()) }} }</p>
          }
          @if (error()) { <p class="err">{{ error() }}</p> }
          <button class="btn" type="submit"><i class="pi pi-check"></i> Registrar gasto simulado</button>
        </form>

        @if (added(); as a) {
          <div class="ok">
            <i class="pi pi-check-circle"></i>
            <div>
              <b>¡Gasto registrado!</b> «{{ a.concept }}» por {{ gs(a.amount) }}. El saldo de caja bajó y el asiento contable ya se generó.<br />
              <a routerLink="/explorar/libro-diario" [queryParams]="{ focus: a.id }">Ver el asiento en el libro diario →</a>
              · <a routerLink="/explorar/panel">Ver el panel →</a>
            </div>
          </div>
        }
      </div>

      <div class="card">
        <h2>Resumen del mes</h2>
        <p class="tot">{{ gs(store.expensesTotal()) }}</p>
        <ul class="cats">
          @for (c of store.expensesByCategory(); track c.category) {
            <li><span>{{ c.category }}</span><div class="meter"><i [style.width.%]="c.share"></i></div><b>{{ c.share }} %</b></li>
          }
        </ul>
      </div>
    </div>

    <div class="card list">
      <h2>Gastos de {{ store.currentPeriod.label }}</h2>
      <div class="tbl-wrap">
        <table class="tb">
          <thead><tr><th>Fecha</th><th>Concepto</th><th>Proveedor</th><th>Rubro</th><th class="num">Importe</th></tr></thead>
          <tbody>
            @for (e of store.expenses(); track e.id) {
              <tr>
                <td>{{ store.dateLabel(e.date) }}</td>
                <td>{{ e.concept }} @if (e.simulated) { <span class="badge sim">Simulado</span> }</td>
                <td class="muted">{{ e.supplier }}</td>
                <td><span class="badge info">{{ e.category }}</span></td>
                <td class="num">{{ gs(e.amount) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [
    DEMO_PAGE_STYLES,
    `
      .form { display: grid; gap: 0.8rem; }
      .form input, .form select { width: 100%; box-sizing: border-box; }
      .two { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
      @media (max-width: 560px) { .two { grid-template-columns: 1fr; } }
      .preview { margin: 0; font-size: 0.86rem; color: var(--ex-muted, #5f7b88); }
      .err { margin: 0; font-size: 0.86rem; color: #c0392f; font-weight: 700; }
      .form .btn { justify-self: start; }
      .ok { display: flex; gap: 0.7rem; margin-top: 1rem; padding: 0.8rem; border-radius: 0.7rem; background: #e8f7ee; font-size: 0.88rem; line-height: 1.5; }
      .ok i { color: #1f7a45; font-size: 1.2rem; margin-top: 0.1rem; }
      .tot { margin: 0 0 0.6rem; font-size: 1.5rem; font-weight: 800; }
      .cats { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
      .cats li { display: grid; grid-template-columns: 7.5rem 1fr 2.6rem; align-items: center; gap: 0.6rem; font-size: 0.84rem; }
      .meter { height: 8px; border-radius: 999px; background: #e6eef4; overflow: hidden; }
      .meter i { display: block; height: 100%; background: #1ab7af; }
      .list { margin-top: 1rem; }
    `
  ]
})
export class DemoExpensesComponent {
  readonly store = inject(DemoStore);
  readonly gs = formatGs;
  readonly categories = EXPENSE_CATEGORIES;

  readonly concept = signal('');
  readonly supplier = signal('');
  readonly category = signal('Mantenimiento');
  readonly amount = signal(0);
  readonly error = signal('');
  readonly added = signal<{ id: string; concept: string; amount: number } | null>(null);

  readonly vat = computed(() => (hasVat(this.category()) ? vatOf(this.amount() || 0) : 0));

  submit(): void {
    this.error.set('');
    const amount = Number(this.amount());
    if (!this.concept().trim()) {
      this.error.set('Escribe un concepto para el gasto.');
      return;
    }
    if (!(amount > 0)) {
      this.error.set('Ingresa un importe mayor que cero.');
      return;
    }
    const e = this.store.addExpense({ concept: this.concept(), supplier: this.supplier(), category: this.category(), amount });
    this.added.set({ id: e.id, concept: e.concept, amount: e.amount });
    this.concept.set('');
    this.supplier.set('');
    this.amount.set(0);
  }
}
