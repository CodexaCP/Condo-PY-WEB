export type LateFeeFrequency = 'Daily' | 'Weekly' | 'Biweekly';
export type InvoicingMode = 'Preimpresa' | 'Autoimpresa' | 'Electronica';
export type IncomeTreatment = 'CreditToOwners' | 'ToReserveFund';

export type BuildingPropertyType = 'Building' | 'Tower' | 'HorizontalCondominium' | 'GatedCommunity' | 'Other';
export type TaxpayerType = 'Legal' | 'Natural';
export type VatRegime = 'General' | 'Resimple' | 'Exempt';
export type BankAccountType = 'Checking' | 'Savings';

// Ficha de registro del edificio (todo opcional): datos generales, legales, fiscales, de cobranza y de configuración.
export interface BuildingProfileData {
  propertyType?: BuildingPropertyType | null;
  department?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  locationReference?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  yearBuilt?: number | null;
  towersCount?: number | null;
  floorsCount?: number | null;
  unitsCount?: number | null;
  logoUrl?: string | null;
  whatsAppPhone?: string | null;
  officeHours?: string | null;

  fincaNumber?: string | null;
  padronNumber?: string | null;
  cadastralAccount?: string | null;
  legalEntityNumber?: string | null;
  legalEntityDate?: string | null;
  bylawsUrl?: string | null;
  bylawsFileName?: string | null;
  administratorName?: string | null;
  administratorPhone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;

  ruc?: string | null;
  legalName?: string | null;
  taxpayerType?: TaxpayerType | null;
  vatRegime?: VatRegime | null;
  economicActivity?: string | null;
  fiscalAddress?: string | null;
  invoiceEmail?: string | null;

  defaultDueDay?: number | null;
  graceDays?: number | null;
  paymentInstructions?: string | null;

  timeZoneId?: string | null;
}

export interface BuildingBankAccount {
  id?: string | null;
  bankName: string;
  accountType: BankAccountType;
  accountNumber: string;
  holderName: string;
  holderDocument?: string | null;
  alias?: string | null;
  isActive: boolean;
}

export interface Building extends BuildingProfileData {
  id: string;
  companyId: string;
  condominiumId: string | null;
  condominiumName: string;
  name: string;
  code: string;
  address: string;
  isActive: boolean;
  description?: string | null;
  contactPhonePrefix?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  lateFeeRatePercentage?: number | null;
  incomeTreatment?: IncomeTreatment | null;
  reserveFundPercentage?: number | null;
  extraordinaryPercentage?: number | null;
  lateFeeFrequency?: LateFeeFrequency | null;
  blockOverdueAmenityReservations: boolean;
  invoicingMode: InvoicingMode;
  useStandardTemplates?: boolean | null;
  invoiceTemplateUrl?: string | null;
  invoiceTemplateFileName?: string | null;
  creditNoteTemplateUrl?: string | null;
  creditNoteTemplateFileName?: string | null;
  settlementTemplateUrl?: string | null;
  settlementTemplateFileName?: string | null;
  settlementFieldPositionsJson?: string | null;
  settlementHideFrame?: boolean;
  financeModuleEnabled?: boolean;
  marketplaceEnabled?: boolean;
  adsEnabled?: boolean;
  bankAccounts?: BuildingBankAccount[];
}

