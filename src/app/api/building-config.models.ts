// Tipos del Centro de configuración del edificio (backend: api/building-config/{buildingId}/...). Los enums viajan como texto.

export type ConfigSectionStatus = 'Complete' | 'Incomplete' | 'Optional' | 'NotAvailable';

// Dónde se edita una sección: 'building' (pestaña de la ficha del edificio), 'finance' (pantallas de Finanzas) o 'self' (en el propio Centro).
export type ConfigLinkKind = 'building' | 'finance' | 'self';

export interface ConfigSummaryItem {
  label: string;
  value: string;
}

export interface ConfigSection {
  key: string;
  order: number;
  name: string;
  status: ConfigSectionStatus;
  // Cuenta para el indicador «listo para operar». Las opcionales muestran su estado pero no cuentan.
  required: boolean;
  reasons: string[];
  summary: ConfigSummaryItem[];
  canEdit: boolean;
  linkKind: ConfigLinkKind | null;
  // building: general, legal, billing, accounting o config · finance: settings, budget, reconciliation o accounting · self: la clave de la sección.
  linkTab: string | null;
}

export interface BuildingConfigOverview {
  buildingId: string;
  buildingName: string;
  sections: ConfigSection[];
  requiredCount: number;
  readyCount: number;
  readyToOperate: boolean;
  financeAvailable: boolean;
  canViewAudit: boolean;
}

export interface ConfigChange {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
}

export interface ConfigAuditEntry {
  id: string;
  createdAtUtc: string;
  section: string;
  sectionName: string;
  action: string;
  summary: string;
  entityType: string | null;
  entityId: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  changes: ConfigChange[];
}

export interface ConfigAuditPage {
  totalCount: number;
  page: number;
  pageSize: number;
  items: ConfigAuditEntry[];
}

export interface ConfigAuditFilters {
  section?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

// ── Período y cierre ──────────────────────────────────────────────────────────

export type ClosingMonthStatus = 'Open' | 'Closed' | 'Current';

export interface ClosingMonth {
  year: number;
  month: number;
  label: string;
  status: ClosingMonthStatus;
  closedAtUtc: string | null;
  closedByName: string | null;
  // Se puede cerrar ahora: cierre encendido, mes terminado y sin meses anteriores abiertos.
  canClose: boolean;
  cannotCloseReason: string | null;
  canReopen: boolean;
}

export interface ClosureHistoryItem {
  id: string;
  year: number;
  month: number;
  label: string;
  closedAtUtc: string;
  closedByName: string;
  reopenedAtUtc: string | null;
  reopenedByName: string | null;
  reopenReason: string | null;
}

export interface PeriodClosing {
  buildingId: string;
  financeAvailable: boolean;
  enabled: boolean;
  canEdit: boolean;
  financeStartDate: string | null;
  fiscalYearStartMonth: number;
  months: ClosingMonth[];
  history: ClosureHistoryItem[];
}

// ── Política de mora ──────────────────────────────────────────────────────────

export type LateFeeFrequencyValue = 'Daily' | 'Weekly' | 'Biweekly';

export interface LateFeePolicy {
  buildingId: string;
  ratePercentage: number | null;
  frequency: LateFeeFrequencyValue | null;
  graceDays: number | null;
  capPercentage: number | null;
  minAmount: number | null;
  appliesToReserve: boolean;
  appliesToExtraordinary: boolean;
  appliesToIndividual: boolean;
  confirmed: boolean;
  exemptUnitCount: number;
  canEdit: boolean;
}

export interface UpdateLateFeePolicyRequest {
  ratePercentage: number | null;
  frequency: LateFeeFrequencyValue | null;
  graceDays: number | null;
  capPercentage: number | null;
  minAmount: number | null;
  appliesToReserve: boolean;
  appliesToExtraordinary: boolean;
  appliesToIndividual: boolean;
}

export interface UnitLateFeeExemptionRequest {
  exempt: boolean;
  reason: string | null;
}

// ── Fondos ────────────────────────────────────────────────────────────────────

export type IncomeTreatmentValue = 'CreditToOwners' | 'ToReserveFund';
export type ReserveUsePolicy = 'FreeUse' | 'RequiresPresidentApproval' | 'RequiresAssemblyApproval';

export interface FundPolicy {
  buildingId: string;
  incomeTreatment: IncomeTreatmentValue;
  reserveFundPercentage: number | null;
  extraordinaryPercentage: number | null;
  reserveUsePolicy: ReserveUsePolicy;
  reserveUseThreshold: number | null;
  confirmed: boolean;
  canEdit: boolean;
}

export interface UpdateFundPolicyRequest {
  incomeTreatment: IncomeTreatmentValue;
  reserveFundPercentage: number | null;
  extraordinaryPercentage: number | null;
  reserveUsePolicy: ReserveUsePolicy;
  reserveUseThreshold: number | null;
}

// ── Alertas del presupuesto ───────────────────────────────────────────────────

export interface BudgetAlerts {
  buildingId: string;
  financeAvailable: boolean;
  // Desvío (en %) hasta el cual el renglón queda en amarillo; más allá, en rojo (1 a 100).
  warnPercent: number;
  canEdit: boolean;
}

// ── Avisos automáticos ────────────────────────────────────────────────────────

export type NoticeKind = 'BeforeDue' | 'OnDue' | 'LateFeeApplied' | 'PaymentReceived' | 'PeriodPublished';

export interface NoticeRule {
  kind: NoticeKind;
  label: string;
  isActive: boolean;
  // Solo BeforeDue: días de anticipación (1 a 30).
  offsetDays: number | null;
  // Sin regla guardada: se muestra el valor por defecto.
  isDefault: boolean;
}

export interface NoticeRules {
  buildingId: string;
  rules: NoticeRule[];
  canEdit: boolean;
}

export interface UpdateNoticeRuleItem {
  kind: NoticeKind;
  isActive: boolean;
  offsetDays: number | null;
}

// ── Impuestos: IVA de las compras por cuenta de egresos ───────────────────────

export type VatTreatment = 'Vat10' | 'Vat5' | 'Exempt' | 'NotApplicable';

export interface VatTreatmentItem {
  categoryId: string;
  code: string;
  name: string;
  groupName: string;
  isActive: boolean;
  treatment: VatTreatment | null;
}

export interface VatTreatments {
  buildingId: string;
  financeAvailable: boolean;
  buildingVatRegime: 'General' | 'Resimple' | 'Exempt' | null;
  // El edificio discrimina IVA en sus compras (régimen general): solo entonces el tratamiento de cada cuenta es obligatorio.
  applies: boolean;
  definedCount: number;
  totalCount: number;
  canEdit: boolean;
  items: VatTreatmentItem[];
}

export interface VatTreatmentUpdateItem {
  categoryId: string;
  treatment: VatTreatment | null;
}

// ── Proveedores de la empresa ─────────────────────────────────────────────────

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  ruc: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  // Plazo de pago habitual en días: al cargarle un gasto, el vencimiento se propone como fecha del gasto + plazo.
  paymentTermDays: number | null;
  isActive: boolean;
  // Gastos cargados con este proveedor (si tiene gastos no se elimina: se desactiva).
  expenseCount: number;
}

