import { Injectable, computed, signal } from '@angular/core';
import { salesWhatsAppUrlFor } from '../../config/sales.config';
import { DemoDiagnosisAnswers, DemoFunnelEvent, DEMO_PAIN_RECOMMENDATION, trackDemoEvent } from './demo-funnel';
import { DEMO_BUILDING, DEMO_OPENING_CASH, DEMO_RESERVE_FUND, DemoCharge, DemoExpense, DemoMonthStat, DemoMovement, DemoUnit, buildDemoData, fmtDate, hasVat, vatOf } from './demo.data';

export interface DemoMission {
  id: string;
  title: string;
  hint: string;
  route: string;
  icon: string;
}

// Las cinco misiones del recorrido guiado. Cada una enseña una capacidad real de Expenses.
export const DEMO_MISSIONS: DemoMission[] = [
  { id: 'panel', title: 'Conoce el edificio', hint: 'Haz clic en cualquier indicador del panel para ver de dónde sale la cifra.', route: '/explorar/panel', icon: 'pi-chart-bar' },
  { id: 'unidad', title: 'Revisa una unidad', hint: 'Busca un departamento con deuda y abre su estado de cuenta.', route: '/explorar/unidades', icon: 'pi-home' },
  { id: 'gasto', title: 'Registra un gasto', hint: 'Carga un gasto simulado y mira cómo impacta en el edificio.', route: '/explorar/gastos', icon: 'pi-wallet' },
  { id: 'informes', title: 'Descubre los informes', hint: 'Cambia entre los informes de ingresos y gastos, morosidad y rubros.', route: '/explorar/informes', icon: 'pi-file' },
  { id: 'libro', title: 'Comprueba el control contable', hint: 'Abre un asiento del libro diario y mira de qué movimiento sale.', route: '/explorar/libro-diario', icon: 'pi-book' }
];

// Funciones que la demostración no incluye: llevan a una invitación a contactar.
export const DEMO_LOCKED: Record<string, { title: string; text: string; icon: string }> = {
  'estado-pdf': { title: 'Estados de cuenta en PDF y envío al propietario', text: 'Genera el estado de cuenta de cada unidad en PDF y envíalo por correo o por la app, con un solo clic.', icon: 'pi-file-pdf' },
  conciliacion: { title: 'Conciliación bancaria', text: 'Importa el extracto del banco y concilia cobros y pagos contra lo registrado en Expenses.', icon: 'pi-sync' },
  facturacion: { title: 'Facturación y recibos', text: 'Emite facturas y recibos con tu timbrado, con notas de crédito y libro de ventas.', icon: 'pi-receipt' },
  votaciones: { title: 'Votaciones de asamblea', text: 'Convoca y registra votaciones de propietarios con resultados en tiempo real.', icon: 'pi-users' },
  app: { title: 'App para propietarios y encargados', text: 'Cada propietario consulta su deuda, paga y recibe avisos desde el celular.', icon: 'pi-mobile' },
  mas: { title: 'Más módulos de Expenses', text: 'Comunicados, reclamos, reservas de espacios comunes, presupuesto, fondo de reserva y más.', icon: 'pi-th-large' }
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
  kind: 'liquidacion' | 'cobro' | 'gasto';
  origin: string;
  link: string[];
  lines: JournalLine[];
}

const EXPENSE_ACCOUNTS: Record<string, { code: string; name: string }> = {
  Servicios: { code: '5.1.01', name: 'Servicios básicos' },
  Personal: { code: '5.1.02', name: 'Sueldos y cargas sociales' },
  Seguridad: { code: '5.1.03', name: 'Seguridad y vigilancia' },
  Mantenimiento: { code: '5.1.04', name: 'Mantenimiento y reparaciones' },
  Limpieza: { code: '5.1.05', name: 'Limpieza' },
  Administración: { code: '5.1.06', name: 'Honorarios de administración' },
  Seguros: { code: '5.1.07', name: 'Seguros' },
  Otros: { code: '5.1.99', name: 'Otros gastos' }
};

const PROGRESS_KEY = 'expenses-demo-progress';
const JOURNAL_BASE = 120;

export type DemoContactKind = 'presupuesto' | 'demostracion' | 'planes' | 'general';

@Injectable({ providedIn: 'root' })
export class DemoStore {
  readonly building = DEMO_BUILDING;
  readonly missions = DEMO_MISSIONS;
  private readonly data = buildDemoData(new Date());

