export type GuidePose = 'idle' | 'wave' | 'walk' | 'sit' | 'type' | 'point' | 'thumbs' | 'acknowledge' | 'emphasize' | 'lean' | 'invite';
export type GuideScreen = 'off' | 'browser' | 'login' | 'panel' | 'periods' | 'form' | 'done' | 'ledger' | 'payments' | 'payment' | 'settlement' | 'phone';
export type GuideField = 'url' | 'user' | 'pass' | 'building' | 'year' | 'month' | 'name' | 'start' | 'end' | 'due' | 'amount' | 'payAmount' | 'userOp' | 'userMgr' | 'userAdm';
export type GuideTopic = 'create-period' | 'clone-period' | 'custom-need' | 'approve-payment' | 'settlement-flow';
export type GuideSayKey = 'hello' | 'openWeb' | 'user' | 'pass' | 'panel' | 'periods' | 'newPeriod' | 'building' | 'yearMonth' | 'dates' | 'lateFee' | 'create' | 'done'
  | 'cloneHello' | 'cloneIntro' | 'cloneFind' | 'cloneClick' | 'cloneConfirm' | 'cloneCopied' | 'cloneOpenLedger' | 'cloneRows' | 'cloneEdit' | 'cloneAmount' | 'cloneAttach' | 'cloneBenefits' | 'cloneDone'
  | 'customReact' | 'customValueA' | 'customValueB' | 'customClose' | 'customAsk'
  | 'payHello' | 'payAlert' | 'payMenu' | 'payList' | 'payProof' | 'payAmount' | 'payResolve' | 'payApproved' | 'payInvoice' | 'payEmit' | 'payDone'
  | 'stHello' | 'stOpLogin' | 'stOpMenu' | 'stOpCalc' | 'stOpCalc2' | 'stOpMetrics' | 'stSwitchMgr' | 'stMgrLogin' | 'stMgrOpen' | 'stMgrApprove' | 'stMgrAfter' | 'stPresAlert' | 'stPresReview' | 'stPresApprove' | 'stPresSign' | 'stAdmLogin' | 'stAdmOpen' | 'stAdmPublish' | 'stOwnAlert' | 'stOwnAccount' | 'stOwnDetail' | 'stDone';

export interface GuideUiState {
  screen: GuideScreen; menuOpen: boolean; formOpen: boolean; created: boolean;
  confirm: boolean; cloned: boolean; toast: boolean; editOpen: boolean; edited: boolean; attached: boolean; benefits: boolean;
  alert: boolean; pay: 'pending' | 'review' | 'approved'; invOpen: boolean; series: boolean; issued: boolean; note: 'none' | 'approved' | 'issued' | 'calc' | 'sapprove' | 'publish';
  who: 'demo' | 'operator' | 'manager' | 'admin'; sp: 'none' | 'draft' | 'closed' | 'published'; sst: 'draft' | 'calculated' | 'approved' | 'published';
  ph: 'none' | 'p-notif' | 'p-review' | 'p-confirm' | 'p-signed' | 'p-owner-notif' | 'p-account' | 'p-detail'; alert2: boolean;
}

export type GuideAction =
  | { kind: 'move'; target: string }
  | { kind: 'click'; target: string; then?: Partial<GuideUiState> }
  | { kind: 'type'; target: string; field: GuideField }
  | { kind: 'reset'; fields: GuideField[] }
  | { kind: 'pause'; ms: number };

export interface GuideStep {
  say: GuideSayKey;
  shot: 'wide' | 'screen';
  hold?: number;       // ms que el globo queda en pantalla tras el paso; reemplaza el tiempo de lectura automático
  instant?: boolean;   // el personaje aparece ya en su lugar, sin caminar desde la izquierda
  pose: GuidePose;     // pose al terminar de caminar / durante el paso
  figureX: number;     // posición izquierda del personaje en la escena (px del mundo 960×540)
  sitting: boolean;
  icon?: string;       // clase PrimeIcons del círculo de la burbuja y del chat (tema «a medida»)
  tone?: string;       // color CSS del círculo (tema «a medida»)
  ui: GuideUiState;    // estado de la pantalla al EMPEZAR el paso
  actions: GuideAction[];
}

