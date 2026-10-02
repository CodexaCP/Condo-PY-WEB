import { Pipe, PipeTransform } from '@angular/core';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingExpenseCategory, BuildingIncomeCategory } from '../../api/models';

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
