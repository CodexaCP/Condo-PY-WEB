// Datos ficticios de la demostración pública («Explora Expenses»). Nada de esto sale del servidor ni se guarda en él:
// se genera en el navegador, es el mismo para todos los visitantes y se reinicia al recargar.
// No lleva textos en ningún idioma: guarda identificadores (rubro, medio de pago, gasto fijo) y demo.i18n.ts los nombra.

import { CategoryId, ExpenseItemId, MethodId } from './demo.i18n';

export const DEMO_BUILDING = { floors: 8 };

// Saldos de apertura del mes (ficticios).
export const DEMO_OPENING_CASH = 62_400_000;
export const DEMO_RESERVE_FUND = 24_300_000;

export interface DemoPeriod {
  key: string; // aaaa-mm
  year: number;
  month: number; // 0 = enero
  index: number; // 0 = el más antiguo de los seis
}

export interface DemoUnit {
  code: string; // «3C»
  floor: number;
  owner: string;
  area: number;
  fee: number; // cuota ordinaria mensual
  profile: number; // cantidad de períodos anteriores sin pagar (0 = al día)
}

export type DemoChargeKind = 'ordinaria' | 'extra' | 'recargo';

export interface DemoCharge {
  unitCode: string;
  period: string;
  kind: DemoChargeKind;
  date: string; // emisión
  due: string; // vencimiento
  amount: number;
  paidOn: string | null;
  method: MethodId | null;
  receipt: string | null;
}

export interface DemoMovement {
  date: string;
  concept: string;
  charge: number;
  payment: number;
  balance: number;
  reference: string;
  overdue: boolean;
}

export interface DemoExpense {
  id: string;
  date: string;
  // Proveedor y concepto: los gastos fijos los nombra demo.i18n.ts según su itemId; los simulados traen lo que escribió el visitante.
  supplier: string;
  concept: string;
  itemId?: ExpenseItemId;
  category: CategoryId;
  amount: number;
  simulated: boolean;
}

export interface DemoPayment {
  id: string;
  date: string;
  unitCode: string;
  owner: string;
  amount: number;
  method: MethodId;
  receipt: string;
  period: string;
}

export interface DemoMonthStat {
  period: DemoPeriod;
  charged: number;
  collected: number;
  expenses: number;
}

export interface DemoData {
  today: string;
  periods: DemoPeriod[];
  units: DemoUnit[];
  charges: DemoCharge[];
  payments: DemoPayment[];
  expenses: DemoExpense[];
  months: DemoMonthStat[];
}

export const EXPENSE_CATEGORIES: CategoryId[] = ['utilities', 'payroll', 'security', 'maintenance', 'cleaning', 'admin', 'insurance', 'other'];

// Los sueldos no llevan IVA; el resto sí (10 %).
export const hasVat = (category: CategoryId): boolean => category !== 'payroll';
export const vatOf = (total: number): number => Math.round(total / 11);

const FIRST_NAMES = ['María', 'Carlos', 'Ana', 'Luis', 'Sofía', 'Jorge', 'Laura', 'Diego', 'Patricia', 'Andrés', 'Claudia', 'Rodrigo', 'Verónica', 'Fabián', 'Liliana', 'Gustavo', 'Natalia', 'Sergio', 'Mónica', 'Héctor'];
const LAST_NAMES = ['Benítez', 'González', 'Villalba', 'Ayala', 'Domínguez', 'Franco', 'Giménez', 'Insfrán', 'Jara', 'Maldonado', 'Núñez', 'Ortiz', 'Peralta', 'Quintana', 'Riveros', 'Sosa', 'Torres', 'Vera', 'Acosta', 'Duarte'];
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const BASE_AREAS = [62, 74, 88, 74, 105];
const FEE_PER_M2 = 11_500;
const METHODS: MethodId[] = ['transfer', 'cash', 'deposit', 'card'];

// Gastos fijos del mes: día de pago, gasto (proveedor y concepto en demo.i18n.ts), rubro e importe (con IVA incluido).
const EXPENSE_TEMPLATES: { day: number; itemId: ExpenseItemId; category: CategoryId; amount: number }[] = [
  { day: 2, itemId: 'staff', category: 'payroll', amount: 8_600_000 },
  { day: 3, itemId: 'guard', category: 'security', amount: 7_400_000 },
  { day: 5, itemId: 'power', category: 'utilities', amount: 3_850_000 },
  { day: 6, itemId: 'water', category: 'utilities', amount: 2_100_000 },
  { day: 8, itemId: 'elevator', category: 'maintenance', amount: 2_950_000 },
  { day: 9, itemId: 'supplies', category: 'cleaning', amount: 780_000 },
  { day: 10, itemId: 'adminFee', category: 'admin', amount: 3_600_000 },
  { day: 12, itemId: 'pump', category: 'maintenance', amount: 1_450_000 }
];

// Variación de los gastos de los meses anteriores respecto al mes actual (para el gráfico).
const PAST_EXPENSE_FACTORS = [0.96, 1.02, 0.99, 1.05, 0.97];

