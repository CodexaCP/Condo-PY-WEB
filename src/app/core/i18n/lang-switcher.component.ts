import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LANGS, Lang, LangService } from './lang.service';

// Selector de idioma de las pantallas públicas (login, demostración, recuperar contraseña): ES · PT · EN.
// La portada tiene el suyo propio porque cada idioma es una URL distinta.
@Component({
  standalone: true,
  selector: 'app-lang-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ls" role="group" aria-label="Idioma / Language">
      @for (l of langs; track l.code) {
        <button type="button" [class.on]="l.code === current()" [attr.lang]="l.htmlLang" [attr.aria-pressed]="l.code === current()" [title]="l.label" (click)="pick(l.code)">{{ l.short }}</button>
      }
    </div>
  `,
  styles: [
    `
      :host { display: inline-block; }
      .ls { display: inline-flex; border: 1px solid var(--ex-line, #dbe6ef); border-radius: 999px; overflow: hidden; background: #fff; }
      .ls button { cursor: pointer; font: inherit; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; padding: 0.38rem 0.7rem; border: 0; background: transparent; color: var(--ex-muted, #5f7b88); }
      .ls button:hover { background: #eef6fb; }
      .ls button.on { background: #1385b6; color: #fff; }
    `
  ]
})
export class LangSwitcherComponent {
  private readonly service = inject(LangService);
  readonly langs = LANGS;
  readonly current = this.service.lang;

  pick(lang: Lang): void {
    this.service.choose(lang);
  }
}
