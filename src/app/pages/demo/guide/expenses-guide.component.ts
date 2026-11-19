import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LangService } from '../../../core/i18n/lang.service';
import { trackAssistant } from '../../../core/analytics';
import { GuideFigureComponent } from './guide-figure.component';
import { GuideSceneComponent } from './guide-scene.component';
import { GUIDE_TX } from './guide.i18n';
import { GuideTopic, matchGuideTopic } from './guide.script';

// Lanzador del guía: el personaje en una esquina, un globo de invitación, el panel de preguntas y la escena animada.
@Component({
  standalone: true,
  selector: 'app-expenses-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuideFigureComponent, GuideSceneComponent, FormsModule],
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    @if (!topic()) {
      <button type="button" class="eg-fab" [class.left]="corner() === 'left'" [attr.aria-label]="tx().fabAria" [attr.aria-expanded]="panelOpen()" (click)="togglePanel()">
        <app-guide-figure [pose]="waving() ? 'wave' : 'idle'" />
      </button>
      @if (teaser() && !panelOpen()) {
        <div class="eg-teaser" [class.left]="corner() === 'left'">
          <span class="eg-teaser-text" (click)="togglePanel()">{{ tx().teaser }}</span>
          <button type="button" class="eg-teaser-x" [attr.aria-label]="tx().close" (click)="teaser.set(false)">×</button>
        </div>
      }
      @if (panelOpen()) {
        <div class="eg-panel" [class.left]="corner() === 'left'" role="dialog" [attr.aria-label]="tx().name">
          <div class="eg-head">
            <app-guide-figure class="eg-av" [bust]="true" />
            <div><b>{{ tx().name }}</b><br /><small>{{ tx().role }}</small></div>
            <button type="button" class="eg-x" [attr.aria-label]="tx().close" (click)="panelOpen.set(false)"><i class="pi pi-times"></i></button>
          </div>
          <div class="eg-msg bot">{{ tx().ask }}</div>
          <button type="button" class="eg-chip hot" (click)="start('custom-need', 'chip')"><i class="pi pi-lightbulb"></i> {{ tx().topicCustom }}</button>
          <button type="button" class="eg-chip" (click)="start('create-period', 'chip')"><i class="pi pi-calendar-plus"></i> {{ tx().topicCreatePeriod }}</button>
          <button type="button" class="eg-chip" (click)="start('clone-period', 'chip')"><i class="pi pi-copy"></i> {{ tx().topicClonePeriod }}</button>
          <button type="button" class="eg-chip" (click)="start('approve-payment', 'chip')"><i class="pi pi-wallet"></i> {{ tx().topicPayment }}</button>
          <button type="button" class="eg-chip" (click)="start('settlement-flow', 'chip')"><i class="pi pi-calculator"></i> {{ tx().topicSettlement }}</button>
          @for (m of messages(); track $index) {
            <div class="eg-msg" [class.bot]="m.from === 'bot'" [class.user]="m.from === 'user'">{{ m.text }}</div>
          }
          <form class="eg-form" (ngSubmit)="ask()">
            <input name="q" [(ngModel)]="question" [placeholder]="tx().inputPlaceholder" maxlength="160" autocomplete="off" />
            <button type="submit" [attr.aria-label]="tx().send"><i class="pi pi-send"></i></button>
          </form>
        </div>
      }
    }
    @if (topic(); as t) {
      <app-guide-scene [topic]="t" [showDemoLink]="showDemoLink()" (closed)="topic.set(null)" />
    }
  `,
  styles: [
    `
      .eg-fab { position: fixed; bottom: 12px; right: 16px; z-index: 40; width: 70px; background: none; border: 0; padding: 0; cursor: pointer; filter: drop-shadow(0 6px 10px rgba(17, 54, 74, 0.25)); transition: transform 0.2s; }
      .eg-fab.left { right: auto; left: 16px; }
      .eg-fab:hover { transform: translateY(-3px) scale(1.04); }
      .eg-teaser { position: fixed; bottom: 128px; right: 16px; z-index: 40; max-width: 220px; background: #fff; border-radius: 14px; box-shadow: 0 10px 28px rgba(17, 54, 74, 0.2); padding: 10px 30px 10px 12px; font-size: 0.85rem; color: #16324a; }
      .eg-teaser.left { right: auto; left: 16px; }
      .eg-teaser::after { content: ''; position: absolute; bottom: -8px; right: 28px; border: 8px solid transparent; border-bottom: 0; border-top-color: #fff; }
      .eg-teaser.left::after { right: auto; left: 28px; }
      .eg-teaser-text { cursor: pointer; }
      .eg-teaser-x { position: absolute; top: 4px; right: 6px; border: 0; background: none; cursor: pointer; font-size: 1.1rem; line-height: 1; color: #5f7b88; }
      .eg-panel { position: fixed; bottom: 124px; right: 16px; z-index: 41; width: 320px; max-width: calc(100vw - 32px); box-sizing: border-box; background: #fff; border-radius: 18px; box-shadow: 0 18px 48px rgba(17, 54, 74, 0.22); padding: 12px; display: flex; flex-direction: column; gap: 8px; color: #16324a; font-size: 0.88rem; max-height: calc(100vh - 150px); overflow-y: auto; }
      .eg-panel.left { right: auto; left: 16px; }
      .eg-head { display: flex; align-items: center; gap: 10px; }
      .eg-head > div { flex: 1; }
      .eg-head small { color: #5f7b88; }
      .eg-av { width: 40px; }
      .eg-x { width: 1.8rem; height: 1.8rem; border-radius: 50%; border: 0; background: #eef3f7; cursor: pointer; color: #16324a; }
      .eg-msg { max-width: 88%; padding: 8px 12px; border-radius: 14px; line-height: 1.4; }
      .eg-msg.bot { background: #f2f8fb; align-self: flex-start; }
      .eg-msg.user { background: #1385b6; color: #fff; align-self: flex-end; }
      .eg-chip { display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer; font: inherit; font-weight: 700; padding: 9px 12px; border-radius: 12px; border: 1px solid #1385b6; background: #fff; color: #1385b6; }
      .eg-chip + .eg-chip { margin-top: 6px; }
      .eg-chip:hover { background: rgba(19, 133, 182, 0.08); }
      .eg-chip.hot { background: linear-gradient(135deg, #1385b6, #1ab7af); border-color: transparent; color: #fff; }
      .eg-chip.hot:hover { filter: brightness(1.06); background: linear-gradient(135deg, #1385b6, #1ab7af); }
      .eg-form { display: flex; gap: 6px; }
      .eg-form input { flex: 1; min-width: 0; font: inherit; padding: 8px 10px; border-radius: 10px; border: 1.5px solid #dbe6ef; }
      .eg-form button { width: 2.4rem; border: 0; border-radius: 10px; background: #1ab7af; color: #fff; cursor: pointer; }
      @media (max-width: 640px) {
        .eg-fab { width: 54px; bottom: calc(10px + env(safe-area-inset-bottom)); }
        .eg-teaser { bottom: 100px; }
        .eg-panel { bottom: 96px; }
      }
    `
  ]
})
export class ExpensesGuideComponent {
  readonly corner = input<'left' | 'right'>('right');
  readonly showDemoLink = input(false);

  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);
  readonly tx = computed(() => GUIDE_TX[this.lang.lang()]);

  readonly panelOpen = signal(false);
  readonly teaser = signal(false);
  readonly topic = signal<GuideTopic | null>(null);
  readonly messages = signal<{ from: 'bot' | 'user'; text: string }[]>([]);
  readonly waving = signal(false);
  question = '';

  constructor() {
    afterNextRender(() => {
      const timers: ReturnType<typeof setTimeout>[] = [];
      let teased = false;
      try {
        teased = !!sessionStorage.getItem('expenses-guide-teased');
      } catch {
        teased = false;
      }
      if (!teased) {
        timers.push(setTimeout(() => {
          this.teaser.set(true);
          try {
            sessionStorage.setItem('expenses-guide-teased', '1');
          } catch {
            // sin almacenamiento: el globo puede repetirse, no es grave
          }
          timers.push(setTimeout(() => this.teaser.set(false), 9000));
        }, 3500));
      }

      let reduced = false;
      try {
        reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch {
        reduced = false;
      }
      let interval: ReturnType<typeof setInterval> | undefined;
      if (!reduced) {
        interval = setInterval(() => {
          if (this.panelOpen() || this.topic()) return;
          this.waving.set(true);
          timers.push(setTimeout(() => this.waving.set(false), 1600));
        }, 9000);
      }
      this.destroyRef.onDestroy(() => {
        timers.forEach((t) => clearTimeout(t));
        if (interval) clearInterval(interval);
      });
    });
  }

  togglePanel(): void {
    this.panelOpen.update((v) => !v);
    if (this.panelOpen()) {
      this.teaser.set(false);
      trackAssistant('assistant_open', { placement: this.placement() });
    }
  }

  private placement(): 'landing' | 'demo' {
    return this.showDemoLink() ? 'landing' : 'demo';
  }

  start(t: GuideTopic, source: 'chip' | 'texto'): void {
    trackAssistant('assistant_question', { placement: this.placement(), topic: t, source });
    this.panelOpen.set(false);
    this.topic.set(t);
  }

  // Responde a la pregunta escrita: abre la escena si la reconoce, si no avisa qué sabe mostrar.
  ask(): void {
    const q = this.question.trim();
    if (!q) return;
    this.messages.update((m) => [...m, { from: 'user', text: q }]);
    this.question = '';
    const m = matchGuideTopic(q);
    if (m) this.start(m, 'texto');
    else {
      trackAssistant('assistant_question', { placement: this.placement(), topic: 'sin-reconocer', source: 'texto' });
      this.messages.update((list) => [...list, { from: 'bot', text: this.tx().unknown }]);
    }
  }

  onEscape(): void {
    if (this.panelOpen()) this.panelOpen.set(false);
  }
}