const NO_FLAGS: Omit<GuideUiState, 'screen' | 'menuOpen' | 'formOpen' | 'created'> = {
  confirm: false, cloned: false, toast: false, editOpen: false, edited: false, attached: false, benefits: false,
  alert: false, pay: 'pending', invOpen: false, series: false, issued: false, note: 'none',
  who: 'demo', sp: 'none', sst: 'draft', ph: 'none', alert2: false
};
// Estado de la pantalla simulada; los indicadores extra (confirm, cloned…) arrancan apagados salvo que se indiquen.
const ui = (screen: GuideScreen, menuOpen: boolean, formOpen: boolean, created: boolean, extra: Partial<GuideUiState> = {}): GuideUiState => ({ screen, menuOpen, formOpen, created, ...NO_FLAGS, ...extra });
export const GUIDE_INITIAL_UI: GuideUiState = ui('off', false, false, false);

// Icono (PrimeIcons) de cada idea en la burbuja y el chat; los pasos pueden traer el suyo con `icon`.
export const GUIDE_ICONS: Record<GuideSayKey, string> = {
  hello: 'pi-comments', openWeb: 'pi-globe', user: 'pi-user', pass: 'pi-lock', panel: 'pi-chart-pie', periods: 'pi-calendar', newPeriod: 'pi-plus-circle',
  building: 'pi-building', yearMonth: 'pi-calendar-plus', dates: 'pi-clock', lateFee: 'pi-info-circle', create: 'pi-check-circle', done: 'pi-thumbs-up',
  cloneHello: 'pi-comments', cloneIntro: 'pi-calendar', cloneFind: 'pi-copy', cloneClick: 'pi-question-circle', cloneConfirm: 'pi-check-circle', cloneCopied: 'pi-clone',
  cloneOpenLedger: 'pi-list', cloneRows: 'pi-wallet', cloneEdit: 'pi-pencil', cloneAmount: 'pi-dollar', cloneAttach: 'pi-paperclip', cloneBenefits: 'pi-star', cloneDone: 'pi-thumbs-up',
  customReact: 'pi-comments', customValueA: 'pi-sliders-h', customValueB: 'pi-lightbulb', customClose: 'pi-star', customAsk: 'pi-users',
  payHello: 'pi-comments', payAlert: 'pi-bell', payMenu: 'pi-wallet', payList: 'pi-list', payProof: 'pi-image', payAmount: 'pi-dollar', payResolve: 'pi-check-square',
  payApproved: 'pi-check-circle', payInvoice: 'pi-receipt', payEmit: 'pi-send', payDone: 'pi-thumbs-up',
  stHello: 'pi-comments', stOpLogin: 'pi-user', stOpMenu: 'pi-calendar', stOpCalc: 'pi-calculator', stOpCalc2: 'pi-calculator', stOpMetrics: 'pi-chart-bar',
  stSwitchMgr: 'pi-sign-out', stMgrLogin: 'pi-user', stMgrOpen: 'pi-calculator', stMgrApprove: 'pi-check', stMgrAfter: 'pi-clock', stPresAlert: 'pi-mobile',
  stPresReview: 'pi-search', stPresApprove: 'pi-pencil', stPresSign: 'pi-verified', stAdmLogin: 'pi-bell', stAdmOpen: 'pi-lock', stAdmPublish: 'pi-send',
  stOwnAlert: 'pi-bell', stOwnAccount: 'pi-wallet', stOwnDetail: 'pi-file-pdf', stDone: 'pi-thumbs-up'
};
// Colores del círculo de cada idea; se reparten por orden de paso salvo que el paso traiga `tone`.
export const GUIDE_TONES = ['#1385b6', '#7c4dcc', '#f59e0b', '#16a34a', '#0ea5a4', '#e5675d'];

