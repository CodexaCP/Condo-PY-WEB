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
