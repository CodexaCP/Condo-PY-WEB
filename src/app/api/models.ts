export type LateFeeFrequency = 'Daily' | 'Weekly' | 'Biweekly';

export interface Building {
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
  lateFeeFrequency?: LateFeeFrequency | null;
}

export interface CreateBuildingRequest {
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
  lateFeeFrequency?: LateFeeFrequency | null;
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
  documentNumber: string;
  email: string;
  phoneNumber: string;
  isOwner: boolean;
  isActive: boolean;
}

export interface CreateResidentRequest {
  companyId?: string | null;
  fullName: string;
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
export type ExpenseSettlementStatus = 'Draft' | 'Calculated' | 'Approved' | 'Applied';
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
  amount: number;
  distributionType: BuildingExpenseDistributionType;
  targetUnitId: string | null;
  targetUnitCode: string;
  notes: string;
  hasReceipt: boolean;
  receiptFileName: string | null;
}

export interface RecurringBuildingExpense {
  id: string;
  companyId: string;
  buildingId: string;
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
}

export interface RecurringBuildingExpenseUpsertRequest {
  buildingId: string;
  category: BuildingExpenseCategory;
  supplierName: string;
  description: string;
  amount: number;
  distributionType: BuildingExpenseDistributionType;
  targetUnitId: string | null;
  notes: string;
  isActive: boolean;
}

export interface ApplyRecurringExpensesRequest {
  expensePeriodId: string;
}

export interface ApplyRecurringExpensesResult {
  applied: number;
  skipped: number;
  expensePeriodName: string;
  appliedDescriptions: string[];
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
}

export type BuildingIncomeCategory =
  | 'AccumulatedBalance'
  | 'CommonAreaRental'
  | 'Interest'
  | 'OperationalFund'
  | 'CreditAdjustment'
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
}

export interface CreateBuildingIncomeRequest {
  buildingId: string;
  expensePeriodId: string;
  category: BuildingIncomeCategory;
  description: string;
  incomeDate: string;
  amount: number;
  notes: string;
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
}

export type GenerateExpenseChargesMode = 'FixedAmount' | 'ByCoefficient';

export interface GenerateExpenseChargesRequest {
  mode: GenerateExpenseChargesMode;
  concept: string;
  amount: number;
  notes: string;
}

export interface GenerateExpenseChargesResult {
  expensePeriodId: string;
  expensePeriodName: string;
  unitsAffected: number;
  totalGeneratedAmount: number;
  mode: GenerateExpenseChargesMode;
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
  publishedAtUtc: string | null;
  publishedByUserId: string | null;
  publishedByUserName: string;
  status: ExpenseSettlementStatus | null;
  periodStatus: ExpensePeriodStatus;
  generatedChargeCount: number;
  isCalculated: boolean;
  categoryTotals: SettlementCategoryTotal[];
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
  concept: string;
  amount: number;
  notes: string;
  isReversal: boolean;
  reversalOfChargeId: string | null;
  isReversed: boolean;
  totalAllocated: number;
  pendingAmount: number;
}

export interface CreateExpenseChargeRequest {
  expensePeriodId: string;
  unitId: string;
  chargeType?: ExpenseChargeType;
  isLateFee?: boolean;
  concept: string;
  amount: number;
  notes: string;
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
  holderName: string;
  holderDocumentNumber: string;
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
  agingBucket: string;
}

export interface MorosityReport {
  summary: MorositySummary;
  items: MorosityItem[];
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

export interface Owner {
  id: string;
  companyId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  username: string;
  email: string;
  phonePrefix?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
}

export interface OwnerUpsertRequest {
  firstName: string;
  lastName: string;
  fullName?: string;
  username: string;
  email: string;
  password?: string;
  phonePrefix?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
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

export type BuildingPlanStatus = 'Active' | 'ExpiringSoon' | 'Expired' | 'Suspended' | 'Archived';

export interface Plan {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  price: number;
  billingCycle: BillingCycle;
  gracePeriodDays: number;
  isActive: boolean;
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
}

export interface PlanUpdateRequest extends PlanCreateRequest {
  isActive: boolean;
}

export interface PlanCloneResult {
  newPlanId: string;
  newPlanName: string;
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
