import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { salesWhatsAppUrlFor } from '../../../config/sales.config';
import { trackWhatsAppClick } from '../../../core/analytics';
import { LOGIN_TX } from '../../auth/login.i18n';
import { GuideFigureComponent } from './guide-figure.component';
import { GuideScreenComponent } from './guide-screen.component';
import { GUIDE_TX } from './guide.i18n';
import { GUIDE_ICONS, GUIDE_INITIAL_UI, GUIDE_TONES, GuideField, GuidePose, GuideStep, GuideTopic, GuideUiState, STEPS_BY_TOPIC } from './guide.script';

const CANCEL = Symbol('cancel');

const emptyFields = (): Record<GuideField, string> => ({ url: '', user: '', pass: '', building: '', year: '', month: '', name: '', start: '', end: '', due: '', amount: '', payAmount: '' });

interface GuideCursor { x: number; y: number; visible: boolean; clicking: boolean; }

// Escena del guía: un personaje camina, se sienta frente a una PC y recorre paso a paso la web simulada, con un globo de texto por paso.
@Component({
  standalone: true,
  selector: 'app-guide-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuideFigureComponent, GuideScreenComponent, RouterLink, NgTemplateOutlet],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="gs-overlay" (click)="close()">
      <div class="gs-modal" role="dialog" aria-modal="true" aria-labelledby="gs-title" (click)="$event.stopPropagation()">
        <div class="gs-head">
          <h2 id="gs-title">{{ title() }}</h2>
          <button type="button" #closeBtn class="gs-x" (click)="close()" [attr.aria-label]="tx().close"><i class="pi pi-times"></i></button>
        </div>
        <ng-template #bubbleTpl let-flow="flow">
          @for (s of [step()]; track index()) {
            <div class="gs-bub" [class.flow]="flow" aria-live="polite">
              <span class="gs-ico" [style.background]="toneOf(s, index())"><i class="pi" [class]="'pi ' + iconOf(s)"></i></span>
              <div class="gs-bt">
                <b [class.long]="splitSay(tx().say[s.say]).title.length > 90" [innerHTML]="rich(splitSay(tx().say[s.say]).title)"></b>
                @if (splitSay(tx().say[s.say]).sub) { <span [innerHTML]="rich(splitSay(tx().say[s.say]).sub)"></span> }
              </div>
            </div>
          }
        </ng-template>
        <div class="gs-split" [class.talk]="talkMode()">
        <div class="gs-left">
        @if (!talkMode()) {
        <ng-container [ngTemplateOutlet]="bubbleTpl" [ngTemplateOutletContext]="{ flow: true }" />
        <div class="gs-stage" #stage>
          <div class="gs-world" [style.transform]="worldTransform()">
            <div class="gs-wall"></div>
            <div class="gs-floor"></div>
            <div class="gs-window"><i style="left:14px;width:30px;height:70px"></i><i style="left:54px;width:40px;height:95px"></i><i style="left:104px;width:34px;height:60px"></i></div>
            <div class="gs-pot"></div>
            <div class="gs-leaf" style="left:32px;top:352px"></div><div class="gs-leaf" style="left:46px;top:344px"></div><div class="gs-leaf" style="left:56px;top:354px"></div>
            <div class="gs-chair-back"></div>
            <div class="gs-fig" [class.snap]="snap()" [style.left.px]="figX()" [style.top.px]="sitting() ? 270 : 230">
              <app-guide-figure [pose]="figPose()" [sitting]="sitting()" [talking]="talking()" />
            </div>
            <div class="gs-seat"></div><div class="gs-chair-leg"></div><div class="gs-chair-base"></div>
            <div class="gs-monitor"></div>
            <div class="gs-display">
              <div class="gs-screen-scale">
                <app-guide-screen [ui]="ui()" [fields]="fields()" [typing]="typing()" [highlight]="highlight()" [cursor]="cursor()" [tx]="tx()" [login]="loginTx()" />
              </div>
            </div>
            <div class="gs-stand"></div>
            <div class="gs-desk-top"></div><div class="gs-desk-front"></div><div class="gs-keyboard"></div>
          </div>
          @if (shot() === 'screen') {
            <div class="gs-pip"><app-guide-figure [bust]="true" [pose]="'point'" [talking]="talking()" /></div>
          }
        </div>
        } @else {
          <div class="gs-tstage">
            <ng-container [ngTemplateOutlet]="bubbleTpl" [ngTemplateOutletContext]="{ flow: false }" />
            @if (talking()) { <span class="gs-spark a"></span><span class="gs-spark b"></span> }
            <div class="gs-tfig"><app-guide-figure [pose]="figPose()" [talking]="talking()" /></div>
            <div class="gs-tfloor"></div>
          </div>
        }
        </div>
          <div class="gs-chat"><div class="gs-chat-in">
            <div class="gs-chat-head"><span class="gs-chat-ic"><i class="pi pi-comments"></i></span><div><b>{{ tx().chatName }}</b><small><i class="dot"></i>{{ tx().chatOnline }}</small></div></div>
            <div class="gs-chat-list" #chatList>
              @for (m of chat(); track $index) {
                <div class="cm" [class.g]="$index % 2 === 0">
                  <span class="gs-ico sm" [style.background]="m.tone"><i class="pi" [class]="'pi ' + m.icon"></i></span>
                  <span class="ct" [innerHTML]="rich(tx().say[m.say])"></span>
                  <span class="cmeta">{{ m.time }} <span class="ticks">✓✓</span></span>
                </div>
              }
            </div>
            @if (finished() && talkMode()) {
              <div class="gs-quick">
                @if (waUrl(); as u) { <a class="gs-primary wa" [href]="u" target="_blank" rel="noopener noreferrer" (click)="trackContact()"><i class="pi pi-whatsapp"></i> {{ tx().customYes }}</a> }
                <button type="button" class="gs-line" (click)="close()">{{ tx().customNo }}</button>
              </div>
            }
            <div class="gs-chat-input" aria-hidden="true"><i class="pi pi-lightbulb"></i><span>{{ tx().chatInput }}</span><i class="pi pi-send"></i></div>
          </div></div>
        </div>
        <div class="gs-controls">
          <span>{{ tx().stepOf(index() + 1, steps().length) }}</span>
          <div class="gs-btns">
            <button type="button" class="gs-line" (click)="goPrev()" [disabled]="index() === 0"><i class="pi pi-chevron-left"></i> {{ tx().prev }}</button>
            @if (!finished()) {
              <button type="button" class="gs-line" (click)="togglePlay()"><i class="pi" [class.pi-pause]="playing()" [class.pi-play]="!playing()"></i> {{ playing() ? tx().pause : tx().play }}</button>
            }
            <button type="button" class="gs-line" (click)="goNext()" [disabled]="index() === steps().length - 1">{{ tx().next }} <i class="pi pi-chevron-right"></i></button>
            <button type="button" class="gs-line" (click)="replay()"><i class="pi pi-refresh"></i> {{ tx().replay }}</button>
            @if (showDemoLink() && finished() && !talkMode()) {
              <a routerLink="/explorar" class="gs-primary">{{ tx().tryDemo }}</a>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: contents; }
      .gs-overlay { position: fixed; inset: 0; z-index: 1100; background: rgba(12, 30, 46, 0.6); display: flex; align-items: center; justify-content: center; padding: 12px; }
      .gs-modal { width: min(1240px, 100%); max-height: 96vh; overflow: auto; background: #fff; border-radius: 18px; padding: 14px; box-sizing: border-box; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3); color: #16324a; }
      .gs-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
      .gs-head h2 { margin: 0; font-size: 18px; font-weight: 800; }
      .gs-x { width: 2rem; height: 2rem; border-radius: 50%; border: 0; background: #eef3f7; cursor: pointer; color: #16324a; }
      .gs-stage { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 14px; background: #eaf4fa; }
      .gs-world { position: absolute; left: 0; top: 0; width: 960px; height: 540px; transform-origin: 0 0; transition: transform 0.9s ease-in-out; }
      .gs-world > div { position: absolute; }
      .gs-wall { inset: 0; background: linear-gradient(#eef6fb, #e2eef6); }
      .gs-floor { left: 0; top: 430px; width: 960px; height: 110px; background: #cfdde7; }
      .gs-window { left: 40px; top: 50px; width: 170px; height: 130px; border: 6px solid #fff; border-radius: 6px; background: linear-gradient(#bfe3f5, #e8f6fd); box-sizing: border-box; overflow: hidden; }
      .gs-window i { position: absolute; bottom: 0; background: #9cc7dc; }
      .gs-pot { left: 30px; top: 372px; width: 44px; height: 58px; border-radius: 0 0 10px 10px; background: #1ab7af; }
      .gs-leaf { width: 24px; height: 24px; border-radius: 50%; background: #6ac64a; }
      .gs-chair-back { left: 160px; top: 250px; width: 130px; height: 150px; border-radius: 18px; background: #2b3d5a; z-index: 1; }
      .gs-fig { width: 120px; z-index: 2; transition: left 1.8s linear, top 0.4s ease; }
      .gs-fig.snap { transition: none; }
      .gs-fig app-guide-figure { width: 100%; }
      .gs-seat { left: 175px; top: 380px; width: 150px; height: 22px; border-radius: 8px; background: #24344d; z-index: 3; }
      .gs-chair-leg { left: 243px; top: 402px; width: 14px; height: 30px; background: #24344d; z-index: 3; }
      .gs-chair-base { left: 200px; top: 428px; width: 100px; height: 6px; border-radius: 3px; background: #24344d; z-index: 3; }
      .gs-monitor { left: 292px; top: 32px; width: 656px; height: 376px; border-radius: 14px; background: #1d2733; z-index: 1; }
      .gs-display { left: 300px; top: 40px; width: 640px; height: 360px; overflow: hidden; border-radius: 6px; z-index: 1; }
      .gs-screen-scale { width: 960px; height: 540px; transform: scale(0.6667); transform-origin: 0 0; }
      .gs-stand { left: 590px; top: 404px; width: 60px; height: 10px; background: #2a3442; }
      .gs-desk-top { left: 260px; top: 412px; width: 690px; height: 16px; border-radius: 6px; background: #c58f5e; z-index: 4; }
      .gs-desk-front { left: 270px; top: 428px; width: 670px; height: 112px; background: #b07d4f; z-index: 4; }
      .gs-keyboard { left: 330px; top: 402px; width: 160px; height: 10px; border-radius: 3px; background: #e7edf2; z-index: 4; }
      .gs-pip { position: absolute; left: 12px; bottom: 12px; width: 92px; height: 92px; border-radius: 50%; background: #fff; border: 3px solid #1ab7af; overflow: hidden; box-shadow: 0 6px 16px rgba(17, 54, 74, 0.25); box-sizing: border-box; display: flex; justify-content: center; }
      .gs-pip app-guide-figure { width: 78px; margin-top: 6px; }
      .gs-controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #5f7b88; }
      .gs-btns { display: flex; flex-wrap: wrap; gap: 8px; }
      .gs-primary, .gs-line { display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; cursor: pointer; font: inherit; font-size: 0.85rem; font-weight: 700; padding: 0.5rem 0.9rem; border-radius: 0.6rem; border: 1px solid transparent; text-decoration: none; }
      .gs-primary { background: #1ab7af; color: #fff; }
      .gs-primary:hover { background: #14a29b; }
      .gs-line { background: #fff; color: #1385b6; border-color: #1385b6; }
      .gs-line:hover:not(:disabled) { background: rgba(19, 133, 182, 0.08); }
      .gs-line:disabled { opacity: 0.45; cursor: default; }
      .gs-split { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 14px; }
      .gs-split.talk { grid-template-columns: 1.55fr 1fr; }
      .gs-left { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
      .gs-tstage { position: relative; aspect-ratio: 1.22 / 1; min-height: 340px; border-radius: 16px; overflow: hidden; background: radial-gradient(120% 90% at 30% 20%, #f7fbff 0%, #e4effc 70%, #dbe8f9 100%); }
      .gs-tfig { position: absolute; left: 71%; bottom: 6%; transform: translateX(-50%); width: min(42%, 300px); z-index: 2; animation: tfigIn 0.6s ease-out; }
      .gs-tfig app-guide-figure { width: 100%; }
      .gs-tfloor { position: absolute; left: 71%; bottom: 3%; width: 52%; height: 7%; transform: translateX(-50%); border-radius: 50%; background: radial-gradient(closest-side, rgba(120, 150, 205, 0.45), rgba(120, 150, 205, 0)); }
      @keyframes tfigIn { from { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.96); } to { opacity: 1; transform: translateX(-50%); } }
      .gs-bub { position: absolute; left: 3%; top: 6%; width: 47%; z-index: 3; box-sizing: border-box; display: flex; gap: 14px; align-items: center; background: #fff; border-radius: 34px; padding: 18px 22px; box-shadow: 0 16px 36px rgba(37, 99, 180, 0.18); animation: bubIn 0.35s ease-out; }
      .gs-bub::after { content: ''; position: absolute; right: -13px; bottom: 28px; width: 26px; height: 26px; background: #fff; transform: skewX(-28deg) rotate(45deg); border-radius: 0 0 6px 0; box-shadow: 4px 4px 8px rgba(37, 99, 180, 0.08); }
      .gs-bub.flow { position: relative; left: auto; top: auto; width: 100%; min-height: 84px; padding: 14px 20px; border-radius: 30px; border: 1px solid #e3ecf8; box-shadow: 0 10px 26px rgba(37, 99, 180, 0.14); animation: bubIn 0.35s ease-out; }
      .gs-bub.flow::after { right: auto; left: 64px; bottom: -12px; width: 22px; height: 22px; transform: rotate(45deg); border-radius: 0 0 6px 0; background: #fff; border-right: 1px solid #e3ecf8; border-bottom: 1px solid #e3ecf8; box-shadow: 4px 4px 8px rgba(37, 99, 180, 0.08); }
      .gs-bub.flow .gs-ico { width: 48px; height: 48px; font-size: 22px; }
      .gs-bub.flow .gs-bt b { font-size: clamp(16px, 1.7vw, 21px); }
      .gs-bub.flow .gs-bt b.long { font-size: clamp(15px, 1.5vw, 18px); }
      @keyframes bubIn { from { opacity: 0; transform: scale(0.92) translateY(6px); } to { opacity: 1; transform: none; } }
      .gs-ico { flex: none; width: 56px; height: 56px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 26px; }
      .gs-ico.sm { width: 38px; height: 38px; font-size: 17px; }
      .gs-bt { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .gs-bt b { font-size: clamp(16px, 1.7vw, 22px); line-height: 1.2; font-weight: 800; color: #16324a; }
      .gs-bt b.long { font-size: clamp(14px, 1.35vw, 17px); line-height: 1.35; font-weight: 700; }
      .gs-bt span { font-size: clamp(13px, 1.3vw, 16px); line-height: 1.35; color: #3b4a5c; }
      :host ::ng-deep .gs-bt strong, :host ::ng-deep .gs-chat strong { color: #1385b6; }
      .gs-spark { position: absolute; z-index: 3; width: 4px; height: 26px; border-radius: 3px; background: #1385b6; left: 60%; top: 5%; transform: rotate(-35deg); animation: spark 0.5s ease-in-out infinite alternate; }
      .gs-spark.b { left: 65%; top: 4%; height: 18px; transform: rotate(-12deg); }
      @keyframes spark { from { opacity: 0.25; } to { opacity: 1; } }
      .gs-chat { position: relative; min-height: 300px; }
      .gs-chat-in { position: absolute; inset: 0; display: flex; flex-direction: column; background: #fff; border-radius: 22px; box-shadow: 0 10px 30px rgba(17, 54, 74, 0.14); overflow: hidden; border: 1px solid #e3ecf5; }
      .gs-chat-head { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #1d3166; color: #fff; }
      .gs-chat-head small { display: flex; align-items: center; gap: 5px; font-size: 11px; opacity: 0.85; }
      .gs-chat-head .dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; display: inline-block; }
      .gs-chat-ic { width: 34px; height: 34px; border-radius: 50%; background: rgba(255, 255, 255, 0.16); display: inline-flex; align-items: center; justify-content: center; }
      .gs-chat-list { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; background: #f7fafd; }
      .cm { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px 22px; border-radius: 16px; background: #fff; border: 1px solid #e6eef6; box-shadow: 0 3px 10px rgba(17, 54, 74, 0.06); animation: cmIn 0.35s ease-out; font-size: 13px; line-height: 1.4; color: #16324a; }
      .cm.g { background: #e3f4d3; border-color: #cfe8bb; }
      .cm .ct { flex: 1; min-width: 0; }
      .cm .cmeta { position: absolute; right: 12px; bottom: 5px; font-size: 10px; color: #6b7f8f; }
      .cm .ticks { color: #1385b6; letter-spacing: -2px; margin-left: 2px; }
      @keyframes cmIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      .gs-quick { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 4px; background: #f7fafd; }
      .gs-quick .gs-primary.wa { background: #25d366; }
      .gs-quick .gs-primary.wa:hover { background: #1fb858; }
      .gs-chat-input { display: flex; align-items: center; gap: 10px; margin: 8px 12px 12px; padding: 10px 14px; border-radius: 999px; background: #fff; border: 1px solid #e3ecf5; box-shadow: 0 6px 16px rgba(17, 54, 74, 0.08); color: #8aa0b0; font-size: 13px; }
      .gs-chat-input span { flex: 1; }
      .gs-chat-input .pi-lightbulb { color: #f59e0b; }
      .gs-chat-input .pi-send { color: #1385b6; font-size: 18px; }
      @media (max-width: 860px) {
        .gs-split, .gs-split.talk { grid-template-columns: 1fr; }
        .gs-chat { height: 300px; }
        .gs-tstage { aspect-ratio: 4 / 5; min-height: 340px; }
        .gs-bub { width: 94%; left: 3%; padding: 12px 14px; }
        .gs-bub.flow { width: 100%; left: auto; }
        .gs-bub:not(.flow)::after { display: none; }
        .gs-tfig { left: 68%; width: 44%; bottom: 3%; }
        .gs-tfloor { left: 68%; }
        .gs-spark { display: none; }
      }
      @media (prefers-reduced-motion: reduce) { .gs-tfig, .gs-bub, .cm, .gs-spark { animation: none !important; } }
      @media (max-width: 640px) {
        .gs-modal { padding: 10px; border-radius: 14px; }
        .gs-pip { width: 64px; height: 64px; }
        .gs-pip app-guide-figure { width: 54px; margin-top: 4px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .gs-world, .gs-fig { transition: none !important; }
      }
    `
  ]
})
export class GuideSceneComponent {
  readonly topic = input.required<GuideTopic>();
  readonly showDemoLink = input(false);
  readonly closed = output<void>();

  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);
  readonly tx = computed(() => GUIDE_TX[this.lang.lang()]);
  readonly loginTx = computed(() => LOGIN_TX[this.lang.lang()]);
  readonly steps = computed(() => STEPS_BY_TOPIC[this.topic()]);
  readonly title = computed(() => (this.topic() === 'clone-period' ? this.tx().sceneTitleClone : this.topic() === 'custom-need' ? this.tx().sceneTitleCustom : this.topic() === 'approve-payment' ? this.tx().sceneTitlePayment : this.tx().sceneTitle));
  readonly talkMode = computed(() => this.topic() === 'custom-need'); // primer plano sin PC
  readonly snap = signal(false); // coloca al personaje sin deslizarlo
  readonly waUrl = computed(() => salesWhatsAppUrlFor(this.tx().customWa));

  readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  readonly closeBtn = viewChild.required<ElementRef<HTMLButtonElement>>('closeBtn');
  readonly screen = viewChild(GuideScreenComponent);

  readonly index = signal(0);
  readonly ui = signal<GuideUiState>(GUIDE_INITIAL_UI);
  readonly fields = signal<Record<GuideField, string>>(emptyFields());
  readonly typing = signal<GuideField | null>(null);
  readonly highlight = signal<string | null>(null);
  readonly cursor = signal<GuideCursor>({ x: 480, y: 300, visible: false, clicking: false });
  readonly figX = signal(-140);
  readonly figPose = signal<GuidePose>('idle');
  readonly sitting = signal(false);
  readonly shot = signal<'wide' | 'screen'>('wide');
  readonly talking = signal(false);
  readonly playing = signal(true);
  readonly finished = signal(false);
  readonly step = computed(() => this.steps()[this.index()]);
  private readonly k = signal(1);

  private chatTimes: string[] = []; // hora en que apareció cada mensaje
  readonly shown = signal(0); // cuántas ideas están visibles en el chat
  readonly chat = computed(() => this.steps().slice(0, this.shown()).map((s, i) => ({ say: s.say, icon: this.iconOf(s), tone: this.toneOf(s, i), time: this.chatTimes[i] ?? '' })));
  readonly chatList = viewChild<ElementRef<HTMLElement>>('chatList');

  // La cámara se acerca al monitor (plano «screen») o muestra toda la habitación (plano «wide»).
  readonly worldTransform = computed(() => {
    const k = this.k();
    return this.shot() === 'screen' ? `scale(${k}) translate(-450px, -60px) scale(1.5)` : `scale(${k})`;
  });

  private run = 0;
  private reduced = false;

  constructor() {
    try {
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      this.reduced = false;
    }
    afterNextRender(() => {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      this.destroyRef.onDestroy(() => {
        document.body.style.overflow = prevOverflow;
      });
      const stage = this.stage()?.nativeElement;
      if (stage) {
        this.k.set(stage.clientWidth / 960);
        const ro = new ResizeObserver(() => this.k.set(stage.clientWidth / 960));
        ro.observe(stage);
        this.destroyRef.onDestroy(() => ro.disconnect());
      }
      this.closeBtn().nativeElement.focus();
      void this.playFrom(0);
    });
    this.destroyRef.onDestroy(() => this.run++);
    // Auto-scroll del chat al aparecer una idea nueva.
    effect(() => {
      this.shown();
      setTimeout(() => {
        const el = this.chatList()?.nativeElement;
        el?.scrollTo({ top: el.scrollHeight, behavior: this.reduced ? 'auto' : 'smooth' });
      }, 60);
    });
  }

  private hhmm(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // Espera ms; si mientras tanto se pausó/cambió de paso/cerró, corta la secuencia.
  private async wait(ms: number, token: number): Promise<void> {
    await new Promise<void>((r) => setTimeout(r, ms));
    if (token !== this.run) throw CANCEL;
  }

  // Dos cuadros de animación, para que Angular pinte antes de medir el DOM.
  private frame(): Promise<void> {
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  }

  // Lleva el cursor al elemento del guion (si está en pantalla) y lo resalta.
  private moveTo(target: string): void {
    const p = this.screen()?.pointOf(target);
    if (p) this.cursor.update((c) => ({ ...c, x: p.x, y: p.y }));
    this.highlight.set(target);
  }

  // Reproduce un paso completo: texto, caminata, cámara, acciones del cursor y tiempo de lectura.
  private async playStep(i: number, token: number): Promise<void> {
    const s = this.steps()[i];
    const text = this.tx().say[s.say];
    this.index.set(i);
    if (!this.chatTimes[i]) this.chatTimes[i] = this.hhmm();
    this.shown.set(i + 1);
    this.finished.set(false);
    this.highlight.set(null);
    this.typing.set(null);
    this.ui.set({ ...s.ui });
    const shotChanged = this.shot() !== s.shot;
    this.shot.set(s.shot);
    this.sitting.set(s.sitting);

    // Habla un rato (la boca se mueve) y calla, sin cortar la secuencia si se cancela.
    this.talking.set(true);
    setTimeout(() => {
      if (token === this.run) this.talking.set(false);
    }, s.hold ? Math.min(s.hold - 1500, text.length * 55) : Math.min(3200, text.length * 45));

    if (s.instant && this.figX() !== s.figureX) {
      this.snap.set(true);
      this.figX.set(s.figureX);
      await this.frame();
      this.snap.set(false);
    } else if (this.figX() !== s.figureX) {
      this.figPose.set('walk');
      this.figX.set(s.figureX);
      await this.wait(this.reduced ? 0 : 1850, token);
    }
    this.figPose.set(s.pose);

    if (shotChanged) await this.wait(this.reduced ? 0 : 950, token);

    if (s.actions.length) {
      this.cursor.update((c) => ({ ...c, visible: true }));
      for (const a of s.actions) {
        await this.frame();
        if (token !== this.run) throw CANCEL;
        if (a.kind === 'move') {
          this.moveTo(a.target);
          await this.wait(this.reduced ? 0 : 700, token);
        } else if (a.kind === 'click') {
          this.moveTo(a.target);
          await this.wait(this.reduced ? 0 : 700, token);
          this.cursor.update((c) => ({ ...c, clicking: true }));
          await this.wait(180, token);
          this.cursor.update((c) => ({ ...c, clicking: false }));
          if (a.then) this.ui.update((u) => ({ ...u, ...a.then }));
          this.highlight.set(null);
          await this.wait(350, token);
        } else if (a.kind === 'type') {
          this.moveTo(a.target);
          await this.wait(this.reduced ? 0 : 700, token);
          this.typing.set(a.field);
          const full = this.tx().values[a.field];
          if (this.reduced) {
            this.fields.update((f) => ({ ...f, [a.field]: full }));
          } else {
            for (let n = 1; n <= full.length; n++) {
              this.fields.update((f) => ({ ...f, [a.field]: full.slice(0, n) }));
              await this.wait(65, token);
            }
          }
          this.typing.set(null);
          this.highlight.set(null);
          await this.wait(250, token);
        } else {
          await this.wait(a.ms, token);
        }
      }
    } else {
      this.cursor.update((c) => ({ ...c, visible: false }));
    }

    await this.wait(s.hold ?? Math.max(1600, text.length * 38), token);
  }

  // Reproduce desde el paso i hasta el final.
  private async playFrom(i: number): Promise<void> {
    const token = ++this.run;
    this.playing.set(true);
    try {
      for (let j = i; j < this.steps().length; j++) {
        await this.playStep(j, token);
      }
      this.playing.set(false);
      this.finished.set(true);
    } catch (e) {
      if (e !== CANCEL) throw e;
    }
  }

  // Deja el estado instantáneo, como si los pasos anteriores a i ya se hubieran visto.
  private restoreTo(i: number): void {
    this.run++;
    let ui: GuideUiState = { ...GUIDE_INITIAL_UI };
    const fields = emptyFields();
    const values = this.tx().values;
    for (let j = 0; j < i; j++) {
      for (const a of this.steps()[j].actions) {
        if (a.kind === 'click' && a.then) ui = { ...ui, ...a.then };
        if (a.kind === 'type') fields[a.field] = values[a.field];
      }
    }
    const s = this.steps()[i];
    this.index.set(i);
    this.shown.set(i);
    if (i === 0) this.chatTimes = [];
    this.finished.set(false);
    this.ui.set(ui);
    this.fields.set(fields);
    this.figX.set(i === 0 && !s.instant ? -140 : s.figureX);
    this.sitting.set(s.sitting);
    this.shot.set(s.shot);
    this.figPose.set(s.pose);
    this.highlight.set(null);
    this.typing.set(null);
    this.talking.set(false);
    this.cursor.update((c) => ({ ...c, visible: false, clicking: false }));
  }

  // Icono y color de la idea de un paso (en el chat y en la burbuja).
  iconOf(s: GuideStep): string { return s.icon ?? GUIDE_ICONS[s.say]; }
  toneOf(s: GuideStep, i: number): string { return s.tone ?? GUIDE_TONES[i % GUIDE_TONES.length]; }

  // Resalta con negrita lo marcado con **…** (los textos son constantes propias).
  rich(t: string): string {
    return t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  // Primera oración en negrita grande y el resto como apoyo; si no hay segunda oración, todo va como título.
  splitSay(t: string): { title: string; sub: string } {
    const m = /^(.+?[.!?])\s+(.+)$/s.exec(t);
    return m ? { title: m[1], sub: m[2] } : { title: t, sub: '' };
  }

  trackContact(): void {
    trackWhatsAppClick({ placement: this.showDemoLink() ? 'landing' : 'demo', contactType: 'guia-a-medida' });
  }

  togglePlay(): void {
    if (this.playing()) {
      this.run++;
      this.playing.set(false);
      this.talking.set(false);
    } else {
      const i = this.index();
      this.restoreTo(i);
      void this.playFrom(i);
    }
  }

  goPrev(): void {
    this.jump(Math.max(0, this.index() - 1));
  }

  goNext(): void {
    this.jump(Math.min(this.steps().length - 1, this.index() + 1));
  }

  // Salta a otro paso; si se estaba reproduciendo sigue desde ahí, si no solo muestra el estado de ese paso.
  private jump(t: number): void {
    const wasPlaying = this.playing();
    this.restoreTo(t);
    if (wasPlaying) {
      void this.playFrom(t);
    } else {
      this.ui.set({ ...this.steps()[t].ui });
      this.chatTimes[t] = this.chatTimes[t] ?? this.hhmm();
      this.shown.set(t + 1);
    }
  }

  replay(): void {
    this.restoreTo(0);
    void this.playFrom(0);
  }

  close(): void {
    this.run++;
    this.closed.emit();
  }
}
