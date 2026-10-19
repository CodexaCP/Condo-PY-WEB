import { FinancialAccountType } from './models';

// Operaciones guiadas de Finanzas (api/finance/operations): hoy, transferencias entre cuentas propias.

export type FinanceTransferStatus = 'Active' | 'Voided';

export interface FinanceTransferAccount {
  id: string;
  name: string;
  type: FinancialAccountType;
  isActive: boolean;
  balance: number;
}

export interface FinanceTransfer {
  id: string;
  transferDate: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  // Depósito de efectivo, retiro, aporte o retiro del fondo de reserva, o transferencia entre cuentas.
  kind: string;
  amount: number;
  reference: string;
  notes: string;
  supportReference: string;
  status: FinanceTransferStatus;
  createdAtUtc: string;
  createdByName: string;
  voidedAtUtc: string | null;
  voidedByName: string;
  voidReason: string;
  // Números de asiento vigentes del Libro diario (vacío = todavía no asentada).
  journalLabels: string[];
}

export interface FinanceTransfers {
  buildingId: string;
  buildingName: string;
  canEdit: boolean;
  financeStartDate: string;
  postedThrough: string | null;
  totalBalance: number;
  accounts: FinanceTransferAccount[];
  items: FinanceTransfer[];
}

export interface CreateFinanceTransferRequest {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  transferDate: string | null;
  reference: string | null;
  notes: string | null;
  supportReference: string | null;
  confirmNegativeBalance: boolean;
}

// Cómo quedarían los saldos y qué asiento saldría, sin guardar nada.
export interface FinanceTransferPreview {
  kind: string;
  fromAccountName: string;
  fromBefore: number;
  fromAfter: number;
  toAccountName: string;
  toBefore: number;
  toAfter: number;
  totalBalance: number;
  requiresSupport: boolean;
  needsNegativeConfirmation: boolean;
  debitAccount: string | null;
  creditAccount: string | null;
  warnings: string[];
}
