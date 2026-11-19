import { GUIDE_TX } from './guide.i18n';
import { CLONE_PERIOD_STEPS, CREATE_PERIOD_STEPS, CUSTOM_NEED_STEPS, GUIDE_ICONS, GUIDE_TONES, matchGuideTopic } from './guide.script';

describe('guía animada: guion y reconocimiento de preguntas', () => {
  it('reconoce «crear periodo» en los tres idiomas', () => {
    expect(matchGuideTopic('¿Cómo creo un PERÍODO?')).toBe('create-period');
    expect(matchGuideTopic('how do I create a billing period')).toBe('create-period');
    expect(matchGuideTopic('Como crio um período')).toBe('create-period');
  });

  it('reconoce «clonar el periodo del mes anterior» y gana sobre «crear periodo»', () => {
    expect(matchGuideTopic('¿Cómo clono el periodo del mes anterior?')).toBe('clone-period');
    expect(matchGuideTopic("how do I clone last month's period")).toBe('clone-period');
    expect(matchGuideTopic('como copio o período anterior')).toBe('clone-period');
  });

  it('reconoce «algo a medida» en los tres idiomas y no pisa crear/clonar', () => {
    expect(matchGuideTopic('necesito una funcionalidad a medida')).toBe('custom-need');
    expect(matchGuideTopic('tengo una idea para mejorar')).toBe('custom-need');
    expect(matchGuideTopic('I need a custom feature')).toBe('custom-need');
    expect(matchGuideTopic('preciso de uma funcionalidade')).toBe('custom-need');
    expect(matchGuideTopic('¿Cómo creo un PERÍODO?')).toBe('create-period');
    expect(matchGuideTopic('¿Cómo clono el periodo del mes anterior?')).toBe('clone-period');
  });

  it('el guion «a medida» tiene 5 pasos con icono y color, el primero instantáneo, y dura entre 30 y 45 s', () => {
    expect(CUSTOM_NEED_STEPS.length).toBe(5);
    expect(CUSTOM_NEED_STEPS.every((s) => s.shot === 'wide' && !!s.icon && !!s.tone)).toBeTrue();
    expect(CUSTOM_NEED_STEPS[0].instant).toBeTrue();
    const total = CUSTOM_NEED_STEPS.reduce((n, s) => n + (s.hold ?? 0), 0);
    expect(total).toBeGreaterThanOrEqual(30000);
    expect(total).toBeLessThanOrEqual(45000);
  });

  it('cada idioma tiene los textos del tema «a medida»', () => {
    for (const lang of ['es', 'pt', 'en'] as const) {
      const t = GUIDE_TX[lang];
      for (const k of [t.topicCustom, t.customYes, t.customNo, t.customWa, t.sceneTitleCustom, t.chatName, t.chatOnline, t.chatInput]) expect(k.length).toBeGreaterThan(0);
    }
  });

  it('todas las ideas tienen icono por defecto y hay 6 colores', () => {
    expect(Object.keys(GUIDE_TX.es.say).every((k) => !!GUIDE_ICONS[k as keyof typeof GUIDE_ICONS])).toBeTrue();
    expect(GUIDE_TONES.length).toBe(6);
  });

  it('devuelve null para otras preguntas', () => {
    expect(matchGuideTopic('cómo cargo un gasto')).toBeNull();
  });

  it('el guion tiene 13 pasos, empieza apagado y termina con el periodo creado', () => {
    expect(CREATE_PERIOD_STEPS.length).toBe(13);
    expect(CREATE_PERIOD_STEPS[0].ui.screen).toBe('off');
    expect(CREATE_PERIOD_STEPS[CREATE_PERIOD_STEPS.length - 1].ui.created).toBeTrue();
  });

  it('el guion de clonar tiene 13 pasos, empieza apagado y termina con el gasto editado y la factura adjunta', () => {
    expect(CLONE_PERIOD_STEPS.length).toBe(13);
    expect(CLONE_PERIOD_STEPS[0].ui.screen).toBe('off');
    const last = CLONE_PERIOD_STEPS[CLONE_PERIOD_STEPS.length - 1];
    expect(last.ui.edited).toBeTrue();
    expect(last.ui.attached).toBeTrue();
  });

  it('todas las acciones apuntan a elementos conocidos de la pantalla simulada', () => {
    const known = ['url', 'user', 'pass', 'login-btn', 'menu-cobros', 'menu-periodos', 'btn-nuevo', 'f-building', 'f-year', 'f-month', 'f-name', 'f-start', 'f-end', 'f-due', 'f-latefee', 'btn-crear',
      'card-nov', 'btn-clone', 'btn-confirm', 'btn-ledger', 'row-power', 'btn-edit-power', 'f-amount', 'btn-save', 'btn-attach-power'];
    for (const step of [...CREATE_PERIOD_STEPS, ...CLONE_PERIOD_STEPS]) {
      for (const a of step.actions) {
        if (a.kind !== 'pause') expect(known).toContain(a.target);
      }
    }
  });

  it('cada idioma tiene el texto de todos los pasos', () => {
    for (const lang of ['es', 'pt', 'en'] as const) {
      for (const step of [...CREATE_PERIOD_STEPS, ...CLONE_PERIOD_STEPS, ...CUSTOM_NEED_STEPS]) {
        expect(GUIDE_TX[lang].say[step.say]?.length).toBeGreaterThan(0);
      }
    }
  });

  it('cada idioma tiene los gastos, las ventajas y el monto del tema de clonar', () => {
    for (const lang of ['es', 'pt', 'en'] as const) {
      expect(GUIDE_TX[lang].web.rows.length).toBe(5);
      expect(GUIDE_TX[lang].web.benefits.length).toBe(4);
      expect(GUIDE_TX[lang].values.amount.length).toBeGreaterThan(0);
    }
  });
});