// Guion de «crear un periodo»: 13 pasos, cada uno con su texto, su plano de cámara y las acciones del cursor.
export const CREATE_PERIOD_STEPS: GuideStep[] = [
  { say: 'hello', shot: 'wide', pose: 'wave', figureX: 190, sitting: false, ui: ui('off', false, false, false), actions: [] },
  { say: 'openWeb', shot: 'wide', pose: 'type', figureX: 190, sitting: true, ui: ui('browser', false, false, false), actions: [
    { kind: 'type', target: 'url', field: 'url' }, { kind: 'pause', ms: 300 }, { kind: 'click', target: 'url', then: { screen: 'login' } }] },
  { say: 'user', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('login', false, false, false), actions: [{ kind: 'type', target: 'user', field: 'user' }] },
  { say: 'pass', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('login', false, false, false), actions: [
    { kind: 'type', target: 'pass', field: 'pass' }, { kind: 'click', target: 'login-btn', then: { screen: 'panel' } }] },
  { say: 'panel', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('panel', false, false, false), actions: [{ kind: 'click', target: 'menu-cobros', then: { menuOpen: true } }] },
  { say: 'periods', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('panel', true, false, false), actions: [{ kind: 'click', target: 'menu-periodos', then: { screen: 'periods' } }] },
  { say: 'newPeriod', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('periods', true, false, false), actions: [{ kind: 'click', target: 'btn-nuevo', then: { screen: 'form', formOpen: true } }] },
  { say: 'building', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('form', true, true, false), actions: [{ kind: 'type', target: 'f-building', field: 'building' }] },
  { say: 'yearMonth', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('form', true, true, false), actions: [
    { kind: 'type', target: 'f-year', field: 'year' }, { kind: 'type', target: 'f-month', field: 'month' }, { kind: 'type', target: 'f-name', field: 'name' }] },
  { say: 'dates', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('form', true, true, false), actions: [
    { kind: 'type', target: 'f-start', field: 'start' }, { kind: 'type', target: 'f-end', field: 'end' }, { kind: 'type', target: 'f-due', field: 'due' }] },
  { say: 'lateFee', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('form', true, true, false), actions: [{ kind: 'move', target: 'f-latefee' }, { kind: 'pause', ms: 900 }] },
  { say: 'create', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('form', true, true, false), actions: [
    { kind: 'click', target: 'btn-crear', then: { screen: 'done', formOpen: false, created: true } }] },
  { say: 'done', shot: 'wide', pose: 'thumbs', figureX: 190, sitting: false, ui: ui('done', true, false, true), actions: [] }
];

// Guion de «clonar el periodo del mes anterior»: 13 pasos.
export const CLONE_PERIOD_STEPS: GuideStep[] = [
  { say: 'cloneHello', shot: 'wide', pose: 'wave', figureX: 190, sitting: false, ui: ui('off', false, false, false), actions: [] },
  { say: 'cloneIntro', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('periods', true, false, false), actions: [{ kind: 'move', target: 'card-nov' }] },
  { say: 'cloneFind', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('periods', true, false, false), actions: [{ kind: 'move', target: 'btn-clone' }, { kind: 'pause', ms: 600 }] },
  { say: 'cloneClick', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('periods', true, false, false), actions: [
    { kind: 'click', target: 'btn-clone', then: { confirm: true } }] },
  { say: 'cloneConfirm', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('periods', true, false, false, { confirm: true }), actions: [
    { kind: 'click', target: 'btn-confirm', then: { confirm: false, cloned: true, toast: true } }] },
  { say: 'cloneCopied', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('periods', true, false, false, { cloned: true, toast: true }), actions: [
    { kind: 'move', target: 'btn-ledger' }, { kind: 'pause', ms: 600 }] },
  { say: 'cloneOpenLedger', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('periods', true, false, false, { cloned: true }), actions: [
    { kind: 'click', target: 'btn-ledger', then: { screen: 'ledger' } }] },
  { say: 'cloneRows', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('ledger', true, false, false), actions: [{ kind: 'pause', ms: 1200 }, { kind: 'move', target: 'row-power' }] },
  { say: 'cloneEdit', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('ledger', true, false, false), actions: [
    { kind: 'click', target: 'btn-edit-power', then: { editOpen: true } }] },
  { say: 'cloneAmount', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('ledger', true, false, false, { editOpen: true }), actions: [
    { kind: 'type', target: 'f-amount', field: 'amount' }, { kind: 'click', target: 'btn-save', then: { editOpen: false, edited: true } }] },
  { say: 'cloneAttach', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('ledger', true, false, false, { edited: true }), actions: [
    { kind: 'click', target: 'btn-attach-power', then: { attached: true } }] },
  { say: 'cloneBenefits', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('ledger', true, false, false, { edited: true, attached: true, benefits: true }), actions: [] },
  { say: 'cloneDone', shot: 'wide', pose: 'thumbs', figureX: 190, sitting: false, ui: ui('ledger', true, false, false, { edited: true, attached: true }), actions: [] }
];

