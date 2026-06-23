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
  sourceSettlementId: string | null;
  isLateFee: boolean;
  concept: string;
  amount: number;
  notes: string;
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
  method: PaymentMethod;
  reference: string;
  notes: string;
}

export interface CreatePaymentRequest {
  expensePeriodId: string;
  unitId: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
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
}

export interface AccountStatementCharge {
  id: string;
  chargeType: ExpenseChargeType;
  concept: string;
  amount: number;
  notes: string;
}

export interface AccountStatementPayment {
  id: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
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
  ordinaryAmount: number;
  reserveFundAmount: number;
  extraordinaryAmount: number;
  individualAmount: number;
  adjustmentAmount: number;
  totalAmount: number;
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
