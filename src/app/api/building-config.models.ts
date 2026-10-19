import type { FinanceBudgetVsActual } from './models';

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
export type LedgerSourceType = 'OwnerPayment' | 'BuildingExpense' | 'BuildingIncome' | 'SupplierCreditNote' | 'OpeningBalance';
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

// ── Asientos sugeridos y contrapartidas contables ─────────────────────────────

// Una cuenta del plan que se puede elegir como contrapartida (cuenta final de activo o de fondos).
export interface AccountingPlanOption {
  id: string;
  code: string;
  externalCode: string | null;
  name: string;
  type: 'Asset' | 'Fund';
  groupName: string;
  isActive: boolean;
}

// Una cuenta financiera del edificio con la cuenta del plan que la representa.
export interface AccountingRoleAccount {
  financialAccountId: string;
  name: string;
  type: 'Cash' | 'Bank' | 'ReserveFund';
  isActive: boolean;
  ledgerCategoryId: string | null;
  code: string | null;
  categoryName: string | null;
  // Sugerencia por el nombre y tipo de la cuenta; no se aplica sola.
  suggestedCategoryId: string | null;
}

export interface AccountingRoles {
  buildingId: string;
  financeAvailable: boolean;
  canEdit: boolean;
  accounts: AccountingRoleAccount[];
  vatCreditCategoryId: string | null;
  vatCreditCode: string | null;
  vatCreditName: string | null;
  suggestedVatCreditCategoryId: string | null;
  // Contrapartida de la apertura (saldos iniciales) y cuenta del resultado del ejercicio: la asignada al edificio y la que rige por defecto
  // cuando no hay ninguna asignada (3.2.01 «Resultados acumulados» y 3.2.02 «Resultado del período» del plan genérico).
  openingEquityCategoryId: string | null;
  defaultOpeningEquityCategoryId: string | null;
  periodResultCategoryId: string | null;
  defaultPeriodResultCategoryId: string | null;
  options: AccountingPlanOption[];
  // Todas las cuentas financieras activas y el IVA crédito tienen su cuenta del plan.
  isComplete: boolean;
}

export interface UpdateAccountingRolesRequest {
  // Solo las cuentas que vienen se modifican; null en ledgerCategoryId quita la asignación.
  accounts: { financialAccountId: string; ledgerCategoryId: string | null }[];
  setVatCredit: boolean;
  vatCreditCategoryId: string | null;
  // Se aplican solo cuando vienen sus set*: null = volver a la cuenta por defecto. Deben ser cuentas finales de fondos.
  setOpeningEquity?: boolean;
  openingEquityCategoryId?: string | null;
  setPeriodResult?: boolean;
  periodResultCategoryId?: string | null;
}

export interface AccountingLine {
  // Nula cuando falta la asignación (renglón marcado).
  categoryId: string | null;
  code: string;
  externalCode: string | null;
  name: string;
  debit: number;
  credit: number;
  // Financial (banco, caja o fondo), Rubro (ingreso o gasto), VatCredit o Equity (contrapartida de la apertura).
  kind: 'Financial' | 'Rubro' | 'VatCredit' | 'Equity';
  missing: boolean;
}

export interface AccountingEntry {
  number: number;
  date: string;
  description: string;
  thirdParty: string;
  reference: string;
  sourceType: LedgerSourceType;
  sourceId: string;
  sourceAccountId: string | null;
  lines: AccountingLine[];
  debit: number;
  credit: number;
  // Todos los renglones tienen cuenta del plan. Un asiento incompleto no se da por cuadrado para el contador.
  isComplete: boolean;
  issues: string[];
}

export interface AccountingTotal {
  categoryId: string | null;
  code: string;
  externalCode: string | null;
  name: string;
  debit: number;
  credit: number;
  missing: boolean;
}

