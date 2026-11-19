import { Dict } from '../../../core/i18n/lang.service';
import { GuideSayKey } from './guide.script';

export interface GuideValues { url: string; user: string; pass: string; building: string; year: string; month: string; name: string; start: string; end: string; due: string; amount: string; amountOld: string; invoiceFile: string; }
export interface GuideRow { id: 'staff' | 'power' | 'cleaning' | 'insurance' | 'admin'; desc: string; supplier: string; amount: string; }
export interface GuideCard { name: string; status: 'draft' | 'published' | 'closed'; dates: string; }
export interface GuideTx {
  name: string; role: string;
  fabAria: string; teaser: string; ask: string; topicCreatePeriod: string; topicClonePeriod: string; inputPlaceholder: string; send: string; unknown: string; close: string;
  sceneTitle: string; sceneTitleClone: string; prev: string; next: string; pause: string; play: string; replay: string; stepOf: (i: number, n: number) => string; tryDemo: string;
  say: Record<GuideSayKey, string>;
  values: GuideValues;
  web: {
    slogan: string; menuMain: string; menuManage: string; summary: string; payments: string; property: string; collections: string;
    ledger: string; periods: string; statements: string; morosity: string; reports: string; user: string; bell: string;
    kpiUnits: string; kpiUpToDate: string; kpiDebt: string; chartTitle: string;
    periodsTitle: string; periodsSub: string; createAll: string; newPeriod: string; closeForm: string;
    formTitle: string; formSub: string; fBuilding: string; selectBuilding: string; fYear: string; fMonth: string; fName: string; fStart: string; fEnd: string; fDue: string; fLateFee: string; optional: string; fNotes: string; notesPh: string; datePh: string; createBtn: string;
    statusDraft: string; statusPublished: string; statusClosed: string; dueLabel: string;
    toastTitle: string; toastText: string;
    cards: GuideCard[];
    cloneName: string; cloneDates: string; cloneDue: string; cloneToast: string; confirmHost: string; confirmText: string; cancel: string; accept: string;
    ledgerTitle: string; ledgerSub: string; colDesc: string; colDist: string; colAmount: string; colActions: string; expensesCount: (n: number) => string; distAll: string;
    totalBase: string; totalEdited: string; amountNew: string; editTitle: string; fAmount: string; save: string; rows: GuideRow[]; benefitsTitle: string; benefits: string[];
  };
}

