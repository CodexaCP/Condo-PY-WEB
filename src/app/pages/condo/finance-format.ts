import { Pipe, PipeTransform } from '@angular/core';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingExpenseCategory, BuildingIncomeCategory, LedgerCategoryType } from '../../api/models';

const GS = new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const formatGs = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : GS.format(v));
export const formatNum = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : NUM.format(v));

// Categorías con las que los gastos y los ingresos cuentan en la liquidación (las mismas de las pantallas de gastos e ingresos).
export const EXPENSE_CATEGORY_LABELS: Record<BuildingExpenseCategory, string> = {
  Utilities: 'Servicios',
  Cleaning: 'Limpieza',
  Security: 'Seguridad',
  Maintenance: 'Mantenimiento',
  Elevator: 'Ascensor',
  Insurance: 'Seguro',
  Payroll: 'Salarios',
  Taxes: 'Impuestos',
  Administration: 'Administración',
  ReserveFund: 'Fondo de reserva',
  Extraordinary: 'Extraordinario',
  Supplies: 'Insumos',
  Ande: 'ANDE',
  Essap: 'ESSAP',
  InternetPhone: 'Internet y telefonía',
  Other: 'Otro'
};

export const INCOME_CATEGORY_LABELS: Record<BuildingIncomeCategory, string> = {
  AccumulatedBalance: 'Saldo acumulado',
  CommonAreaRental: 'Alquiler de área común',
  Interest: 'Interés',
  OperationalFund: 'Fondo operativo',
  CreditAdjustment: 'Ajuste a favor',
  ExtraordinaryContribution: 'Aporte extraordinario',
  Other: 'Otro'
};

// Las que se pueden elegir para un rubro propio: el aporte al fondo, el saldo acumulado y el fondo operativo tienen un trato
// especial en el libro (no son gastos o ingresos nuevos), así que no se ofrecen.
export const EXPENSE_CATEGORY_CHOICES: BuildingExpenseCategory[] = ['Utilities', 'Cleaning', 'Security', 'Maintenance', 'Elevator', 'Insurance', 'Payroll', 'Taxes', 'Administration', 'Extraordinary', 'Supplies', 'Ande', 'Essap', 'InternetPhone', 'Other'];
export const INCOME_CATEGORY_CHOICES: BuildingIncomeCategory[] = ['CommonAreaRental', 'Interest', 'CreditAdjustment', 'ExtraordinaryContribution', 'Other'];

// Clases del plan de cuentas (tal como se muestran).
export const LEDGER_TYPE_LABELS: Record<LedgerCategoryType, string> = {
  Asset: 'Activo',
  Liability: 'Pasivo',
  Fund: 'Patrimonio / Fondos',
  Income: 'Ingresos',
  Expense: 'Egresos'
};

// Orden de las clases (1 a 5) y las que reciben gastos o ingresos cargados.
export const LEDGER_TYPE_ORDER: LedgerCategoryType[] = ['Asset', 'Liability', 'Fund', 'Income', 'Expense'];
export const MOVEMENT_TYPES: LedgerCategoryType[] = ['Income', 'Expense'];

// Función especial que puede tener una cuenta (la misma lista del backend): cobranza de expensas o cuenta por defecto de una categoría.
// Una función de categoría fija la categoría de la liquidación de la cuenta; las de cobranza no la tienen.
export interface LedgerRoleChoice {
  key: string;
  label: string;
  type: LedgerCategoryType;
  collection: boolean;
  expenseCategory: BuildingExpenseCategory | null;
  incomeCategory: BuildingIncomeCategory | null;
}