  readonly today = this.data.today;
  readonly periods = this.data.periods;
  readonly units: DemoUnit[] = this.data.units;
  readonly months: DemoMonthStat[] = this.data.months;

  private readonly simulated = signal<DemoExpense[]>([]);
  private readonly done = signal<string[]>(this.readProgress());
  private readonly answers = signal<DemoDiagnosisAnswers>({});

  readonly diagnosis = this.answers.asReadonly();
  readonly diagnosisDone = computed(() => !!(this.answers().units && this.answers().method && this.answers().pain));
  readonly recommendation = computed(() => DEMO_PAIN_RECOMMENDATION[this.answers().pain ?? ''] ?? '');
  readonly completed = this.done.asReadonly();
  readonly completedCount = computed(() => this.done().length);
  readonly allDone = computed(() => this.done().length >= DEMO_MISSIONS.length);
  readonly nextMission = computed(() => DEMO_MISSIONS.find((m) => !this.done().includes(m.id)) ?? null);

  readonly expenses = computed(() => [...this.simulated(), ...this.data.expenses].sort((a, b) => b.date.localeCompare(a.date) || Number(b.simulated) - Number(a.simulated)));
  readonly expensesTotal = computed(() => this.expenses().reduce((s, e) => s + e.amount, 0));
  readonly currentPeriod = this.data.periods[this.data.periods.length - 1];

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
  readonly chart = computed(() => this.months.map((m, i) => ({ label: m.period.short, income: m.collected, expense: i === this.months.length - 1 ? this.expensesTotal() : m.expenses })));

  readonly expensesByCategory = computed(() => {
    const total = this.expensesTotal() || 1;
    const map = new Map<string, number>();
    for (const e of this.expenses()) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return [...map.entries()].map(([category, amount]) => ({ category, amount, share: Math.round((amount / total) * 100) })).sort((a, b) => b.amount - a.amount);
  });

  readonly aging = this.buildAging();

