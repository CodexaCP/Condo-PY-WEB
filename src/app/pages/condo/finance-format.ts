import { Pipe, PipeTransform } from '@angular/core';
import { extractApiErrorMessage } from '../../api/api-error.util';

const GS = new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const formatGs = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : GS.format(v));
export const formatNum = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : NUM.format(v));

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
