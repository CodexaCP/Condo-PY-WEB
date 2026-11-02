import { Injectable, computed, inject, signal } from '@angular/core';
import { LangService } from '../../core/i18n/lang.service';
import { salesWhatsAppUrlFor } from '../../config/sales.config';
import { DEMO_COUNTRIES, DemoCountry, detectDemoCountry, formatDemoMoney, rememberDemoCountry } from './demo.country';
import { DemoDiagnosisAnswers, DemoFunnelEvent, trackDemoEvent } from './demo-funnel';
import { DemoCharge, DemoData, DemoExpense, DemoMonthStat, DemoMovement, DemoPeriod, DemoUnit, buildDemoData, hasVat, vatOf } from './demo.data';
import { CategoryId, ContactKind, DEMO_TX, DEMO_TX_AR, JournalKind, LockedId, MissionId, PainId } from './demo.i18n';

export interface DemoMission {
  id: MissionId;
  title: string;
  hint: string;
  route: string;
  icon: string;
}

// Las cinco misiones del recorrido guiado. Cada una enseña una capacidad real de Expenses (los textos están en demo.i18n.ts).
// Argentina cambia el libro diario (que es de Finanzas) por el certificado de deudas, un documento real del sistema.
const MISSIONS: Record<DemoCountry, { id: MissionId; route: string; icon: string }[]> = {
  py: [
    { id: 'panel', route: '/explorar/panel', icon: 'pi-chart-bar' },
    { id: 'unidad', route: '/explorar/unidades', icon: 'pi-home' },
    { id: 'gasto', route: '/explorar/gastos', icon: 'pi-wallet' },
    { id: 'informes', route: '/explorar/informes', icon: 'pi-file' },
    { id: 'libro', route: '/explorar/libro-diario', icon: 'pi-book' }
  ],
  ar: [
    { id: 'panel', route: '/explorar/panel', icon: 'pi-chart-bar' },
    { id: 'unidad', route: '/explorar/unidades', icon: 'pi-home' },
    { id: 'gasto', route: '/explorar/gastos', icon: 'pi-wallet' },
    { id: 'informes', route: '/explorar/informes', icon: 'pi-file' },
    { id: 'certificado', route: '/explorar/certificado', icon: 'pi-verified' }
  ]
};

// Funciones que la demostración no incluye: llevan a una invitación a contactar. En Argentina no se ofrece facturación.
export const DEMO_LOCKED_ICONS: Record<LockedId, string> = {
  'estado-pdf': 'pi-file-pdf',
  conciliacion: 'pi-sync',
  facturacion: 'pi-receipt',
  votaciones: 'pi-users',
  app: 'pi-mobile',
  mas: 'pi-th-large'
};