export interface CreateBuildingRequest extends BuildingProfileData {
  companyId?: string | null;
  condominiumId?: string | null;
  name: string;
  code: string;
  address: string;
  isActive: boolean;
  description?: string | null;
  contactPhonePrefix?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  lateFeeRatePercentage?: number | null;
  incomeTreatment?: IncomeTreatment | null;
  reserveFundPercentage?: number | null;
  extraordinaryPercentage?: number | null;
  lateFeeFrequency?: LateFeeFrequency | null;
  blockOverdueAmenityReservations: boolean;
  invoicingMode?: InvoicingMode | null;
  useStandardTemplates?: boolean | null;
  invoiceTemplateUrl?: string | null;
  invoiceTemplateFileName?: string | null;
  creditNoteTemplateUrl?: string | null;
  creditNoteTemplateFileName?: string | null;
  settlementTemplateUrl?: string | null;
  settlementTemplateFileName?: string | null;
  bankAccounts?: BuildingBankAccount[] | null;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  description?: string | null;
  contactPhonePrefix?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export interface CreateCompanyRequest {
  name: string;
  slug: string;
  isActive: boolean;
  description?: string | null;
  contactPhonePrefix?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export interface Condominium {
  id: string;
  companyId: string;
  name: string;
  code: string;
  address: string;
  isActive: boolean;
  description?: string | null;
  contactPhonePrefix?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export interface CreateCondominiumRequest {
  companyId?: string | null;
  name: string;
  code: string;
  address: string;
  isActive: boolean;
  description?: string | null;
  contactPhonePrefix?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export interface Unit {
  id: string;
  buildingId: string;
  buildingName: string;
  code: string;
  floor: string;
  coefficient: number;
  isActive: boolean;
}

export interface UnitOwnerAssignment {
  id: string;
  unitId: string;
  unitCode: string;
  buildingId: string;
  buildingName: string;
  ownerId: string;
  ownerName: string;
  isPrimary: boolean;
  startDate: string;
  // Al asignar el nuevo propietario principal: saldo a favor de la unidad que se le traspasó.
  transferredCredit?: number;
}

// Resultado de quitar a un propietario: saldo a favor de la unidad retenido (a la espera del nuevo propietario principal) o pasado
// directo a otro propietario principal que sigue en la unidad.
export interface UnitOwnerRemoval {
  heldCredit: number;
  transferredCredit: number;
}

// Lo que pasaría al quitar a un propietario, sin hacerlo.
export interface UnitOwnerRemovalPreview {
  unitCode: string;
  ownerName: string;
  isPrimary: boolean;
  isLastPrimary: boolean;
  canRemove: boolean;
  pendingDebt: number;
  debtPeriods: string[];
  creditToHold: number;
  creditToTransfer: number;
  message: string | null;
}

export interface CreateUnitOwnerRequest {
  unitId: string;
  ownerId: string;
  isPrimary: boolean;
  startDate: string;
}

export interface CreateUnitRequest {
  buildingId: string;
  code: string;
  floor: string;
  coefficient: number;
  isActive: boolean;
}

export interface Resident {
  id: string;
  fullName: string;
  documentType?: string | null;
  documentNumber: string;
  email: string;
  phoneNumber: string;
  isOwner: boolean;
  isActive: boolean;
  hasLinkedAccount: boolean;
}

export interface CreateResidentRequest {
  companyId?: string | null;
  fullName: string;
  documentType?: string | null;
  documentNumber: string;
  email: string;
  phoneNumber: string;
  isOwner: boolean;
  isActive: boolean;
}

export interface Assignment {
  id: string;
  unitId: string;
  unitCode: string;
  buildingId: string;
  buildingName: string;
  residentId: string;
  residentName: string;
  isPrimary: boolean;
  startDate: string;
  endDate: string | null;
}

export interface CreateAssignmentRequest {
  unitId: string;
  residentId: string;
  isPrimary: boolean;
  startDate: string;
  endDate: string | null;
}

export interface DashboardSummary {
  totalBuildings: number;
  activeBuildings: number;
  totalUnits: number;
  activeUnits: number;
  totalResidents: number;
  activeResidents: number;
  activeAssignments: number;
  unitsWithOwners: number;
  occupiedUnits: number;
  unitsWithoutPrimaryResident: number;
  totalExpensePeriods: number;
  draftExpensePeriods: number;
  unitsWithOutstandingBalance: number;
  totalChargedAmount: number;
  totalCollectedAmount: number;
  pendingBalanceAmount: number;
  overdueBalanceAmount: number;
  collectionRatePercentage: number;
  totalReversedAmount: number;
  totalReversedPayments: number;
}

export type ExpensePeriodStatus = 'Draft' | 'Closed' | 'Published';
export type ExpenseSettlementStatus = 'Draft' | 'Calculated' | 'Approved' | 'Applied' | 'Rejected';
export type ExpenseChargeType = 'Ordinary' | 'ReserveFund' | 'Extraordinary' | 'Individual' | 'Adjustment';

export interface ExpensePeriod {
  id: string;
  companyId: string;
  buildingId: string;
  buildingName: string;
  year: number;
  month: number;
  name: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  lateFeeDate: string | null;
  status: ExpensePeriodStatus;
  notes: string;
}

export type BuildingExpenseCategory =
  | 'Utilities'
  | 'Cleaning'
  | 'Security'
  | 'Maintenance'
  | 'Elevator'
  | 'Insurance'
  | 'Payroll'
  | 'Taxes'
  | 'Administration'
  | 'ReserveFund'
  | 'Extraordinary'
  | 'Supplies'
  | 'Ande'
  | 'Essap'
  | 'InternetPhone'
  | 'Other';

export type BuildingExpenseDistributionType =
  | 'ByCoefficient'
  | 'FixedPerUnit'
  | 'IndividualUnit'
  | 'ManualGroup'
  | 'NonDistributed';

export interface BuildingExpense {
  id: string;
  companyId: string;
  buildingId: string;
  buildingName: string;
  expensePeriodId: string;
  expensePeriodName: string;
  category: BuildingExpenseCategory;
  supplierName: string;
  description: string;
  expenseDate: string;
  // Monto que se reparte (neto de las notas de crédito del proveedor).
  amount: number;
  // Lo facturado por el proveedor antes de las notas de crédito (igual a amount si no tiene).
  originalAmount: number;
  creditedAmount: number;
  // Notas de crédito registradas con el período ya publicado (el monto repartido no cambia).
  creditedAfterPublishAmount: number;
  distributionType: BuildingExpenseDistributionType;
  targetUnitId: string | null;
  targetUnitCode: string;
  notes: string;
  paidByReserveFund: boolean;
  hasReceipt: boolean;
  receiptFileName: string | null;
  // Rubro del plan de cuentas de Finanzas del edificio (opcional).
  ledgerCategoryId: string | null;
  ledgerCategoryCode: string | null;
  ledgerCategoryName: string | null;
}

// Nota de crédito que emite el PROVEEDOR sobre un gasto del edificio (no confundir con la nota de crédito al propietario).
export interface BuildingExpenseCreditNote {
  id: string;
  buildingId: string;
  buildingExpenseId: string;
  expensePeriodId: string;
  supplierName: string;
  numero: string;
  timbrado: string | null;
  issueDate: string;
  amount: number;
  reason: string;
  documentUrl: string | null;
  mode: 'Netted' | 'Credited';
  status: 'Applied' | 'Voided';
  createdByUserId: string;
  createdAtUtc: string;
  voidReason: string;
  voidedAtUtc: string | null;
  // Solo en notas de período publicado (Credited): lo acreditado como saldo a favor de cada unidad.
  allocations: BuildingExpenseCreditNoteAllocation[];
}

export interface BuildingExpenseCreditNoteAllocation {
  unitId: string;
  unitCode: string;
  ownerId: string;
  ownerName: string;
  amount: number;
}

export interface BuildingExpenseCreditNotePreviewRow {
  unitId: string;
  unitCode: string;
  ownerId: string | null;
  ownerName: string;
  chargeAmount: number;
  creditAmount: number;
}

// Simulación (no guarda nada) de lo que pasaría al registrar la nota con ese monto.
export interface BuildingExpenseCreditNotePreview {
  mode: 'Netted' | 'Credited';
  amount: number;
  newExpenseAmount: number;
  creditedSoFar: number;
  maxAmount: number;
  chargedTotal: number;
  rows: BuildingExpenseCreditNotePreviewRow[];
  unitsWithoutOwner: string[];
  message: string | null;
}

// Una fila del anexo de notas de crédito de proveedor de un edificio y período (para la liquidación y el contador).
export interface PeriodSupplierCreditNote {
  id: string;
  buildingId: string;
  buildingName: string;
  expensePeriodId: string;
  expensePeriodName: string;
  buildingExpenseId: string;
  expenseDescription: string;
  supplierName: string;
  category: string;
  rubro: string | null;
  numero: string;
  timbrado: string | null;
  issueDate: string;
  amount: number;
  mode: 'Netted' | 'Credited';
  status: 'Applied' | 'Voided';
  // Qué se hizo con la nota: descontada del gasto, acreditada a las unidades, devuelta al fondo de reserva...
  treatment: string;
  reason: string;
  documentUrl: string | null;
  voidReason: string;
  allocationsCount: number;
  allocatedAmount: number;
}

export interface CreateBuildingExpenseCreditNoteRequest {
  numero: string;
  timbrado: string | null;
  issueDate: string;
  amount: number;
  reason: string;
  documentUrl: string;
}

export interface BuildingExpenseCreditNoteResult {
  creditNote: BuildingExpenseCreditNote;
  expense: BuildingExpense;
  // La liquidación del período ya estaba calculada: hay que volver a calcularla.
  settlementNeedsRecalculation: boolean;
  // Período publicado: total acreditado como saldo a favor de las unidades.
  creditedToOwners: number;
}

export interface RecurringBuildingExpense {
  id: string;
  companyId: string;
  buildingId: string | null;
  buildingName: string;
  category: BuildingExpenseCategory;
  supplierName: string;
  description: string;
  amount: number;
  distributionType: BuildingExpenseDistributionType;
  targetUnitId: string | null;
  targetUnitCode: string;
  notes: string;
  isActive: boolean;
  // Rubro del plan de cuentas de Finanzas del edificio (solo plantillas de un edificio puntual).
  ledgerCategoryId: string | null;
  ledgerCategoryCode: string | null;
  ledgerCategoryName: string | null;
}

export interface RecurringBuildingExpenseUpsertRequest {
  buildingId: string | null;
  category: BuildingExpenseCategory;
  supplierName: string;
  description: string;
  amount: number;
  distributionType: BuildingExpenseDistributionType;
  targetUnitId: string | null;
  notes: string;
  isActive: boolean;
  // Con rubro, la categoría se toma del rubro.
  ledgerCategoryId?: string | null;
}

export interface ApplyRecurringExpensesRequest {
  expensePeriodId: string;
}

export interface ApplyRecurringExpensesResult {
  applied: number;
  skipped: number;
  // Gastos creados sin el rubro de su plantilla porque ya no está disponible (desactivado o módulo apagado).
  withoutRubro: number;
  expensePeriodName: string;
  appliedDescriptions: string[];
}

export type BuildingExpenseImportRowStatus = 'Ok' | 'Warning' | 'Duplicate' | 'Error';

export interface BuildingExpenseImportRow {
  rowNumber: number;
  category: string;
  // Rubro del plan de cuentas (solo edificios con Finanzas): «código nombre» una vez resuelto.
  rubro: string;
  supplier: string;
  description: string;
  amount: number | null;
  paidByReserveFund: boolean;
  status: BuildingExpenseImportRowStatus;
  message: string;
}

export interface BuildingExpenseImportResult {
  imported: boolean;
  importedCount: number;
  existingCount: number;
  deletedCount: number;
  okCount: number;
  warningCount: number;
  duplicateCount: number;
  errorCount: number;
  rows: BuildingExpenseImportRow[];
}

export interface CreateBuildingExpenseRequest {
  buildingId: string;
  expensePeriodId: string;
  category: BuildingExpenseCategory;
  supplierName: string;
  description: string;
  expenseDate: string;
  amount: number;
  distributionType: BuildingExpenseDistributionType;
  targetUnitId: string | null;
  notes: string;
  paidByReserveFund: boolean;
  // Con rubro, la categoría se toma del rubro.
  ledgerCategoryId?: string | null;
}

export type BuildingIncomeCategory =
  | 'AccumulatedBalance'
  | 'CommonAreaRental'
  | 'Interest'
  | 'OperationalFund'
  | 'CreditAdjustment'
  | 'ExtraordinaryContribution'
  | 'Other';

export interface BuildingIncome {
  id: string;
  companyId: string;
  buildingId: string;
  buildingName: string;
  expensePeriodId: string;
  expensePeriodName: string;
  category: BuildingIncomeCategory;
  description: string;
  incomeDate: string;
  amount: number;
  notes: string;
  // Rubro del plan de cuentas de Finanzas del edificio (opcional).
  ledgerCategoryId: string | null;
  ledgerCategoryCode: string | null;
  ledgerCategoryName: string | null;
}

export interface CreateBuildingIncomeRequest {
  buildingId: string;
  expensePeriodId: string;
  category: BuildingIncomeCategory;
  description: string;
  incomeDate: string;
  amount: number;
  notes: string;
  // Con rubro, la categoría se toma del rubro.
  ledgerCategoryId?: string | null;
}

export interface RolloverIncomeRequest {
  buildingId: string;
  sourcePeriodId: string;
  targetPeriodId: string;
}

export interface RolloverIncomeResult {
  sourcePeriodName: string;
  targetPeriodName: string;
  totalIngresos: number;
  totalGastos: number;
  saldo: number;
  rolloverCreated: boolean;
  createdIncome: BuildingIncome | null;
}

export interface CreateExpensePeriodRequest {
  buildingId: string;
  year: number;
  month: number;
  name: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  lateFeeDate: string | null;
  status: ExpensePeriodStatus;
  notes: string;
}

export interface BulkCreateExpensePeriodsRequest {
  buildingIds: string[];
  year: number;
  month: number;
  name: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  lateFeeDate: string | null;
  notes: string;
}

export interface BulkCreateExpensePeriodsResult {
  created: number;
  skipped: number;
  createdBuildings: string[];
  skippedBuildings: string[];
}

export interface CloneExpensePeriodResult {
  period: ExpensePeriod;
  copiedExpenses: number;
  copiedIncomes: number;
  accumulatedBalance: number;
}

export interface ExpenseSettlementSummary {
  id: string | null;
  expensePeriodId: string;
  buildingId: string;
  expensePeriodName: string;
  buildingName: string;
  totalBuildingExpenses: number;
  totalBuildingIncomes: number;
  reserveFundAmount: number;
  extraordinaryAmount: number;
  netCommonAmount: number;
  generatedAtUtc: string | null;
  generatedByUserId: string | null;
  generatedByUserName: string;
  approvedAtUtc: string | null;
  approvedByUserId: string | null;
  approvedByUserName: string;
  approvedByRole: string;
  publishedAtUtc: string | null;
  publishedByUserId: string | null;
  publishedByUserName: string;
  rejectionReason: string;
  rejectedAtUtc: string | null;
  rejectedByUserId: string | null;
  rejectedByUserName: string;
  presidentUserId: string | null;
  presidentUserName: string;
  presidentApprovedAtUtc: string | null;
  presidentApprovedByUserId: string | null;
  presidentApprovedByUserName: string;
  presidentRejectionReason: string;
  presidentRejectedAtUtc: string | null;
  presidentRejectedByUserId: string | null;
  presidentRejectedByUserName: string;
  status: ExpenseSettlementStatus | null;
  periodStatus: ExpensePeriodStatus;
  generatedChargeCount: number;
  isCalculated: boolean;
  categoryTotals: SettlementCategoryTotal[];
}

export interface RejectSettlementRequest {
  rejectionReason: string;
}

export interface SettlementCategoryTotal {
  category: BuildingExpenseCategory;
  expenseCount: number;
  amount: number;
}

export interface ExpenseSettlementChargePreviewItem {
  unitId: string;
  unitCode: string;
  chargeType: ExpenseChargeType;
  concept: string;
  amount: number;
  notes: string;
  sourceBuildingExpenseId: string | null;
  sourceSettlementId: string;
}

export interface ExpenseSettlementChargePreview {
  expensePeriodId: string;
  expensePeriodName: string;
  buildingId: string;
  buildingName: string;
  settlementId: string;
  chargeCount: number;
  unitsAffected: number;
  totalGeneratedAmount: number;
  items: ExpenseSettlementChargePreviewItem[];
}

export interface VoidSettlementResult {
  expensePeriodName: string;
  deletedChargeCount: number;
}

export interface ExpenseCharge {
  id: string;
  companyId: string;
  expensePeriodId: string;
  expensePeriodName: string;
  buildingId: string;
  buildingName: string;
  unitId: string;
  unitCode: string;
  chargeType: ExpenseChargeType;
  sourceBuildingExpenseId: string | null;
  sourceBuildingExpenseDescription: string;
  sourceSettlementId: string | null;
  sourceSettlementName: string;
  isLateFee: boolean;
  // Cargo manual anterior (legacy): ya no se crean; solo se pueden limpiar en borrador.
  isManual: boolean;
  concept: string;
  amount: number;
  notes: string;
  isReversal: boolean;
  reversalOfChargeId: string | null;
  isReversed: boolean;
  totalAllocated: number;
  pendingAmount: number;
}

export interface ApplyLateFeesRequest {
  ratePercentage: number;
  referenceDate: string | null;
  concept: string;
  notes: string;
}

export interface ApplyLateFeesResult {
  expensePeriodId: string;
  expensePeriodName: string;
  referenceDate: string;
  ratePercentage: number;
  chargesCreated: number;
  unitsAffected: number;
  totalLateFeeAmount: number;
}

export interface ExpensePeriodOperationalAlertItem {
  expensePeriodId: string;
  expensePeriodName: string;
  buildingId: string;
  buildingName: string;
  dueDate: string;
  daysUntilDue: number;
  alertType: 'DueSoon' | 'OverdueBalance' | 'ReadyToPublish' | string;
  message: string;
  periodStatus: ExpensePeriodStatus;
  settlementStatus: ExpenseSettlementStatus | null;
  pendingAmount: number;
}

export interface ExpensePeriodOperationalAlerts {
  generatedAtUtc: string;
  items: ExpensePeriodOperationalAlertItem[];
}

export type PaymentMethod = 'Cash' | 'BankTransfer' | 'Card' | 'Check' | 'Other';

export interface PaymentAllocation {
  id: string;
  expenseChargeId: string;
  chargeConcept: string;
  chargeType: ExpenseChargeType;
  allocatedAmount: number;
}

export interface Payment {
  id: string;
  companyId: string;
  expensePeriodId: string;
  expensePeriodName: string;
  buildingId: string;
  buildingName: string;
  unitId: string;
  unitCode: string;
  paymentDate: string;
  amount: number;
  allocatedAmount: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
  allocations: PaymentAllocation[];
  isReversed: boolean;
  reversedAt: string | null;
}

export interface AllocationRequest {
  expenseChargeId: string;
  amount: number;
}

export interface CreatePaymentRequest {
  expensePeriodId: string;
  unitId: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
  allocations: AllocationRequest[];
}

export type InvoiceStatus = 'Draft' | 'Issued' | 'Voided';
export type InvoiceSeriesDocumentType = 'Invoice' | 'CreditNote';

export interface InvoiceSeries {
  id: string;
  companyId: string;
  buildingId: string;
  buildingName: string;
  documentType: InvoiceSeriesDocumentType;
  ruc: string;
  razonSocial: string;
  establecimiento: string;
  puntoExpedicion: string;
  numeroTimbrado: string;
  rangoDesde: number;
  rangoHasta: number;
  correlativoActual: number;
  numerosDisponibles: number;
  vigenciaDesde: string;
  vigenciaHasta: string;
  activo: boolean;
  proximoAAgotarse: boolean;
  proximoAVencer: boolean;
  direccionEstablecimiento: string;
  actividadEconomica: string;
  imprentaNumeroHabilitacion?: string | null;
  imprentaRuc?: string | null;
  imprentaRazonSocial?: string | null;
  fieldPositionsJson?: string | null;
  referenceScanUrl?: string | null;
  hideFrame: boolean;
  halfPage: boolean;
}

export interface FieldOffset {
  dx: number;
  dy: number;
  fontSize?: number | null;
  width?: number | null;     // liquidacion: ancho del bloque en puntos
  rowHeight?: number | null; // liquidacion: alto de fila (solo la key "filas")
  hidden?: boolean;           // liquidacion: no dibujar el bloque
}

export interface UpdateInvoiceSeriesCalibrationRequest {
  positions: Record<string, FieldOffset>;
  referenceScanUrl?: string | null;
  hideFrame: boolean;
  halfPage: boolean;
}

export interface CreateInvoiceSeriesRequest {
  buildingId: string;
  documentType: InvoiceSeriesDocumentType;
  ruc: string;
  razonSocial: string;
  establecimiento: string;
  puntoExpedicion: string;
  numeroTimbrado: string;
  rangoDesde: number;
  rangoHasta: number;
  proximoNumero: number;
  vigenciaDesde: string;
  vigenciaHasta: string;
  direccionEstablecimiento: string;
  actividadEconomica: string;
  imprentaNumeroHabilitacion?: string | null;
  imprentaRuc?: string | null;
  imprentaRazonSocial?: string | null;
}

export interface InvoiceLine {
  concepto: string;
  chargeType: ExpenseChargeType | null;
  monto: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  buildingId: string;
  buildingName: string;
  unitId: string;
  unitCode: string;
  paymentId: string;
  invoiceSeriesId: string | null;
  seriesRazonSocial: string | null;
  seriesRuc: string | null;
  seriesNumeroTimbrado: string | null;
  status: InvoiceStatus;
  numero: number | null;
  numeroFormateado: string | null;
  montoTotal: number;
  detalle: InvoiceLine[];
  fechaEmisionUtc: string | null;
  fechaAnulacionUtc: string | null;
  motivoAnulacion: string | null;
  reemplazadaPorInvoiceId: string | null;
  createdAtUtc: string;
}

// ─── Nota de crédito interna ────────────────────────────────────────────────

export type CreditNoteStatus = 'Draft' | 'Approved' | 'Rejected' | 'Voided';
export type CreditNoteAttachmentKind = 'Pdf' | 'Image' | 'Xml' | 'Other';
export type CreditNoteFiscalDocumentType = 'Paper' | 'Electronic';

export interface CreditNoteLine {
  id: string;
  expenseChargeId: string;
  chargeConcept: string;
  chargeType: ExpenseChargeType;
  chargeAmount: number;
  amount: number;
  concept: string | null;
}

export interface CreditNoteAttachment {
  id: string;
  url: string;
  fileName: string;
  kind: CreditNoteAttachmentKind;
  uploadedByUserId: string;
  uploadedByName: string | null;
  uploadedAtUtc: string;
}

export interface CreditNote {
  id: string;
  companyId: string;
  buildingId: string;
  buildingName: string;
  unitId: string;
  unitCode: string;
  invoiceId: string;
  invoiceNumeroFormateado: string | null;
  invoiceMontoTotal: number;
  invoiceStatus: InvoiceStatus;
  buildingAddress: string | null;
  clienteNombre: string | null;
  clienteDocumento: string | null;
  emisorRazonSocial: string | null;
  emisorRuc: string | null;
  emisorTimbrado: string | null;
  emisorEstablecimiento: string | null;
  emisorPuntoExpedicion: string | null;
  periodName: string | null;
  periodDueDate: string | null;
  paymentReference: string | null;
  paymentDate: string | null;
  paymentAmount: number | null;
  ownerPaymentId: string | null;
  ownerName: string | null;
  motivo: string;
  amount: number;
  status: CreditNoteStatus;
  createdByUserId: string;
  createdByName: string | null;
  createdAtUtc: string;
  approvedAtUtc: string | null;
  approvedByName: string | null;
  rejectionReason: string | null;
  rejectedAtUtc: string | null;
  rejectedByName: string | null;
  voidReason: string | null;
  voidedAtUtc: string | null;
  voidedByName: string | null;
  invoiceSeriesId: string | null;
  numero: number | null;
  fiscalDocumentType: CreditNoteFiscalDocumentType | null;
  fiscalNumero: string | null;
  fiscalTimbrado: string | null;
  fiscalCdc: string | null;
  fiscalFechaEmisionUtc: string | null;
  fiscalEstado: string | null;
  fiscalObservaciones: string | null;
  lines: CreditNoteLine[];
  attachments: CreditNoteAttachment[];
}

export interface AdjustableCharge {
  expenseChargeId: string;
  concept: string;
  chargeType: ExpenseChargeType;
  amount: number;
  alreadyAdjusted: number;
  adjustable: number;
  alreadyPaid: number;
}

export interface CreateCreditNoteLineRequest {
  expenseChargeId: string;
  amount: number;
  concept?: string;
}

export interface CreateCreditNoteRequest {
  invoiceId: string;
  motivo: string;
  lines: CreateCreditNoteLineRequest[];
}

// numero/timbrado/fechaEmisionUtc ya no se cargan a mano: los asigna approve() con el timbrado.
export interface RegisterCreditNoteFiscalDataRequest {
  documentType: CreditNoteFiscalDocumentType | null;
  cdc?: string;
  estado?: string;
  observaciones?: string;
}

// ─── Consulta / trazabilidad de facturas ────────────────────────────────────

export interface InvoiceLedgerQuery {
  buildingId?: string;
  unitId?: string;
  status?: InvoiceStatus | '';
  year?: number | null;
  month?: number | null;
  from?: string;
  to?: string;
  search?: string;
  ownerPaymentId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface InvoiceLedgerRow {
  id: string;
  status: InvoiceStatus;
  numero: number | null;
  numeroFormateado: string | null;
  montoTotal: number;
  fechaEmisionUtc: string | null;
  fechaAnulacionUtc: string | null;
  motivoAnulacion: string | null;
  createdAtUtc: string;
  lineCount: number;
  moraTotal: number;

  seriesRazonSocial: string | null;
  seriesRuc: string | null;
  seriesNumeroTimbrado: string | null;
  seriesEstablecimiento: string | null;
  seriesPuntoExpedicion: string | null;

  buildingId: string;
  buildingName: string;
  unitId: string;
  unitCode: string;
  clienteNombre: string | null;
  clienteDocumento: string | null;

  expensePeriodId: string;
  periodYear: number;
  periodMonth: number;
  periodName: string;
  periodStatus: string;
  periodDueDate: string;
  comprobanteTotal: number;
  liquidationStatus: string | null;
  liquidationApprovedAtUtc: string | null;
  liquidationApprovedBy: string | null;
  liquidationPublishedAtUtc: string | null;
  liquidationPublishedBy: string | null;

  paymentId: string;
  paymentReference: string;
  paymentDate: string;
  paymentAmount: number;
  ownerPaymentId: string | null;
  ownerPaymentReference: string | null;
  ownerPaymentStatus: string | null;
  ownerName: string | null;
  ownerPaymentReviewedBy: string | null;
  ownerPaymentResolvedAtUtc: string | null;
}

export interface InvoiceLedgerSummary {
  draftCount: number;
  issuedCount: number;
  voidedCount: number;
  draftAmount: number;
  issuedAmount: number;
  voidedAmount: number;
}

export interface InvoiceLedger {
  items: InvoiceLedgerRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  summary: InvoiceLedgerSummary;
}

export interface InvoiceFunnelPaymentItem {
  paymentId: string;
  buildingId: string;
  buildingName: string;
  unitCode: string;
  amount: number;
  paymentDate: string;
  reference: string;
}

export interface InvoiceFunnel {
  paymentsWithoutInvoice: number;
  draftsNotEmitted: number;
  issued: number;
  paymentsWithoutInvoiceItems: InvoiceFunnelPaymentItem[];
}

export interface AccountStatementPeriod {
  expensePeriodId: string;
  expensePeriodName: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  dueDate: string;
  status: ExpensePeriodStatus;
  totalCharges: number;
  totalPayments: number;
  balance: number;
  previousBalance: number;
  runningBalance: number;
}

export interface AccountStatementCharge {
  id: string;
  chargeType: ExpenseChargeType;
  concept: string;
  amount: number;
  notes: string;
  isReversal: boolean;
}

export interface AccountStatementPayment {
  id: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
  isReversed: boolean;
  reversedAt: string | null;
}

export interface AccountStatementDetail {
  unitId: string;
  unitCode: string;
  buildingId: string;
  buildingName: string;
  expensePeriodId: string;
  expensePeriodName: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  dueDate: string;
  status: ExpensePeriodStatus;
  charges: AccountStatementCharge[];
  payments: AccountStatementPayment[];
  totalCharges: number;
  totalPayments: number;
  balance: number;
}

export interface ExpenseReceiptCharge {
  id: string;
  chargeType: ExpenseChargeType;
  concept: string;
  amount: number;
  notes: string;
  isReversal: boolean;
}

export interface ExpenseReceipt {
  unitId: string;
  unitCode: string;
  buildingId: string;
  buildingName: string;
  expensePeriodId: string;
  expensePeriodName: string;
  year: number;
  month: number;
  dueDate: string;
  ownerName: string;
  ownerDocumentType?: string;
  ownerDocumentNumber?: string;
  residentName: string;
  residentDocumentType?: string;
  residentDocumentNumber?: string;
  unitCoefficient: number;
  charges: ExpenseReceiptCharge[];
  payments: AccountStatementPayment[];
  ordinaryAmount: number;
  reserveFundAmount: number;
  extraordinaryAmount: number;
  individualAmount: number;
  adjustmentAmount: number;
  totalAmount: number;
  totalPayments: number;
  balance: number;
}

export interface MorositySummary {
  totalUnitsInArrears: number;
  totalOverduePeriods: number;
  totalOverdueAmount: number;
  ordinaryOverdueAmount: number;
  reserveFundOverdueAmount: number;
  extraordinaryOverdueAmount: number;
  individualOverdueAmount: number;
  adjustmentOverdueAmount: number;
  totalCreditBalanceAmount: number;
  occupiedUnitsInArrears: number;
  vacantUnitsInArrears: number;
  occupiedOverdueAmount: number;
  vacantOverdueAmount: number;
  units0To30: number;
  amount0To30: number;
  units31To60: number;
  amount31To60: number;
  units61To90: number;
  amount61To90: number;
  unitsOver90: number;
  amountOver90: number;
}

export interface MorosityItem {
  unitId: string;
  unitCode: string;
  buildingId: string;
  buildingName: string;
  expensePeriodId: string;
  expensePeriodName: string;
  dueDate: string;
  daysOverdue: number;
  totalCharges: number;
  totalPayments: number;
  balance: number;
  ordinaryBalance: number;
  reserveFundBalance: number;
  extraordinaryBalance: number;
  individualBalance: number;
  adjustmentBalance: number;
  creditBalanceAmount: number;
  isOccupied: boolean;
  responsibleType: string;
  responsibleName: string;
  responsiblePhone: string;
  responsibleEmail: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  agingBucket: string;
}

export interface MorosityReport {
  summary: MorositySummary;
  items: MorosityItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CollectionSummary {
  totalChargedAmount: number;
  totalCollectedAmount: number;
  totalPendingAmount: number;
  collectionRatePercentage: number;
  totalCreditBalanceAmount: number;
  ordinaryChargedAmount: number;
  reserveFundChargedAmount: number;
  extraordinaryChargedAmount: number;
  individualChargedAmount: number;
  adjustmentChargedAmount: number;
  residentChargedAmount: number;
  residentCollectedAmount: number;
  residentPendingAmount: number;
  ownerChargedAmount: number;
  ownerCollectedAmount: number;
  ownerPendingAmount: number;
}

export interface CollectionItem {
  buildingId: string;
  buildingName: string;
  expensePeriodId: string;
  expensePeriodName: string;
  year: number;
  month: number;
  dueDate: string;
  status: string;
  totalChargedAmount: number;
  totalCollectedAmount: number;
  pendingAmount: number;
  collectionRatePercentage: number;
  creditBalanceAmount: number;
  ordinaryChargedAmount: number;
  reserveFundChargedAmount: number;
  extraordinaryChargedAmount: number;
  individualChargedAmount: number;
  adjustmentChargedAmount: number;
  residentChargedAmount: number;
  residentCollectedAmount: number;
  residentPendingAmount: number;
  ownerChargedAmount: number;
  ownerCollectedAmount: number;
  ownerPendingAmount: number;
  previousPeriodCollectionRatePercentage: number | null;
}

export interface CollectionReport {
  summary: CollectionSummary;
  items: CollectionItem[];
}

export type LibroMovimientoType = 'Cobro' | 'IngresoEdificio' | 'GastoEdificio' | 'NotaCreditoProveedor';

export interface LibroMovimientoItem {
  date: string;
  type: LibroMovimientoType;
  description: string;
  unitCode: string | null;
  reference: string | null;
  credit: number;
  debit: number;
  runningBalance: number;
}

export interface LibroMovimientosReport {
  buildingId: string;
  buildingName: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  totalCredits: number;
  totalDebits: number;
  closingBalance: number;
  items: LibroMovimientoItem[];
}

export interface EstadoResultadosLine {
  label: string;
  amount: number;
}

export interface EstadoResultadosReport {
  buildingId: string;
  buildingName: string;
  fromDate: string;
  toDate: string;
  incomeLines: EstadoResultadosLine[];
  totalIncome: number;
  expenseLines: EstadoResultadosLine[];
  totalExpense: number;
  netResult: number;
}

export interface BuildingComparisonItem {
  buildingId: string;
  buildingName: string;
  totalCollected: number;
  totalExpenses: number;
  netResult: number;
  overdueAmount: number;
  unitsWithOverdueBalance: number;
}

export interface BuildingComparisonReport {
  fromDate: string;
  toDate: string;
  items: BuildingComparisonItem[];
}

export interface Owner {
  id: string;
  companyId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  username: string;
  email: string;
  documentType?: string | null;
  documentNumber?: string | null;
  phonePrefix?: string | null;
  phone?: string | null;
  address?: string | null;
  isResident: boolean;
  isActive: boolean;
  signatureUrl?: string | null;
  presidentOfBuildings: OwnerPresidentBuilding[];
}

export type OwnerCreditLotOrigin = 'OwnerPayment' | 'Marketplace' | 'CreditNote' | 'SupplierCreditNote' | 'Previous';

export interface OwnerCreditLot {
  id: string;
  createdAtUtc: string;
  origin: OwnerCreditLotOrigin;
  reference: string | null;
  description: string;
  buildingName: string | null;
  unitCode: string | null;
  originalAmount: number;
  remainingAmount: number;
  onHold: boolean;
  ownerPaymentId: string | null;
  marketplaceReservationId: string | null;
}

export interface OwnerCreditUse {
  id: string;
  createdAtUtc: string;
  kind: string;
  applyMode: 'Automatic' | 'ManualApp' | 'ManualManager' | 'OnPaymentApproval' | null;
  amount: number;
  sourceReference: string | null;
  paymentId: string | null;
  description: string;
}

export interface OwnerCreditBreakdown {
  amount: number;
  untracedAmount: number;
  heldAmount: number;
  lots: OwnerCreditLot[];
  uses: OwnerCreditUse[];
}

export interface OwnerPresidentBuilding {
  buildingId: string;
  buildingName: string;
}

export interface OwnerEligibleBuilding {
  buildingId: string;
  buildingName: string;
  hasOtherPresident: boolean;
  otherPresidentName?: string | null;
}

export interface OwnerUpsertRequest {
  firstName: string;
  lastName: string;
  fullName?: string;
  username: string;
  email: string;
  password?: string;
  documentType?: string | null;
  documentNumber?: string | null;
  phonePrefix?: string | null;
  phone?: string | null;
  address?: string | null;
  isResident: boolean;
  isActive: boolean;
  signatureUrl?: string | null;
}

export interface ManagedUser {
  id: string;
  companyId: string | null;
  condominiumId: string | null;
  firstName: string;
  lastName: string;
  username: string;
  fullName: string;
  email: string;
  phonePrefix?: string | null;
  phone?: string | null;
  address?: string | null;
  role: string;
  isActive: boolean;
  buildingIds: string[];
  signatureUrl?: string | null;
}

export interface BuildingCapacityItem {
  buildingId: string;
  buildingManagerCount: number;
  companyOperatorCount: number;
}

export interface BuildingCapacityResponse {
  items: BuildingCapacityItem[];
}

export interface CreateUserRequest {
  companyId?: string | null;
  condominiumId?: string | null;
  firstName: string;
  lastName: string;
  fullName?: string;
  username: string;
  email: string;
  password?: string;
  phonePrefix?: string | null;
  phone?: string | null;
  address?: string | null;
  role: string;
  isActive: boolean;
  buildingIds: string[];
  signatureUrl?: string | null;
}

export type VoteStatus = 'Draft' | 'Open' | 'Closed';
export type VoteWeightType = 'ByUnit' | 'ByCoefficient';

export interface VoteOptionDto {
  id: string;
  label: string;
  displayOrder: number;
  castCount: number;
  castWeight: number;
  percentage: number;
}

export interface VoteUnitSummary {
  unitId: string;
  unitCode: string;
  coefficient: number;
  castId: string | null;
  votedOptionId: string | null;
  votedOptionLabel: string | null;
  castAtUtc: string | null;
}

export interface Vote {
  id: string;
  buildingId: string;
  buildingName: string;
  title: string;
  description: string | null;
  quorumPercentage: number;
  weightType: VoteWeightType;
  status: VoteStatus;
  openedAtUtc: string | null;
  closedAtUtc: string | null;
  createdByName: string;
  createdAtUtc: string;
  totalUnits: number;
  participatingUnits: number;
  quorumReached: boolean;
  options: VoteOptionDto[];
  units: VoteUnitSummary[];
}

export interface VoteUpsertRequest {
  buildingId: string;
  title: string;
  description: string | null;
  quorumPercentage: number;
  weightType: VoteWeightType;
  optionLabels: string[];
}

export interface VoteCastRequest {
  unitId: string;
  voteOptionId: string;
}

export type ClaimCategory = 'Ruido' | 'Limpieza' | 'Mantenimiento' | 'Otro';
export type ClaimStatus = 'Pendiente' | 'EnProceso' | 'Resuelto';

export interface Claim {
  id: string;
  condominiumId: string | null;
  condominiumName: string;
  buildingId: string;
  buildingName: string;
  unitId: string;
  unitCode: string;
  category: ClaimCategory;
  description: string;
  status: ClaimStatus;
  createdByUserId: string;
  createdByName: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  resolvedAtUtc: string | null;
  resolvedByUserId: string | null;
  resolvedByUserName: string;
}

export interface ClaimStatusUpdateRequest {
  status: ClaimStatus;
}

export type AnnouncementCategory = 'General' | 'Mantenimiento' | 'Seguridad' | 'Financiero' | 'Convocatoria' | 'Otro';

export interface Announcement {
  id: string;
  buildingId: string;
  buildingName: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  publishedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdByUserId: string | null;
  createdByName: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface AnnouncementUpsertRequest {
  buildingId: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  publishedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

export interface AnnouncementBroadcastRequest {
  buildingIds: string[];
  title: string;
  body: string;
  category: AnnouncementCategory;
  publishedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

// ── Owner Payments ──────────────────────────────────────────────────────────

export type OwnerPaymentStatus = 'Pending' | 'UnderReview' | 'Approved' | 'Rejected';
// App: lo declara el propietario. Web: lo registra el personal ya cobrado.
export type OwnerPaymentChannel = 'App' | 'Web';

export interface OwnerPaymentUnit {
  unitId: string;
  unitCode: string;
  buildingName: string;
  allocatedAmount: number;
}

export interface OwnerPayment {
  id: string;
  ownerId: string;
  ownerFullName: string;
  paymentDate: string;
  comprobanteUrl: string;
  declaredAmount: number;
  reviewedAmount: number | null;
  status: OwnerPaymentStatus;
  reference: string;
  rejectionReason: string;
  reviewedByUserFullName: string | null;
  reviewedAt: string | null;
  resolvedAt: string | null;
  createdAtUtc: string;
  units: OwnerPaymentUnit[];
  channel: OwnerPaymentChannel;
  method: PaymentMethod;
  externalReference: string;
  notes: string;
  reversedAt: string | null;
  // false: el pago incluye unidades de edificios no asignados al usuario -> solo lectura.
  canProcess?: boolean;
}

export interface OwnerPaymentCreateRequest {
  paymentDate: string;
  comprobanteUrl: string;
  declaredAmount: number;
  unitIds: string[];
}

export interface OwnerPaymentReviewRequest {
  reviewedAmount: number;
}

export interface OwnerPaymentRejectRequest {
  rejectionReason: string;
}

export interface OwnerDebtCharge {
  chargeId: string;
  concept: string;
  chargeType: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  pendingAmount: number;
}

export interface OwnerDebtUnit {
  unitId: string;
  unitCode: string;
  buildingName: string;
  totalDebt: number;
  charges: OwnerDebtCharge[];
}

// ── Notifications ───────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  entityType: string;
  entityId: string | null;
  createdAtUtc: string;
}

export interface UnreadCountDto {
  count: number;
}

// ── Amenities ──────────────────────────────────────────────────────────

export type AmenityReservationStatus = 'PendingPayment' | 'PendingReview' | 'Confirmed' | 'Rejected' | 'Cancelled';

export interface Amenity {
  id: string;
  buildingId: string;
  buildingName: string;
  name: string;
  description: string;
  reservationPrice: number;
  isActive: boolean;
}

export interface AmenityUpsertRequest {
  buildingId: string;
  name: string;
  description: string;
  reservationPrice: number;
  isActive: boolean;
}

export interface AmenityReservation {
  id: string;
  amenityId: string;
  amenityName: string;
  buildingId: string;
  buildingName: string;
  startsAt: string;
  endsAt: string;
  price: number;
  status: AmenityReservationStatus;
  notes: string;
  comprobanteUrl: string | null;
  reservedByName: string;
  rejectionReason: string | null;
  createdAtUtc: string;
}

export interface AmenityScheduleSlot {
  startsAt: string;
  endsAt: string;
  status: AmenityReservationStatus;
}

export interface AmenityReservationComprobanteRequest {
  comprobanteUrl: string;
}

// ── Planes ────────────────────────────────────────────────────────────────────

export type BillingCycle = 'Monthly' | 'Quarterly' | 'SemiAnnual' | 'Annual';

export type PlanAssignmentScope = 'Building' | 'Condominium' | 'Company';

export type BuildingPlanPaymentStatus = 'Pending' | 'Approved' | 'Rejected';

// Expired = vencido en período de gracia · ReadOnly = solo consulta + pago · Blocked = bloqueo total hasta el pago
export type BuildingPlanStatus = 'Active' | 'ExpiringSoon' | 'Expired' | 'ReadOnly' | 'Blocked' | 'Archived';

export interface Plan {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  price: number;
  billingCycle: BillingCycle;
  gracePeriodDays: number;
  isActive: boolean;
  includesFinanceModule: boolean;
  includesMarketplace: boolean;
  isAssigned: boolean;
  assignedBuildingsCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface PlanCreateRequest {
  name: string;
  description: string;
  price: number;
  billingCycle: BillingCycle;
  gracePeriodDays: number;
  includesFinanceModule: boolean;
  includesMarketplace: boolean;
}

export interface PlanUpdateRequest extends PlanCreateRequest {
  isActive: boolean;
}

export interface PlanCloneResult {
  newPlanId: string;
  newPlanName: string;
}

// ── Finanzas del edificio ─────────────────────────────────────────────────────

export type FinancialAccountType = 'Cash' | 'Bank' | 'ReserveFund';
// Clase de la cuenta en el plan: 1 Activo, 2 Pasivo, 3 Patrimonio / Fondos, 4 Ingresos, 5 Egresos. Solo Income y Expense reciben
// gastos e ingresos cargados; el resto es de referencia (y se exporta al contador).
export type LedgerCategoryType = 'Income' | 'Expense' | 'Fund' | 'Asset' | 'Liability';

// Edificio del usuario con el módulo disponible (habilitado y con plan que lo incluye): alimenta el menú y el selector.
export interface FinanceBuildingAccess {
  buildingId: string;
  buildingName: string;
  setupCompleted: boolean;
}

// Fila del listado del SuperAdmin.
export interface FinanceAdminBuilding {
  buildingId: string;
  buildingName: string;
  companyName: string;
  condominiumName: string;
  planId: string | null;
  planName: string;
  planStatus: string;
  planIncludesFinanceModule: boolean;
  moduleEnabled: boolean;
  moduleAvailable: boolean;
  setupCompleted: boolean;
  financeStartDate: string | null;
  enabledAtUtc: string | null;
}

export interface FinanceSettings {
  buildingId: string;
  buildingName: string;
  financeStartDate: string | null;
  fiscalYearStartMonth: number;
  // Cuenta donde el libro asienta lo que no trae cuenta propia (cobros que no son en efectivo, ingresos y gastos).
  defaultAccountId: string | null;
  setupCompleted: boolean;
  setupCompletedAtUtc: string | null;
  cashBasis: string;
  receivablesBasis: string;
  reserveFundPercentage: number | null;
  accountCount: number;
  categoryCount: number;
  missingForSetup: string[];
  // Configuración (fecha de arranque, cuentas y plan de cuentas): solo la modifica el SuperAdmin; los demás la ven en solo lectura.
  canEdit: boolean;
  // El presupuesto lo cargan el SuperAdmin y el Administrador de empresa.
  canEditBudget: boolean;
}

export interface FinanceSettingsUpdateRequest {
  financeStartDate: string | null;
  fiscalYearStartMonth: number;
}

export interface FinancialAccount {
  id: string;
  buildingId: string;
  name: string;
  type: FinancialAccountType;
  openingBalance: number;
  isActive: boolean;
}

export interface FinancialAccountUpsertRequest {
  buildingId: string;
  name: string;
  type: FinancialAccountType;
  openingBalance: number;
  isActive: boolean;
}

export interface LedgerCategory {
  id: string;
  buildingId: string;
  parentId: string | null;
  code: string;
  name: string;
  type: LedgerCategoryType;
  externalCode: string | null;
  systemKey: string | null;
  isActive: boolean;
  isTemplate: boolean;
  hasChildren: boolean;
  // Cuenta final de gastos o ingresos: categoría con la que cuenta en la liquidación lo que se carga en ella (nula en los grupos,
  // en las clases de balance y en las cuentas de cobranza de expensas, que no reciben gastos ni ingresos cargados a mano).
  expenseCategory: BuildingExpenseCategory | null;
  incomeCategory: BuildingIncomeCategory | null;
  // Ya tiene gastos o ingresos cargados: no se elimina ni se le cambia el tipo o la categoría; solo se desactiva.
  hasMovements: boolean;
}

export interface LedgerCategoryUpsertRequest {
  buildingId: string;
  parentId: string | null;
  code: string;
  name: string;
  type: LedgerCategoryType;
  externalCode: string | null;
  isActive: boolean;
  expenseCategory?: BuildingExpenseCategory | null;
  incomeCategory?: BuildingIncomeCategory | null;
  // Función especial de la cuenta: sin dato (null/undefined) se conserva la que tenía; '' la quita; con valor la asigna
  // (si otra cuenta la tenía, se la quita: cada función va en una sola cuenta).
  systemKey?: string | null;
}

// Cómo se aplica un plan a un edificio: Replace sustituye el plan entero (desvincula el rubro de gastos e ingresos y borra el
// presupuesto), AddMissing solo agrega las cuentas que faltan y Update además actualiza las que ya existen.
export type LedgerPlanApplyMode = 'Replace' | 'AddMissing' | 'Update';

// Lo que se desvincula o se borra al reemplazar el plan del edificio.
export interface LedgerPlanImpact {
  categories: number;
  expenses: number;
  incomes: number;
  recurringExpenses: number;
  budgetLines: number;
  hasImpact: boolean;
}

export interface LedgerPlanApplyRequest {
  buildingId: string;
  mode: LedgerPlanApplyMode;
  confirmReplace: boolean;
}

export interface LedgerPlanApplyResult {
  created: number;
  updated: number;
  skipped: number;
  removedCategories: number;
  unlinkedExpenses: number;
  unlinkedIncomes: number;
  unlinkedRecurringExpenses: number;
  deletedBudgetLines: number;
  messages: string[];
}

// Fila del plan importado: salida de la vista previa y entrada de la confirmación (el usuario corrige el tipo de las raíces y la
// categoría de la liquidación de las cuentas finales).
export interface LedgerPlanImportRow {
  rowNumber: number;
  code: string;
  name: string;
  parentCode: string | null;
  type: LedgerCategoryType;
  level: number;
  isLeaf: boolean;
  externalCode: string | null;
  isActive: boolean;
  systemKey: string | null;
  expenseCategory: BuildingExpenseCategory | null;
  incomeCategory: BuildingIncomeCategory | null;
  categorySuggested: boolean;
  errors: string[];
  warnings: string[];
}

export interface LedgerPlanImportPreview {
  rows: LedgerPlanImportRow[];
  errorCount: number;
  warningCount: number;
  hasErrors: boolean;
  impact: LedgerPlanImpact;
}

export interface LedgerPlanImportCommitRequest {
  buildingId: string;
  mode: LedgerPlanApplyMode;
  confirmReplace: boolean;
  rows: LedgerPlanImportRow[];
}

export interface LedgerCategoryCopyRequest {
  sourceBuildingId: string;
  targetBuildingId: string;
}

export interface LedgerCategoryCopyResult {
  updated: number;
  created: number;
  skipped: number;
  messages: string[];
}

// ── Finanzas del edificio: libro (saldos, movimientos, flujo y tablero) ───────

export type LedgerDirection = 'In' | 'Out';
export type LedgerSourceType = 'OwnerPayment' | 'BuildingExpense' | 'BuildingIncome' | 'SupplierCreditNote';

export interface FinanceAccountBalance {
  id: string;
  name: string;
  type: FinancialAccountType;
  isActive: boolean;
  openingBalance: number;
  inflows: number;
  outflows: number;
  balance: number;
}

export interface FinanceBalances {
  buildingId: string;
  buildingName: string;
  financeStartDate: string;
  asOf: string;
  accounts: FinanceAccountBalance[];
  unassignedNet: number;
  totalBalance: number;
  cashBalance: number;
  bankBalance: number;
  reserveFundBalance: number;
  defaultAccountId: string | null;
  warnings: string[];
}

export interface FinanceMovement {
  date: string;
  accountId: string | null;
  accountName: string;
  categoryId: string | null;
  categoryCode: string;
  categoryName: string;
  direction: LedgerDirection;
  amount: number;
  signedAmount: number;
  description: string;
  thirdParty: string;
  reference: string;
  sourceType: LedgerSourceType;
  sourceId: string;
  runningBalance: number | null;
}

export interface FinanceMovementsPage {
  items: FinanceMovement[];
  totalCount: number;
  page: number;
  pageSize: number;
  from: string;
  to: string;
  totalIn: number;
  totalOut: number;
  openingBalance: number | null;
  closingBalance: number | null;
}

export interface FinanceMovementFilters {
  from?: string | null;
  to?: string | null;
  accountId?: string | null;
  unassigned?: boolean;
  categoryId?: string | null;
  direction?: LedgerDirection | null;
  newestFirst?: boolean;
  page?: number;
  pageSize?: number;
}

export interface FinanceFlow {
  in: number;
  out: number;
  net: number;
}

export interface FinanceRubroAmount {
  categoryId: string | null;
  code: string;
  name: string;
  amount: number;
}

export interface FinanceMonthPoint {
  year: number;
  month: number;
  in: number;
  out: number;
  net: number;
  endBalance: number;
}

export interface FinanceMonthRef {
  year: number;
  month: number;
}

export interface FinanceDashboard {
  buildingId: string;
  buildingName: string;
  financeStartDate: string;
  asOf: string;
  year: number;
  month: number;
  balances: FinanceBalances;
  monthFlow: FinanceFlow;
  monthIn: FinanceRubroAmount[];
  monthOut: FinanceRubroAmount[];
  fiscalYear: number;
  fiscalYearStart: string;
  fiscalYearToDate: FinanceFlow;
  series: FinanceMonthPoint[];
  budget: FinanceBudgetSummary;
  reserveFund: FinanceReserveSummary;
}

export interface FinanceCashFlowLine {
  categoryId: string | null;
  code: string;
  name: string;
  groupCode: string;
  groupName: string;
  direction: LedgerDirection;
  amounts: number[];
  total: number;
}

export interface FinanceCashFlow {
  buildingId: string;
  financeStartDate: string;
  fiscalYear: number;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  asOf: string;
  months: FinanceMonthRef[];
  inLines: FinanceCashFlowLine[];
  outLines: FinanceCashFlowLine[];
  totalIn: number[];
  totalOut: number[];
  net: number[];
  openingBalance: number;
  closingBalance: number[];
}

export interface BuildingPlan {
  id: string;
  planId: string;
  planName: string;
  planIsDefault: boolean;
  planPrice: number;
  planBillingCycle: BillingCycle;
  planGracePeriodDays: number;
  buildingId: string;
  buildingName: string;
  companyName: string;
  assignmentScope: PlanAssignmentScope;
  scopeEntityId: string;
  startDate: string;
  endDate: string;
  renewalStartDate: string | null;
  renewalEndDate: string | null;
  isPaid: boolean;
  paidAt: string | null;
  paidByFullName: string | null;
  isActive: boolean;
  isArchived: boolean;
  assignedByFullName: string;
  createdAtUtc: string;
  status: BuildingPlanStatus;
  daysUntilExpiry: number;
  daysUntilBlocked: number | null;
  hasPendingPayment: boolean;
}

export interface BuildingPlanSummary {
  id: string;
  buildingId: string;
  buildingName: string;
  planName: string;
  startDate: string;
  endDate: string;
  hasRenewal: boolean;
  isPaid: boolean;
  isActive: boolean;
  status: BuildingPlanStatus;
  daysUntilExpiry: number;
  daysUntilBlocked: number | null;
}

export interface BuildingPlanAssignRequest {
  planId: string;
  buildingId: string;
  startDate: string;
  endDate: string;
}

export interface BuildingPlanBulkAssignRequest {
  planId: string;
  scope: 'Company' | 'Condominium';
  scopeEntityId: string;
  startDate: string;
  endDate: string;
}

export interface BuildingPlanSetRenewalRequest {
  renewalStartDate: string;
  renewalEndDate: string;
}

export interface BuildingPlanPayment {
  id: string;
  buildingPlanId: string;
  assignmentScope: PlanAssignmentScope;
  scopeEntityId: string;
  companyId: string;
  companyName: string;
  buildingName: string;
  planName: string;
  declaredAmount: number;
  paymentDate: string;
  comprobanteUrl: string;
  reference: string;
  status: BuildingPlanPaymentStatus;
  rejectionReason: string;
  submittedByFullName: string;
  createdAtUtc: string;
  reviewedByFullName: string | null;
  reviewedAt: string | null;
}

export interface BuildingPlanPaymentCreateRequest {
  buildingPlanId: string;
  declaredAmount: number;
  paymentDate: string;
  comprobanteUrl?: string;
  reference?: string;
}

export interface BuildingPlanPaymentRejectRequest {
  rejectionReason: string;
}

export interface BulkAssignError {
  buildingId: string;
  buildingName: string;
  error: string;
}

export interface BulkAssignErrorResponse {
  message: string;
  failedBuildings: BulkAssignError[];
}

// ── Ad Campaigns ─────────────────────────────────────────────────────────────

export type AdCampaignCategory =
  | 'Gastronomia' | 'Supermercado' | 'Farmacia' | 'Lavanderia'
  | 'ServiciosHogar' | 'BellezaBienestar' | 'Educacion' | 'Mascotas'
  | 'Tecnologia' | 'Inmobiliaria' | 'Otro';

export interface AdCampaign {
  id: string;
  companyId: string;
  companyName: string;
  createdByUserId: string;
  advertiserName: string;
  description: string | null;
  ctaText: string;
  ctaUrl: string | null;
  imageUrl: string;
  category: AdCampaignCategory;
  position: number;
  startDate: string;
  endDate: string;
  monthlyAmount: number | null;
  isActive: boolean;
  notifyBeforeExpiry: boolean;
  buildingIds: string[];
  buildingCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface AdCampaignCreateRequest {
  companyId: string;
  advertiserName: string;
  description?: string | null;
  ctaText: string;
  ctaUrl?: string | null;
  imageUrl: string;
  category: string;
  position: number;
  startDate: string;
  endDate: string;
  monthlyAmount?: number | null;
  isActive: boolean;
  notifyBeforeExpiry: boolean;
  buildingIds: string[];
}

export interface AdCampaignUpdateRequest {
  advertiserName: string;
  description?: string | null;
  ctaText: string;
  ctaUrl?: string | null;
  imageUrl: string;
  category: string;
  position: number;
  startDate: string;
  endDate: string;
  monthlyAmount?: number | null;
  isActive: boolean;
  notifyBeforeExpiry: boolean;
  buildingIds: string[];
}

export interface UpdateSettlementCalibrationRequest {
  positions: Record<string, FieldOffset>;
  hideFrame: boolean;
}

// ── Finanzas del edificio: presupuesto y fondo de reserva ─────────────────────

// Semaforo del presupuesto vs. real: verde dentro de lo presupuestado, amarillo hasta 10 % de desvio, rojo mas alla.
export type BudgetStatus = 'None' | 'Green' | 'Amber' | 'Red';

export interface FinanceBudgetRow {
  categoryId: string;
  code: string;
  name: string;
  groupCode: string;
  groupName: string;
  type: LedgerCategoryType;
  isActive: boolean;
  // Un importe por mes del ejercicio (en el mismo orden que `months`).
  amounts: number[];
  total: number;
}

export interface FinanceBudget {
  buildingId: string;
  fiscalYear: number;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  months: FinanceMonthRef[];
  rows: FinanceBudgetRow[];
  totalIncome: number[];
  totalExpense: number[];
  affectedCells: number;
}

export interface FinanceBudgetCell {
  categoryId: string;
  year: number;
  month: number;
  amount: number;
}

export interface FinanceBudgetVsActualLine {
  categoryId: string;
  code: string;
  name: string;
  groupCode: string;
  groupName: string;
  type: LedgerCategoryType;
  monthBudget: number;
  monthActual: number;
  monthVariance: number;
  monthVariancePct: number | null;
  monthStatus: BudgetStatus;
  ytdBudget: number;
  ytdActual: number;
  ytdVariance: number;
  ytdVariancePct: number | null;
  ytdStatus: BudgetStatus;
}

export interface FinanceBudgetTotals {
  monthBudget: number;
  monthActual: number;
  ytdBudget: number;
  ytdActual: number;
  monthStatus: BudgetStatus;
  ytdStatus: BudgetStatus;
}

export interface FinanceBudgetVsActual {
  buildingId: string;
  buildingName: string;
  year: number;
  month: number;
  fiscalYear: number;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  asOf: string;
  expenseBasis: string;
  incomeBasis: string;
  amberThresholdPct: number;
  incomeLines: FinanceBudgetVsActualLine[];
  expenseLines: FinanceBudgetVsActualLine[];
  incomeTotals: FinanceBudgetTotals;
  expenseTotals: FinanceBudgetTotals;
}

export interface FinanceBudgetSummary {
  monthExpenseBudget: number;
  monthExpenseActual: number;
  monthIncomeBudget: number;
  monthIncomeActual: number;
  redCount: number;
  amberCount: number;
  hasBudget: boolean;
  topOverBudget: FinanceBudgetVsActualLine[];
}

export interface FinanceReserveMonth {
  year: number;
  month: number;
  opening: number;
  contributions: number;
  uses: number;
  closing: number;
}

export interface FinanceReserveFund {
  buildingId: string;
  buildingName: string;
  // Sin cuenta de fondo de reserva el libro no puede separar sus movimientos.
  hasFundAccount: boolean;
  accountId: string | null;
  accountName: string;
  financeStartDate: string;
  asOf: string;
  reserveFundPercentage: number | null;
  openingBalance: number;
  contributions: number;
  uses: number;
  balance: number;
  months: FinanceReserveMonth[];
  movements: FinanceMovementsPage;
}

export interface FinanceReserveSummary {
  hasFundAccount: boolean;
  balance: number;
  monthContributions: number;
  monthUses: number;
}

// ── Pago registrado por el sistema (canal Web) ──────────────────────────────

export interface OwnerPaymentRegisterRequest {
  ownerId: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  externalReference: string;
  notes: string;
}

export interface RegisterComprobanteLine {
  concept: string;
  pending: number;
}

export interface RegisterComprobante {
  unitId: string;
  unitCode: string;
  buildingId: string;
  buildingName: string;
  expensePeriodId: string;
  periodYear: number;
  periodMonth: number;
  total: number;
  cumulativeTotal: number;
  amountToReceive: number;
  inScope: boolean;
  lines: RegisterComprobanteLine[];
}

export interface RegisterPreview {
  ownerId: string;
  ownerFullName: string;
  availableCredit: number;
  pendingOwnerPayments: { id: string; reference: string; status: string; declaredAmount: number }[];
  comprobantes: RegisterComprobante[];
}

// ── Conciliacion del periodo (gastos + aportes - ingresos = cargos) ─────────
export type ReconciliationState = 'Preview' | 'Reconciled' | 'Difference' | 'Error';

export interface ExpensePeriodReconciliation {
  expensePeriodId: string;
  expensePeriodName: string;
  periodStatus: ExpensePeriodStatus;
  settlementStatus: string | null;
  totalExpenses: number;
  nonDistributedExpenses: number;
  paidByReserveFundExpenses: number;
  incomesCredited: number;
  reserveContribution: number;
  extraordinaryContribution: number;
  expectedCharges: number;
  issuedCharges: number;
  difference: number;
  state: ReconciliationState;
  message: string | null;
  manualChargeCount: number;
  manualChargeAmount: number;
  lateFeeAmount: number;
  totalCharged: number;
  collected: number;
  pending: number;
}

// ── Marketplace de espacios temporales ────────────────────────────────────────

// Fila del listado del SuperAdmin: edificio con su plan, el interruptor y la configuración del marketplace.
export interface MarketplaceAdminBuilding {
  buildingId: string;
  buildingName: string;
  companyName: string;
  condominiumName: string;
  planId: string | null;
  planName: string;
  planStatus: string;
  planIncludesMarketplace: boolean;
  moduleEnabled: boolean;
  moduleAvailable: boolean;
  commissionPercent: number;
  transferInfo: string;
}

// Edificio del personal con el marketplace disponible y lo que su rol puede hacer ahí.
export interface MarketplaceStaffBuilding {
  buildingId: string;
  buildingName: string;
  canReviewPayments: boolean;
  canViewAccount: boolean;
  canEditAccount: boolean;
}

export interface MarketplaceAdminUpdateRequest {
  enabled: boolean;
  commissionPercent: number;
  transferInfo: string | null;
}

// ── Marketplace: revisión de pagos de reservas ────────────────────────────────

// Pago de una reserva esperando revisión (lo ve solo el personal del edificio).
export interface MarketplaceReviewItem {
  paymentId: string;
  reservationId: string;
  buildingId: string;
  reference: string;
  title: string;
  unitCode: string;
  ownerName: string;
  buyerName: string;
  buyerUnits: string;
  // Aviso solo para quien revisa: alguna unidad del comprador tiene pagos atrasados.
  buyerUnitOverdue: boolean;
  startsAtUtc: string;
  endsAtUtc: string;
  hours: number;
  baseAmount: number;
  commissionAmount: number;
  expectedAmount: number;
  comprobanteUrl: string;
  submittedAtUtc: string;
  status: 'Submitted' | 'Approved' | 'Rejected';
  rejectionReason: string | null;
  // La reserva ya terminó: ya no se puede confirmar (solo rechazar).
  reservationEnded: boolean;
}

// ── Marketplace: cuenta aparte por edificio ───────────────────────────────────

// Renglón del extracto. El importe lleva signo: los ingresos suman; las acreditaciones y devoluciones restan.
export interface MarketplaceAccountRow {
  id: string;
  occurredAtUtc: string;
  kind: 'PaymentIn' | 'OwnerCredit' | 'RefundOut' | 'Adjustment' | 'CancellationFee';
  amount: number;
  concept: string;
  reservationId: string | null;
  reference: string | null;
  // Nulo = movimiento automático del sistema.
  createdByName: string | null;
  // Solo el SuperAdmin: la acreditación se puede revertir (el saldo del propietario sigue intacto).
  canReverse: boolean;
}

export interface MarketplaceAccountSummary {
  openingBalance: number;
  totalIn: number;
  totalCredited: number;
  totalRefunds: number;
  totalAdjustments: number;
  // Comisiones que los propietarios asumieron al cancelar (se descontaron de su saldo a favor).
  totalCancellationFees: number;
  closingBalance: number;
  // Al día de hoy (no dependen del período elegido):
  currentBalance: number;
  pendingToCredit: number;
  // Reembolsos a compradores todavía sin devolver (siguen dentro del saldo, pero no son ganancia).
  pendingRefunds: number;
  // Deudas por gestión de propietarios por descontar de sus próximas acreditaciones (informativo).
  ownerDebtsPending: number;
  managementGain: number;
}

export interface MarketplaceStatement {
  buildingId: string;
  buildingName: string;
  fromDate: string;
  toDate: string;
  summary: MarketplaceAccountSummary;
  rows: MarketplaceAccountRow[];
  // Solo el SuperAdmin puede cargar ajustes y revertir acreditaciones.
  canEdit: boolean;
}

export interface MarketplaceAdjustmentRequest {
  buildingId: string;
  amount: number;
  concept: string;
}

export interface MarketplaceReversal {
  reservationId: string;
  reference: string;
  amount: number;
  ownerBalance: number;
}

// ── Marketplace: reembolsos, deudas por gestión y reclamos (seguimiento del personal) ─────────────────────────────

// Reembolso pendiente al comprador: el Encargado lo devuelve fuera del sistema y lo marca "devuelto".
export interface MarketplaceRefund {
  id: string;
  reservationId: string;
  buildingId: string;
  reference: string;
  title: string;
  unitCode: string;
  buyerName: string;
  amount: number;
  origin: 'BuyerCancellation' | 'OwnerCancellation' | 'ClaimResolution';
  reason: string;
  status: 'Pending' | 'Returned';
  createdAtUtc: string;
  // Plazo máximo para devolver (72 horas desde que se creó).
  dueAtUtc: string;
  overdue: boolean;
  returnedAtUtc: string | null;
  returnedByName: string | null;
}

// Comisión que el propietario asumió y su saldo no cubrió: se descuenta de su próxima acreditación del Marketplace.
export interface MarketplaceOwnerDebt {
  id: string;
  reservationId: string;
  buildingId: string;
  reference: string;
  ownerName: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  reason: string;
  createdAtUtc: string;
}

export type MarketplaceClaimOutcome = 'InFavorOfOwner' | 'InFavorOfBuyer';

// "Reportar un problema": con lo necesario para que el Encargado decida.
export interface MarketplaceClaim {
  id: string;
  reservationId: string;
  buildingId: string;
  reference: string;
  title: string;
  unitCode: string;
  ownerName: string;
  buyerName: string;
  buyerUnits: string;
  startsAtUtc: string;
  endsAtUtc: string;
  baseAmount: number;
  commissionAmount: number;
  totalAmount: number;
  openedBy: 'Buyer' | 'Owner';
  openedByName: string;
  reason: string;
  status: 'Open' | 'Resolved';
  resolution: MarketplaceClaimOutcome | null;
  resolutionNote: string | null;
  createdAtUtc: string;
  resolvedAtUtc: string | null;
  // Lo que respondió el comprador al aviso de inicio (nulo = no respondió: se asume que la usó).
  buyerStartResponse: 'Attending' | 'NotUsing' | null;
  buyerStartResponseReason: string | null;
}

// ── Marketplace: documentos y trazabilidad ────────────────────────────────────

// Una línea del historial económico de una operación (sale de la auditoría del Marketplace).
export interface MarketplaceHistoryItem {
  timestampUtc: string;
  action: string;
  title: string;
  detail: string | null;
  // Nulo = lo hizo el sistema.
  actorName: string | null;
  amount: number | null;
  fromStatus: string | null;
  toStatus: string | null;
}

// La operación de punta a punta: publicación → reserva → importes → pago → acreditación.
export interface MarketplaceOperationHistory {
  reservationId: string;
  buildingId: string;
  reference: string;
  title: string;
  unitCode: string;
  ownerName: string;
  buyerName: string;
  status: string;
  creditStatus: string;
  startsAtUtc: string;
  endsAtUtc: string;
  hours: number;
  // Importes congelados al crear la reserva.
  hourlyPrice: number;
  baseAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  totalAmount: number;
  ownerNetAmount: number;
  items: MarketplaceHistoryItem[];
}

// Estado ACTUAL de una reserva afectada por un cambio de propietario principal.
export interface MarketplaceHandoverOperation {
  reservationId: string;
  reference: string;
  title: string;
  status: string;
  creditStatus: string;
  startsAtUtc: string;
  endsAtUtc: string;
  ownerNetAmount: number;
  hasOpenClaim: boolean;
  refundStatus: 'Pending' | 'Returned' | null;
}

// Nota interna que se genera cuando cambia el propietario principal de una unidad con operaciones abiertas.
export interface MarketplaceHandoverNote {
  id: string;
  buildingId: string;
  buildingName: string;
  unitId: string;
  unitCode: string;
  previousOwnerName: string;
  newOwnerName: string | null;
  trigger: 'PrimaryRemoved' | 'PrimaryReplaced';
  // Lo que pasó y la situación al momento del cambio (texto fijo).
  content: string;
  reservationCount: number;
  createdAtUtc: string;
  readAtUtc: string | null;
  readByName: string | null;
  // Solo al abrir la nota: situación actual de cada operación.
  operations: MarketplaceHandoverOperation[];
}

// ── Publicidad: interruptor por edificio ─────────────────────────────────────
// Fila del listado del SuperAdmin: edificio con su interruptor de publicidad.
export interface AdBuilding {
  buildingId: string;
  buildingName: string;
  companyId: string | null;
  companyName: string;
  condominiumName: string;
  adsEnabled: boolean;
  campaignCount: number;
}
