import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { formatGs } from '../condo/finance-format';
import { DEMO_PAGE_STYLES } from './demo.styles';
import { DemoStore } from './demo.store';

// Misión 2 (parte 1): lista de unidades. Se puede buscar y filtrar por deuda; cada fila abre el estado de cuenta.
@Component({
  standalone: true,
  selector: 'app-demo-units',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  template: `
    <h1>{{ t().units.title }}</h1>
    <p class="sub">{{ t().units.sub }}</p>

    <div class="card">
      <div class="row bar">
        <input type="search" [placeholder]="t().units.searchPlaceholder" [ngModel]="search()" (ngModelChange)="search.set($event)" [attr.aria-label]="t().units.searchAria" />
        <label class="chk"><input type="checkbox" [ngModel]="onlyDebt()" (ngModelChange)="onlyDebt.set($event)" /> {{ t().units.onlyDebt }}</label>
        <span class="muted count">{{ t().units.count(rows().length, store.units.length) }}</span>
      </div>
      <div class="tbl-wrap">
        <table class="tb">
          <thead>
            <tr><th>{{ t().units.cols.unit }}</th><th>{{ t().units.cols.owner }}</th><th class="num">{{ t().units.cols.area }}</th><th class="num">{{ t().units.cols.fee }}</th><th class="num">{{ t().units.cols.debt }}</th><th>{{ t().units.cols.status }}</th><th></th></tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.unit.code) {
              <tr class="click" [routerLink]="['/explorar/unidades', r.unit.code]">
                <td><b>{{ r.unit.code }}</b> <span class="muted">· {{ t().units.floor(r.unit.floor) }}</span></td>
                <td>{{ r.unit.owner }}</td>
                <td class="num">{{ r.unit.area }} m²</td>
                <td class="num">{{ gs(r.unit.fee) }}</td>
                <td class="num">{{ r.debt ? gs(r.debt) : '—' }}</td>
                <td>@if (r.debt) { <span class="badge bad">{{ t().units.owes(r.months) }}</span> } @else { <span class="badge ok">{{ t().units.upToDate }}</span> }</td>
                <td><a [routerLink]="['/explorar/unidades', r.unit.code]">{{ t().units.statementLink }}</a></td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="muted">{{ t().units.none }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [DEMO_PAGE_STYLES, `.bar { margin-bottom: 0.8rem; } .bar input[type='search'] { flex: 1; min-width: 220px; } .chk { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.86rem; } .chk input { min-width: auto; } .count { margin-left: auto; font-size: 0.82rem; }`]
})
export class DemoUnitsComponent {
  readonly store = inject(DemoStore);
  readonly t = this.store.t;
  readonly gs = formatGs;
  readonly search = signal('');
  readonly onlyDebt = signal(false);

  private readonly debtMap = new Map(this.store.overdueUnits.map((x) => [x.unit.code, x]));

  constructor() {
    const route = inject(ActivatedRoute);
    if (route.snapshot.queryParamMap.get('deuda') === '1') this.onlyDebt.set(true);
  }

  readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.store.units
      .map((unit) => ({ unit, debt: this.debtMap.get(unit.code)?.amount ?? 0, months: this.debtMap.get(unit.code)?.months ?? 0 }))
      .filter((r) => (!this.onlyDebt() || r.debt > 0) && (!q || r.unit.code.toLowerCase().includes(q) || r.unit.owner.toLowerCase().includes(q)));
  });
}

// Misión 2 (parte 2): estado de cuenta de una unidad.
@Component({
  standalone: true,
  selector: 'app-demo-statement',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (st(); as s) {
      <p class="back"><a routerLink="/explorar/unidades">{{ t().statement.back }}</a></p>
      <h1>{{ t().statement.title(s.unit.code) }}</h1>
      <p class="sub">{{ t().statement.sub(s.unit.owner, s.unit.floor, s.unit.area, gs(s.unit.fee)) }}</p>

      <div class="sum">
        <div class="card"><span class="muted">{{ t().statement.pending }}</span><strong [class.neg]="s.pending > 0" [class.pos]="s.pending === 0">{{ gs(s.pending) }}</strong></div>
        <div class="card"><span class="muted">{{ t().statement.overdueOf }}</span><strong [class.neg]="s.overdue > 0">{{ gs(s.overdue) }}</strong></div>
        <div class="card"><span class="muted">{{ t().statement.lastPayment }}</span><strong>{{ s.lastPayment ? store.dateLabel(s.lastPayment) : '—' }}</strong></div>
        <div class="card"><span class="muted">{{ t().statement.status }}</span>@if (s.overdue) { <span class="badge bad">{{ t().statement.withDebt }}</span> } @else { <span class="badge ok">{{ t().statement.upToDate }}</span> }</div>
      </div>

      <div class="row acts">
        <a class="btn line" routerLink="/explorar/bloqueado" [queryParams]="{ f: 'estado-pdf' }"><i class="pi pi-file-pdf"></i> {{ t().statement.pdf }}</a>
        <a class="btn line" routerLink="/explorar/bloqueado" [queryParams]="{ f: 'estado-pdf' }"><i class="pi pi-send"></i> {{ t().statement.send }}</a>
      </div>

      <div class="card">
        <h2>{{ t().statement.movements }}</h2>
        <div class="tbl-wrap">
          <table class="tb">
            <thead><tr><th>{{ t().statement.cols.date }}</th><th>{{ t().statement.cols.concept }}</th><th>{{ t().statement.cols.reference }}</th><th class="num">{{ t().statement.cols.charge }}</th><th class="num">{{ t().statement.cols.payment }}</th><th class="num">{{ t().statement.cols.balance }}</th></tr></thead>
            <tbody>
              @for (r of s.rows; track $index) {
                <tr>
                  <td>{{ store.dateLabel(r.date) }}</td>
                  <td>{{ r.concept }} @if (r.overdue) { <span class="badge bad">{{ t().statement.overdueBadge }}</span> }</td>
                  <td class="muted">{{ r.reference || '—' }}</td>
                  <td class="num">{{ r.charge ? gs(r.charge) : '' }}</td>
                  <td class="num pos">{{ r.payment ? gs(r.payment) : '' }}</td>
                  <td class="num"><b>{{ gs(r.balance) }}</b></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    } @else {
      <h1>{{ t().statement.notFoundTitle }}</h1>
      <p class="sub">{{ t().statement.notFound }}<a routerLink="/explorar/unidades">{{ t().statement.backShort }}</a></p>
    }
  `,
  styles: [DEMO_PAGE_STYLES, `.back { margin: 0.2rem 0 0; font-size: 0.86rem; font-weight: 700; } .sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.8rem; margin-bottom: 1rem; } .sum .card { display: grid; gap: 0.25rem; } .sum strong { font-size: 1.15rem; } .acts { margin-bottom: 1rem; }`]
})
export class DemoStatementComponent {
  readonly store = inject(DemoStore);
  readonly t = this.store.t;
  readonly gs = formatGs;
  private readonly code = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('code') ?? '')), { initialValue: '' });
  readonly st = computed(() => this.store.statement(this.code()));

  constructor() {
    effect(() => {
      if (this.st()) untracked(() => this.store.complete('unidad'));
    });
  }
}