const LOCKED_NAV: Record<DemoCountry, string[]> = {
  py: ['conciliacion', 'facturacion', 'votaciones', 'app'],
  ar: ['conciliacion', 'votaciones', 'app']
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

export interface DemoCertificateLine {
  period: string;
  due: string;
  charged: number;
  paid: number;
  balance: number;
}

export interface DemoCertificate {
  unit: DemoUnit;
  issuedOn: string;
  lines: DemoCertificateLine[];
  totalDebt: number;
  credit: number;
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

const round2 = (n: number): number => Math.round(n * 100) / 100;

export type DemoContactKind = ContactKind;

@Injectable({ providedIn: 'root' })
export class DemoStore {
  private readonly lang = inject(LangService);

  // País de la demostración (Paraguay o Argentina): cambia los datos, la moneda y el vocabulario. Se elige en la cabecera o con ?pais=ar.
  readonly country = signal<DemoCountry>(detectDemoCountry());
  readonly countryOptions = computed(() => DEMO_COUNTRIES.map((code) => ({ code, label: this.t().countries[code] })));

  // Textos de la demostración en el idioma y el país actuales.
  readonly t = computed(() => (this.country() === 'ar' ? DEMO_TX_AR : DEMO_TX)[this.lang.lang()]);

  private readonly now = new Date();
  private readonly dataSignal = computed(() => buildDemoData(this.now, this.country()));

  // Todo lo que se deriva de los datos del país elegido; si el visitante cambia de país se recalcula entero.
  private readonly view = computed(() => {
    const data = this.dataSignal();
    const today = data.today;
    const overdue = (c: DemoCharge): boolean => c.paidOn === null && c.due < today;
    const currentPeriod = data.periods[data.periods.length - 1];
    const lastMonth = data.months[data.months.length - 1];
    const overdueUnits = data.units
      .map((unit) => {
        const items = data.charges.filter((c) => c.unitCode === unit.code && overdue(c));
        return { unit, amount: round2(items.reduce((s, c) => s + c.amount, 0)), months: items.filter((c) => c.kind === 'ordinaria').length };
      })
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    return {
      today,
      periods: data.periods,
      units: data.units,
      months: data.months,
      currentPeriod,
      collectedMonth: lastMonth.collected,
      chargedMonth: lastMonth.charged,
      paymentsMonth: data.payments.filter((p) => p.date.slice(0, 7) === currentPeriod.key),
      pendingTotal: round2(data.charges.filter((c) => c.paidOn === null).reduce((s, c) => s + c.amount, 0)),
      overdueUnits,
      overdueTotal: round2(overdueUnits.reduce((s, x) => s + x.amount, 0)),
      morosityPct: Math.round((overdueUnits.length / data.units.length) * 1000) / 10
    };
  });

  private get data(): DemoData {
    return this.dataSignal();
  }

  get today(): string { return this.view().today; }
  get periods(): DemoPeriod[] { return this.view().periods; }
  get units(): DemoUnit[] { return this.view().units; }
  get months(): DemoMonthStat[] { return this.view().months; }
  get currentPeriod(): DemoPeriod { return this.view().currentPeriod; }
  get collectedMonth(): number { return this.view().collectedMonth; }
  get chargedMonth(): number { return this.view().chargedMonth; }
  get paymentsMonth() { return this.view().paymentsMonth; }
  get pendingTotal(): number { return this.view().pendingTotal; }
  get overdueUnits() { return this.view().overdueUnits; }
  get overdueTotal(): number { return this.view().overdueTotal; }
  get morosityPct(): number { return this.view().morosityPct; }
  get reserveFund(): number { return this.data.reserveFund; }
  get openingCash(): number { return this.data.openingCash; }

  private readonly simulated = signal<DemoExpense[]>([]);
  private readonly done = signal<string[]>(this.readProgress(this.country()));
  private readonly answers = signal<DemoDiagnosisAnswers>({});

  readonly missions = computed<DemoMission[]>(() => MISSIONS[this.country()].map((m) => ({ ...m, ...this.t().missions[m.id] })));

  // Pantallas que dependen del país: el libro diario es de Paraguay; en Argentina el cierre del mes se mira en Informes.
  readonly hasJournal = computed(() => this.country() === 'py');
  readonly ledgerRoute = computed(() => (this.country() === 'py' ? '/explorar/libro-diario' : '/explorar/informes'));
  readonly lockedKeys = computed(() => LOCKED_NAV[this.country()]);

  readonly diagnosis = this.answers.asReadonly();
  readonly diagnosisDone = computed(() => !!(this.answers().units && this.answers().method && this.answers().pain));
  readonly recommendation = computed(() => this.t().recommendation[(this.answers().pain ?? '') as PainId] ?? '');
  readonly completed = this.done.asReadonly();
  readonly completedCount = computed(() => this.done().length);
  readonly allDone = computed(() => this.done().length >= this.missions().length);
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
  readonly currentPeriodLabel = computed(() => this.periodLabel(this.currentPeriod));

  readonly cashBalance = computed(() => this.openingCash + this.collectedMonth - this.expensesTotal());

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

  // Libro diario del mes: liquidación, cobros y gastos (incluidos los simulados). Solo lo muestra la demo de Paraguay.
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
      const vat = this.vatFor(e.category, e.amount);
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

  // Importe en la moneda del país de la demo (guaraníes o pesos); no depende de la sesión.
  money(value: number): string {
    return formatDemoMoney(this.country(), value);
  }

  // Los sueldos no llevan IVA y el resto sí (10 %) en Paraguay; en Argentina la demo no discrimina impuesto.
  vatFor(category: CategoryId, amount: number): number {
    return this.country() === 'py' && hasVat(category) ? vatOf(amount) : 0;
  }

  // Superficie en Paraguay («74 m²»); en Argentina el porcentual de la unidad funcional («4,7 %»).
  unitMetric(unit: DemoUnit): string {
    const tx = this.t();
    return this.country() === 'ar' ? tx.percent(tx.decimal(unit.share ?? 0)) : `${unit.area} m²`;
  }

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
      balance = round2(balance + r.charge - r.payment);
      return { date: r.date, concept: r.concept, charge: r.charge, payment: r.payment, balance, reference: r.reference, overdue: r.overdue };
    });
    const payments = this.data.payments.filter((x) => x.unitCode === code);
    return {
      unit,
      rows: rows.reverse(),
      pending: round2(charges.filter((c) => c.paidOn === null).reduce((s, c) => s + c.amount, 0)),
      overdue: round2(charges.filter((c) => this.isOverdue(c)).reduce((s, c) => s + c.amount, 0)),
      lastPayment: payments.length ? payments[payments.length - 1].date : null
    };
  }

  // Certificado de deudas y créditos de una unidad (el documento que la administración entrega a pedido de un interesado): lo adeudado
  // por período (expensas e intereses) y el saldo a favor del propietario. Solo se ofrece en la demo de Argentina.
  certificate(code: string): DemoCertificate | null {
    const unit = this.unit(code);
    if (!unit) return null;
    const byPeriod = new Map<string, { due: string; charged: number; paid: number }>();
    for (const c of this.data.charges.filter((x) => x.unitCode === code)) {
      const entry = byPeriod.get(c.period) ?? { due: c.due, charged: 0, paid: 0 };
      if (c.kind === 'ordinaria') entry.due = c.due;
      entry.charged += c.amount;
      if (c.paidOn !== null) entry.paid += c.amount;
      byPeriod.set(c.period, entry);
    }
    const lines = this.periods
      .map((p) => ({ p, e: byPeriod.get(p.key) }))
      .filter((x): x is { p: DemoPeriod; e: { due: string; charged: number; paid: number } } => !!x.e && round2(x.e.charged - x.e.paid) > 0)
      .map(({ p, e }) => ({ period: this.periodLabel(p), due: e.due, charged: round2(e.charged), paid: round2(e.paid), balance: round2(e.charged - e.paid) }));
    return { unit, issuedOn: this.today, lines, totalDebt: round2(lines.reduce((s, l) => s + l.balance, 0)), credit: unit.credit ?? 0 };
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
    if (this.done().includes(id) || !this.missions().some((m) => m.id === id)) return;
    const next = [...this.done(), id];
    this.done.set(next);
    this.writeStorage(PROGRESS_KEY, JSON.stringify(next));
    this.track('mission_complete', id);
    if (next.length >= this.missions().length) this.track('demo_complete');
  }

  // Paso 4 del embudo: el diagnóstico de tres preguntas (se guardan identificadores, no textos, para medir igual en cualquier idioma).
  answer(key: 'units' | 'method' | 'pain', value: string): void {
    const was = this.diagnosisDone();
    this.answers.update((a) => ({ ...a, [key]: value }));
    if (!was && this.diagnosisDone()) this.track('diagnosis_done', Object.values(this.answers()).join(' | '));
  }

  // Cambia de país: se recuerda para el resto de la visita y la demo empieza de nuevo (los datos, la moneda y las misiones son otras).
  setCountry(country: DemoCountry): void {
    if (country === this.country()) return;
    this.country.set(country);
    rememberDemoCountry(country);
    this.simulated.set([]);
    this.answers.set({});
    this.done.set([]);
    this.writeStorage(PROGRESS_KEY, '[]');
    this.track('country_change');
  }

  reset(): void {
    this.simulated.set([]);
    this.answers.set({});
    this.done.set([]);
    this.writeStorage(PROGRESS_KEY, '[]');
    this.track('demo_reset');
  }

  // Mensaje de WhatsApp para el cierre comercial: dice qué exploró la persona, para saber qué le interesó, y desde qué país mira la demo.
  // Va en el idioma que usa.
  whatsappUrl(kind: DemoContactKind): string | null {
    const tx = this.t();
    const explored = this.missions().filter((m) => this.done().includes(m.id)).map((m) => m.title.toLowerCase());
    const tail = explored.length ? tx.whatsapp.explored(explored.join(', ')) : '';
    const a = this.answers();
    const label = (key: 'units' | 'method' | 'pain'): string => (tx.diagnosis[key].options.find(([id]) => id === a[key])?.[1] ?? '').toLowerCase();
    const profile = this.diagnosisDone() ? tx.whatsapp.profile(label('units'), label('method'), label('pain')) : '';
    return salesWhatsAppUrlFor(tx.whatsapp.intro[kind] + tail + profile + tx.whatsapp.country(tx.countries[this.country()]));
  }

  // Medición del embudo en el navegador (ver demo-funnel.ts). Cada evento lleva el país de la demo en el detalle.
  track(event: DemoFunnelEvent, detail?: string): void {
    const country = this.country();
    trackDemoEvent(event, detail ? `${detail} · ${country}` : country);
  }

  dateLabel(isoDate: string): string {
    return this.t().date(isoDate);
  }

  private readProgress(country: DemoCountry): string[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string' && MISSIONS[country].some((m) => m.id === x)) : [];
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