export interface SupplierUpsertRequest {
  // Solo lo usa el SuperAdmin al crear (no tiene empresa propia).
  companyId?: string | null;
  name: string;
  ruc: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  paymentTermDays: number | null;
  isActive: boolean;
}

export interface SupplierPage {
  totalCount: number;
  page: number;
  pageSize: number;
  canEdit: boolean;
  items: Supplier[];
}

export interface SupplierFilters {
  companyId?: string;
  q?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

// ── Cuentas por pagar y por cobrar ────────────────────────────────────────────

export interface AgingBucket {
  label: string;
  count: number;
  total: number;
}

export interface PayablesSummary {
  pendingCount: number;
  pendingTotal: number;
  overdueCount: number;
  overdueTotal: number;
  dueNext7DaysTotal: number;
  aging: AgingBucket[];
}

export type PayablesStatusFilter = 'all' | 'pending' | 'overdue' | 'paid';

export interface PayableRow {
  expenseId: string;
  expensePeriodId: string;
  expensePeriodName: string;
  supplierId: string | null;
  supplierName: string;
  supplierRuc: string | null;
  description: string;
  invoiceNumber: string | null;
  expenseDate: string;
  dueDate: string;
  amount: number;
  // Pending, Overdue o Paid.
  status: string;
  daysOverdue: number;
  paidAt: string | null;
  paidFromAccountName: string | null;
  ledgerCategoryCode: string | null;
  ledgerCategoryName: string | null;
  vatRate: number | null;
  vatAmount: number | null;
}

export interface PayablesPage {
  buildingId: string;
  summary: PayablesSummary;
  totalCount: number;
  page: number;
  pageSize: number;
  items: PayableRow[];
}

export interface PayablesFilters {
  status?: PayablesStatusFilter;
  supplierId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface RegisterExpensePaymentRequest {
  paidAt: string;
  accountId: string | null;
}

// ── Libro de compras (IVA de los gastos) ──────────────────────────────────────

export interface VatPurchaseRow {
  date: string;
  expenseId: string;
  supplierName: string;
  supplierRuc: string | null;
  timbrado: string | null;
  documentNumber: string | null;
  isCreditNote: boolean;
  description: string;
  ledgerCategoryCode: string | null;
  ledgerCategoryName: string | null;
  // Total del comprobante con IVA incluido (negativo en una nota de crédito).
  total: number;
  vatRate: number;
  base: number;
  vat: number;
}

export interface VatRateTotals {
  // 10, 5 o 0 (exento).
  rate: number;
  count: number;
  total: number;
  base: number;
  vat: number;
}

export interface VatPurchasesBook {
  buildingId: string;
  buildingName: string;
  from: string;
  to: string;
  rows: VatPurchaseRow[];
  totalsByRate: VatRateTotals[];
  grandTotal: number;
  grandBase: number;
  grandVat: number;
  // Gastos del rango sin tasa de IVA cuya cuenta no es «no corresponde»: hay que clasificarlos para que entren al libro.
  unclassifiedCount: number;
  unclassifiedTotal: number;
}

// ── Conciliación bancaria manual ──────────────────────────────────────────────

export type ReconciliationStatus = 'Open' | 'Completed';
export type LedgerSourceType = 'OwnerPayment' | 'BuildingExpense' | 'BuildingIncome' | 'SupplierCreditNote';
export type LedgerDirection = 'In' | 'Out';

// Una cuenta bancaria del edificio con el estado de su conciliación.
export interface ReconciliationAccount {
  accountId: string;
  accountName: string;
  isActive: boolean;
  // Saldo del libro a hoy.
  bookBalance: number;
  lastCompletedDate: string | null;
  lastStatementBalance: number | null;
  openReconciliationId: string | null;
  openStatementDate: string | null;
}

export interface ReconciliationOverview {
  buildingId: string;
  canEdit: boolean;
  accounts: ReconciliationAccount[];
}

export interface ReconciliationSummary {
  id: string;
  accountId: string;
  accountName: string;
  statementDate: string;
  statementBalance: number;
  status: ReconciliationStatus;
  completedAtUtc: string | null;
  completedByName: string | null;
  reconciledBalanceAtCompletion: number | null;
  markedCount: number;
  notes: string | null;
}

// Un movimiento del libro en la pantalla de conciliación (marcado o pendiente).
export interface ReconciliationMovement {
  sourceType: LedgerSourceType;
  sourceId: string;
  date: string;
  description: string;
  thirdParty: string;
  reference: string;
  // Con signo: entradas positivas y salidas negativas. En un marcado, el importe vigente del libro.
  amount: number;
  direction: LedgerDirection;
  isMarked: boolean;
  reconciliationId: string | null;
  // True si lo marcó esta conciliación (los de conciliaciones cerradas anteriores no se tocan desde esta).
  inThisReconciliation: boolean;
  // Ok, Changed (el importe cambió después de marcarlo) o Missing (ya no figura en el libro a esa fecha).
  state: 'Ok' | 'Changed' | 'Missing';
  markedAmount: number | null;
  markedAtUtc: string | null;
  markedByName: string | null;
}

export interface ReconciliationWorkspace {
  id: string;
  buildingId: string;
  accountId: string;
  accountName: string;
  statementDate: string;
  statementBalance: number;
  notes: string | null;
  status: ReconciliationStatus;
  canEdit: boolean;
  openingBalance: number;
  bookBalance: number;
  // Saldo inicial más lo ya marcado como conciliado, hasta la fecha de corte.
  reconciledBalance: number;
  // Saldo del extracto menos el saldo conciliado. Cero = conciliada.
  difference: number;
  isBalanced: boolean;
  // Lo del libro hasta la fecha de corte que todavía no se marcó (depósitos y cheques en tránsito, por ejemplo).
  pendingIn: number;
  pendingOut: number;
  pendingCount: number;
  pendingTruncated: boolean;
  changedCount: number;
  missingCount: number;
  alerts: string[];
  marked: ReconciliationMovement[];
  pending: ReconciliationMovement[];
}

export interface StartReconciliationRequest {
  buildingId: string;
  accountId: string;
  statementDate: string;
  statementBalance: number;
  notes: string | null;
}

export interface UpdateReconciliationRequest {
  statementDate: string;
  statementBalance: number;
  notes: string | null;
}

export interface ReconciliationItemRef {
  sourceType: LedgerSourceType;
  sourceId: string;
}
