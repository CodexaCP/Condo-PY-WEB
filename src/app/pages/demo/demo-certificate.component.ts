import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DEMO_PAGE_STYLES } from './demo.styles';
import { DemoStore } from './demo.store';

// Misión 5 de la demo de Argentina: certificado de deudas y créditos de una unidad funcional. Es el documento que la administración
// entrega a pedido de un interesado (por ejemplo, para transmitir la unidad): lo adeudado por período y el saldo a favor del propietario.
// Verlo cumple la misión. En Paraguay esta pantalla no existe (la misión es el libro diario).
@Component({
  standalone: true,
  selector: 'app-demo-certificate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  template: `
    @if (cert(); as c) {
      <h1>{{ t().certificate.title }}</h1>
      <p class="sub">{{ t().certificate.sub }}</p>

      <div class="row bar">
        <label class="fld">{{ t().certificate.pick }}
          <select [ngModel]="code()" (ngModelChange)="picked.set($event)">
            @for (u of store.units; track u.code) {
              <option [value]="u.code">{{ u.code }} · {{ u.owner }}</option>
            }
          </select>
        </label>
        <a class="btn line" [routerLink]="['/explorar/unidades', c.unit.code]">{{ t().certificate.statementLink }}</a>
        <a class="btn line" routerLink="/explorar/bloqueado" [queryParams]="{ f: 'estado-pdf' }"><i class="pi pi-file-pdf"></i> {{ t().certificate.pdf }}</a>
      </div>

      <div class="card doc">
        <h2>{{ store.buildingName() }}</h2>
        <p class="title">{{ t().certificate.title }}</p>
        <p>{{ t().certificate.issued(store.dateLabel(c.issuedOn), c.unit.code, store.buildingName(), t().certificate.place) }}</p>
        <p><b>{{ t().certificate.owner }}:</b> {{ c.unit.owner }}</p>

        @if (c.lines.length) {
          <div class="tbl-wrap">
            <table class="tb">
              <thead>
                <tr>
                  <th>{{ t().certificate.cols.period }}</th>
                  <th>{{ t().certificate.cols.due }}</th>
                  <th class="num">{{ t().certificate.cols.charged }}</th>
                  <th class="num">{{ t().certificate.cols.paid }}</th>
                  <th class="num">{{ t().certificate.cols.pending }}</th>
                </tr>
              </thead>
              <tbody>
                @for (l of c.lines; track l.period) {
                  <tr>
                    <td>{{ l.period }}</td>
                    <td>{{ store.dateLabel(l.due) }}</td>
                    <td class="num">{{ gs(l.charged) }}</td>
                    <td class="num">{{ gs(l.paid) }}</td>
                    <td class="num neg"><b>{{ gs(l.balance) }}</b></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="muted">{{ t().certificate.none }}</p>
        }

        <div class="totals">
          <div><span>{{ t().certificate.total }}</span><strong [class.neg]="c.totalDebt > 0" [class.pos]="c.totalDebt === 0">{{ gs(c.totalDebt) }}</strong></div>
          <div class="muted"><span>{{ t().certificate.credit }}</span><b>{{ gs(c.credit) }}</b></div>
        </div>

        <p>{{ c.totalDebt > 0 ? t().certificate.hasDebt : t().certificate.noDebt }}</p>
        <p class="muted note">{{ t().certificate.note }}</p>

        <div class="sign">
          <i></i>
          <b>{{ t().certificate.signature }}</b>
          <span class="muted">{{ t().certificate.registry }}</span>
        </div>
      </div>
    }
  `,
  styles: [
    DEMO_PAGE_STYLES,
    `
      .bar { align-items: flex-end; margin-bottom: 1rem; }
      .bar select { min-width: 240px; }
      .doc { max-width: 820px; display: grid; gap: 0.3rem; }
      .doc h2 { margin: 0; font-size: 1.15rem; color: #1385b6; }
      .doc .title { margin: 0 0 0.6rem; font-size: 1rem; font-weight: 700; color: var(--ex-muted, #5f7b88); }
      .doc p { margin: 0.2rem 0; line-height: 1.5; }
      .totals { display: grid; gap: 0.4rem; margin: 0.8rem 0 0.4rem; }
      .totals > div { display: flex; justify-content: space-between; gap: 1rem; }
      .totals strong { font-size: 1.15rem; }
      .note { font-size: 0.78rem; }
      .sign { display: grid; gap: 0.15rem; margin-top: 1.8rem; justify-items: start; }
      .sign i { display: block; width: 220px; border-top: 1px solid var(--ex-muted, #5f7b88); margin-bottom: 0.3rem; }
      .sign span { font-size: 0.82rem; }
    `
  ]
})
export class DemoCertificateComponent {
  readonly store = inject(DemoStore);
  readonly t = this.store.t;
  readonly gs = (v: number): string => this.store.money(v);
  private readonly param = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('code'))), { initialValue: null as string | null });
  readonly picked = signal<string | null>(null);

  // La unidad que eligió la persona; si no, la de la dirección; si no, la que más debe (la que mejor muestra el certificado).
  readonly code = computed(() => this.picked() ?? this.param() ?? this.store.overdueUnits[0]?.unit.code ?? this.store.units[0]?.code ?? '');
  readonly cert = computed(() => this.store.certificate(this.code()));

  constructor() {
    const router = inject(Router);
    // Solo existe en la demo de Argentina: en Paraguay esta dirección vuelve al panel.
    if (this.store.country() !== 'ar') {
      void router.navigateByUrl('/explorar/panel');
      return;
    }
    effect(() => {
      if (this.cert()) untracked(() => this.store.complete('certificado'));
    });
  }
}
