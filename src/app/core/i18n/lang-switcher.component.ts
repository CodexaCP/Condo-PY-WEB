import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LANGS, Lang, LangService, isLang } from './lang.service';

// Selector de idioma de las pantallas públicas (login, demostración, recuperar contraseña): lista desplegable.
// La portada tiene el suyo propio porque cada idioma es una URL distinta.
@Component({
  standalone: true,
  selector: 'app-lang-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="ls">
      <span class="globe" aria-hidden="true">🌐</span>
      <select aria-label="Idioma / Language" [value]="current()" (change)="pick($any($event.target).value)">
        @for (l of langs; track l.code) {
          <option [value]="l.code" [selected]="l.code === current()" [attr.lang]="l.htmlLang">{{ l.label }}</option>
        }
      </select>
    </label>
  `,
  styles: [
    `
      :host { display: inline-block; }
      .ls { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0 0.4rem 0 0.65rem; border: 1px solid var(--ex-line, #dbe6ef); border-radius: 999px; background: #fff; }
      .globe { font-size: 0.85rem; }
      select { cursor: pointer; font: inherit; font-size: 0.82rem; font-weight: 700; padding: 0.42rem 0.3rem; border: 0; background: transparent; color: var(--ex-ink, #16324a); outline: none; }
      .ls:hover, .ls:focus-within { background: #eef6fb; }
    `
  ]
})
export class LangSwitcherComponent {
  private readonly service = inject(LangService);
  readonly langs = LANGS;
  readonly current = this.service.lang;

  pick(code: string): void {
    if (isLang(code)) this.service.choose(code as Lang);
  }
}
