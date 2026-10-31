import { Injectable, computed, inject, signal } from '@angular/core';
import { LangService } from '../../core/i18n/lang.service';
import { salesWhatsAppUrlFor } from '../../config/sales.config';
import { DemoDiagnosisAnswers, DemoFunnelEvent, trackDemoEvent } from './demo-funnel';
import { DEMO_OPENING_CASH, DEMO_RESERVE_FUND, DemoCharge, DemoExpense, DemoMonthStat, DemoMovement, DemoPeriod, DemoUnit, buildDemoData, hasVat, vatOf } from './demo.data';
import { CategoryId, ContactKind, DEMO_TX, JournalKind, LockedId, MissionId, PainId } from './demo.i18n';

export interface DemoMission {
  id: MissionId;
  title: string;
  hint: string;
  route: string;
  icon: string;
}

// Las cinco misiones del recorrido guiado. Cada una enseña una capacidad real de Expenses (los textos están en demo.i18n.ts).
const MISSION_BASE: { id: MissionId; route: string; icon: string }[] = [
  { id: 'panel', route: '/explorar/panel', icon: 'pi-chart-bar' },
  { id: 'unidad', route: '/explorar/unidades', icon: 'pi-home' },
  { id: 'gasto', route: '/explorar/gastos', icon: 'pi-wallet' },
  { id: 'informes', route: '/explorar/informes', icon: 'pi-file' },
  { id: 'libro', route: '/explorar/libro-diario', icon: 'pi-book' }
];

// Funciones que la demostración no incluye: llevan a una invitación a contactar.
export const DEMO_LOCKED_ICONS: Record<LockedId, string> = {
  'estado-pdf': 'pi-file-pdf',
  conciliacion: 'pi-sync',
  facturacion: 'pi-receipt',
  votaciones: 'pi-users',
  app: 'pi-mobile',
  mas: 'pi-th-large'
};

export interface JournalLine {
  account: string;
  name: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  number: number;
  date: string;
  description: string;
  kind: JournalKind;
  origin: string;
  link: string[];
  lines: JournalLine[];
}

const EXPENSE_ACCOUNT_CODES: Record<CategoryId, string> = {
  utilities: '5.1.01',
  payroll: '5.1.02',
  security: '5.1.03',
  maintenance: '5.1.04',
  cleaning: '5.1.05',
  admin: '5.1.06',
  insurance: '5.1.07',
  other: '5.1.99'
};

const PROGRESS_KEY = 'expenses-demo-progress';
const JOURNAL_BASE = 120;

export type DemoContactKind = ContactKind;

@Injectable({ providedIn: 'root' })
export class DemoStore {
  private readonly lang = inject(LangService);
  // Textos de la demostración en el idioma actual.
  readonly t = computed(() => DEMO_TX[this.lang.lang()]);

  private readonly data = buildDemoData(new Date());

  readonly today = this.data.today;
  readonly periods = this.data.periods;
  readonly units: DemoUnit[] = this.data.units;
  readonly months: DemoMonthStat[] = this.data.months;

  private readonly simulated = signal<DemoExpense[]>([]);
  private readonly done = signal<string[]>(this.readProgress());
  private readonly answers = signal<DemoDiagnosisAnswers>({});

  readonly missions = computed<DemoMission[]>(() => MISSION_BASE.map((m) => ({ ...m, ...this.t().missions[m.id] })));

  readonly diagnosis = this.answers.asReadonly();
  readonly diagnosisDone = computed(() => !!(this.answers().units && this.answers().method && this.answers().pain));
  readonly recommendation = computed(() => this.t().recommendation[(this.answers().pain ?? '') as PainId] ?? '');
  readonly completed = this.done.asReadonly();
  readonly completedCount = computed(() => this.done().length);
  readonly allDone = computed(() => this.done().length >= MISSION_BASE.length);
  readonly nextMission = computed(() => this.missions().find((m) => !this.done().includes(m.id)) ?? null);

  readonly buildingName = computed(() => this.t().building.name);
  readonly buildingCity = computed(() => this.t().building.city);