  // Libro diario del mes: liquidación, cobros y gastos (incluidos los simulados).
  readonly journal = computed<JournalEntry[]>(() => {
    const key = this.currentPeriod.key;
    const entries: Omit<JournalEntry, 'number'>[] = [];
    const monthCharges = this.data.charges.filter((c) => c.period === key && c.kind !== 'recargo');
    const ordinary = monthCharges.filter((c) => c.kind === 'ordinaria').reduce((s, c) => s + c.amount, 0);
    const extra = monthCharges.filter((c) => c.kind === 'extra').reduce((s, c) => s + c.amount, 0);
    const liqLines: JournalLine[] = [{ account: '1.3.01', name: 'Expensas a cobrar', debit: ordinary + extra, credit: 0 }, { account: '4.1.01', name: 'Ingresos por expensas ordinarias', debit: 0, credit: ordinary }];
    if (extra > 0) liqLines.push({ account: '4.1.02', name: 'Ingresos por expensas extraordinarias', debit: 0, credit: extra });
    entries.push({ id: `liq-${key}`, date: `${key}-01`, description: `Liquidación de expensas ${this.currentPeriod.label}`, kind: 'liquidacion', origin: `Liquidación del período · ${this.units.length} unidades`, link: ['/explorar/unidades'], lines: liqLines });

    for (const p of this.paymentsMonth) {
      entries.push({
        id: p.id,
        date: p.date,
        description: `Cobro de expensas · Unidad ${p.unitCode}`,
        kind: 'cobro',
        origin: `Recibo ${p.receipt} · ${p.owner} · ${p.method}`,
        link: ['/explorar/unidades', p.unitCode],
        lines: [{ account: '1.1.01', name: 'Caja y bancos', debit: p.amount, credit: 0 }, { account: '1.3.01', name: 'Expensas a cobrar', debit: 0, credit: p.amount }]
      });
    }

    for (const e of this.expenses()) {
      const account = EXPENSE_ACCOUNTS[e.category] ?? EXPENSE_ACCOUNTS['Otros'];
      const vat = hasVat(e.category) ? vatOf(e.amount) : 0;
      const lines: JournalLine[] = [{ account: account.code, name: account.name, debit: e.amount - vat, credit: 0 }];
      if (vat > 0) lines.push({ account: '1.1.05', name: 'IVA crédito fiscal', debit: vat, credit: 0 });
      lines.push({ account: '1.1.01', name: 'Caja y bancos', debit: 0, credit: e.amount });
      entries.push({ id: e.id, date: e.date, description: `${e.concept} · ${e.supplier}`, kind: 'gasto', origin: e.simulated ? 'Gasto simulado en esta demostración' : `Gasto registrado · rubro ${e.category}`, link: ['/explorar/gastos'], lines });
    }

    const order = { liquidacion: 0, cobro: 1, gasto: 2 };
    entries.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind] || a.id.localeCompare(b.id));
    return entries.map((e, i) => ({ ...e, number: JOURNAL_BASE + i + 1 })).reverse();
  });

  readonly lastMovements = computed(() => {
    const pays = this.paymentsMonth.map((p) => ({ date: p.date, text: `Cobro · Unidad ${p.unitCode} · ${p.owner}`, amount: p.amount, income: true, id: p.id }));
    const exps = this.expenses().map((e) => ({ date: e.date, text: `${e.concept} · ${e.supplier}`, amount: e.amount, income: false, id: e.id }));
    return [...pays, ...exps].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  });

  unit(code: string): DemoUnit | undefined {
    return this.units.find((u) => u.code === code);
  }

  isOverdue(c: DemoCharge): boolean {
    return c.paidOn === null && c.due < this.today;
  }

  // Estado de cuenta de una unidad: cargos y pagos con saldo acumulado (más reciente primero).
  statement(code: string): { unit: DemoUnit; rows: DemoMovement[]; pending: number; overdue: number; lastPayment: string | null } | null {
    const unit = this.unit(code);
    if (!unit) return null;
    const charges = this.data.charges.filter((c) => c.unitCode === code);
    const raw: { date: string; order: number; concept: string; charge: number; payment: number; reference: string; overdue: boolean }[] = [];
    for (const c of charges) raw.push({ date: c.date, order: 0, concept: c.concept, charge: c.amount, payment: 0, reference: '', overdue: this.isOverdue(c) });
    for (const p of this.data.payments.filter((x) => x.unitCode === code)) raw.push({ date: p.date, order: 1, concept: `Pago recibido · ${p.method}`, charge: 0, payment: p.amount, reference: p.receipt, overdue: false });
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

  addExpense(input: { concept: string; supplier: string; category: string; amount: number }): DemoExpense {
    const expense: DemoExpense = {
      id: `exp-sim-${this.simulated().length + 1}`,
      date: this.today,
      supplier: input.supplier.trim() || 'Proveedor de ejemplo',
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
    if (next.length >= DEMO_MISSIONS.length) this.track('demo_complete');
  }

  // Paso 4 del embudo: el diagnóstico de tres preguntas.
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

  // Mensaje de WhatsApp para el cierre comercial: dice qué exploró la persona, para saber qué le interesó.
  whatsappUrl(kind: DemoContactKind): string | null {
    const explored = DEMO_MISSIONS.filter((m) => this.done().includes(m.id)).map((m) => m.title.toLowerCase());
    const intro: Record<DemoContactKind, string> = {
      presupuesto: 'Hola, probé la demostración de Expenses y quiero pedir un presupuesto para mi edificio.',
      demostracion: 'Hola, probé la demostración de Expenses y quiero solicitar una demostración personalizada.',
      planes: 'Hola, probé la demostración de Expenses y quiero consultar planes y condiciones.',
      general: 'Hola, estuve explorando Expenses y quiero más información.'
    };
    const tail = explored.length ? ` En la demo exploré: ${explored.join(', ')}.` : '';
    const a = this.answers();
    const profile = this.diagnosisDone() ? ` Administro ${(a.units ?? '').toLowerCase()} unidades, hoy llevo las expensas con ${(a.method ?? '').toLowerCase()} y lo que más me preocupa es: ${(a.pain ?? '').toLowerCase()}.` : '';
    return salesWhatsAppUrlFor(intro[kind] + tail + profile);
  }

  // Medición del embudo en el navegador (ver demo-funnel.ts).
  track(event: DemoFunnelEvent, detail?: string): void {
    trackDemoEvent(event, detail);
  }

  dateLabel(isoDate: string): string {
    return fmtDate(isoDate);
  }

  private readProgress(): string[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string' && DEMO_MISSIONS.some((m) => m.id === x)) : [];
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

  private buildAging(): { label: string; units: number; amount: number }[] {
    const buckets = [
      { label: '1 mes vencido', units: 0, amount: 0 },
      { label: '2 meses vencidos', units: 0, amount: 0 },
      { label: '3 o más meses', units: 0, amount: 0 }
    ];
    for (const x of this.overdueUnits) {
      const b = buckets[Math.min(Math.max(x.months, 1), 3) - 1];
      b.units++;
      b.amount += x.amount;
    }
    return buckets;
  }
}
