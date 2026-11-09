import { Dict } from '../../core/i18n/lang.service';

// Textos de la página pública a la que lleva el QR de un documento (/v/:token), en los tres idiomas.
export interface VerifyTx {
  seoTitle: string;
  loading: string;
  badge: Record<'valid' | 'draft' | 'superseded' | 'revoked' | 'unavailable' | 'notfound' | 'error', string>;
  lead: Record<'valid' | 'draft' | 'superseded' | 'revoked' | 'unavailable' | 'notfound' | 'error', string>;
  building: string;
  administrator: string;
  period: string;
  total: string;
  issued: string;
  replaced: string;
  check: string;
  privacy: string;
  retry: string;
  footer: string;
}

const ES: VerifyTx = {
  seoTitle: 'Verificación de documento · Expenses',
  loading: 'Verificando el documento…',
  badge: {
    valid: 'Documento auténtico y vigente',
    draft: 'Borrador: todavía no está publicado',
    superseded: 'Este documento fue reemplazado',
    revoked: 'Este documento fue anulado',
    unavailable: 'Este documento ya no está disponible',
    notfound: 'No encontramos este documento',
    error: 'No pudimos verificarlo ahora'
  },
  lead: {
    valid: 'Lo emitió Expenses y es la versión vigente.',
    draft: 'Se imprimió antes de publicarse. Pedile a la administración la versión publicada.',
    superseded: 'Hay una versión más nueva. Pedila a la administración y no uses este papel.',
    revoked: 'La administración lo retiró. No lo uses.',
    unavailable: 'La liquidación original se eliminó del sistema.',
    notfound: 'El código no corresponde a ningún documento emitido por Expenses. Si lo recibiste impreso o por mensaje, desconfiá de él.',
    error: 'Revisá tu conexión e intentá de nuevo.'
  },
  building: 'Edificio',
  administrator: 'Administra',
  period: 'Período',
  total: 'Total de la liquidación',
  issued: 'Emitido el',
  replaced: 'Reemplazado el',
  check: 'Comparalo con el papel: si el total o el período no coinciden, no es el documento original.',
  privacy: 'Esta página muestra solo datos que ya figuran en la liquidación. No muestra unidades ni datos personales.',
  retry: 'Reintentar',
  footer: 'Verificación de documentos'
};

const PT: VerifyTx = {
  seoTitle: 'Verificação de documento · Expenses',
  loading: 'Verificando o documento…',
  badge: {
    valid: 'Documento autêntico e vigente',
    draft: 'Rascunho: ainda não foi publicado',
    superseded: 'Este documento foi substituído',
    revoked: 'Este documento foi anulado',
    unavailable: 'Este documento não está mais disponível',
    notfound: 'Não encontramos este documento',
    error: 'Não foi possível verificar agora'
  },
  lead: {
    valid: 'Foi emitido pelo Expenses e é a versão vigente.',
    draft: 'Foi impresso antes de ser publicado. Peça à administração a versão publicada.',
    superseded: 'Há uma versão mais nova. Peça à administração e não use este papel.',
    revoked: 'A administração o retirou. Não o use.',
    unavailable: 'A prestação de contas original foi removida do sistema.',
    notfound: 'O código não corresponde a nenhum documento emitido pelo Expenses. Se o recebeu impresso ou por mensagem, desconfie dele.',
    error: 'Verifique sua conexão e tente novamente.'
  },
  building: 'Edifício',
  administrator: 'Administração',
  period: 'Período',
  total: 'Total da prestação de contas',
  issued: 'Emitido em',
  replaced: 'Substituído em',
  check: 'Compare com o papel: se o total ou o período não coincidirem, não é o documento original.',
  privacy: 'Esta página mostra apenas dados que já constam no documento. Não mostra unidades nem dados pessoais.',
  retry: 'Tentar novamente',
  footer: 'Verificação de documentos'
};

const EN: VerifyTx = {
  seoTitle: 'Document verification · Expenses',
  loading: 'Verifying the document…',
  badge: {
    valid: 'Authentic and current document',
    draft: 'Draft: not published yet',
    superseded: 'This document has been replaced',
    revoked: 'This document has been cancelled',
    unavailable: 'This document is no longer available',
    notfound: 'We could not find this document',
    error: 'We could not verify it right now'
  },
  lead: {
    valid: 'It was issued by Expenses and is the current version.',
    draft: 'It was printed before being published. Ask the administration for the published version.',
    superseded: 'There is a newer version. Ask the administration for it and do not use this paper.',
    revoked: 'The administration withdrew it. Do not use it.',
    unavailable: 'The original statement was removed from the system.',
    notfound: 'This code does not match any document issued by Expenses. If you received it printed or in a message, be wary of it.',
    error: 'Check your connection and try again.'
  },
  building: 'Building',
  administrator: 'Administered by',
  period: 'Period',
  total: 'Statement total',
  issued: 'Issued on',
  replaced: 'Replaced on',
  check: 'Compare it with the paper: if the total or the period do not match, it is not the original document.',
  privacy: 'This page only shows data that already appears on the statement. It shows no units or personal data.',
  retry: 'Try again',
  footer: 'Document verification'
};

export const VERIFY_TX: Dict<VerifyTx> = { es: ES, pt: PT, en: EN };