const ES: GuideTx = {
  name: 'Expenses', role: 'Tu guía en Expenses', fabAria: 'Abrir la guía de Expenses',
  teaser: '¿Quieres que te muestre cómo se hace? Tócame.',
  ask: '¡Hola! ¿Qué quieres aprender? Elige o escribe tu pregunta y te lo muestro en la compu.',
  topicCreatePeriod: '¿Cómo creo un periodo de expensas?', topicClonePeriod: '¿Cómo clono el periodo del mes anterior?', inputPlaceholder: 'Escribe tu pregunta…', send: 'Enviar',
  unknown: 'Por ahora sé mostrarte cómo crear un periodo de expensas o cómo clonar el del mes anterior. ¡Pronto aprendo más cosas!', close: 'Cerrar',
  sceneTitle: 'Cómo crear un periodo de expensas', sceneTitleClone: 'Cómo clonar el periodo del mes anterior', prev: 'Anterior', next: 'Siguiente', pause: 'Pausar', play: 'Seguir', replay: 'Ver de nuevo',
  stepOf: (i, n) => `Paso ${i} de ${n}`, tryDemo: 'Explorar la demostración',
  say: {
    hello: '¡Hola! Te muestro cómo crear un periodo de expensas. Acompáñame a la compu.',
    openWeb: 'Me siento y abro el navegador. Escribo expenses.com.py y entro.',
    user: 'Escribo mi usuario. Este es de prueba: tú usas el que te dio tu administradora.',
    pass: 'Pongo la contraseña y toco «Entrar al sistema».',
    panel: 'Este es el panel. Los periodos están en el menú, dentro de «Períodos y cobros».',
    periods: 'Entro a «Periodos». Aquí ves los ciclos mensuales de cada edificio.',
    newPeriod: 'Toco «Nuevo periodo» y se abre el formulario.',
    building: 'Primero elijo el edificio.',
    yearMonth: 'Luego el año y el mes del ciclo, y un nombre fácil de reconocer.',
    dates: 'Ahora las fechas: inicio y fin del periodo, y el vencimiento, que es el día límite para pagar.',
    lateFee: 'El corte de mora es opcional: lo puedes dejar vacío.',
    create: 'Todo listo: toco «Crear periodo».',
    done: '¡Listo! El periodo quedó creado en Borrador. Después cargas los gastos y calculas la liquidación.',
    cloneHello: '¡Hola! Te enseño un atajo: clonar el periodo del mes anterior para no volver a cargar todos los gastos.',
    cloneIntro: 'Ya entré al sistema y estoy en «Periodos». Noviembre está publicado y quiero armar diciembre.',
    cloneFind: 'En la tarjeta de noviembre hay un botón de copiar: «Clonar al mes siguiente».',
    cloneClick: 'Lo toco. El sistema me pregunta si quiero clonar noviembre a diciembre y avisa que copia los gastos del edificio como base.',
    cloneConfirm: 'Acepto. ¡Listo! Apareció diciembre en Borrador, con las fechas movidas un mes.',
    cloneCopied: 'Lo mejor: no cargué nada a mano. Se copiaron todos los gastos con su proveedor, rubro, IVA y reparto. Vamos a verlos.',
    cloneOpenLedger: 'Abro «Gastos y cargos» del periodo de diciembre.',
    cloneRows: 'Aquí están los 5 gastos del mes anterior, ya cargados como base: sueldos, luz, limpieza, seguro y administración.',
    cloneEdit: 'Solo edito lo que cambió. Este mes la luz subió, así que toco el lápiz.',
    cloneAmount: 'Cambio el monto y guardo. El resto queda igual y el total se actualiza solo.',
    cloneAttach: 'Ahora adjunto la factura nueva con el clip. Las facturas no se copian: cada mes subes las de ese mes.',
    cloneBenefits: 'Ventajas de clonar: ahorras la carga, las fechas y el saldo avanzan solos, y todo queda en Borrador para ajustar.',
    cloneDone: '¡Listo! Clonas, editas lo que cambió, adjuntas las facturas nuevas y ya puedes calcular la liquidación.'
  },
  values: { url: 'expenses.com.py', user: 'demo@expenses.com.py', pass: '••••••••', building: 'Edificio Torre Mirador', year: '2026', month: '12', name: 'Diciembre 2026', start: '01/12/2026', end: '31/12/2026', due: '10/01/2027', amount: '2.120.000', amountOld: '1.850.000', invoiceFile: 'factura-ande-dic.pdf' },
  web: {
    slogan: 'Administrar también es crecer', menuMain: 'PRINCIPAL', menuManage: 'GESTIÓN', summary: 'Resumen', payments: 'Pagos', property: 'Inmuebles y personas',
    collections: 'Períodos y cobros', ledger: 'Gastos y cargos', periods: 'Periodos', statements: 'Estado de cuenta', morosity: 'Morosidad', reports: 'Reportes',
    user: 'Ana Demo', bell: 'Notificaciones', kpiUnits: 'Unidades', kpiUpToDate: 'Al día', kpiDebt: 'Con deuda', chartTitle: 'Cobranza de los últimos meses',
    periodsTitle: 'Periodos de expensas', periodsSub: 'Apertura, cierre y control de ciclos mensuales por edificio.', createAll: 'Crear para todos', newPeriod: 'Nuevo periodo', closeForm: 'Cerrar',
    formTitle: 'Nuevo periodo', formSub: 'Completá los datos del ciclo mensual', fBuilding: 'Edificio *', selectBuilding: '— Seleccionar edificio —', fYear: 'Año *', fMonth: 'Mes *', fName: 'Nombre *',
    fStart: 'Inicio *', fEnd: 'Fin *', fDue: 'Vencimiento *', fLateFee: 'Corte mora', optional: '(opcional)', fNotes: 'Notas', notesPh: 'Observaciones opcionales...', datePh: 'dd/mm/aaaa', createBtn: 'Crear periodo',
    statusDraft: 'Borrador', statusPublished: 'Publicado', statusClosed: 'Cerrado', dueLabel: 'Vence', toastTitle: 'Éxito', toastText: 'Periodo creado correctamente.',
    cards: [
      { name: 'Noviembre 2026', status: 'published', dates: '01/11/2026 – 30/11/2026' },
      { name: 'Octubre 2026', status: 'closed', dates: '01/10/2026 – 31/10/2026' }
    ],
    cloneName: 'Diciembre 2026', cloneDates: '01/12/2026 – 31/12/2026', cloneDue: '10/01/2027',
    cloneToast: 'Período Diciembre 2026 creado. Se copiaron 5 gasto(s) como base.',
    confirmHost: 'expenses.com.py dice', confirmText: '¿Clonar "Noviembre 2026" al período 2026-12? Se copiarán los gastos del edificio como base.',
    cancel: 'Cancelar', accept: 'Aceptar', ledgerTitle: 'Gastos y cargos', ledgerSub: 'Gastos del periodo, listos para liquidar.',
    colDesc: 'Descripción', colDist: 'Distribución', colAmount: 'Monto', colActions: 'Acciones', expensesCount: (n) => `${n} gastos`, distAll: 'Todas las unidades',
    totalBase: 'Gs. 11.030.000', totalEdited: 'Gs. 11.300.000', amountNew: 'Gs. 2.120.000', editTitle: 'Editar gasto · Energía eléctrica', fAmount: 'Monto *', save: 'Guardar cambios',
    rows: [
      { id: 'staff', desc: 'Sueldo de portería', supplier: 'Personal', amount: 'Gs. 4.500.000' },
      { id: 'power', desc: 'Energía eléctrica áreas comunes', supplier: 'ANDE', amount: 'Gs. 1.850.000' },
      { id: 'cleaning', desc: 'Limpieza de áreas comunes', supplier: 'Limpieza Brillante', amount: 'Gs. 2.300.000' },
      { id: 'insurance', desc: 'Seguro del edificio', supplier: 'Seguros del Sur', amount: 'Gs. 780.000' },
      { id: 'admin', desc: 'Honorarios de administración', supplier: 'Administración', amount: 'Gs. 1.600.000' }
    ],
    benefitsTitle: 'Por qué conviene clonar',
    benefits: [
      'Ahorras la carga: sueldos, servicios y seguros ya vienen con su proveedor, rubro, IVA y reparto.',
      'Las fechas avanzan un mes y, si quedó saldo del periodo anterior, pasa solo al nuevo.',
      'Entra como Borrador: editas solo lo que cambió, quitas lo que no se repite y adjuntas las facturas nuevas.',
      'Menos errores de tipeo y todos los meses con el mismo criterio contable.'
    ]
  }
};