export interface AccountingEntries {
  buildingId: string;
  buildingName: string;
  from: string;
  to: string;
  entries: AccountingEntry[];
  totals: AccountingTotal[];
  entryCount: number;
  incompleteCount: number;
  totalDebit: number;
  totalCredit: number;
  // Cuentas financieras y rubros sin cuenta del plan que dejaron incompletos a algunos asientos.
  pending: string[];
  // Último día asentado en el Libro Diario: los sugeridos hasta esa fecha ya tienen su número real.
  postedThrough: string | null;
}

// ── Libro Diario: asientos asentados ──────────────────────────────────────────

export type JournalEntryKind = 'Auto' | 'Opening' | 'Adjustment' | 'Reversal' | 'Closing';

export interface JournalEntryLine {
  ledgerCategoryId: string | null;
  code: string;
  externalCode: string | null;
  name: string;
  debit: number;
  credit: number;
  kind: string;
}

export interface JournalEntry {
  id: string;
  fiscalYear: number;
  number: number;
  // Número completo para mostrar y citar, por ejemplo 2026-000012.
  label: string;
  date: string;
  operationDate: string;
  description: string;
  thirdParty: string;
  reference: string;
  kind: JournalEntryKind;
  sourceType: LedgerSourceType | null;
  sourceId: string | null;
  reversesEntryId: string | null;
  // Número del asiento que este contraasiento invierte, y del contraasiento que anuló a este asiento (si lo hay).
  reversesLabel: string | null;
  reversedByLabel: string | null;
  debit: number;
  credit: number;
  postedAtUtc: string;
  postedByUserId: string | null;
  lines: JournalEntryLine[];
}

export interface Journal {
  buildingId: string;
  buildingName: string;
  fiscalYear: number;
  fiscalYears: number[];
  postedThrough: string | null;
  entries: JournalEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalDebit: number;
  totalCredit: number;
  canPost: boolean;
  // Primer folio sugerido para imprimir el Libro Diario: el siguiente a los folios usados de la rúbrica (1 si no se cargó).
  suggestedStartFolio: number;
}

// Changed: el movimiento cambió después de asentarlo (contraasiento + asiento nuevo). Missing: movimiento de un día ya asentado sin asiento
// (asiento nuevo). Removed: el movimiento ya no existe (contraasiento).
export type JournalDifferenceKind = 'Changed' | 'Missing' | 'Removed';

export interface JournalDifference {
  kind: JournalDifferenceKind;
  sourceType: LedgerSourceType;
  // Qué pasó en palabras («Pago revertido», «Gasto modificado»…) y el motivo si el sistema lo guardó (reversa de un pago, nota anulada).
  cause: string;
  reason: string | null;
  entryId: string | null;
  entryLabel: string | null;
  operationDate: string;
  description: string;
  thirdParty: string;
  amountBefore: number | null;
  amountAfter: number | null;
  // El asiento nuevo estaría incompleto (falta una cuenta del plan).
  incomplete: boolean;
}

export interface JournalDifferences {
  buildingId: string;
  postedThrough: string | null;
  items: JournalDifference[];
  changedCount: number;
  missingCount: number;
  removedCount: number;
  incompleteCount: number;
  pending: string[];
}

export interface JournalPreview {
  buildingId: string;
  postedThrough: string | null;
  from: string;
  through: string;
  entryCount: number;
  incompleteCount: number;
  pending: string[];
  firstLabel: string | null;
  lastLabel: string | null;
  totalDebit: number;
  totalCredit: number;
  // Asientos ya asentados que cambiaron y se corrigen al asentar, y cuántos asientos nuevos eso crea.
  differences: JournalDifference[];
  correctionEntryCount: number;
  // Períodos en borrador con gastos o ingresos en lo que se asentaría: mientras estén en borrador pueden cambiar, así que no se asienta.
  draftPeriods: string[];
  // Hay algo para asentar y todos los asientos están completos.
  canPost: boolean;
}

// Cuántos asientos vigentes del Libro diario salen de un pago, un gasto o un período: avisa antes de revertir o deshacer algo ya asentado.
export interface JournalImpact {
  posted: boolean;
  postedCount: number;
  labels: string[];
  postedThrough: string | null;
}

