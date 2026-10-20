// Cobros online de expensas: lo que el propietario puede pagar, el cobro abierto con el proveedor y su registro para el personal.

export type OnlinePaymentStatus = 'Open' | 'Paid' | 'Closed' | 'ReviewRequired' | 'Reversed';

export interface OnlinePaymentItem {
  unitId: string;
  unitCode: string;
  expensePeriodId: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
}

export interface OnlinePaymentEvent {
  receivedAtUtc: string;
  direction: string;
  kind: string;
  outcome: string;
  error?: string | null;
  signatureOk?: boolean | null;
  ip?: string | null;
}

export interface OnlinePayment {
  id: string;
  number: number;
  buildingId: string;
  buildingName: string;
  ownerId: string;
  ownerFullName: string;
  amount: number;
  currency: string;
  status: OnlinePaymentStatus;
  closeReason?: string | null;
  reviewReason?: string | null;
  holderName: string;
  holderTaxId: string;
  isSimulated: boolean;
  expiresAtUtc?: string | null;
  createdAtUtc: string;
  connectionId: string;
  connectionName: string;
  // "Fake" = simulador de cobros.
  connectionProviderCode: string;
  attemptNumber?: number | null;
  attemptStatus?: string | null;
  // Dónde paga el propietario. Solo mientras el intento espera el pago.
  checkoutUrl?: string | null;
  confirmedAtUtc?: string | null;
  providerTransactionId?: string | null;
  authorizationCode?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  ownerPaymentId?: string | null;
  ownerPaymentReference?: string | null;
  items: OnlinePaymentItem[];
  // Solo para el SuperAdmin y el Administrador de empresa.
  events?: OnlinePaymentEvent[] | null;
}

// Resultado de simular la respuesta del proveedor falso (el mismo camino que el aviso real).
export interface FakePaymentResult {
  webhookStatusCode: number;
  success: boolean;
  message?: string | null;
  payment?: OnlinePayment | null;
}