const PT: GuideTx = {
  name: 'Expenses', role: 'Seu guia no Expenses', fabAria: 'Abrir o guia do Expenses',
  teaser: 'Quer que eu mostre como se faz? Toque em mim.',
  ask: 'Olá! O que você quer aprender? Escolha ou escreva sua pergunta e eu mostro no computador.',
  topicCreatePeriod: 'Como crio um período de condomínio?', topicClonePeriod: 'Como clono o período do mês anterior?', inputPlaceholder: 'Escreva sua pergunta…', send: 'Enviar',
  unknown: 'Por enquanto sei mostrar como criar um período ou como clonar o do mês anterior. Logo aprendo mais coisas!', close: 'Fechar',
  sceneTitle: 'Como criar um período', sceneTitleClone: 'Como clonar o período do mês anterior', prev: 'Anterior', next: 'Próximo', pause: 'Pausar', play: 'Continuar', replay: 'Ver de novo',
  stepOf: (i, n) => `Passo ${i} de ${n}`, tryDemo: 'Explorar a demonstração',
  say: {
    hello: 'Olá! Vou mostrar como criar um período de condomínio. Venha comigo até o computador.',
    openWeb: 'Sento e abro o navegador. Digito expenses.com.py e entro.',
    user: 'Digito meu usuário. Este é de teste: você usa o que a sua administradora te deu.',
    pass: 'Coloco a senha e toco em «Entrar no sistema».',
    panel: 'Este é o painel. Os períodos ficam no menu, dentro de «Períodos e cobranças».',
    periods: 'Entro em «Períodos». Aqui você vê os ciclos mensais de cada edifício.',
    newPeriod: 'Toco em «Novo período» e o formulário abre.',
    building: 'Primeiro escolho o edifício.',
    yearMonth: 'Depois o ano e o mês do ciclo, e um nome fácil de reconhecer.',
    dates: 'Agora as datas: início e fim do período, e o vencimento, o dia limite para pagar.',
    lateFee: 'O corte de multa é opcional: pode deixar vazio.',
    create: 'Tudo pronto: toco em «Criar período».',
    done: 'Pronto! O período foi criado como Rascunho. Depois você lança as despesas e calcula o rateio.',
    cloneHello: 'Olá! Vou mostrar um atalho: clonar o período do mês anterior para não lançar todas as despesas de novo.',
    cloneIntro: 'Já entrei no sistema e estou em «Períodos». Novembro está publicado e quero montar dezembro.',
    cloneFind: 'No cartão de novembro há um botão de copiar: «Clonar para o mês seguinte».',
    cloneClick: 'Toco nele. O sistema pergunta se quero clonar novembro para dezembro e avisa que copia as despesas do edifício como base.',
    cloneConfirm: 'Aceito. Pronto! Dezembro apareceu como Rascunho, com as datas movidas um mês.',
    cloneCopied: 'O melhor: não lancei nada à mão. Todas as despesas foram copiadas com fornecedor, categoria, IVA e rateio. Vamos vê-las.',
    cloneOpenLedger: 'Abro «Despesas e cobranças» do período de dezembro.',
    cloneRows: 'Aqui estão as 5 despesas do mês anterior, já lançadas como base: salário, luz, limpeza, seguro e administração.',
    cloneEdit: 'Só edito o que mudou. Neste mês a luz subiu, então toco no lápis.',
    cloneAmount: 'Mudo o valor e salvo. O resto fica igual e o total se atualiza sozinho.',
    cloneAttach: 'Agora anexo a fatura nova com o clipe. As faturas não são copiadas: todo mês você sobe as daquele mês.',
    cloneBenefits: 'Vantagens de clonar: você economiza o lançamento, as datas e o saldo avançam sozinhos, e tudo fica em Rascunho para ajustar.',
    cloneDone: 'Pronto! Você clona, edita o que mudou, anexa as faturas novas e já pode calcular o rateio.'
  },
  values: { url: 'expenses.com.py', user: 'demo@expenses.com.py', pass: '••••••••', building: 'Edifício Torre Mirador', year: '2026', month: '12', name: 'Dezembro 2026', start: '01/12/2026', end: '31/12/2026', due: '10/01/2027', amount: '2.120.000', amountOld: '1.850.000', invoiceFile: 'fatura-energia-dez.pdf' },
  web: {
    slogan: 'Administrar também é crescer', menuMain: 'PRINCIPAL', menuManage: 'GESTÃO', summary: 'Resumo', payments: 'Pagamentos', property: 'Imóveis e pessoas',
    collections: 'Períodos e cobranças', ledger: 'Despesas e cobranças', periods: 'Períodos', statements: 'Extrato', morosity: 'Inadimplência', reports: 'Relatórios',
    user: 'Ana Demo', bell: 'Notificações', kpiUnits: 'Unidades', kpiUpToDate: 'Em dia', kpiDebt: 'Com dívida', chartTitle: 'Arrecadação dos últimos meses',
    periodsTitle: 'Períodos de condomínio', periodsSub: 'Abertura, fechamento e controle dos ciclos mensais por edifício.', createAll: 'Criar para todos', newPeriod: 'Novo período', closeForm: 'Fechar',
    formTitle: 'Novo período', formSub: 'Preencha os dados do ciclo mensal', fBuilding: 'Edifício *', selectBuilding: '— Selecionar edifício —', fYear: 'Ano *', fMonth: 'Mês *', fName: 'Nome *',
    fStart: 'Início *', fEnd: 'Fim *', fDue: 'Vencimento *', fLateFee: 'Corte de multa', optional: '(opcional)', fNotes: 'Notas', notesPh: 'Observações opcionais...', datePh: 'dd/mm/aaaa', createBtn: 'Criar período',
    statusDraft: 'Rascunho', statusPublished: 'Publicado', statusClosed: 'Fechado', dueLabel: 'Vence', toastTitle: 'Sucesso', toastText: 'Período criado com sucesso.',
    cards: [
      { name: 'Novembro 2026', status: 'published', dates: '01/11/2026 – 30/11/2026' },
      { name: 'Outubro 2026', status: 'closed', dates: '01/10/2026 – 31/10/2026' }
    ],
    cloneName: 'Dezembro 2026', cloneDates: '01/12/2026 – 31/12/2026', cloneDue: '10/01/2027',
    cloneToast: 'Período Dezembro 2026 criado. 5 despesa(s) copiada(s) como base.',
    confirmHost: 'expenses.com.py diz', confirmText: 'Clonar "Novembro 2026" para o período 2026-12? As despesas do edifício serão copiadas como base.',
    cancel: 'Cancelar', accept: 'Aceitar', ledgerTitle: 'Despesas e cobranças', ledgerSub: 'Despesas do período, prontas para ratear.',
    colDesc: 'Descrição', colDist: 'Distribuição', colAmount: 'Valor', colActions: 'Ações', expensesCount: (n) => `${n} despesas`, distAll: 'Todas as unidades',
    totalBase: 'Gs. 11.030.000', totalEdited: 'Gs. 11.300.000', amountNew: 'Gs. 2.120.000', editTitle: 'Editar despesa · Energia elétrica', fAmount: 'Valor *', save: 'Salvar alterações',
    rows: [
      { id: 'staff', desc: 'Salário da portaria', supplier: 'Pessoal', amount: 'Gs. 4.500.000' },
      { id: 'power', desc: 'Energia elétrica áreas comuns', supplier: 'ANDE', amount: 'Gs. 1.850.000' },
      { id: 'cleaning', desc: 'Limpeza de áreas comuns', supplier: 'Limpeza Brilhante', amount: 'Gs. 2.300.000' },
      { id: 'insurance', desc: 'Seguro do edifício', supplier: 'Seguros do Sul', amount: 'Gs. 780.000' },
      { id: 'admin', desc: 'Honorários de administração', supplier: 'Administração', amount: 'Gs. 1.600.000' }
    ],
    benefitsTitle: 'Por que vale clonar',
    benefits: [
      'Você economiza o lançamento: salários, serviços e seguros já vêm com fornecedor, categoria, IVA e rateio.',
      'As datas avançam um mês e, se sobrou saldo do período anterior, ele passa sozinho para o novo.',
      'Entra como Rascunho: você edita só o que mudou, tira o que não se repete e anexa as faturas novas.',
      'Menos erros de digitação e todo mês com o mesmo critério contábil.'
    ]
  }
};