export interface PostJournalResult {
  postedCount: number;
  // Cuántos de los asientos creados son correcciones (contraasientos y asientos de reemplazo).
  correctionEntryCount: number;
  firstLabel: string | null;
  lastLabel: string | null;
  postedThrough: string;
}

export interface JournalFilters {
  fiscalYear?: number;
  from?: string;
  to?: string;
  number?: number;
  page?: number;
  pageSize?: number;
}

// ── Libros contables ──────────────────────────────────────────────────────────

export type AccountingBookHolder = 'Consortium' | 'AdminCompany';

// Datos con que se completa el encabezado del Libro Diario cuando el titular no los pisa.
export interface AccountingBookDefaults {
  legalName: string | null;
  ruc: string | null;
  address: string | null;
}

export interface AccountingBooks {
  buildingId: string;
  financeAvailable: boolean;
  canEdit: boolean;
  // Ya se guardó la configuración alguna vez (sin guardar rige el consorcio con los datos de la ficha).
  configured: boolean;
  holder: AccountingBookHolder;
  // Lo que cargó el usuario; vacío = se usa el dato por defecto del titular.
  holderLegalName: string | null;
  holderRuc: string | null;
  holderAddress: string | null;
  accountantName: string | null;
  accountantRegistration: string | null;
  bookNumber: string | null;
  rubricDate: string | null;
  authorizedFolios: number | null;
  usedFolios: number | null;
  consortiumDefaults: AccountingBookDefaults;
  adminCompanyDefaults: AccountingBookDefaults;
  // Lo que saldría hoy en el encabezado del Diario.
  effective: AccountingBookDefaults;
}

export interface UpdateAccountingBooksRequest {
  holder: AccountingBookHolder;
  holderLegalName: string | null;
  holderRuc: string | null;
  holderAddress: string | null;
  accountantName: string | null;
  accountantRegistration: string | null;
  bookNumber: string | null;
  rubricDate: string | null;
  authorizedFolios: number | null;
  usedFolios: number | null;
}

// ── Libros oficiales: Libro Mayor y balance de sumas y saldos ─────────────────

export interface JournalLedgerMovement {
  date: string;
  entryId: string;
  // Número del asiento (2026-000012).
  entryLabel: string;
  description: string;
  debit: number;
  credit: number;
  // Saldo acumulado de la cuenta después de este movimiento (positivo = deudor, negativo = acreedor).
  balance: number;
}

export interface JournalLedgerAccount {
  code: string;
  externalCode: string | null;
  name: string;
  openingBalance: number;
  debit: number;
  credit: number;
  closingBalance: number;
  movementCount: number;
  // Solo cuando se pide una cuenta: los movimientos del período en orden.
  movements: JournalLedgerMovement[];
}

export interface JournalLedger {
  buildingId: string;
  buildingName: string;
  fiscalYear: number;
  fiscalYears: number[];
  from: string;
  to: string;
  accounts: JournalLedgerAccount[];
  totalDebit: number;
  totalCredit: number;
}

