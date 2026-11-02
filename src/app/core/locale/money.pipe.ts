import { Pipe, PipeTransform } from '@angular/core';
import { formatMoney, formatMoneyNumber, moneySymbol } from './locale.state';

// Importe con el simbolo y el formato de la moneda de la empresa: «₲ 1.234.567» o «$ 1.234,56».
@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string { return formatMoney(value); }
}

// Numero con los separadores y decimales de la moneda de la empresa, sin simbolo.
@Pipe({ name: 'moneyNumber', standalone: true, pure: false })
export class MoneyNumberPipe implements PipeTransform {
  transform(value: number | null | undefined): string { return formatMoneyNumber(value); }
}

// Simbolo de la moneda de la empresa, para los rotulos de los campos: «Importe ({{ null | currencySymbol }})».
@Pipe({ name: 'currencySymbol', standalone: true, pure: false })
export class CurrencySymbolPipe implements PipeTransform {
  transform(_value?: unknown): string { return moneySymbol(); }
}