// Guion «a medida»: asesor comercial en primer plano, 5 globos con gestos y la pregunta final.
export const CUSTOM_NEED_STEPS: GuideStep[] = [
  { say: 'customReact',  shot: 'wide', pose: 'acknowledge', figureX: 420, sitting: false, instant: true, hold: 8500,  icon: 'pi-comments', tone: '#1385b6', ui: ui('off', false, false, false), actions: [] },
  { say: 'customValueA', shot: 'wide', pose: 'emphasize',   figureX: 420, sitting: false, hold: 7500,  icon: 'pi-sliders-h', tone: '#7c4dcc', ui: ui('off', false, false, false), actions: [] },
  { say: 'customValueB', shot: 'wide', pose: 'lean',        figureX: 420, sitting: false, hold: 10500, icon: 'pi-lightbulb', tone: '#f59e0b', ui: ui('off', false, false, false), actions: [] },
  { say: 'customClose',  shot: 'wide', pose: 'invite',      figureX: 420, sitting: false, hold: 7000,  icon: 'pi-star', tone: '#16a34a', ui: ui('off', false, false, false), actions: [] },
  { say: 'customAsk',    shot: 'wide', pose: 'invite',      figureX: 420, sitting: false, hold: 2500,  icon: 'pi-users', tone: '#0ea5a4', ui: ui('off', false, false, false), actions: [] }
];

// Guion «aprobar el pago de un propietario y emitir la factura»: 14 pasos desde el login.
export const APPROVE_PAYMENT_STEPS: GuideStep[] = [
  { say: 'payHello', shot: 'wide', pose: 'wave', figureX: 190, sitting: false, ui: ui('off', false, false, false), actions: [] },
  { say: 'openWeb', shot: 'wide', pose: 'type', figureX: 190, sitting: true, ui: ui('browser', false, false, false), actions: [
    { kind: 'type', target: 'url', field: 'url' }, { kind: 'pause', ms: 300 }, { kind: 'click', target: 'url', then: { screen: 'login' } }] },
  { say: 'user', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('login', false, false, false), actions: [{ kind: 'type', target: 'user', field: 'user' }] },
  { say: 'pass', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('login', false, false, false), actions: [
    { kind: 'type', target: 'pass', field: 'pass' }, { kind: 'click', target: 'login-btn', then: { screen: 'panel', alert: true } }] },
  { say: 'payAlert', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('panel', false, false, false, { alert: true }), actions: [
    { kind: 'move', target: 'alert-toast' }, { kind: 'pause', ms: 1200 }] },
  { say: 'payMenu', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('panel', false, false, false, { alert: true }), actions: [
    { kind: 'click', target: 'menu-pagos', then: { screen: 'payments', alert: false } }] },
  { say: 'payList', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('payments', false, false, false), actions: [
    { kind: 'move', target: 'row-pay' }, { kind: 'click', target: 'row-pay', then: { screen: 'payment' } }] },
  { say: 'payProof', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('payment', false, false, false), actions: [{ kind: 'move', target: 'proof' }, { kind: 'pause', ms: 1400 }] },
  { say: 'payAmount', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('payment', false, false, false), actions: [
    { kind: 'type', target: 'f-payamount', field: 'payAmount' }, { kind: 'click', target: 'btn-review', then: { pay: 'review' } }] },
  { say: 'payResolve', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('payment', false, false, false, { pay: 'review' }), actions: [
    { kind: 'pause', ms: 600 }, { kind: 'click', target: 'btn-approve', then: { pay: 'approved', note: 'approved' } }] },
  { say: 'payApproved', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('payment', false, false, false, { pay: 'approved', note: 'approved' }), actions: [{ kind: 'pause', ms: 1200 }] },
  { say: 'payInvoice', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('payment', false, false, false, { pay: 'approved' }), actions: [
    { kind: 'click', target: 'btn-inv-open', then: { invOpen: true } }] },
  { say: 'payEmit', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('payment', false, false, false, { pay: 'approved', invOpen: true }), actions: [
    { kind: 'click', target: 'f-series', then: { series: true } }, { kind: 'click', target: 'btn-emit', then: { issued: true, note: 'issued' } }] },
  { say: 'payDone', shot: 'wide', pose: 'thumbs', figureX: 190, sitting: false, ui: ui('payment', false, false, false, { pay: 'approved', invOpen: true, series: true, issued: true }), actions: [] }
];

