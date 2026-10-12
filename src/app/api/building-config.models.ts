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