  // Gastos con el proveedor y el concepto ya nombrados en el idioma actual (los simulados traen lo que escribió el visitante).
  readonly expenses = computed(() => {
    const items = this.t().expenseItems;
    return [...this.simulated(), ...this.data.expenses]
      .map((e) => (e.itemId ? { ...e, supplier: items[e.itemId].supplier, concept: items[e.itemId].concept } : { ...e, supplier: e.supplier || this.t().defaultSupplier }))
      .sort((a, b) => b.date.localeCompare(a.date) || Number(b.simulated) - Number(a.simulated));
  });
  readonly expensesTotal = computed(() => this.expenses().reduce((s, e) => s + e.amount, 0));
  readonly currentPeriod = this.data.periods[this.data.periods.length - 1];
  readonly currentPeriodLabel = computed(() => this.periodLabel(this.currentPeriod));

  readonly collectedMonth = this.data.months[this.data.months.length - 1].collected;
  readonly chargedMonth = this.data.months[this.data.months.length - 1].charged;
  readonly paymentsMonth = this.data.payments.filter((p) => p.date.slice(0, 7) === this.currentPeriod.key);
  readonly cashBalance = computed(() => DEMO_OPENING_CASH + this.collectedMonth - this.expensesTotal());
  readonly reserveFund = DEMO_RESERVE_FUND;
  readonly openingCash = DEMO_OPENING_CASH;

  readonly pendingTotal = this.data.charges.filter((c) => c.paidOn === null).reduce((s, c) => s + c.amount, 0);

  // Unidades con deuda vencida, de mayor a menor.
  readonly overdueUnits = this.units
    .map((unit) => {
      const overdue = this.data.charges.filter((c) => c.unitCode === unit.code && this.isOverdue(c));
      return { unit, amount: overdue.reduce((s, c) => s + c.amount, 0), months: overdue.filter((c) => c.kind === 'ordinaria').length };
    })
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  readonly overdueTotal = this.overdueUnits.reduce((s, x) => s + x.amount, 0);
  readonly morosityPct = Math.round((this.overdueUnits.length / this.units.length) * 1000) / 10;

  // Gráfico: el mes actual refleja los gastos simulados que cargue el visitante.
  readonly chart = computed(() => this.months.map((m, i) => ({ label: this.periodShort(m.period), income: m.collected, expense: i === this.months.length - 1 ? this.expensesTotal() : m.expenses })));

  readonly expensesByCategory = computed(() => {
    const total = this.expensesTotal() || 1;
    const map = new Map<CategoryId, number>();
    for (const e of this.expenses()) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return [...map.entries()].map(([category, amount]) => ({ category, label: this.t().categories[category], amount, share: Math.round((amount / total) * 100) })).sort((a, b) => b.amount - a.amount);
  });

  readonly aging = computed(() => {
    const buckets = this.t().aging.map((label) => ({ label, units: 0, amount: 0 }));
    for (const x of this.overdueUnits) {
      const b = buckets[Math.min(Math.max(x.months, 1), 3) - 1];
      b.units++;
      b.amount += x.amount;
    }
    return buckets;
  });

