import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type Lang = 'es' | 'pt' | 'en';

export const LANGS: { code: Lang; label: string; short: string; htmlLang: string; ogLocale: string; locale: string }[] = [
  { code: 'es', label: 'Español', short: 'ES', htmlLang: 'es', ogLocale: 'es_PY', locale: 'es-PY' },
  { code: 'pt', label: 'Português', short: 'PT', htmlLang: 'pt', ogLocale: 'pt_BR', locale: 'pt-BR' },
  { code: 'en', label: 'English', short: 'EN', htmlLang: 'en', ogLocale: 'en_US', locale: 'en-US' }
];

const CHOSEN_KEY = 'expenses-lang';
const SESSION_KEY = 'expenses-lang-session';

export const isLang = (v: unknown): v is Lang => v === 'es' || v === 'pt' || v === 'en';

// Un texto por idioma. Cada pantalla pública define uno y el compilador exige que estén los tres completos.
export type Dict<T> = Record<Lang, T>;

// Idioma de las pantallas públicas (portada, login, demostración, recuperar contraseña).
// Orden de preferencia: lo que la persona eligió con el selector → el idioma de la portada por la que entró en esta
// pestaña → el idioma del navegador (si es español, portugués o inglés) → español.
@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly doc = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly lang = signal<Lang>(this.initial());

  // Lo que la persona eligió con el selector, si alguna vez eligió (la portada no la redirige si no eligió nada, por el buscador).
  chosen(): Lang | null {
    if (!this.browser) return null;
    const v = this.read('local', CHOSEN_KEY);
    return isLang(v) ? v : null;
  }

  // Idioma preferido del navegador entre los tres que hay, o null si no es ninguno.
  browserLang(): Lang | null {
    if (!this.browser) return null;
    const list = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of list) {
      const code = (l ?? '').slice(0, 2).toLowerCase();
      if (isLang(code)) return code;
    }
    return null;
  }

  // La persona elige un idioma con el selector: se recuerda para las próximas visitas.
  choose(lang: Lang): void {
    this.lang.set(lang);
    this.write('local', CHOSEN_KEY, lang);
    this.write('session', SESSION_KEY, lang);
    this.applyHtmlLang();
  }

  // Una portada con idioma propio (/pt/, /en/) lo fija para el resto de la visita sin recordarlo como elección.
  follow(lang: Lang): void {
    this.lang.set(lang);
    this.write('session', SESSION_KEY, lang);
  }

  // Atributo lang del <html> para lectores de pantalla y buscadores.
  applyHtmlLang(): void {
    const info = LANGS.find((l) => l.code === this.lang());
    if (info) this.doc.documentElement.setAttribute('lang', info.htmlLang);
  }

  private initial(): Lang {
    if (!this.browser) return 'es';
    const session = this.read('session', SESSION_KEY);
    if (isLang(session)) return session;
    return this.chosen() ?? this.browserLang() ?? 'es';
  }

  private read(store: 'local' | 'session', key: string): string | null {
    try {
      return (store === 'local' ? localStorage : sessionStorage).getItem(key);
    } catch {
      return null;
    }
  }

  private write(store: 'local' | 'session', key: string, value: string): void {
    if (!this.browser) return;
    try {
      (store === 'local' ? localStorage : sessionStorage).setItem(key, value);
    } catch {
      // Sin almacenamiento: el idioma dura mientras la página siga abierta.
    }
  }
}
