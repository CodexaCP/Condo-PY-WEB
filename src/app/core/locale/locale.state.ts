import { signal } from '@angular/core';
import { CapabilityName, CompanyLocale, CountryDocumentType, DEFAULT_LOCALE } from './locale.models';

// Configuracion regional de la sesion. Es un signal de modulo (no un servicio) para que las funciones de formato se puedan usar
// desde cualquier metodo de un componente sin inyeccion. La fija AuthService al iniciar o restaurar la sesion.
const state = signal<CompanyLocale>(DEFAULT_LOCALE);

export const currentLocale = state.asReadonly();

export function setCurrentLocale(locale: CompanyLocale | null | undefined): void {
  state.set(locale ? { ...DEFAULT_LOCALE, ...locale } : DEFAULT_LOCALE);
}

// Simbolo con el que se escribe la moneda: el guarani sigue con «₲» como siempre; las demas monedas con el suyo.
export function moneySymbol(): string {
  const l = state();
  return l.currencyCode === 'PYG' ? '₲' : l.currencySymbol;
}

// Prefijo para los campos numericos de importe («₲ », «$ »).
export function moneyPrefix(): string {
  return moneySymbol() + ' ';
}

export function moneyDecimals(): number {
  return state().currencyDecimals;
}

// Numero con los separadores y decimales de la moneda de la empresa, sin simbolo: «1.234.567» o «1.234,56».
export function formatMoneyNumber(value: number | null | undefined): string {
  const l = state();
  const n = Number(value ?? 0);
  const abs = Math.abs(n).toFixed(l.currencyDecimals);
  const [integer, fraction] = abs.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, l.groupSeparator);
  const sign = n < 0 && Number(abs) !== 0 ? '-' : '';
  return sign + grouped + (fraction ? l.decimalSeparator + fraction : '');
}

// Importe con simbolo: «₲ 1.234.567» (Paraguay) o «$ 1.234,56». Con useCurrencySymbol=true usa el simbolo del backend («Gs. 1.234.567»).
export function formatMoney(value: number | null | undefined, useCurrencySymbol = false): string {
  const symbol = useCurrencySymbol ? state().currencySymbol : moneySymbol();
  return `${symbol} ${formatMoneyNumber(value)}`;
}

// Palabra del glosario del pais («Porcentual» en lugar de «Coeficiente»); si el pais no la define se usa la de siempre.
export function term(key: string, fallback: string): string {
  return state().glossary[key] ?? fallback;
}

export function hasCapability(name: CapabilityName): boolean {
  return state().capabilities[name];
}

export function documentTypesFor(current?: string | null): CountryDocumentType[] {
  // «Documento extranjero» se ofrece siempre (ya existia en los formularios); un valor guardado que ya no esta en la lista del pais
  // tambien se conserva como opcion para no perderlo al editar.
  const list = [...state().documentTypes];
  if (!list.some((t) => t.code === 'DocumentoExtranjero')) list.push({ code: 'DocumentoExtranjero', label: 'Documento extranjero', isTaxId: false });
  if (current && !list.some((t) => t.code === current)) list.push({ code: current, label: current, isTaxId: false });
  return list;
}

// Plural simple de una palabra o frase del glosario: «Unidad funcional» -> «Unidades funcionales», «Inmueble» -> «Inmuebles».
export function pluralTerm(key: string, fallback: string): string {
  return term(key, fallback)
    .split(' ')
    .map((w) => (w.length > 3 ? (/[aeiou]$/i.test(w) ? w + 's' : w + 'es') : w))
    .join(' ');
}