const EN: GuideTx = {
  name: 'Expenses', role: 'Your Expenses guide', fabAria: 'Open the Expenses guide',
  teaser: 'Want me to show you how it\'s done? Tap me.',
  ask: 'Hi! What do you want to learn? Pick or type your question and I\'ll show you on the computer.',
  topicCreatePeriod: 'How do I create a billing period?', topicClonePeriod: 'How do I clone last month\'s period?', inputPlaceholder: 'Type your question…', send: 'Send',
  unknown: 'For now I can show you how to create a billing period or how to clone last month\'s. I\'ll learn more soon!', close: 'Close',
  sceneTitle: 'How to create a billing period', sceneTitleClone: 'How to clone last month\'s period', prev: 'Back', next: 'Next', pause: 'Pause', play: 'Resume', replay: 'Watch again',
  stepOf: (i, n) => `Step ${i} of ${n}`, tryDemo: 'Explore the demo',
  say: {
    hello: 'Hi! I\'ll show you how to create a billing period. Come with me to the computer.',
    openWeb: 'I sit down and open the browser. I type expenses.com.py and go in.',
    user: 'I type my user. This one is a test user: you use the one your management company gave you.',
    pass: 'I enter the password and tap “Log in”.',
    panel: 'This is the dashboard. Periods are in the menu, under “Periods & billing”.',
    periods: 'I open “Periods”. Here you see each building\'s monthly cycles.',
    newPeriod: 'I tap “New period” and the form opens.',
    building: 'First I pick the building.',
    yearMonth: 'Then the year and month of the cycle, and an easy-to-recognize name.',
    dates: 'Now the dates: start and end of the period, and the due date, the last day to pay.',
    lateFee: 'The late-fee cutoff is optional: you can leave it empty.',
    create: 'All set: I tap “Create period”.',
    done: 'Done! The period was created as a Draft. Next you add the expenses and calculate the settlement.',
    cloneHello: 'Hi! I\'ll show you a shortcut: clone last month\'s period so you don\'t enter every expense again.',
    cloneIntro: 'I\'m already logged in and on “Periods”. November is published and I want to set up December.',
    cloneFind: 'On the November card there\'s a copy button: “Clone to next month”.',
    cloneClick: 'I tap it. The system asks if I want to clone November into December and warns that it copies the building\'s expenses as a base.',
    cloneConfirm: 'I accept. Done! December appeared as a Draft, with the dates moved forward a month.',
    cloneCopied: 'Best part: I didn\'t enter anything by hand. Every expense was copied with its supplier, category, VAT and split. Let\'s take a look.',
    cloneOpenLedger: 'I open the “Expenses & charges” of the December period.',
    cloneRows: 'Here are last month\'s 5 expenses, already loaded as a base: payroll, power, cleaning, insurance and management.',
    cloneEdit: 'I only edit what changed. Power went up this month, so I tap the pencil.',
    cloneAmount: 'I change the amount and save. Everything else stays the same and the total updates by itself.',
    cloneAttach: 'Now I attach the new invoice with the paperclip. Invoices aren\'t copied: each month you upload that month\'s.',
    cloneBenefits: 'Why cloning pays off: you skip the data entry, dates and balance carry forward by themselves, and it all stays a Draft to adjust.',
    cloneDone: 'Done! You clone, edit what changed, attach the new invoices and you can calculate the settlement.'
  },
  values: { url: 'expenses.com.py', user: 'demo@expenses.com.py', pass: '••••••••', building: 'Torre Mirador Building', year: '2026', month: '12', name: 'December 2026', start: '12/01/2026', end: '12/31/2026', due: '01/10/2027', amount: '2,120,000', amountOld: '1,850,000', invoiceFile: 'invoice-power-dec.pdf' },
  web: {
    slogan: 'Managing is growing too', menuMain: 'MAIN', menuManage: 'MANAGEMENT', summary: 'Summary', payments: 'Payments', property: 'Properties & people',
    collections: 'Periods & billing', ledger: 'Expenses & charges', periods: 'Periods', statements: 'Account statement', morosity: 'Arrears', reports: 'Reports',
    user: 'Ana Demo', bell: 'Notifications', kpiUnits: 'Units', kpiUpToDate: 'Up to date', kpiDebt: 'In arrears', chartTitle: 'Collections in recent months',
    periodsTitle: 'Billing periods', periodsSub: 'Opening, closing and control of monthly cycles per building.', createAll: 'Create for all', newPeriod: 'New period', closeForm: 'Close',
    formTitle: 'New period', formSub: 'Fill in the monthly cycle details', fBuilding: 'Building *', selectBuilding: '— Select building —', fYear: 'Year *', fMonth: 'Month *', fName: 'Name *',
    fStart: 'Start *', fEnd: 'End *', fDue: 'Due date *', fLateFee: 'Late-fee cutoff', optional: '(optional)', fNotes: 'Notes', notesPh: 'Optional notes...', datePh: 'mm/dd/yyyy', createBtn: 'Create period',
    statusDraft: 'Draft', statusPublished: 'Published', statusClosed: 'Closed', dueLabel: 'Due', toastTitle: 'Success', toastText: 'Period created successfully.',
    cards: [
      { name: 'November 2026', status: 'published', dates: '11/01/2026 – 11/30/2026' },
      { name: 'October 2026', status: 'closed', dates: '10/01/2026 – 10/31/2026' }
    ],
    cloneName: 'December 2026', cloneDates: '12/01/2026 – 12/31/2026', cloneDue: '01/10/2027',
    cloneToast: 'Period December 2026 created. 5 expense(s) copied as a base.',
    confirmHost: 'expenses.com.py says', confirmText: 'Clone "November 2026" into period 2026-12? The building\'s expenses will be copied as a base.',
    cancel: 'Cancel', accept: 'OK', ledgerTitle: 'Expenses & charges', ledgerSub: 'Period expenses, ready to settle.',
    colDesc: 'Description', colDist: 'Split', colAmount: 'Amount', colActions: 'Actions', expensesCount: (n) => `${n} expenses`, distAll: 'All units',
    totalBase: 'Gs. 11,030,000', totalEdited: 'Gs. 11,300,000', amountNew: 'Gs. 2,120,000', editTitle: 'Edit expense · Common-area power', fAmount: 'Amount *', save: 'Save changes',
    rows: [
      { id: 'staff', desc: 'Doorman payroll', supplier: 'Staff', amount: 'Gs. 4,500,000' },
      { id: 'power', desc: 'Common-area power', supplier: 'ANDE', amount: 'Gs. 1,850,000' },
      { id: 'cleaning', desc: 'Common-area cleaning', supplier: 'Bright Cleaning', amount: 'Gs. 2,300,000' },
      { id: 'insurance', desc: 'Building insurance', supplier: 'Southern Insurance', amount: 'Gs. 780,000' },
      { id: 'admin', desc: 'Management fees', supplier: 'Management', amount: 'Gs. 1,600,000' }
    ],
    benefitsTitle: 'Why cloning pays off',
    benefits: [
      'You skip the data entry: payroll, utilities and insurance come with supplier, category, VAT and split.',
      'Dates move forward a month and, if there was a balance left over, it carries into the new period.',
      'It starts as a Draft: edit only what changed, remove what doesn\'t repeat and attach the new invoices.',
      'Fewer typing mistakes and the same accounting criteria every month.'
    ]
  }
};

export const GUIDE_TX: Dict<GuideTx> = { es: ES, pt: PT, en: EN };
