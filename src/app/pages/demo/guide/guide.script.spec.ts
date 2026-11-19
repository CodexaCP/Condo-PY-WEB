import { GUIDE_TX } from './guide.i18n';
import { APPROVE_PAYMENT_STEPS, CLONE_PERIOD_STEPS, CREATE_PERIOD_STEPS, CUSTOM_NEED_STEPS, GUIDE_ICONS, GUIDE_TONES, SETTLEMENT_FLOW_STEPS, matchGuideTopic } from './guide.script';

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

  it('reconoce «aprobar pago / emitir factura» en los tres idiomas', () => {
    expect(matchGuideTopic('¿Cómo apruebo el pago de un propietario?')).toBe('approve-payment');
    expect(matchGuideTopic('how do I issue the invoice')).toBe('approve-payment');
    expect(matchGuideTopic('como emitir a fatura do pagamento')).toBe('approve-payment');
    expect(matchGuideTopic('¿Cómo creo un PERÍODO?')).toBe('create-period');
    expect(matchGuideTopic('¿Cómo clono el periodo del mes anterior?')).toBe('clone-period');
    expect(matchGuideTopic('necesito una funcionalidad a medida')).toBe('custom-need');
  });

  it('el guion de aprobar el pago tiene 14 pasos, empieza apagado y termina con la factura emitida', () => {
    expect(APPROVE_PAYMENT_STEPS.length).toBe(14);
    expect(APPROVE_PAYMENT_STEPS[0].ui.screen).toBe('off');
    const last = APPROVE_PAYMENT_STEPS[APPROVE_PAYMENT_STEPS.length - 1];
    expect(last.ui.issued).toBeTrue();
    expect(last.ui.pay).toBe('approved');
  });

  it('cada idioma tiene el número de factura del tema de aprobar el pago', () => {
    for (const lang of ['es', 'pt', 'en'] as const) expect(GUIDE_TX[lang].web.pay.invNumber.length).toBeGreaterThan(0);
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
      'card-nov', 'btn-clone', 'btn-confirm', 'btn-ledger', 'row-power', 'btn-edit-power', 'f-amount', 'btn-save', 'btn-attach-power',
      'alert-toast', 'menu-pagos', 'row-pay', 'proof', 'f-payamount', 'btn-review', 'btn-approve', 'btn-inv-open', 'f-series', 'btn-emit',
      'btn-logout', 'btn-calc', 'btn-calcular', 'metric-net', 'metric-charges', 'btn-aprobar', 'btn-publicar', 'p-notif-card', 'p-summary', 'p-approve', 'p-yes', 'p-owner-card', 'p-period', 'p-pdf'];
    for (const step of [...CREATE_PERIOD_STEPS, ...CLONE_PERIOD_STEPS, ...APPROVE_PAYMENT_STEPS, ...SETTLEMENT_FLOW_STEPS]) {
      for (const a of step.actions) {
        if (a.kind !== 'pause' && a.kind !== 'reset') expect(known).toContain(a.target);
      }
    }
  });

  it('reconoce «liquidaciones» en los tres idiomas sin pisar los demás temas', () => {
    expect(matchGuideTopic('¿Cómo se manejan las liquidaciones en Expenses?')).toBe('settlement-flow');
    expect(matchGuideTopic('how are settlements handled')).toBe('settlement-flow');
    expect(matchGuideTopic('como funciona o rateio')).toBe('settlement-flow');
    expect(matchGuideTopic('¿Cómo apruebo el pago de un propietario?')).toBe('approve-payment');
    expect(matchGuideTopic('¿Cómo clono el periodo del mes anterior?')).toBe('clone-period');
    expect(matchGuideTopic('necesito una funcionalidad a medida')).toBe('custom-need');
    expect(matchGuideTopic('¿Cómo creo un PERÍODO?')).toBe('create-period');
  });

  it('el guion de liquidaciones tiene 23 pasos, empieza apagado y termina con la liquidación publicada y el detalle del propietario', () => {
    expect(SETTLEMENT_FLOW_STEPS.length).toBe(23);
    expect(SETTLEMENT_FLOW_STEPS[0].ui.screen).toBe('off');
    const last = SETTLEMENT_FLOW_STEPS[SETTLEMENT_FLOW_STEPS.length - 1];
    expect(last.ui.sst).toBe('published');
    expect(last.ui.ph).toBe('p-detail');
  });

  it('cada idioma tiene los textos del tema de liquidaciones y los usuarios existen en los valores', () => {
    for (const lang of ['es', 'pt', 'en'] as const) {
      const t = GUIDE_TX[lang];
      expect(t.web.stl.sStatus.published.length).toBeGreaterThan(0);
      expect(t.web.stl.who.manager.length).toBeGreaterThan(0);
      expect(t.values.userMgr.length).toBeGreaterThan(0);
      expect(t.topicSettlement.length).toBeGreaterThan(0);
      for (const step of SETTLEMENT_FLOW_STEPS) {
        for (const a of step.actions) {
          if (a.kind === 'type') expect(t.values[a.field].length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('cada idioma tiene el texto de todos los pasos', () => {
    for (const lang of ['es', 'pt', 'en'] as const) {
      for (const step of [...CREATE_PERIOD_STEPS, ...CLONE_PERIOD_STEPS, ...APPROVE_PAYMENT_STEPS, ...CUSTOM_NEED_STEPS, ...SETTLEMENT_FLOW_STEPS]) {
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
