import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GuidePose } from './guide.script';

// Personaje de bloques (minifigura con los rasgos de la mascota de Expenses); las poses se animan solo con CSS.
@Component({
  standalone: true,
  selector: 'app-guide-figure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': `'pose-' + pose()`,
    '[class.talking]': 'talking()',
    '[class.sitting]': 'sitting()',
    '[class.bust]': 'bust()'
  },
  template: `
    <svg [attr.viewBox]="bust() ? '20 0 80 124' : '0 0 120 200'" aria-hidden="true" focusable="false">
      <g class="fig">
        <ellipse class="shadow" cx="60" cy="196" rx="34" ry="4" fill="rgba(17,54,74,0.18)" />
        <g class="leg leg-l"><rect x="31" y="126" width="28" height="50" rx="3" fill="#3a4150"/><rect x="31" y="170" width="28" height="9" rx="2" fill="#22262e"/></g>
        <g class="leg leg-r"><rect x="61" y="126" width="28" height="50" rx="3" fill="#3a4150"/><rect x="61" y="170" width="28" height="9" rx="2" fill="#22262e"/></g>
        <rect x="30" y="118" width="60" height="10" rx="2" fill="#2a2f3a"/>
        <path d="M38 66 L82 66 L90 120 L30 120 Z" fill="#1f2f55"/>
        <path d="M50 66 L60 77 L70 66" fill="none" stroke="#2c4275" stroke-width="3" stroke-linejoin="round"/>
        <line x1="60" y1="77" x2="60" y2="118" stroke="#2c4275" stroke-width="1.5"/>
        <rect x="67" y="92" width="3.2" height="6" fill="#2fb3a5"/><rect x="71.4" y="89" width="3.2" height="9" fill="#34b98f"/><rect x="75.8" y="86" width="3.2" height="12" fill="#5cc36a"/>
        <text x="73" y="104" font-size="4.6" font-weight="700" fill="#fff" text-anchor="middle" font-family="system-ui, sans-serif">Expenses</text>
        <g class="arm arm-l">
          <path d="M38 67 L27 71 L20 108 L32 110 L40 82 Z" fill="#24386a"/>
          <circle cx="25" cy="114" r="7" fill="#eec29b"/><circle cx="25" cy="116" r="3" fill="#d9a47c"/>
        </g>
        <g class="arm arm-r">
          <path d="M82 67 L93 71 L100 108 L88 110 L80 82 Z" fill="#24386a"/>
          <rect x="87.5" y="102" width="13" height="4.5" rx="1.5" fill="#1b1b1b"/>
          <circle cx="95" cy="114" r="7" fill="#eec29b"/><circle cx="95" cy="116" r="3" fill="#d9a47c"/>
          <rect class="thumb" x="96" y="103" width="4.5" height="8" rx="2.2" fill="#eec29b"/>
        </g>
        <g class="head">
          <rect x="52" y="58" width="16" height="9" fill="#d9a47c"/>
          <rect x="36" y="18" width="48" height="44" rx="12" fill="#eec29b"/>
          <circle cx="43" cy="53" r="3.2" fill="#f19a8a" opacity="0.35"/><circle cx="77" cy="53" r="3.2" fill="#f19a8a" opacity="0.35"/>
          <g class="eyes"><circle cx="49.5" cy="42" r="2.6" fill="#1b1b1b"/><circle cx="70.5" cy="42" r="2.6" fill="#1b1b1b"/></g>
          <path class="brow" d="M44 33 Q50 29 56 33" fill="none" stroke="#3a2417" stroke-width="2.5" stroke-linecap="round"/>
          <path class="brow" d="M64 33 Q70 29 76 33" fill="none" stroke="#3a2417" stroke-width="2.5" stroke-linecap="round"/>
          <rect x="41" y="36" width="17" height="12" rx="4" fill="rgba(255,255,255,0.22)" stroke="#111" stroke-width="2.6"/>
          <rect x="62" y="36" width="17" height="12" rx="4" fill="rgba(255,255,255,0.22)" stroke="#111" stroke-width="2.6"/>
          <line x1="58" y1="41" x2="62" y2="41" stroke="#111" stroke-width="2.6"/>
          <line x1="41" y1="40" x2="36" y2="39" stroke="#111" stroke-width="2.4"/><line x1="79" y1="40" x2="84" y2="39" stroke="#111" stroke-width="2.4"/>
          <path class="mouth" d="M48 51 Q60 61 72 51 Z" fill="#fff" stroke="#7a3b2b" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M32 31 C29 11 49 2 61 6 C75 1 93 10 88 33 C85 25 79 22 72 24 C66 18 57 22 50 20 C44 24 38 24 32 31 Z" fill="#3a2417"/>
        </g>
      </g>
    </svg>
  `,
  styles: [
    `
      :host { display: inline-block; line-height: 0; }
      svg { width: 100%; height: auto; overflow: visible; }
      .arm, .leg, .head, .fig, .mouth, .eyes, .brow { transform-box: view-box; }
      .brow { transition: transform 0.3s ease; }
      .arm-l { transform-origin: 38px 70px; }
      .arm-r { transform-origin: 82px 70px; }
      .leg-l { transform-origin: 45px 126px; }
      .leg-r { transform-origin: 75px 126px; }
      .head { transform-origin: 60px 62px; }
      .mouth { transform-origin: 60px 54px; transform-box: view-box; }
      .eyes { transform-origin: 60px 42px; transform-box: view-box; animation: blink 4.2s infinite; }
      .thumb { display: none; }
      :host(.pose-thumbs) .thumb { display: inline; }
      .arm, .leg, .head, .fig { transition: transform 0.35s ease; }

      :host(.pose-idle) .fig { animation: bob 2.4s ease-in-out infinite; }
      :host(.pose-wave) .arm-r { animation: wave 0.55s ease-in-out infinite alternate; }
      :host(.pose-walk) .leg-l { animation: stepA 0.45s ease-in-out infinite alternate; }
      :host(.pose-walk) .leg-r { animation: stepB 0.45s ease-in-out infinite alternate; }
      :host(.pose-walk) .arm-l { animation: stepB 0.45s ease-in-out infinite alternate; }
      :host(.pose-walk) .arm-r { animation: stepA 0.45s ease-in-out infinite alternate; }
      :host(.pose-walk) .fig { animation: bob 0.45s ease-in-out infinite; }
      :host(.pose-type) .arm-l { transform: rotate(-40deg); animation: typingL 0.2s ease-in-out 0.1s infinite alternate; }
      :host(.pose-type) .arm-r { animation: typing 0.2s ease-in-out infinite alternate; }
      :host(.pose-type) .head { transform: rotate(6deg); }
      :host(.pose-point) .arm-r { transform: rotate(-95deg); }
      :host(.pose-point) .head { transform: rotate(6deg); }
      :host(.pose-point) .fig { animation: bob 2.4s ease-in-out infinite; }
      :host(.pose-thumbs) .arm-r { transform: rotate(-140deg); }
      :host(.pose-thumbs) .fig { animation: bob 2.4s ease-in-out infinite; }
      :host(.pose-acknowledge) .head { animation: nodTwice 0.7s ease-in-out 2; }
      :host(.pose-acknowledge) .arm-r { transform: rotate(-62deg); animation: palmSway 1.4s ease-in-out 0.4s infinite alternate; }
      :host(.pose-acknowledge) .brow { transform: translateY(-1.2px); }
      :host(.pose-emphasize) .arm-r { animation: gestR 0.9s ease-in-out infinite alternate; }
      :host(.pose-emphasize) .arm-l { animation: gestL 0.9s ease-in-out 0.25s infinite alternate; }
      :host(.pose-emphasize) .brow { transform: translateY(-1.5px); }
      :host(.pose-lean) .fig { transform: scale(1.06); transform-origin: 60px 196px; }
      :host(.pose-lean) .head { transform: translateY(2px) rotate(3deg); }
      :host(.pose-lean) .arm-r { transform: rotate(-48deg); animation: palmSway 1.4s ease-in-out infinite alternate; }
      :host(.pose-invite) .arm-l { transform: rotate(52deg); animation: openL 1.2s ease-in-out infinite alternate; }
      :host(.pose-invite) .arm-r { transform: rotate(-52deg); animation: openR 1.2s ease-in-out infinite alternate; }
      :host(.pose-invite) .head { transform: rotate(-4deg); }
      :host(.pose-invite) .brow { transform: translateY(-1.5px); }

      :host(.sitting) .leg { transform: scaleY(0.45); }
      :host(.sitting) .shadow { display: none; }
      :host(.talking) .mouth { animation: talk 0.22s ease-in-out infinite alternate; }
      :host(.bust) .leg, :host(.bust) .shadow { display: none; }

      @keyframes wave { from { transform: rotate(-150deg); } to { transform: rotate(-115deg); } }
      @keyframes stepA { from { transform: rotate(18deg); } to { transform: rotate(-18deg); } }
      @keyframes stepB { from { transform: rotate(-18deg); } to { transform: rotate(18deg); } }
      @keyframes typing { from { transform: rotate(-66deg); } to { transform: rotate(-74deg); } }
      @keyframes typingL { from { transform: rotate(-36deg); } to { transform: rotate(-44deg); } }
      @keyframes talk { from { transform: scaleY(1); } to { transform: scaleY(0.45); } }
      @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
      @keyframes blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
      @keyframes nodTwice { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(7deg) translateY(1.5px); } }
      @keyframes palmSway { from { transform: rotate(-58deg); } to { transform: rotate(-68deg); } }
      @keyframes gestR { from { transform: rotate(-40deg); } to { transform: rotate(-62deg); } }
      @keyframes gestL { from { transform: rotate(30deg); } to { transform: rotate(52deg); } }
      @keyframes openL { from { transform: rotate(48deg); } to { transform: rotate(58deg); } }
      @keyframes openR { from { transform: rotate(-48deg); } to { transform: rotate(-58deg); } }
      @media (prefers-reduced-motion: reduce) {
        .fig, .arm, .leg, .head, .eyes, .mouth, .brow { animation: none !important; }
      }
    `
  ]
})
export class GuideFigureComponent {
  readonly pose = input<GuidePose>('idle');
  readonly talking = input(false);
  readonly sitting = input(false);
  readonly bust = input(false);
}
