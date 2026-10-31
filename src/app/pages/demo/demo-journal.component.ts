import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { formatGs } from '../condo/finance-format';
import { DEMO_PAGE_STYLES } from './demo.styles';
import { DemoStore, JournalEntry } from './demo.store';

type Filter = 'todos' | JournalEntry['kind'];

// Misión 5: libro diario. Cada asiento muestra de qué movimiento sale; abrir uno cumple la misión.
@Component({
  standalone: true,
  selector: 'app-demo-journal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <h1>{{ t().journal.title }}</h1>
    <p class="sub">{{ t().journal.sub }}</p>

    <div class="row filters">
      @for (key of filters; track key) {
        <button type="button" class="chip" [class.on]="filter() === key" (click)="filter.set(key)">{{ t().journal.filters[key] }}</button>
      }
      <span class="muted count">{{ t().journal.count(entries().length) }}</span>
    </div>

    <div class="list">
      @for (e of entries(); track e.id) {
        <div class="entry card" [id]="'je-' + e.id" [class.open]="openId() === e.id">
          <button type="button" class="head" (click)="toggle(e.id)" [attr.aria-expanded]="openId() === e.id">
            <span class="no">{{ t().journal.number }} {{ pad(e.number) }}</span>
            <span class="dt">{{ store.dateLabel(e.date) }}</span>
            <span class="ds">{{ e.description }}</span>
            <span class="badge" [class]="'badge ' + tone(e.kind)">{{ label(e.kind) }}</span>
            <span class="am">{{ gs(total(e)) }}</span>
            <i class="pi" [class.pi-chevron-down]="openId() !== e.id" [class.pi-chevron-up]="openId() === e.id"></i>
          </button>
          @if (openId() === e.id) {
            <div class="body">
              <div class="tbl-wrap">
                <table class="tb">
                  <thead><tr><th>{{ t().journal.cols.account }}</th><th>{{ t().journal.cols.name }}</th><th class="num">{{ t().journal.cols.debit }}</th><th class="num">{{ t().journal.cols.credit }}</th></tr></thead>
                  <tbody>
                    @for (l of e.lines; track $index) {
                      <tr><td>{{ l.account }}</td><td>{{ l.name }}</td><td class="num">{{ l.debit ? gs(l.debit) : '' }}</td><td class="num">{{ l.credit ? gs(l.credit) : '' }}</td></tr>
                    }
                    <tr class="tot"><td colspan="2"><b>{{ t().journal.totals }}</b> <span class="badge ok">{{ t().journal.balanced }}</span></td><td class="num"><b>{{ gs(total(e)) }}</b></td><td class="num"><b>{{ gs(total(e)) }}</b></td></tr>
                  </tbody>
                </table>
              </div>
              <p class="origin"><i class="pi pi-link"></i> <b>{{ t().journal.origin }}</b> {{ e.origin }} · <a [routerLink]="e.link">{{ t().journal.seeMovement }}</a></p>
            </div>
          }
        </div>
      }
    </div>

    <div class="card more">
      <i class="pi pi-lock"></i>
      <span>{{ t().journal.more }}<b>{{ t().journal.moreBold }}</b>{{ t().journal.moreRest }}</span>
      <a routerLink="/explorar/bloqueado" [queryParams]="{ f: 'mas' }">{{ t().journal.learnMore }}</a>
    </div>
  `,
  styles: [
    DEMO_PAGE_STYLES,
    `
      .filters { margin-bottom: 0.8rem; }
      .chip { cursor: pointer; font: inherit; font-size: 0.84rem; font-weight: 700; padding: 0.4rem 0.9rem; border-radius: 999px; border: 1px solid var(--ex-line, #dbe6ef); background: #fff; color: var(--ex-muted, #5f7b88); }
      .chip.on { background: #1385b6; border-color: #1385b6; color: #fff; }
      .count { margin-left: auto; font-size: 0.82rem; }
      .list { display: grid; gap: 0.5rem; }
      .entry { padding: 0; overflow: hidden; }
      .entry.open { border-color: #1ab7af; }
      .head { width: 100%; display: grid; grid-template-columns: 5.5rem 5.2rem 1fr auto 8rem 1.2rem; align-items: center; gap: 0.7rem; padding: 0.75rem 1rem; background: none; border: 0; cursor: pointer; font: inherit; color: inherit; text-align: left; }
      .head:hover { background: #f6fafc; }
      .no { font-weight: 800; font-size: 0.84rem; }
      .dt { color: var(--ex-muted, #5f7b88); font-size: 0.84rem; }
      .ds { font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .am { text-align: right; font-weight: 700; font-size: 0.88rem; font-variant-numeric: tabular-nums; }
      @media (max-width: 760px) { .head { grid-template-columns: 1fr auto 1.2rem; } .no, .dt { grid-column: 1 / -1; } .ds { white-space: normal; } .badge { display: none; } }
      .body { padding: 0 1rem 1rem; border-top: 1px solid #eef3f7; }
      .tot td { border-top: 2px solid var(--ex-line, #dbe6ef); }
      .origin { margin: 0.8rem 0 0; font-size: 0.86rem; }
      .origin i { color: #1385b6; }
      .more { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; margin-top: 1rem; background: #f6fafc; }
      .more i { color: #1385b6; }
      .more span { flex: 1; min-width: 220px; font-size: 0.88rem; }
    `
  ]
})
export class DemoJournalComponent {
  readonly store = inject(DemoStore);
  readonly t = this.store.t;
  readonly gs = formatGs;
  readonly filter = signal<Filter>('todos');
  readonly openId = signal<string | null>(null);

  readonly filters: Filter[] = ['todos', 'gasto', 'cobro', 'liquidacion'];

  readonly entries = computed(() => this.store.journal().filter((e) => this.filter() === 'todos' || e.kind === this.filter()));

  constructor() {
    // Viene del aviso «Ver el asiento» de la pantalla de Gastos: abre ese asiento y se desplaza hasta él.
    const focus = inject(ActivatedRoute).snapshot.queryParamMap.get('focus');
    if (focus && this.store.journal().some((e) => e.id === focus)) {
      this.openId.set(focus);
      this.store.complete('libro');
      setTimeout(() => document.getElementById('je-' + focus)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
  }

  toggle(id: string): void {
    const closing = this.openId() === id;
    this.openId.set(closing ? null : id);
    if (!closing) this.store.complete('libro');
  }

  total(e: JournalEntry): number {
    return e.lines.reduce((s, l) => s + l.debit, 0);
  }

  pad(n: number): string {
    return String(n).padStart(6, '0');
  }

  label(k: JournalEntry['kind']): string {
    return this.t().journal.kinds[k];
  }

  tone(k: JournalEntry['kind']): string {
    return k === 'gasto' ? 'sim' : k === 'cobro' ? 'ok' : 'info';
  }
}
