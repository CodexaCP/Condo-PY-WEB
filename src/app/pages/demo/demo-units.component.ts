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
    <h1>Unidades y propietarios</h1>
    <p class="sub">Busca un departamento y abre su estado de cuenta para ver cargos, pagos y saldo.</p>

    <div class="card">
      <div class="row bar">
        <input type="search" placeholder="Buscar por unidad o propietario..." [ngModel]="search()" (ngModelChange)="search.set($event)" aria-label="Buscar unidad" />
        <label class="chk"><input type="checkbox" [ngModel]="onlyDebt()" (ngModelChange)="onlyDebt.set($event)" /> Solo con deuda vencida</label>
        <span class="muted count">{{ rows().length }} de {{ store.units.length }} unidades</span>
      </div>
      <div class="tbl-wrap">
        <table class="tb">
          <thead>
            <tr><th>Unidad</th><th>Propietario</th><th class="num">Superficie</th><th class="num">Cuota ordinaria</th><th class="num">Deuda vencida</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.unit.code) {
              <tr class="click" [routerLink]="['/explorar/unidades', r.unit.code]">
                <td><b>{{ r.unit.code }}</b> <span class="muted">· piso {{ r.unit.floor }}</span></td>
                <td>{{ r.unit.owner }}</td>
                <td class="num">{{ r.unit.area }} m²</td>
                <td class="num">{{ gs(r.unit.fee) }}</td>
                <td class="num">{{ r.debt ? gs(r.debt) : '—' }}</td>
                <td>@if (r.debt) { <span class="badge bad">Debe {{ r.months }} {{ r.months === 1 ? 'mes' : 'meses' }}</span> } @else { <span class="badge ok">Al día</span> }</td>
                <td><a [routerLink]="['/explorar/unidades', r.unit.code]">Estado de cuenta →</a></td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="muted">Ninguna unidad coincide con la búsqueda.</td></tr>
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
      <p class="back"><a routerLink="/explorar/unidades">← Volver a unidades</a></p>
      <h1>Estado de cuenta · Unidad {{ s.unit.code }}</h1>
      <p class="sub">{{ s.unit.owner }} · piso {{ s.unit.floor }} · {{ s.unit.area }} m² · cuota ordinaria {{ gs(s.unit.fee) }}</p>

      <div class="sum">
        <div class="card"><span class="muted">Saldo pendiente</span><strong [class.neg]="s.pending > 0" [class.pos]="s.pending === 0">{{ gs(s.pending) }}</strong></div>
        <div class="card"><span class="muted">De los cuales vencidos</span><strong [class.neg]="s.overdue > 0">{{ gs(s.overdue) }}</strong></div>
        <div class="card"><span class="muted">Último pago</span><strong>{{ s.lastPayment ? store.dateLabel(s.lastPayment) : '—' }}</strong></div>
        <div class="card"><span class="muted">Estado</span>@if (s.overdue) { <span class="badge bad">Con deuda vencida</span> } @else { <span class="badge ok">Al día</span> }</div>
      </div>

      <div class="row acts">
        <a class="btn line" routerLink="/explorar/bloqueado" [queryParams]="{ f: 'estado-pdf' }"><i class="pi pi-file-pdf"></i> Descargar PDF</a>
        <a class="btn line" routerLink="/explorar/bloqueado" [queryParams]="{ f: 'estado-pdf' }"><i class="pi pi-send"></i> Enviar al propietario</a>
      </div>

      <div class="card">
        <h2>Movimientos</h2>
        <div class="tbl-wrap">
          <table class="tb">
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Referencia</th><th class="num">Cargo</th><th class="num">Pago</th><th class="num">Saldo</th></tr></thead>
            <tbody>
              @for (r of s.rows; track $index) {
                <tr>
                  <td>{{ store.dateLabel(r.date) }}</td>
                  <td>{{ r.concept }} @if (r.overdue) { <span class="badge bad">Vencido</span> }</td>
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
      <h1>Unidad no encontrada</h1>
      <p class="sub">Esa unidad no existe en la demostración. <a routerLink="/explorar/unidades">Volver a unidades</a></p>
    }
  `,
  styles: [DEMO_PAGE_STYLES, `.back { margin: 0.2rem 0 0; font-size: 0.86rem; font-weight: 700; } .sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.8rem; margin-bottom: 1rem; } .sum .card { display: grid; gap: 0.25rem; } .sum strong { font-size: 1.15rem; } .acts { margin-bottom: 1rem; }`]
})
export class DemoStatementComponent {
  readonly store = inject(DemoStore);
  readonly gs = formatGs;
  private readonly code = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('code') ?? '')), { initialValue: '' });
  readonly st = computed(() => this.store.statement(this.code()));

  constructor() {
    effect(() => {
      if (this.st()) untracked(() => this.store.complete('unidad'));
    });
  }
}