  // Libro diario del mes: liquidación, cobros y gastos (incluidos los simulados).
  readonly journal = computed<JournalEntry[]>(() => {
    const tx = this.t();
    const key = this.currentPeriod.key;
    const entries: Omit<JournalEntry, 'number'>[] = [];
    const monthCharges = this.data.charges.filter((c) => c.period === key && c.kind !== 'recargo');
    const ordinary = monthCharges.filter((c) => c.kind === 'ordinaria').reduce((s, c) => s + c.amount, 0);
    const extra = monthCharges.filter((c) => c.kind === 'extra').reduce((s, c) => s + c.amount, 0);
    const liqLines: JournalLine[] = [{ account: '1.3.01', name: tx.accounts.receivable, debit: ordinary + extra, credit: 0 }, { account: '4.1.01', name: tx.accounts.ordinaryIncome, debit: 0, credit: ordinary }];
    if (extra > 0) liqLines.push({ account: '4.1.02', name: tx.accounts.extraIncome, debit: 0, credit: extra });
    entries.push({ id: `liq-${key}`, date: `${key}-01`, description: tx.journalText.liquidation(this.currentPeriodLabel()), kind: 'liquidacion', origin: tx.journalText.liquidationOrigin(this.units.length), link: ['/explorar/unidades'], lines: liqLines });

    for (const p of this.paymentsMonth) {
      entries.push({
        id: p.id,
        date: p.date,
        description: tx.journalText.collection(p.unitCode),
        kind: 'cobro',
        origin: tx.journalText.collectionOrigin(p.receipt, p.owner, tx.methods[p.method]),
        link: ['/explorar/unidades', p.unitCode],
        lines: [{ account: '1.1.01', name: tx.accounts.cash, debit: p.amount, credit: 0 }, { account: '1.3.01', name: tx.accounts.receivable, debit: 0, credit: p.amount }]
      });
    }

    for (const e of this.expenses()) {
      const vat = hasVat(e.category) ? vatOf(e.amount) : 0;
      const lines: JournalLine[] = [{ account: EXPENSE_ACCOUNT_CODES[e.category], name: tx.accountNames[e.category], debit: e.amount - vat, credit: 0 }];
      if (vat > 0) lines.push({ account: '1.1.05', name: tx.accounts.vat, debit: vat, credit: 0 });
      lines.push({ account: '1.1.01', name: tx.accounts.cash, debit: 0, credit: e.amount });
      entries.push({
        id: e.id,
        date: e.date,
        description: `${e.concept} · ${e.supplier}`,
        kind: 'gasto',
        origin: e.simulated ? tx.journalText.expenseOriginSimulated : tx.journalText.expenseOrigin(tx.categories[e.category]),
        link: ['/explorar/gastos'],
        lines
      });
    }

    const order = { liquidacion: 0, cobro: 1, gasto: 2 };
    entries.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind] || a.id.localeCompare(b.id));
    return entries.map((e, i) => ({ ...e, number: JOURNAL_BASE + i + 1 })).reverse();
  });

  readonly lastMovements = computed(() => {
    const tx = this.t();
    const pays = this.paymentsMonth.map((p) => ({ date: p.date, text: tx.movementCollection(p.unitCode, p.owner), amount: p.amount, income: true, id: p.id }));
    const exps = this.expenses().map((e) => ({ date: e.date, text: `${e.concept} · ${e.supplier}`, amount: e.amount, income: false, id: e.id }));
    return [...pays, ...exps].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  });

  unit(code: string): DemoUnit | undefined {
    return this.units.find((u) => u.code === code);
  }

  isOverdue(c: DemoCharge): boolean {
    return c.paidOn === null && c.due < this.today;
  }

  periodLabel(p: DemoPeriod): string {
    return `${this.t().months[p.month]} ${p.year}`;
  }

  periodShort(p: DemoPeriod): string {
    return this.t().monthsShort[p.month];
  }

  lockedInfo(id: string): { title: string; text: string; icon: string } {
    const key = (id in DEMO_LOCKED_ICONS ? id : 'mas') as LockedId;
    return { ...this.t().locked[key], icon: DEMO_LOCKED_ICONS[key] };
  }

  // Concepto de un cargo en el idioma actual.
  private chargeConcept(c: DemoCharge): string {
    const tx = this.t().charge;
    const period = this.periods.find((p) => p.key === c.period);
    const label = period ? this.periodLabel(period) : c.period;
    return c.kind === 'ordinaria' ? tx.ordinary(label) : c.kind === 'extra' ? tx.extra : tx.surcharge(label);
  }

  // Estado de cuenta de una unidad: cargos y pagos con saldo acumulado (más reciente primero).
  statement(code: string): { unit: DemoUnit; rows: DemoMovement[]; pending: number; overdue: number; lastPayment: string | null } | null {
    const unit = this.unit(code);
    if (!unit) return null;
    const tx = this.t();
    const charges = this.data.charges.filter((c) => c.unitCode === code);
    const raw: { date: string; order: number; concept: string; charge: number; payment: number; reference: string; overdue: boolean }[] = [];
    for (const c of charges) raw.push({ date: c.date, order: 0, concept: this.chargeConcept(c), charge: c.amount, payment: 0, reference: '', overdue: this.isOverdue(c) });
    for (const p of this.data.payments.filter((x) => x.unitCode === code)) raw.push({ date: p.date, order: 1, concept: tx.charge.paymentReceived(tx.methods[p.method]), charge: 0, payment: p.amount, reference: p.receipt, overdue: false });
    raw.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
    let balance = 0;
    const rows: DemoMovement[] = raw.map((r) => {
      balance += r.charge - r.payment;
      return { date: r.date, concept: r.concept, charge: r.charge, payment: r.payment, balance, reference: r.reference, overdue: r.overdue };
    });
    const payments = this.data.payments.filter((x) => x.unitCode === code);
    return {
      unit,
      rows: rows.reverse(),
      pending: charges.filter((c) => c.paidOn === null).reduce((s, c) => s + c.amount, 0),
      overdue: charges.filter((c) => this.isOverdue(c)).reduce((s, c) => s + c.amount, 0),
      lastPayment: payments.length ? payments[payments.length - 1].date : null
    };
  }

  addExpense(input: { concept: string; supplier: string; category: CategoryId; amount: number }): DemoExpense {
    const expense: DemoExpense = {
      id: `exp-sim-${this.simulated().length + 1}`,
      date: this.today,
      supplier: input.supplier.trim(),
      concept: input.concept.trim(),
      category: input.category,
      amount: Math.round(input.amount),
      simulated: true
    };
    this.simulated.update((list) => [expense, ...list]);
    this.complete('gasto');
    return expense;
  }

  complete(id: string): void {
    if (this.done().includes(id)) return;
    const next = [...this.done(), id];
    this.done.set(next);
    this.writeStorage(PROGRESS_KEY, JSON.stringify(next));
    this.track('mission_complete', id);
    if (next.length >= MISSION_BASE.length) this.track('demo_complete');
  }

  // Paso 4 del embudo: el diagnóstico de tres preguntas (se guardan identificadores, no textos, para medir igual en cualquier idioma).
  answer(key: 'units' | 'method' | 'pain', value: string): void {
    const was = this.diagnosisDone();
    this.answers.update((a) => ({ ...a, [key]: value }));
    if (!was && this.diagnosisDone()) this.track('diagnosis_done', Object.values(this.answers()).join(' | '));
  }

  reset(): void {
    this.simulated.set([]);
    this.answers.set({});
    this.done.set([]);
    this.writeStorage(PROGRESS_KEY, '[]');
    this.track('demo_reset');
  }

  // Mensaje de WhatsApp para el cierre comercial: dice qué exploró la persona, para saber qué le interesó. Va en el idioma que usa.
  whatsappUrl(kind: DemoContactKind): string | null {
    const tx = this.t();
    const explored = this.missions().filter((m) => this.done().includes(m.id)).map((m) => m.title.toLowerCase());
    const tail = explored.length ? tx.whatsapp.explored(explored.join(', ')) : '';
    const a = this.answers();
    const label = (key: 'units' | 'method' | 'pain'): string => (tx.diagnosis[key].options.find(([id]) => id === a[key])?.[1] ?? '').toLowerCase();
    const profile = this.diagnosisDone() ? tx.whatsapp.profile(label('units'), label('method'), label('pain')) : '';
    return salesWhatsAppUrlFor(tx.whatsapp.intro[kind] + tail + profile);
  }

  // Medición del embudo en el navegador (ver demo-funnel.ts).
  track(event: DemoFunnelEvent, detail?: string): void {
    trackDemoEvent(event, detail);
  }

  dateLabel(isoDate: string): string {
    return this.t().date(isoDate);
  }

  private readProgress(): string[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string' && MISSION_BASE.some((m) => m.id === x)) : [];
    } catch {
      return [];
    }
  }

  private writeStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Sin almacenamiento: el avance dura mientras la página siga abierta.
    }
  }
}