export interface JournalTrialBalanceRow {
  code: string;
  externalCode: string | null;
  name: string;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface JournalTrialBalance {
  buildingId: string;
  buildingName: string;
  fiscalYear: number;
  fiscalYears: number[];
  from: string;
  to: string;
  rows: JournalTrialBalanceRow[];
  totals: JournalTrialBalanceRow;
  // Las sumas del debe y del haber coinciden y los saldos deudores igualan a los acreedores.
  isBalanced: boolean;
  difference: number;
}

// ── Cierre del ejercicio y estados (balance general y de resultados) ──────────

export interface FiscalClosingAccount {
  code: string;
  name: string;
  // Income (ingreso) o Expense (gasto).
  type: 'Income' | 'Expense';
  // Importe del ejercicio en positivo (lo ganado o lo gastado).
  amount: number;
}

export interface FiscalYearClosing {
  buildingId: string;
  buildingName: string;
  fiscalYear: number;
  fiscalYears: number[];
  start: string;
  end: string;
  isClosed: boolean;
  // Números de los asientos de cierre vigentes (si está cerrado).
  closingLabels: string[];
  canClose: boolean;
  // Si no se puede cerrar, por qué.
  blockers: string[];
  accounts: FiscalClosingAccount[];
  totalIncome: number;
  totalExpense: number;
  // Ingresos menos gastos: positivo = superávit, negativo = déficit.
  result: number;
  resultAccount: string | null;
  equityAccount: string | null;
  canReopen: boolean;
  canEdit: boolean;
}

export interface FiscalYearClosingResult {
  createdCount: number;
  firstLabel: string | null;
  lastLabel: string | null;
}

export interface StatementAccount {
  code: string;
  externalCode: string | null;
  name: string;
  // En positivo, con el signo natural de la cuenta.
  amount: number;
}

export interface JournalStatements {
  buildingId: string;
  buildingName: string;
  fiscalYear: number;
  fiscalYears: number[];
  from: string;
  asOf: string;
  yearClosed: boolean;
  assets: StatementAccount[];
  liabilities: StatementAccount[];
  equity: StatementAccount[];
  income: StatementAccount[];
  expenses: StatementAccount[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalIncome: number;
  totalExpenses: number;
  // Ingresos menos gastos del ejercicio hasta la fecha (sin contar los asientos de cierre).
  result: number;
  // Resultado que todavía no pasó a fondos (ejercicio sin cerrar): se suma al patrimonio para que el balance cuadre.
  pendingResult: number;
  isBalanced: boolean;
  difference: number;
  // Hay renglones de una clase que no se pudo determinar.
  unclassifiedNet: number;
}

// ── Informe de asamblea ───────────────────────────────────────────────────────

export interface AssemblyReportRubro {
  code: string;
  name: string;
  amount: number;
}

export interface AssemblyReportAccount {
  name: string;
  type: 'Cash' | 'Bank' | 'ReserveFund';
  // Fila de los movimientos que no tienen cuenta asignada.
  isUnassigned: boolean;
  // Saldo al comienzo del rango, lo que entró y salió en el rango, y el saldo al final.
  opening: number;
  inflows: number;
  outflows: number;
  closing: number;
}

export interface AssemblyReportReserve {
  accountName: string;
  reserveFundPercentage: number | null;
  opening: number;
  contributions: number;
  uses: number;
  closing: number;
}

export interface ReceivablesSummary {
  totalCharged: number;
  totalCollected: number;
  totalPending: number;
  collectionRatePercentage: number;
  overdueAmount: number;
  overdueUnits: number;
  aging: AgingBucket[];
}

// Datos del informe para la asamblea: los movimientos van por el criterio de caja; la morosidad y las cuentas por pagar son la situación a la
// fecha de emisión (snapshotDate). La morosidad va solo agregada por antigüedad: no figura ninguna unidad ni propietario.
export interface AssemblyReport {
  buildingId: string;
  buildingName: string;
  from: string;
  to: string;
  generatedAt: string;
  notes: string | null;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  closingBalance: number;
  accounts: AssemblyReportAccount[];
  incomeLines: AssemblyReportRubro[];
  expenseLines: AssemblyReportRubro[];
  // Ejecución acumulada del ejercicio hasta el mes de cierre del rango; nula si no se cargó presupuesto.
  budget: FinanceBudgetVsActual | null;
  // Nulo si el edificio no tiene cuenta de fondo de reserva.
  reserve: AssemblyReportReserve | null;
  snapshotDate: string;
  receivables: ReceivablesSummary;
  payables: PayablesSummary;
  warnings: string[];
}

export interface AssemblyReportRequest {
  buildingId: string;
  // Por defecto, del comienzo del ejercicio de hoy hasta hoy.
  from?: string | null;
  to?: string | null;
  // Notas del administrador (texto libre, hasta 4000 caracteres); no se guardan: van solo en el informe generado.
  notes?: string | null;
}
