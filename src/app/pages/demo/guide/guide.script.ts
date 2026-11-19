export type GuidePose = 'idle' | 'wave' | 'walk' | 'sit' | 'type' | 'point' | 'thumbs';
export type GuideScreen = 'off' | 'browser' | 'login' | 'panel' | 'periods' | 'form' | 'done' | 'ledger';
export type GuideField = 'url' | 'user' | 'pass' | 'building' | 'year' | 'month' | 'name' | 'start' | 'end' | 'due' | 'amount';
export type GuideTopic = 'create-period' | 'clone-period';
export type GuideSayKey = 'hello' | 'openWeb' | 'user' | 'pass' | 'panel' | 'periods' | 'newPeriod' | 'building' | 'yearMonth' | 'dates' | 'lateFee' | 'create' | 'done'
  | 'cloneHello' | 'cloneIntro' | 'cloneFind' | 'cloneClick' | 'cloneConfirm' | 'cloneCopied' | 'cloneOpenLedger' | 'cloneRows' | 'cloneEdit' | 'cloneAmount' | 'cloneAttach' | 'cloneBenefits' | 'cloneDone';

export interface GuideUiState {
  screen: GuideScreen; menuOpen: boolean; formOpen: boolean; created: boolean;
  confirm: boolean; cloned: boolean; toast: boolean; editOpen: boolean; edited: boolean; attached: boolean; benefits: boolean;
}

export type GuideAction =
  | { kind: 'move'; target: string }
  | { kind: 'click'; target: string; then?: Partial<GuideUiState> }
  | { kind: 'type'; target: string; field: GuideField }
  | { kind: 'pause'; ms: number };

export interface GuideStep {
  say: GuideSayKey;
  shot: 'wide' | 'screen';
  pose: GuidePose;     // pose al terminar de caminar / durante el paso
  figureX: number;     // posición izquierda del personaje en la escena (px del mundo 960×540)
  sitting: boolean;
  ui: GuideUiState;    // estado de la pantalla al EMPEZAR el paso
  actions: GuideAction[];
}

const NO_FLAGS = { confirm: false, cloned: false, toast: false, editOpen: false, edited: false, attached: false, benefits: false };
// Estado de la pantalla simulada; los indicadores extra (confirm, cloned…) arrancan apagados salvo que se indiquen.
const ui = (screen: GuideScreen, menuOpen: boolean, formOpen: boolean, created: boolean, extra: Partial<GuideUiState> = {}): GuideUiState => ({ screen, menuOpen, formOpen, created, ...NO_FLAGS, ...extra });
export const GUIDE_INITIAL_UI: GuideUiState = ui('off', false, false, false);

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

export const STEPS_BY_TOPIC: Record<GuideTopic, GuideStep[]> = { 'create-period': CREATE_PERIOD_STEPS, 'clone-period': CLONE_PERIOD_STEPS };

// Reconoce la pregunta escrita (sin tildes ni mayúsculas, en los 3 idiomas). «Clonar/copiar» gana sobre «crear periodo».
export function matchGuideTopic(text: string): GuideTopic | null {
  const norm = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const clone = ['clon', 'copi', 'copy', 'duplic', 'repet', 'repit', 'repeat', 'mes anterior', 'mes pasado', 'mes passado', 'periodo anterior', 'previous', 'last month', 'mismos gastos', 'mesmas despesas', 'same expenses'];
  if (clone.some((k) => norm.includes(k))) return 'clone-period';
  const create = ['periodo', 'period', 'ciclo', 'cycle', 'liquidacion nueva', 'mes nuevo', 'new month'];
  return create.some((k) => norm.includes(k)) ? 'create-period' : null;
}