export const LEDGER_ROLES: LedgerRoleChoice[] = [
  { key: 'Collection.Ordinary', label: 'Cobranza de expensas ordinarias', type: 'Income', collection: true, expenseCategory: null, incomeCategory: null },
  { key: 'Collection.Extraordinary', label: 'Cobranza de aportes extraordinarios', type: 'Income', collection: true, expenseCategory: null, incomeCategory: null },
  { key: 'Collection.IndividualAdjustment', label: 'Cobranza de cargos individuales y ajustes', type: 'Income', collection: true, expenseCategory: null, incomeCategory: null },
  { key: 'Collection.LateFee', label: 'Cobranza de intereses por mora', type: 'Income', collection: true, expenseCategory: null, incomeCategory: null },
  { key: 'Collection.ReserveFund', label: 'Cobranza de aportes al fondo de reserva', type: 'Income', collection: true, expenseCategory: null, incomeCategory: null },
  ...EXPENSE_CATEGORY_CHOICES.map(c => ({
    key: `Expense.${c}`, label: `Cuenta por defecto de gastos: ${EXPENSE_CATEGORY_LABELS[c]}`, type: 'Expense' as LedgerCategoryType,
    collection: false, expenseCategory: c as BuildingExpenseCategory | null, incomeCategory: null as BuildingIncomeCategory | null
  })),
  ...INCOME_CATEGORY_CHOICES.map(c => ({
    key: `Income.${c}`, label: `Cuenta por defecto de ingresos: ${INCOME_CATEGORY_LABELS[c]}`, type: 'Income' as LedgerCategoryType,
    collection: false, expenseCategory: null as BuildingExpenseCategory | null, incomeCategory: c as BuildingIncomeCategory | null
  }))
];

export const roleLabel = (key: string | null | undefined): string => LEDGER_ROLES.find(r => r.key === key)?.label ?? '';

export const monthName = (month: number): string => MONTHS[month - 1] ?? String(month);
export const monthLabel = (year: number, month: number): string => `${monthName(month)} ${year}`;
export const monthShort = (year: number, month: number): string => `${MONTHS_SHORT[month - 1] ?? month} ${String(year).slice(2)}`;

// Importe en guaranies con el simbolo: «Gs. 1.500.000».
@Pipe({ name: 'gs', standalone: true })
export class GsPipe implements PipeTransform {
  transform(value: number | null | undefined): string { return formatGs(value); }
}

// Numero con separador de miles y sin simbolo (para tablas anchas).
@Pipe({ name: 'num', standalone: true })
export class NumPipe implements PipeTransform {
  transform(value: number | null | undefined): string { return formatNum(value); }
}

export type FinanceErrorKind = 'blocked' | 'setup' | 'other';

// Clasifica un error de la API de Finanzas: modulo apagado o plan sin Finanzas (403), configuracion incompleta (409) u otro.
export function classifyFinanceError(err: unknown, fallback: string): { kind: FinanceErrorKind; message: string } {
  const body = (err as { error?: { error?: string; message?: string } })?.error;
  const code = typeof body === 'object' && body !== null ? body.error : undefined;

  if (code === 'finance_module_disabled' || code === 'finance_plan_not_included') {
    return { kind: 'blocked', message: body?.message ?? 'El módulo Finanzas del edificio no está disponible para este edificio.' };
  }

  if (code === 'finance_setup_incomplete') {
    return { kind: 'setup', message: body?.message ?? 'Completá la configuración inicial de Finanzas del edificio.' };
  }

  return { kind: 'other', message: extractApiErrorMessage(err, fallback) };
}

// Nombre del archivo de una exportación a Excel: finanzas-<tipo>-<edificio>-<período>.xlsx, sin tildes ni símbolos (el mismo criterio que usa el backend).
export function exportFileName(kind: string, buildingName: string, period: string): string {
  const slug = buildingName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `finanzas-${kind}-${slug || 'edificio'}-${period}.xlsx`;
}

// Mensaje de un error al pedir un archivo: con responseType 'blob' el cuerpo del error llega como Blob, así que se lee para mostrar el
// mensaje que mandó el backend (por ejemplo, «Completá la configuración inicial…» o «El rango no puede superar…»).
export async function exportErrorMessage(err: unknown, fallback: string): Promise<string> {
  const body = (err as { error?: unknown })?.error;
  if (body instanceof Blob) {
    try {
      const text = await body.text();
      try {
        const json = JSON.parse(text) as unknown;
        if (typeof json === 'string') return json;
        const message = (json as { message?: string; title?: string })?.message ?? (json as { title?: string })?.title;
        return message || fallback;
      } catch {
        return text || fallback;
      }
    } catch {
      return fallback;
    }
  }

  return extractApiErrorMessage(err, fallback);
}
