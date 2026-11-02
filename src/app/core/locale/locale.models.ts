// Configuracion regional de la empresa del usuario (pais, moneda con su formato, impuesto, vocabulario y capacidades).
// Es el CompanyLocaleDto del backend: llega con el login y se refresca con GET /api/locale/me.
export type CountryDocumentType = { code: string; label: string; isTaxId: boolean };

export type CountryCapabilities = {
  emitsInvoices: boolean;
  onlinePayments: boolean;
  purchaseTaxBook: boolean;
  paymentsInOtherCurrency: boolean;
};

export type CompanyLocale = {
  countryCode: string;
  countryName: string;
  isDraftCountry: boolean;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;
  groupSeparator: string;
  decimalSeparator: string;
  localeCode: string;
  timeZoneId: string;
  phonePrefix: string;
  taxName: string;
  taxGeneralRate: number | null;
  taxReducedRate: number | null;
  taxIdLabel: string;
  regionLabel: string;
  jurisdictions: string[];
  documentTypes: CountryDocumentType[];
  capabilities: CountryCapabilities;
  glossary: Record<string, string>;
  buildingFieldLabels: Record<string, string>;
};

// Un pais del catalogo (GET /api/locale/countries) con los valores que se copian a la empresa al crearla.
export type CountryProfile = {
  code: string;
  name: string;
  isDraft: boolean;
  currencyCode: string;
  localeCode: string;
  timeZoneId: string;
  phonePrefix: string;
  taxName: string;
  taxGeneralRate: number | null;
  taxReducedRate: number | null;
  taxIdLabel: string;
  regionLabel: string;
  jurisdictions: string[];
  documentTypes: CountryDocumentType[];
  capabilities: CountryCapabilities;
  glossary: Record<string, string>;
  buildingFieldLabels: Record<string, string>;
};

export type CapabilityName = keyof CountryCapabilities;

// Paraguay: lo que el panel mostraba antes de ser multipais. Se usa cuando no hay sesion o la respuesta no trae locale.
export const DEFAULT_LOCALE: CompanyLocale = {
  countryCode: 'PY',
  countryName: 'Paraguay',
  isDraftCountry: false,
  currencyCode: 'PYG',
  currencySymbol: 'Gs.',
  currencyDecimals: 0,
  groupSeparator: '.',
  decimalSeparator: ',',
  localeCode: 'es-PY',
  timeZoneId: 'America/Asuncion',
  phonePrefix: '+595',
  taxName: 'IVA',
  taxGeneralRate: 10,
  taxReducedRate: 5,
  taxIdLabel: 'RUC',
  regionLabel: 'Departamento',
  jurisdictions: [],
  documentTypes: [
    { code: 'RUC', label: 'RUC', isTaxId: true },
    { code: 'CedulaParaguaya', label: 'Cédula paraguaya', isTaxId: false },
    { code: 'Pasaporte', label: 'Pasaporte', isTaxId: false },
    { code: 'Otro', label: 'Otro', isTaxId: false }
  ],
  capabilities: { emitsInvoices: true, onlinePayments: true, purchaseTaxBook: true, paymentsInOtherCurrency: false },
  glossary: {},
  buildingFieldLabels: {
    region: 'Departamento',
    finca: 'Finca',
    padron: 'Padrón',
    cadastral: 'Cuenta corriente catastral',
    legalEntity: 'Personería jurídica',
    taxId: 'RUC'
  }
};
