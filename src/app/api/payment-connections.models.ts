// Pagos online (Centro de configuración): conexiones de la empresa con el comercio del proveedor (Bancard Tpago y vPOS).

export type PaymentEnvironment = 'Sandbox' | 'Production';
export type PaymentConnectionStatus = 'Draft' | 'PendingValidation' | 'Active' | 'Disabled';

export interface PaymentField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  maxLength: number;
  help?: string | null;
}

export interface PaymentProduct {
  code: string;
  name: string;
  description: string;
  fields: PaymentField[];
  signedCallback: boolean;
  supportsReversal: boolean;
  reversalNote: string;
  embeddedCheckout: boolean;
  notes: string[];
}

export interface PaymentProvider {
  code: string;
  name: string;
  products: PaymentProduct[];
}

export interface PaymentCatalog {
  providers: PaymentProvider[];
  masterKeyConfigured: boolean;
}

export interface PaymentConnectionBuilding {
  buildingId: string;
  buildingName: string;
  isEnabled: boolean;
  // Edificio de prueba: un cobro de sandbox o del simulador se aplica a la deuda solo acá; en cualquier otro queda simulado.
  isTest: boolean;
}

export interface PaymentConnection {
  id: string;
  companyId: string;
  name: string;
  providerCode: string;
  providerName: string;
  productCode: string;
  productName: string;
  environment: PaymentEnvironment;
  status: PaymentConnectionStatus;
  statusChangedAtUtc?: string | null;
  buildings: PaymentConnectionBuilding[];
  // Solo para quien puede editar (el resto ve nombre, estado y edificios).
  callbackUrl?: string | null;
  settings?: Record<string, string> | null;
  // Final enmascarado de cada clave secreta cargada (••••1234). Nunca el valor.
  secretsMasked?: Record<string, string> | null;
  secretsUpdatedAtUtc?: string | null;
  missingFields: string[];
  // Titular del comercio: a nombre de quién se cobra. Obligatorio para activar.
  holderName?: string | null;
  holderTaxId?: string | null;
  holderBankNote?: string | null;
}

export interface PaymentConnectionList {
  items: PaymentConnection[];
  canEdit: boolean;
  masterKeyConfigured: boolean;
  // El cobro online todavía no está habilitado: la configuración deja la conexión lista, pero nadie puede pagar aún.
  collectionEnabled: boolean;
}

export interface PaymentConnectionRequest {
  companyId?: string | null;
  name: string;
  providerCode: string;
  productCode: string;
  environment: PaymentEnvironment;
  settings: Record<string, string>;
  // Vacío o ausente = se conserva la clave actual; con valor = se reemplaza.
  secrets: Record<string, string>;
  // Titular del comercio. Ausente = no se toca; vacío borra el dato.
  holderName?: string | null;
  holderTaxId?: string | null;
  holderBankNote?: string | null;
}

export interface PaymentConnectionAudit {
  id: string;
  createdAtUtc: string;
  action: string;
  summary: string;
  changesJson?: string | null;
  userEmail: string;
  userRole: string;
}