// Guion «¿cómo se manejan las liquidaciones?»: 23 pasos, del Operador al comprobante del propietario, cambiando de usuario.
export const SETTLEMENT_FLOW_STEPS: GuideStep[] = [
  { say: 'stHello', shot: 'wide', pose: 'wave', figureX: 190, sitting: false, ui: ui('off', false, false, false), actions: [] },
  { say: 'openWeb', shot: 'wide', pose: 'type', figureX: 190, sitting: true, ui: ui('browser', false, false, false), actions: [
    { kind: 'type', target: 'url', field: 'url' }, { kind: 'pause', ms: 300 }, { kind: 'click', target: 'url', then: { screen: 'login' } }] },
  { say: 'stOpLogin', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('login', false, false, false), actions: [
    { kind: 'type', target: 'user', field: 'userOp' }, { kind: 'type', target: 'pass', field: 'pass' }, { kind: 'click', target: 'login-btn', then: { screen: 'panel', who: 'operator' } }] },
  { say: 'stOpMenu', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('panel', false, false, false, { who: 'operator' }), actions: [
    { kind: 'click', target: 'menu-cobros', then: { menuOpen: true } }, { kind: 'click', target: 'menu-periodos', then: { screen: 'periods', sp: 'draft' } }] },
  { say: 'stOpCalc', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('periods', true, false, false, { who: 'operator', sp: 'draft' }), actions: [
    { kind: 'click', target: 'btn-calc', then: { screen: 'settlement' } }] },
  { say: 'stOpCalc2', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('settlement', true, false, false, { who: 'operator', sp: 'draft' }), actions: [
    { kind: 'click', target: 'btn-calcular', then: { sst: 'calculated', note: 'calc' } }] },
  { say: 'stOpMetrics', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('settlement', true, false, false, { who: 'operator', sp: 'draft', sst: 'calculated', note: 'calc' }), actions: [
    { kind: 'move', target: 'metric-net' }, { kind: 'pause', ms: 1500 }] },
  { say: 'stSwitchMgr', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('settlement', true, false, false, { who: 'operator', sp: 'draft', sst: 'calculated' }), actions: [
    { kind: 'click', target: 'btn-logout', then: { screen: 'login', who: 'demo', menuOpen: false } }, { kind: 'reset', fields: ['user', 'userOp', 'pass'] }] },
  { say: 'stMgrLogin', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('login', false, false, false), actions: [
    { kind: 'type', target: 'user', field: 'userMgr' }, { kind: 'type', target: 'pass', field: 'pass' }, { kind: 'click', target: 'login-btn', then: { screen: 'panel', who: 'manager' } }] },
  { say: 'stMgrOpen', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('panel', false, false, false, { who: 'manager', sp: 'draft', sst: 'calculated' }), actions: [
    { kind: 'click', target: 'menu-cobros', then: { menuOpen: true } }, { kind: 'click', target: 'menu-periodos', then: { screen: 'periods' } }, { kind: 'click', target: 'btn-calc', then: { screen: 'settlement' } }] },
  { say: 'stMgrApprove', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('settlement', true, false, false, { who: 'manager', sp: 'draft', sst: 'calculated' }), actions: [
    { kind: 'click', target: 'btn-aprobar', then: { sst: 'approved', sp: 'closed', note: 'sapprove' } }] },
  { say: 'stMgrAfter', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('settlement', true, false, false, { who: 'manager', sp: 'closed', sst: 'approved', note: 'sapprove' }), actions: [
    { kind: 'move', target: 'metric-charges' }, { kind: 'pause', ms: 1500 }] },
  { say: 'stPresAlert', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('phone', false, false, false, { ph: 'p-notif', sp: 'closed', sst: 'approved' }), actions: [
    { kind: 'move', target: 'p-notif-card' }, { kind: 'pause', ms: 1200 }] },
  { say: 'stPresReview', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('phone', false, false, false, { ph: 'p-notif', sp: 'closed', sst: 'approved' }), actions: [
    { kind: 'click', target: 'p-notif-card', then: { ph: 'p-review' } }, { kind: 'move', target: 'p-summary' }, { kind: 'pause', ms: 1200 }] },
  { say: 'stPresApprove', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('phone', false, false, false, { ph: 'p-review', sp: 'closed', sst: 'approved' }), actions: [
    { kind: 'click', target: 'p-approve', then: { ph: 'p-confirm' } }] },
  { say: 'stPresSign', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('phone', false, false, false, { ph: 'p-confirm', sp: 'closed', sst: 'approved' }), actions: [
    { kind: 'click', target: 'p-yes', then: { ph: 'p-signed' } }] },
  { say: 'stAdmLogin', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('login', false, false, false, { sp: 'closed', sst: 'approved' }), actions: [
    { kind: 'reset', fields: ['user', 'userMgr', 'pass'] }, { kind: 'type', target: 'user', field: 'userAdm' }, { kind: 'type', target: 'pass', field: 'pass' },
    { kind: 'click', target: 'login-btn', then: { screen: 'panel', who: 'admin', alert2: true } }, { kind: 'pause', ms: 900 }] },
  { say: 'stAdmOpen', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('panel', false, false, false, { who: 'admin', sp: 'closed', sst: 'approved', alert2: true }), actions: [
    { kind: 'click', target: 'menu-cobros', then: { menuOpen: true, alert2: false } }, { kind: 'click', target: 'menu-periodos', then: { screen: 'periods' } }, { kind: 'click', target: 'btn-calc', then: { screen: 'settlement' } }] },
  { say: 'stAdmPublish', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('settlement', true, false, false, { who: 'admin', sp: 'closed', sst: 'approved' }), actions: [
    { kind: 'click', target: 'btn-publicar', then: { sst: 'published', sp: 'published', note: 'publish' } }, { kind: 'pause', ms: 1200 }] },
  { say: 'stOwnAlert', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('phone', false, false, false, { ph: 'p-owner-notif', sp: 'published', sst: 'published' }), actions: [
    { kind: 'move', target: 'p-owner-card' }, { kind: 'pause', ms: 1200 }] },
  { say: 'stOwnAccount', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('phone', false, false, false, { ph: 'p-owner-notif', sp: 'published', sst: 'published' }), actions: [
    { kind: 'click', target: 'p-owner-card', then: { ph: 'p-account' } }, { kind: 'move', target: 'p-period' }, { kind: 'pause', ms: 900 }] },
  { say: 'stOwnDetail', shot: 'screen', pose: 'point', figureX: 190, sitting: true, ui: ui('phone', false, false, false, { ph: 'p-account', sp: 'published', sst: 'published' }), actions: [
    { kind: 'click', target: 'p-period', then: { ph: 'p-detail' } }, { kind: 'move', target: 'p-pdf' }, { kind: 'pause', ms: 1200 }] },
  { say: 'stDone', shot: 'wide', pose: 'thumbs', figureX: 190, sitting: false, ui: ui('phone', false, false, false, { ph: 'p-detail', sp: 'published', sst: 'published' }), actions: [] }
];

