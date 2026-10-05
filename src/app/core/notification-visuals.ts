// Ícono y color de cada tipo de notificación. Lo comparten la página de Notificaciones y el aviso en pantalla
// (NotificationAlertService), para que un mismo tipo se vea igual en los dos lados.
// Los tipos son los de Condo.Domain/Enums/NotificationType.cs: si el backend suma uno, se agrega acá.

const TONE = {
  ok:     '#22c55e',
  warn:   '#f59e0b',
  bad:    '#ef4444',
  info:   '#3b82f6',
  plan:   '#f97316',
  brand:  '#6366f1',
  teal:   '#14b8a6',
  violet: '#8b5cf6'
} as const;

export interface NotificationVisual {
  icon: string;
  color: string;
}

const DEFAULT_VISUAL: NotificationVisual = { icon: 'pi-bell', color: TONE.info };

const VISUALS: Record<string, NotificationVisual> = {
  // Pagos de expensas
  OwnerPaymentSubmitted:    { icon: 'pi-inbox',            color: TONE.warn },
  PaymentUnderReview:       { icon: 'pi-search',           color: TONE.info },
  PaymentApproved:          { icon: 'pi-check-circle',     color: TONE.ok },
  PaymentRejected:          { icon: 'pi-times-circle',     color: TONE.bad },
  LateFeeConfigChanged:     { icon: 'pi-exclamation-circle', color: TONE.plan },
  // Facturas y notas de crédito
  InvoiceIssued:            { icon: 'pi-file',             color: TONE.info },
  CreditNoteApproved:       { icon: 'pi-receipt',          color: TONE.ok },
  // Liquidación de expensas
  ExpensePeriodPublished:   { icon: 'pi-receipt',          color: TONE.brand },
  ExpensePeriodUnpublished: { icon: 'pi-undo',             color: TONE.warn },
  SettlementRejected:       { icon: 'pi-times-circle',     color: TONE.bad },
  SettlementPendingPresidentReview: { icon: 'pi-file-edit', color: TONE.violet },
  SettlementRejectedByPresident:    { icon: 'pi-times-circle', color: TONE.bad },
  SettlementApprovedByPresident:    { icon: 'pi-file-check', color: TONE.ok },
  // Comunicados, votaciones y reclamos
  AnnouncementPublished:    { icon: 'pi-megaphone',        color: TONE.brand },
  VoteOpened:               { icon: 'pi-check-square',     color: TONE.violet },
  ClaimCreated:             { icon: 'pi-comments',         color: TONE.info },
  ClaimStatusUpdated:       { icon: 'pi-comments',         color: TONE.info },
  // Reservas de áreas comunes
  AmenityReservationCreated: { icon: 'pi-calendar',        color: TONE.teal },
  AmenityReservationUpdated: { icon: 'pi-calendar',        color: TONE.teal },
  // Plan del edificio
  PlanExpiringSoon:         { icon: 'pi-clock',            color: TONE.warn },
  PlanExpired:              { icon: 'pi-exclamation-circle', color: TONE.plan },
  PlanSuspended:            { icon: 'pi-lock',             color: TONE.bad },
  // Marketplace
  MarketplaceReservationExpired:   { icon: 'pi-clock',          color: TONE.plan },
  MarketplacePaymentPending:       { icon: 'pi-money-bill',     color: TONE.warn },
  MarketplaceReservationConfirmed: { icon: 'pi-check-circle',   color: TONE.ok },
  MarketplaceReservationRejected:  { icon: 'pi-times-circle',   color: TONE.bad },
  MarketplaceNewReservation:       { icon: 'pi-shop',           color: TONE.teal },
  MarketplaceCreditApplied:        { icon: 'pi-wallet',         color: TONE.ok },
  MarketplaceCreditReversed:       { icon: 'pi-wallet',         color: TONE.warn },
  MarketplaceReservationCancelled: { icon: 'pi-times-circle',   color: TONE.bad },
  MarketplaceRefundPending:        { icon: 'pi-replay',         color: TONE.warn },
  MarketplaceRefundReturned:       { icon: 'pi-check-circle',   color: TONE.ok },
  MarketplaceRefundOverdue:        { icon: 'pi-exclamation-circle', color: TONE.bad },
  MarketplaceClaimOpened:          { icon: 'pi-flag',           color: TONE.plan },
  MarketplaceClaimResolved:        { icon: 'pi-flag',           color: TONE.ok },
  MarketplaceStartNotice:          { icon: 'pi-stopwatch',      color: TONE.info },
  MarketplaceHandoverNote:         { icon: 'pi-arrow-right-arrow-left', color: TONE.violet }
};

export function notificationVisual(type: string | null | undefined): NotificationVisual {
  return (type && VISUALS[type]) || DEFAULT_VISUAL;
}