// Unidades con deuda: índice de la unidad → períodos anteriores vencidos.
const DEBT_PROFILES: Record<number, number> = { 12: 3, 5: 2, 27: 2, 3: 1, 19: 1, 31: 1, 36: 1 };

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const iso = (y: number, m: number, d: number): string => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function buildDemoData(now: Date): DemoData {
  const rand = rng(20261023);
  const ty = now.getFullYear();
  const tm = now.getMonth();
  const td = now.getDate();
  const today = iso(ty, tm, td);

  // Seis períodos: los cinco meses anteriores y el actual.
  const periods: DemoPeriod[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ty, tm - i, 1);
    periods.push({ key: iso(d.getFullYear(), d.getMonth(), 1).slice(0, 7), year: d.getFullYear(), month: d.getMonth(), index: 5 - i });
  }
  const current = periods[5];

  // Unidades: 8 pisos × 5 departamentos.
  const units: DemoUnit[] = [];
  let n = 0;
  for (let floor = 1; floor <= 8; floor++) {
    for (let l = 0; l < LETTERS.length; l++) {
      const area = BASE_AREAS[l] + (floor >= 7 ? 6 : 0);
      units.push({
        code: `${floor}${LETTERS[l]}`,
        floor,
        owner: `${FIRST_NAMES[n % 20]} ${LAST_NAMES[(n * 7 + 3) % 20]}`,
        area,
        fee: Math.round((area * FEE_PER_M2) / 1000) * 1000,
        profile: DEBT_PROFILES[n] ?? 0
      });
      n++;
    }
  }

  // Cargos y pagos de los seis períodos.
  const charges: DemoCharge[] = [];
  for (const unit of units) {
    for (const p of periods) {
      const [py, pm] = p.key.split('-').map(Number);
      const date = iso(py, pm - 1, 1);
      const due = iso(py, pm - 1, 10);
      const isCurrent = p.index === 5;
      const unpaid = unit.profile > 0 && p.index >= 5 - unit.profile;
      let paidOn: string | null = null;
      if (!unpaid) {
        const day = 2 + Math.floor(rand() * 8);
        const candidate = iso(py, pm - 1, day);
        paidOn = isCurrent && candidate > today ? null : candidate;
      }
      const method = paidOn ? METHODS[Math.floor(rand() * METHODS.length)] : null;
      const lines: { kind: DemoChargeKind; amount: number }[] = [{ kind: 'ordinaria', amount: unit.fee }];
      if (p.index === 3) lines.push({ kind: 'extra', amount: Math.round((unit.fee * 0.15) / 1000) * 1000 });
      for (const line of lines) {
        charges.push({ unitCode: unit.code, period: p.key, kind: line.kind, date, due, amount: line.amount, paidOn, method, receipt: null });
        // Recargo por mora (2 %) por cada expensa ordinaria vencida y sin pagar.
        if (line.kind === 'ordinaria' && paidOn === null && due < today) {
          const [dy, dm, dd] = due.split('-').map(Number);
          const surchargeDate = iso(dy, dm - 1, dd + 1);
          if (surchargeDate <= today) {
            charges.push({ unitCode: unit.code, period: p.key, kind: 'recargo', date: surchargeDate, due: surchargeDate, amount: Math.round((line.amount * 0.02) / 10) * 10, paidOn: null, method: null, receipt: null });
          }
        }
      }
    }
  }

  // Recibos numerados por fecha de pago.
  const paid = charges.filter((c) => c.paidOn !== null).sort((a, b) => (a.paidOn as string).localeCompare(b.paidOn as string) || a.unitCode.localeCompare(b.unitCode));
  let receiptNo = 1200;
  const receiptByKey = new Map<string, string>();
  for (const c of paid) {
    const key = `${c.unitCode}|${c.period}`;
    let r = receiptByKey.get(key);
    if (!r) {
      receiptNo++;
      r = `REC-${String(receiptNo).padStart(6, '0')}`;
      receiptByKey.set(key, r);
    }
    c.receipt = r;
  }

  // Pagos (un pago por unidad y período).
  const payments: DemoPayment[] = [];
  const ownerOf = new Map(units.map((u) => [u.code, u.owner]));
  const grouped = new Map<string, DemoPayment>();
  for (const c of paid) {
    const key = `${c.unitCode}|${c.period}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.amount += c.amount;
    } else {
      const pay: DemoPayment = { id: `pay-${key}`, date: c.paidOn as string, unitCode: c.unitCode, owner: ownerOf.get(c.unitCode) ?? '', amount: c.amount, method: c.method ?? 'transfer', receipt: c.receipt as string, period: c.period };
      grouped.set(key, pay);
      payments.push(pay);
    }
  }
  payments.sort((a, b) => a.date.localeCompare(b.date) || a.receipt.localeCompare(b.receipt));

  // Gastos del mes actual (nunca con fecha futura).
  const expenses: DemoExpense[] = EXPENSE_TEMPLATES.map((t, i) => ({
    id: `exp-${i + 1}`,
    date: iso(ty, tm, Math.min(t.day, td)),
    supplier: '',
    concept: '',
    itemId: t.itemId,
    category: t.category,
    amount: t.amount,
    simulated: false
  }));
  const monthlyExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // Resumen por mes para el gráfico y los informes.
  const months: DemoMonthStat[] = periods.map((p) => ({
    period: p,
    charged: charges.filter((c) => c.period === p.key && c.kind !== 'recargo').reduce((s, c) => s + c.amount, 0),
    collected: payments.filter((x) => x.date.slice(0, 7) === p.key).reduce((s, x) => s + x.amount, 0),
    expenses: p.index === current.index ? monthlyExpenses : Math.round((monthlyExpenses * PAST_EXPENSE_FACTORS[p.index]) / 1000) * 1000
  }));

  return { today, periods, units, charges, payments, expenses, months };
}