export const STEPS_BY_TOPIC: Record<GuideTopic, GuideStep[]> = { 'create-period': CREATE_PERIOD_STEPS, 'clone-period': CLONE_PERIOD_STEPS, 'custom-need': CUSTOM_NEED_STEPS, 'approve-payment': APPROVE_PAYMENT_STEPS, 'settlement-flow': SETTLEMENT_FLOW_STEPS };

// Reconoce la pregunta escrita (sin tildes ni mayúsculas, en los 3 idiomas). «A medida» gana sobre «clonar», luego «liquidación», luego «pago/factura», luego «crear periodo».
export function matchGuideTopic(text: string): GuideTopic | null {
  const norm = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const custom = ['a medida', 'personaliz', 'funcionalidad', 'funcion que', 'no tiene', 'no existe', 'idea', 'sugerenc', 'mejora', 'sob medida', 'nao tem', 'funcionalidade', 'ideia', 'sugest', 'custom', 'feature', 'suggest', 'tailor', "doesn't have", 'need something', 'necesito algo'];
  if (custom.some((k) => norm.includes(k))) return 'custom-need';
  const clone = ['clon', 'copi', 'copy', 'duplic', 'repet', 'repit', 'repeat', 'mes anterior', 'mes pasado', 'mes passado', 'periodo anterior', 'previous', 'last month', 'mismos gastos', 'mesmas despesas', 'same expenses'];
  if (clone.some((k) => norm.includes(k))) return 'clone-period';
  const settle = ['liquidaci', 'settlement', 'rateio'];
  if (settle.some((k) => norm.includes(k))) return 'settlement-flow';
  const pay = ['pago', 'aprob', 'factura', 'comprobante', 'cobr', 'timbrado', 'payment', 'approve', 'invoice', 'receipt', 'pagamento', 'aprov', 'fatura'];
  if (pay.some((k) => norm.includes(k))) return 'approve-payment';
  const create = ['periodo', 'period', 'ciclo', 'cycle', 'mes nuevo', 'new month'];
  return create.some((k) => norm.includes(k)) ? 'create-period' : null;
}
