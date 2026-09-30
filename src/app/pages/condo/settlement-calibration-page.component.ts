import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { isPdfUrl, resolveUploadUrl } from '../../api/file-url.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { AuthService } from '../../auth/auth.service';
import { Building, FieldOffset } from '../../api/models';

type BlockKind = 'text' | 'column' | 'image';
type ColumnKey = 'colConcepto' | 'colDescripcion' | 'colReserva' | 'colMonto';

interface CalibField {
  key: string;
  label: string;
  section: string; // seccion desplegable de la pantalla (Encabezado, Ingresos, Cuerpo...)
  group: string;   // subgrupo dentro de la seccion (p. ej. cada categoria de ingreso); '' = sin subgrupo
  kind: BlockKind;
  sample: string;
  x: number;   // punto PDF, desde la esquina superior izquierda (igual que SettlementPdfDocument.cs)
  top: number;
  width: number; // ancho del bloque en puntos; 0 = texto de una linea sin ancho propio
  defaultFontSize: number; // debe coincidir con el tamano por defecto en SettlementPdfDocument.cs
  hiddenByDefault?: boolean; // arranca oculto hasta que se destilde "No dibujar"
  align?: 'L' | 'C' | 'R'; // alineacion dentro del ancho (montos a la derecha, nombres centrados)
}

interface CalibSection { name: string; fields: CalibField[]; }
const SECTION_ORDER = ['Encabezado', 'Ingresos', 'Gastos', 'Cuerpo', 'Totales', 'Fechas', 'Firmas'];

const IMAGE_H_PT = 40; // alto del cajetin de una firma (imagen)

// Cada dato es un bloque propio (etiqueta y valor por separado). Mismas keys, posiciones, anchos, alineacion y
// tamanos base que FieldDefaults en SettlementPdfDocument.cs — si se agrega un bloque calibrable ahi, hay que
// agregarlo aca tambien para poder arrastrarlo.
const FIELDS: CalibField[] = [
  // Encabezado
  { key: 'titulo',   section: 'Encabezado', group: '', label: 'Título',           kind: 'text', sample: 'LIQUIDACIÓN EXPENSAS COMUNES', x: 195, top: 86,  width: 0, defaultFontSize: 11 },
  { key: 'edificio', section: 'Encabezado', group: '', label: 'Edificio (valor)', kind: 'text', sample: 'EDIFICIO DE EJEMPLO',           x: 66,  top: 100, width: 0, defaultFontSize: 8 },
  { key: 'mes',      section: 'Encabezado', group: '', label: 'Mes (valor)',      kind: 'text', sample: 'ABRIL',                         x: 215, top: 112, width: 0, defaultFontSize: 10 },
  { key: 'anio',     section: 'Encabezado', group: '', label: 'Año (valor)',      kind: 'text', sample: '2026',                          x: 330, top: 112, width: 0, defaultFontSize: 10 },

  // Saldo acumulado: título, descripción y valor aparte de los conceptos (solo en la primera hoja)
  { key: 'saldoLabel', section: 'Ingresos', group: 'Saldo acumulado', label: 'Saldo acumulado — título', kind: 'text', sample: 'SALDO ACUMULADO', x: 50,  top: 130, width: 200, defaultFontSize: 8 },
  { key: 'saldoDescripcion', section: 'Ingresos', group: 'Saldo acumulado', label: 'Saldo acumulado — descripción', kind: 'text', sample: 'Saldo anterior período', x: 255, top: 130, width: 110, defaultFontSize: 8 },
  { key: 'saldoValor', section: 'Ingresos', group: 'Saldo acumulado', label: 'Saldo acumulado — valor',  kind: 'text', sample: '2.500.000',       x: 475, top: 130, width: 70,  defaultFontSize: 8, align: 'R' },

  // Fondo operativo: título, descripción y valor aparte de los conceptos (solo en la primera hoja)
  { key: 'fondoOperativoLabel', section: 'Ingresos', group: 'Fondo operativo', label: 'Fondo operativo — título', kind: 'text', sample: 'FONDO OPERATIVO', x: 50,  top: 118, width: 200, defaultFontSize: 8 },
  { key: 'fondoOperativoDescripcion', section: 'Ingresos', group: 'Fondo operativo', label: 'Fondo operativo — descripción', kind: 'text', sample: 'Gs. 121.700.000', x: 255, top: 118, width: 110, defaultFontSize: 8 },
  { key: 'fondoOperativoValor', section: 'Ingresos', group: 'Fondo operativo', label: 'Fondo operativo — valor',  kind: 'text', sample: '1.200.000',       x: 475, top: 118, width: 70,  defaultFontSize: 8, align: 'R' },

  // Resto de las categorías de ingreso: cada una con su título, su descripción y su valor (solo en la primera hoja)
  { key: 'alquilerLabel', section: 'Ingresos', group: 'Alquiler / uso de salón', label: 'Alquiler / uso de salón — título', kind: 'text', sample: 'ALQUILER/USO DE SALÓN', x: 370, top: 106, width: 105, defaultFontSize: 8 },
  { key: 'alquilerDescripcion', section: 'Ingresos', group: 'Alquiler / uso de salón', label: 'Alquiler / uso de salón — descripción', kind: 'text', sample: 'Alquiler / uso de salón', x: 250, top: 106, width: 115, defaultFontSize: 8 },
  { key: 'alquilerValor', section: 'Ingresos', group: 'Alquiler / uso de salón', label: 'Alquiler / uso de salón — valor',  kind: 'text', sample: '900.000', x: 475, top: 106, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'interesLabel', section: 'Ingresos', group: 'Interés', label: 'Interés — título', kind: 'text', sample: 'INTERÉS', x: 370, top: 94, width: 105, defaultFontSize: 8 },
  { key: 'interesDescripcion', section: 'Ingresos', group: 'Interés', label: 'Interés — descripción', kind: 'text', sample: 'Fondo mutuo Gs. 100.000.000', x: 250, top: 94, width: 115, defaultFontSize: 8 },
  { key: 'interesValor', section: 'Ingresos', group: 'Interés', label: 'Interés — valor',  kind: 'text', sample: '150.000', x: 475, top: 94, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'ajusteLabel', section: 'Ingresos', group: 'Ajuste a favor', label: 'Ajuste a favor — título', kind: 'text', sample: 'AJUSTE A FAVOR', x: 370, top: 82, width: 105, defaultFontSize: 8 },
  { key: 'ajusteDescripcion', section: 'Ingresos', group: 'Ajuste a favor', label: 'Ajuste a favor — descripción', kind: 'text', sample: 'Ajuste de ejemplo', x: 250, top: 82, width: 115, defaultFontSize: 8 },
  { key: 'ajusteValor', section: 'Ingresos', group: 'Ajuste a favor', label: 'Ajuste a favor — valor',  kind: 'text', sample: '100.000', x: 475, top: 82, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'aporteExtraLabel', section: 'Ingresos', group: 'Aporte extraordinario', label: 'Aporte extraordinario — título', kind: 'text', sample: 'APORTE EXTRAORDINARIO', x: 370, top: 70, width: 105, defaultFontSize: 8 },
  { key: 'aporteExtraDescripcion', section: 'Ingresos', group: 'Aporte extraordinario', label: 'Aporte extraordinario — descripción', kind: 'text', sample: 'Aporte extraordinario', x: 250, top: 70, width: 115, defaultFontSize: 8 },
  { key: 'aporteExtraValor', section: 'Ingresos', group: 'Aporte extraordinario', label: 'Aporte extraordinario — valor',  kind: 'text', sample: '350.000', x: 475, top: 70, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'otroLabel', section: 'Ingresos', group: 'Otros ingresos', label: 'Otros ingresos — título', kind: 'text', sample: 'OTROS INGRESOS', x: 370, top: 58, width: 105, defaultFontSize: 8 },
  { key: 'otroDescripcion', section: 'Ingresos', group: 'Otros ingresos', label: 'Otros ingresos — descripción', kind: 'text', sample: 'Otros ingresos', x: 250, top: 58, width: 115, defaultFontSize: 8 },
  { key: 'otroValor', section: 'Ingresos', group: 'Otros ingresos', label: 'Otros ingresos — valor',  kind: 'text', sample: '50.000', x: 475, top: 58, width: 70,  defaultFontSize: 8, align: 'R' },

  // Gastos por categoría (arrancan ocultos: los gastos salen en la lista corrida por proveedor; destildá "No dibujar" para usar estos bloques)
  { key: 'gastoAndeLabel',       section: 'Gastos', group: 'ANDE', label: 'ANDE — título',      kind: 'text', sample: 'ANDE', x: 50,  top: 145, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoAndeDescripcion', section: 'Gastos', group: 'ANDE', label: 'ANDE — descripción', kind: 'text', sample: 'CONSUMO CICLO 03/26', x: 185, top: 145, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoAndeValor',       section: 'Gastos', group: 'ANDE', label: 'ANDE — valor',       kind: 'text', sample: '3.150.000', x: 475, top: 145, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoEssapLabel',       section: 'Gastos', group: 'ESSAP', label: 'ESSAP — título',      kind: 'text', sample: 'ESSAP S.A.', x: 50,  top: 160, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoEssapDescripcion', section: 'Gastos', group: 'ESSAP', label: 'ESSAP — descripción', kind: 'text', sample: 'CONSUMO CICLO 03/26', x: 185, top: 160, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoEssapValor',       section: 'Gastos', group: 'ESSAP', label: 'ESSAP — valor',       kind: 'text', sample: '1.090.000', x: 475, top: 160, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoUtilitiesLabel',       section: 'Gastos', group: 'Servicios', label: 'Servicios — título',      kind: 'text', sample: 'SERVICIOS', x: 50,  top: 175, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoUtilitiesDescripcion', section: 'Gastos', group: 'Servicios', label: 'Servicios — descripción', kind: 'text', sample: 'SERVICIOS VARIOS', x: 185, top: 175, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoUtilitiesValor',       section: 'Gastos', group: 'Servicios', label: 'Servicios — valor',       kind: 'text', sample: '500.000', x: 475, top: 175, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoInternetPhoneLabel',       section: 'Gastos', group: 'Internet y telefonía', label: 'Internet y telefonía — título',      kind: 'text', sample: 'INTERNET Y TELEFONÍA', x: 50,  top: 190, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoInternetPhoneDescripcion', section: 'Gastos', group: 'Internet y telefonía', label: 'Internet y telefonía — descripción', kind: 'text', sample: 'SERVICIO DE INTERNET', x: 185, top: 190, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoInternetPhoneValor',       section: 'Gastos', group: 'Internet y telefonía', label: 'Internet y telefonía — valor',       kind: 'text', sample: '300.000', x: 475, top: 190, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoCleaningLabel',       section: 'Gastos', group: 'Limpieza', label: 'Limpieza — título',      kind: 'text', sample: 'LIMPIEZA', x: 50,  top: 205, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoCleaningDescripcion', section: 'Gastos', group: 'Limpieza', label: 'Limpieza — descripción', kind: 'text', sample: 'SERVICIO DE LIMPIEZA', x: 185, top: 205, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoCleaningValor',       section: 'Gastos', group: 'Limpieza', label: 'Limpieza — valor',       kind: 'text', sample: '11.290.000', x: 475, top: 205, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoSecurityLabel',       section: 'Gastos', group: 'Seguridad', label: 'Seguridad — título',      kind: 'text', sample: 'SEGURIDAD', x: 50,  top: 220, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoSecurityDescripcion', section: 'Gastos', group: 'Seguridad', label: 'Seguridad — descripción', kind: 'text', sample: 'SEGURIDAD - VALET PARKING', x: 185, top: 220, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoSecurityValor',       section: 'Gastos', group: 'Seguridad', label: 'Seguridad — valor',       kind: 'text', sample: '21.650.000', x: 475, top: 220, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoMaintenanceLabel',       section: 'Gastos', group: 'Mantenimiento', label: 'Mantenimiento — título',      kind: 'text', sample: 'MANTENIMIENTO', x: 50,  top: 235, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoMaintenanceDescripcion', section: 'Gastos', group: 'Mantenimiento', label: 'Mantenimiento — descripción', kind: 'text', sample: 'MANTENIMIENTO DE ASCENSORES', x: 185, top: 235, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoMaintenanceValor',       section: 'Gastos', group: 'Mantenimiento', label: 'Mantenimiento — valor',       kind: 'text', sample: '4.230.000', x: 475, top: 235, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoElevatorLabel',       section: 'Gastos', group: 'Ascensor', label: 'Ascensor — título',      kind: 'text', sample: 'ASCENSOR', x: 50,  top: 250, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoElevatorDescripcion', section: 'Gastos', group: 'Ascensor', label: 'Ascensor — descripción', kind: 'text', sample: 'REPARACIÓN DE ASCENSOR', x: 185, top: 250, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoElevatorValor',       section: 'Gastos', group: 'Ascensor', label: 'Ascensor — valor',       kind: 'text', sample: '800.000', x: 475, top: 250, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoInsuranceLabel',       section: 'Gastos', group: 'Seguro', label: 'Seguro — título',      kind: 'text', sample: 'SEGURO', x: 50,  top: 265, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoInsuranceDescripcion', section: 'Gastos', group: 'Seguro', label: 'Seguro — descripción', kind: 'text', sample: 'SEGURO TODO RIESGO', x: 185, top: 265, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoInsuranceValor',       section: 'Gastos', group: 'Seguro', label: 'Seguro — valor',       kind: 'text', sample: '3.116.667', x: 475, top: 265, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoSuppliesLabel',       section: 'Gastos', group: 'Insumos', label: 'Insumos — título',      kind: 'text', sample: 'INSUMOS', x: 50,  top: 280, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoSuppliesDescripcion', section: 'Gastos', group: 'Insumos', label: 'Insumos — descripción', kind: 'text', sample: 'ARTÍCULOS ELÉCTRICOS', x: 185, top: 280, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoSuppliesValor',       section: 'Gastos', group: 'Insumos', label: 'Insumos — valor',       kind: 'text', sample: '793.500', x: 475, top: 280, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoPayrollLabel',       section: 'Gastos', group: 'Salarios', label: 'Salarios — título',      kind: 'text', sample: 'SALARIOS', x: 50,  top: 295, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoPayrollDescripcion', section: 'Gastos', group: 'Salarios', label: 'Salarios — descripción', kind: 'text', sample: 'SALARIO MES DE ABRIL', x: 185, top: 295, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoPayrollValor',       section: 'Gastos', group: 'Salarios', label: 'Salarios — valor',       kind: 'text', sample: '4.100.739', x: 475, top: 295, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoTaxesLabel',       section: 'Gastos', group: 'Impuestos', label: 'Impuestos — título',      kind: 'text', sample: 'IMPUESTOS', x: 50,  top: 310, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoTaxesDescripcion', section: 'Gastos', group: 'Impuestos', label: 'Impuestos — descripción', kind: 'text', sample: 'ASISTENCIA TRIBUTARIA', x: 185, top: 310, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoTaxesValor',       section: 'Gastos', group: 'Impuestos', label: 'Impuestos — valor',       kind: 'text', sample: '550.000', x: 475, top: 310, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoAdministrationLabel',       section: 'Gastos', group: 'Administración', label: 'Administración — título',      kind: 'text', sample: 'ADMINISTRACIÓN', x: 50,  top: 325, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoAdministrationDescripcion', section: 'Gastos', group: 'Administración', label: 'Administración — descripción', kind: 'text', sample: 'ADMINISTRACIÓN CONSORCIO', x: 185, top: 325, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoAdministrationValor',       section: 'Gastos', group: 'Administración', label: 'Administración — valor',       kind: 'text', sample: '7.535.000', x: 475, top: 325, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoExtraordinaryLabel',       section: 'Gastos', group: 'Extraordinario', label: 'Extraordinario — título',      kind: 'text', sample: 'EXTRAORDINARIO', x: 50,  top: 340, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoExtraordinaryDescripcion', section: 'Gastos', group: 'Extraordinario', label: 'Extraordinario — descripción', kind: 'text', sample: 'GASTO EXTRAORDINARIO', x: 185, top: 340, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoExtraordinaryValor',       section: 'Gastos', group: 'Extraordinario', label: 'Extraordinario — valor',       kind: 'text', sample: '1.000.000', x: 475, top: 340, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoOtherLabel',       section: 'Gastos', group: 'Otros gastos', label: 'Otros gastos — título',      kind: 'text', sample: 'OTROS GASTOS', x: 50,  top: 355, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoOtherDescripcion', section: 'Gastos', group: 'Otros gastos', label: 'Otros gastos — descripción', kind: 'text', sample: 'FOTOCOPIAS Y PAPELERÍA', x: 185, top: 355, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoOtherValor',       section: 'Gastos', group: 'Otros gastos', label: 'Otros gastos — valor',       kind: 'text', sample: '120.400', x: 475, top: 355, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },
  { key: 'gastoReserveFundLabel',       section: 'Gastos', group: 'Fondo de reserva', label: 'Fondo de reserva — título',      kind: 'text', sample: 'FONDO DE RESERVA', x: 50,  top: 370, width: 135, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoReserveFundDescripcion', section: 'Gastos', group: 'Fondo de reserva', label: 'Fondo de reserva — descripción', kind: 'text', sample: 'CAMBIO DE BARRERA', x: 185, top: 370, width: 220, defaultFontSize: 8, hiddenByDefault: true },
  { key: 'gastoReserveFundValor',       section: 'Gastos', group: 'Fondo de reserva', label: 'Fondo de reserva — valor',       kind: 'text', sample: '2.640.000', x: 475, top: 370, width: 70,  defaultFontSize: 8, align: 'R', hiddenByDefault: true },

  // Cuerpo: lista corrida de gastos por proveedor (una columna por bloque); los bloques por categoría de arriba arrancan ocultos
  { key: 'colConcepto',    section: 'Cuerpo', group: '', label: 'Columna CONCEPTO (proveedor)',      kind: 'column', sample: '', x: 50,  top: 145, width: 135, defaultFontSize: 8 },
  { key: 'colDescripcion', section: 'Cuerpo', group: '', label: 'Columna DESCRIPCIÓN DE CONCEPTO',   kind: 'column', sample: '', x: 185, top: 145, width: 220, defaultFontSize: 8 },
  { key: 'colReserva',     section: 'Cuerpo', group: '', label: 'Columna MONTO fondo de reserva',    kind: 'column', sample: '', x: 405, top: 145, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'colMonto',       section: 'Cuerpo', group: '', label: 'Columna MONTO gastos comunes',      kind: 'column', sample: '', x: 475, top: 145, width: 70,  defaultFontSize: 8, align: 'R' },

  // Totales (solo en la última hoja)
  { key: 'mesTotales', section: 'Totales', group: '', label: 'Mes (valor) — en los totales', kind: 'text', sample: 'ABRIL', x: 250, top: 598, width: 100, defaultFontSize: 8, align: 'C' },
  { key: 'reservaPctLabel', section: 'Totales', group: '', label: 'Aporte de fondo de reserva — título', kind: 'text', sample: 'APORTE DE FONDO DE RESERVA 10%', x: 50, top: 637, width: 250, defaultFontSize: 8 },
  { key: 'reservaPctValorReserva', section: 'Totales', group: '', label: 'Aporte de fondo de reserva — valor (fondo de reserva)', kind: 'text', sample: '6.398.488', x: 405, top: 637, width: 70, defaultFontSize: 8, align: 'R' },
  { key: 'reservaPctValorComunes', section: 'Totales', group: '', label: 'Aporte de fondo de reserva — valor (gastos comunes)', kind: 'text', sample: '6.398.488', x: 475, top: 637, width: 70, defaultFontSize: 8, align: 'R' },
  { key: 'extraPctLabel', section: 'Totales', group: '', label: 'Aporte extraordinario (%) — título', kind: 'text', sample: 'APORTE EXTRAORDINARIO 20%', x: 50, top: 650, width: 250, defaultFontSize: 8 },
  { key: 'extraPctValor', section: 'Totales', group: '', label: 'Aporte extraordinario (%) — valor', kind: 'text', sample: '14.076.674', x: 475, top: 650, width: 70, defaultFontSize: 8, align: 'R' },
  { key: 'saldoAcumuladoLabel', section: 'Totales', group: '', label: 'Saldo acumulado (fondo de reserva) — título', kind: 'text', sample: 'SALDO ACUMULADO', x: 50, top: 663, width: 250, defaultFontSize: 8 },
  { key: 'saldoAcumuladoValor', section: 'Totales', group: '', label: 'Saldo acumulado (fondo de reserva) — valor', kind: 'text', sample: '135.024.084', x: 405, top: 663, width: 70, defaultFontSize: 8, align: 'R' },
  { key: 'totIngresosLabel', section: 'Totales', group: '', label: 'Total para gastos — título',        kind: 'text', sample: 'TOTAL PARA GASTOS',     x: 50,  top: 585, width: 200, defaultFontSize: 8 },
  { key: 'totIngresosValor', section: 'Totales', group: '', label: 'Total para gastos — valor',         kind: 'text', sample: '3.400.000',             x: 475, top: 585, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'totGastosLabel',   section: 'Totales', group: '', label: 'Total gastos del mes — título',     kind: 'text', sample: 'TOTAL GASTOS DEL MES',  x: 50,  top: 598, width: 200, defaultFontSize: 8 },
  { key: 'totGastosValor', section: 'Totales', group: '', label: 'Total gastos del mes — valor (suma de todos los conceptos)', kind: 'text', sample: '66.626.695', x: 335, top: 598, width: 70, defaultFontSize: 8, align: 'R' },
  { key: 'totGastosReserva', section: 'Totales', group: '', label: 'Total gastos — valor fondo de reserva', kind: 'text', sample: '2.640.000',        x: 405, top: 598, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'totPagadoFondoValor', section: 'Totales', group: '', label: 'Total gastos — pagado por el fondo de reserva (× -1)', kind: 'text', sample: '-2.641.814', x: 405, top: 598, width: 70, defaultFontSize: 8, align: 'R' },
  { key: 'totGastosComunes', section: 'Totales', group: '', label: 'Total gastos — valor gastos comunes',   kind: 'text', sample: '37.180.000',       x: 475, top: 598, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'subTotalValor',    section: 'Totales', group: '', label: 'Sub total general — valor',         kind: 'text', sample: '39.820.000',            x: 475, top: 611, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'totalValor',       section: 'Totales', group: '', label: 'Total general — valor',             kind: 'text', sample: '40.190.000',            x: 475, top: 624, width: 70,  defaultFontSize: 8, align: 'R' },

  // Fechas
  { key: 'fechaEmision',     section: 'Fechas', group: '', label: 'Fecha de emisión (solo el valor)', kind: 'text', sample: '30/04/2026',  x: 165, top: 705, width: 0, defaultFontSize: 8 },
  { key: 'vigenciaLabel',    section: 'Fechas', group: '', label: 'Vigencia — título',                kind: 'text', sample: 'VIGENCIA',    x: 52,  top: 745, width: 0, defaultFontSize: 8 },
  { key: 'vigenciaDesde',    section: 'Fechas', group: '', label: 'Vigencia — desde',                 kind: 'text', sample: '01/04/2026',  x: 110, top: 745, width: 0, defaultFontSize: 8 },
  { key: 'vigenciaHasta',    section: 'Fechas', group: '', label: 'Vigencia — hasta',                 kind: 'text', sample: '30/04/2026',  x: 165, top: 745, width: 0, defaultFontSize: 8 },
  { key: 'vencimientoLabel', section: 'Fechas', group: '', label: 'Vencimiento — título',             kind: 'text', sample: 'VENCIMIENTO', x: 52,  top: 757, width: 0, defaultFontSize: 8 },
  { key: 'vencimiento',      section: 'Fechas', group: '', label: 'Vencimiento — valor',              kind: 'text', sample: '20/05/2026',  x: 120, top: 757, width: 0, defaultFontSize: 8 },

  // Firmas: Autorizado = presidente (imagen, nombre y cargo por separado); Verificación = building manager (solo la imagen)
  { key: 'firmaAutorizado',       section: 'Firmas', group: 'Autorizado por (presidente)', label: 'Imagen de la firma', kind: 'image', sample: 'firma',                   x: 250, top: 655, width: 110, defaultFontSize: 8 },
  { key: 'firmaAutorizadoNombre', section: 'Firmas', group: 'Autorizado por (presidente)', label: 'Nombre',             kind: 'text',  sample: 'Nombre Apellido',         x: 215, top: 700, width: 175, defaultFontSize: 8, align: 'C' },
  { key: 'firmaAutorizadoCargo',  section: 'Firmas', group: 'Autorizado por (presidente)', label: 'Cargo',              kind: 'text',  sample: 'Presidente del consorcio', x: 215, top: 711, width: 175, defaultFontSize: 8, align: 'C' },
  { key: 'firmaVerificacion',       section: 'Firmas', group: 'Verificación (building manager)', label: 'Imagen de la firma', kind: 'image', sample: 'firma',              x: 420, top: 655, width: 110, defaultFontSize: 8 }
];

// Filas de ejemplo de cada columna (una fila por renglon del cuerpo).
const COLUMN_SAMPLES: Record<ColumnKey, string[]> = {
  colConcepto:    ['SALDO ACUMULADO', 'ANDE', 'TODO BRILLO S.A.', 'CGI S.R.L.', 'TOTAL GASTOS DEL MES'],
  colDescripcion: ['', 'CONSUMO CICLO 03/26', 'SERVICIO DE LIMPIEZA', 'CAMBIO DE BARRERA', ''],
  colReserva:     ['', '', '', '2.640.000', '2.640.000'],
  colMonto:       ['2.500.000', '3.150.000', '11.290.000', '', '37.180.000']
};

const ROWS_KEY = 'filas'; // guarda el alto de fila comun de las cuatro columnas
const DEFAULT_ROW_HEIGHT = 15;

const PAGE_W_PT = 595.2756;
const PAGE_H_PT = 841.8898;
const DEFAULT_ZOOM = 0.9; // px por punto PDF (ajustable con el zoom de la pantalla)
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.6;

@Component({
  standalone: true,
  selector: 'app-settlement-calibration-page',
  imports: [CommonModule, FormsModule, RouterLink, Button, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-page-head">
        <div>
          <h1>Ajustar liquidación</h1>
          <p *ngIf="building">{{ building.name }} · modelo de liquidación propio</p>
        </div>
        <a routerLink="/buildings" style="display:contents">
          <p-button label="Volver a edificios" icon="pi pi-arrow-left" severity="secondary" [text]="true"></p-button>
        </a>
      </div>

      <p class="app-state" *ngIf="loading">Cargando...</p>

      <p class="app-state" *ngIf="!loading && building && !templateUrl">
        Este edificio no tiene un modelo de liquidación propio cargado. El superadmin lo adjunta en la ficha del edificio.
      </p>

      <ng-container *ngIf="!loading && building && templateUrl">
        <div class="calib-toolbar">
          <p-button label="Reiniciar posiciones" icon="pi pi-refresh" severity="secondary" [text]="true" (onClick)="resetAll()"></p-button>
          <span class="zoom-ctl">
            Zoom
            <button type="button" class="font-step" (click)="stepZoom(-0.1)" title="Achicar la hoja">−</button>
            <span class="zoom-value">{{ zoom * 100 | number:'1.0-0' }}%</span>
            <button type="button" class="font-step" (click)="stepZoom(0.1)" title="Agrandar la hoja">+</button>
          </span>
          <span class="spacer"></span>
          <p-button label="Generar PDF de prueba" icon="pi pi-file-pdf" severity="secondary" [outlined]="true" (onClick)="openSamplePdf()"></p-button>
          <p-button label="Guardar posiciones" icon="pi pi-check" [loading]="saving" (onClick)="save()"></p-button>
        </div>

        <p class="calib-hint">
          Arrastrá cada bloque sobre el modelo, o ajustalo con los controles de los paneles (cada panel tiene su propio scroll).
          Cada texto va en una sola línea (si no entra en su ancho se corta con "..."). Los datos son de ejemplo. Guardá y generá
          el PDF de prueba para verificar.
        </p>

        <div class="calib-options">
          <label class="hide-frame-check">
            <input type="checkbox" [(ngModel)]="hideFrame" name="hideFrame" [ngModelOptions]="{ standalone: true }" />
            Mi modelo ya tiene su propio marco, fondos y líneas impresos — dibujar solo el texto.
          </label>
          <span class="section-actions">
            <button type="button" class="link-btn" (click)="setAllSections(true)">Expandir todo</button>
            <button type="button" class="link-btn" (click)="setAllSections(false)">Contraer todo</button>
          </span>
          <span class="row-height">
            Alto de cada fila
            <button type="button" class="font-step" (click)="stepRowHeight(-0.5)">−</button>
            <input type="number" step="0.5" min="6" max="80" class="font-input"
                   [ngModel]="rowHeight" (ngModelChange)="setRowHeight($event)" [ngModelOptions]="{ standalone: true }" />
            <button type="button" class="font-step" (click)="stepRowHeight(0.5)">+</button>
            pt
          </span>
        </div>

        <div class="calib-workspace">
          <div class="calib-list calib-side">
            <ng-container *ngTemplateOutlet="sectionsTpl; context: { sections: leftSections }"></ng-container>
          </div>

          <div class="calib-canvas-wrap">
          <div class="calib-canvas" [style.width.px]="canvasW" [style.height.px]="canvasH">
            <img *ngIf="!isPdf" [src]="resolvedTemplateUrl" class="calib-bg" [style.width.px]="canvasW" [style.height.px]="canvasH" alt="Modelo de liquidación" />
            <iframe *ngIf="isPdf" [src]="resolvedTemplateUrlSafe" class="calib-bg" [style.width.px]="canvasW" [style.height.px]="canvasH" title="Modelo de liquidación"></iframe>

            <ng-container *ngFor="let f of fields">
              <div class="calib-field" *ngIf="!isHidden(f)"
                   [style.left.px]="screenX(f)" [style.top.px]="screenY(f)"
                   [style.fontSize.px]="fontSizeOf(f) * SCALE"
                   [style.width.px]="widthOf(f) ? widthOf(f) * SCALE : null"
                   [style.height.px]="heightOf(f)"
                   [style.textAlign]="alignOf(f)"
                   [class.calib-block]="f.kind !== 'text'"
                   [class.dragging]="draggingKey === f.key"
                   (mousedown)="startDrag(f, $event)">
                <ng-container [ngSwitch]="f.kind">
                  <ng-container *ngSwitchCase="'text'">{{ f.sample }}</ng-container>
                  <ng-container *ngSwitchCase="'column'">
                    <div class="mock-cell" *ngFor="let text of samplesOf(f)"
                         [style.textAlign]="alignOf(f)"
                         [style.height.px]="rowHeight * SCALE" [style.lineHeight.px]="rowHeight * SCALE">{{ text }}</div>
                  </ng-container>
                  <div *ngSwitchCase="'image'" class="mock-sign-img">{{ f.sample }}</div>
                </ng-container>
              </div>
            </ng-container>
          </div>
          </div>

          <div class="calib-list calib-side">
            <ng-container *ngTemplateOutlet="sectionsTpl; context: { sections: rightSections }"></ng-container>
          </div>
        </div>

        <ng-template #sectionsTpl let-sections="sections">
          <div class="calib-section" *ngFor="let sec of sections">
            <button type="button" class="calib-section-head" (click)="toggleSection(sec.name)" [attr.aria-expanded]="isOpen(sec.name)">
              <i class="pi" [ngClass]="isOpen(sec.name) ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
              <span>{{ sec.name }}</span>
              <span class="calib-section-count">{{ sec.fields.length }}</span>
            </button>
            <div class="calib-section-body" *ngIf="isOpen(sec.name)">
              <ng-container *ngTemplateOutlet="rowTpl; context: { fields: sec.fields }"></ng-container>
            </div>
          </div>
        </ng-template>

        <ng-template #rowTpl let-fields="fields">
          <ng-container *ngFor="let f of fields; let i = index">
          <div class="calib-group" *ngIf="f.group && (i === 0 || fields[i - 1].group !== f.group)">{{ f.group }}</div>
          <div class="calib-row" [class.is-hidden]="isHidden(f)">
            <div class="calib-row-head">
              <span class="calib-row-label">{{ f.label }}</span>
              <span class="calib-row-offset">dx {{ (offsets[f.key]?.dx ?? 0) | number:'1.0-1' }} · dy {{ (offsets[f.key]?.dy ?? 0) | number:'1.0-1' }}</span>
            </div>
            <div class="calib-row-controls">
              <span class="ctl" *ngIf="f.kind !== 'image'">
                letra
                <button type="button" class="font-step" (click)="stepFontSize(f, -0.5)">−</button>
                <input type="number" step="0.5" min="4" max="60" class="font-input"
                       [ngModel]="fontSizeOf(f)" (ngModelChange)="setFontSize(f, $event)" [ngModelOptions]="{ standalone: true }" />
                <button type="button" class="font-step" (click)="stepFontSize(f, 0.5)">+</button>
              </span>
              <span class="ctl" *ngIf="f.width">
                ancho
                <button type="button" class="font-step" (click)="stepWidth(f, -5)">−</button>
                <input type="number" step="1" min="10" max="600" class="font-input wide"
                       [ngModel]="widthOf(f)" (ngModelChange)="setWidth(f, $event)" [ngModelOptions]="{ standalone: true }" />
                <button type="button" class="font-step" (click)="stepWidth(f, 5)">+</button>
              </span>
              <label class="hide-check" title="Marcalo si tu papel ya lo trae impreso: el sistema no lo dibuja">
                <input type="checkbox" [ngModel]="isHidden(f)" (ngModelChange)="setHidden(f, $event)" [ngModelOptions]="{ standalone: true }" />
                No dibujar
              </label>
            </div>
          </div>
          </ng-container>
        </ng-template>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .app-page-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
    .calib-toolbar { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .spacer { flex: 1; }
    .calib-hint { font-size: 0.82rem; color: #6b878d; margin: 0 0 1rem; }
    .calib-options { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .hide-frame-check {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.85rem; color: #29484f; font-weight: 600; cursor: pointer;
    }
    .hide-frame-check input { width: auto; }
    .row-height { display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; color: #29484f; font-weight: 600; }
    .zoom-ctl { display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; color: #29484f; font-weight: 600; }
    .zoom-value { min-width: 2.6rem; text-align: center; font-variant-numeric: tabular-nums; }
    /* Tres paneles: controles | hoja | controles. Los de los costados usan todo el ancho libre y cada panel
       tiene su propio scroll, asi la hoja se ve completa sin tener que bajar la pagina. */
    .calib-workspace {
      display: grid; grid-template-columns: minmax(300px, 1fr) auto minmax(300px, 1fr);
      gap: 1rem; align-items: start; margin-bottom: 1rem;
      height: calc(100vh - 330px); min-height: 480px;
    }
    .calib-canvas-wrap { overflow: auto; max-height: 100%; }
    .calib-canvas {
      position: relative;
      background: #fff;
      border: 1.5px solid #d7e5e1;
      border-radius: 6px;
      flex: none;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.06);
    }
    /* contain sobre el lienzo A4, igual que el PDF (FitArea): si la proporcion de la imagen no es A4 queda
       con el mismo margen en blanco que va a tener el PDF, asi lo que se ve aca es lo que sale impreso. */
    .calib-bg { position: absolute; top: 0; left: 0; object-fit: contain; object-position: top left; pointer-events: none; border: 0; }
    .calib-field {
      position: absolute;
      background: rgba(19,133,182,0.12);
      border: 1px dashed #1385b6;
      color: #0c5878;
      font-size: 10px;
      line-height: 1.3;
      padding: 0 2px;
      white-space: nowrap;
      cursor: grab;
      user-select: none;
      border-radius: 3px;
    }
    .calib-field { box-sizing: border-box; }
    .calib-field.calib-block { white-space: normal; overflow: hidden; }
    .calib-field.dragging { cursor: grabbing; background: rgba(19,133,182,0.25); z-index: 10; }
    .mock-cell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mock-sign-img { height: 100%; display: flex; align-items: flex-end; justify-content: center; opacity: 0.5; }
    .calib-section { border: 1px solid #e3ecea; border-radius: 8px; overflow: hidden; background: #fff; }
    .calib-section-head {
      display: flex; align-items: center; gap: 0.5rem; width: 100%;
      padding: 0.5rem 0.65rem; border: 0; background: #f4f9f8; cursor: pointer;
      font-size: 0.85rem; font-weight: 700; color: #29484f; text-align: left;
    }
    .calib-section-head:hover { background: #eaf4f3; }
    .calib-section-count { margin-left: auto; font-size: 0.72rem; font-weight: 600; color: #6b878d; background: #fff; border-radius: 999px; padding: 0 0.5rem; }
    .calib-section-body { padding-bottom: 0.25rem; }
    .section-actions { display: flex; gap: 0.75rem; }
    .link-btn { border: 0; background: none; padding: 0; cursor: pointer; color: #1385b6; font-size: 0.8rem; font-weight: 600; }
    .link-btn:hover { text-decoration: underline; }
    .calib-group { margin-top: 0.6rem; padding: 0.2rem 0.5rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #1385b6; }
    .calib-list { display: grid; gap: 0.25rem; align-content: start; }
    .calib-side { min-width: 0; max-height: 100%; overflow-y: auto; padding-right: 0.25rem; }
    .calib-row { padding: 0.3rem 0.5rem; border-bottom: 1px solid #eef3f2; font-size: 0.78rem; }
    .calib-row-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
    .calib-row-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.2rem 0.85rem; margin-top: 0.15rem; }
    .ctl { display: inline-flex; align-items: center; gap: 0.25rem; color: #6b878d; white-space: nowrap; }
    .calib-row.is-hidden { opacity: 0.55; }
    .calib-row-label { color: #29484f; font-weight: 600; }
    .calib-row-offset { color: #6b878d; font-variant-numeric: tabular-nums; }
    .hide-check { display: flex; align-items: center; gap: 0.35rem; color: #6b878d; cursor: pointer; }
    .hide-check input { width: auto; }
    .font-step {
      width: 20px; height: 20px; border-radius: 4px; border: 1px solid #d7e5e1; background: #fff;
      color: #29484f; font-weight: 700; line-height: 1; cursor: pointer; padding: 0;
    }
    .font-step:hover { border-color: #1385b6; }
    .font-input {
      width: 44px; text-align: center; border: 1px solid #d7e5e1; border-radius: 4px;
      padding: 0.15rem 0.2rem; font-size: 0.8rem; font-variant-numeric: tabular-nums;
    }
    .font-input.wide { width: 52px; }
    @media (max-width: 1100px) {
      .calib-workspace { grid-template-columns: 1fr; height: auto; }
      .calib-side { max-height: none; overflow: visible; }
      .calib-canvas-wrap { max-height: none; }
    }
  `]
})
export class SettlementCalibrationPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly fields = FIELDS;
  // Los controles van agrupados en secciones desplegables (todo lo de ingresos junto, etc.).
  readonly sections: CalibSection[] = SECTION_ORDER.map((name) => ({ name, fields: FIELDS.filter((f) => f.section === name) }));
  readonly leftSections = this.sections.slice(0, 3);
  readonly rightSections = this.sections.slice(3);
  openSections: Record<string, boolean> = {};
  zoom = DEFAULT_ZOOM;
  // px por punto PDF: la hoja se agranda o achica con el zoom, el resto (posiciones guardadas) no cambia.
  get SCALE(): number { return this.zoom; }
  get canvasW(): number { return Math.round(PAGE_W_PT * this.zoom); }
  get canvasH(): number { return Math.round(PAGE_H_PT * this.zoom); }

  setZoom(value: number): void {
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
  }
  stepZoom(delta: number): void { this.setZoom(this.zoom + delta); }

  building: Building | null = null;
  templateUrl: string | null = null;
  loading = true;
  saving = false;
  offsets: Record<string, FieldOffset> = {};
  hideFrame = true;

  get resolvedTemplateUrl(): string { return resolveUploadUrl(this.templateUrl); }
  get resolvedTemplateUrlSafe(): SafeResourceUrl { return this.sanitizer.bypassSecurityTrustResourceUrl(this.resolvedTemplateUrl); }
  get isPdf(): boolean { return isPdfUrl(this.templateUrl); }

  private draggingField: CalibField | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragBaseDx = 0;
  private dragBaseDy = 0;
  draggingKey: string | null = null;

  private readonly onMouseMove = (event: MouseEvent) => this.handleMouseMove(event);
  private readonly onMouseUp = () => this.handleMouseUp();

  ngOnInit(): void {
    // Solo quien administra el edificio (empresa o encargado) la ajusta; el backend tambien lo valida.
    if (!this.auth.hasRole('CompanyAdmin', 'BuildingManager')) {
      this.router.navigate(['/']);
      return;
    }

    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.buildingsApi.getById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (found) => {
        this.applyBuilding(found);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el edificio.'), life: 5000 });
        this.router.navigate(['/buildings']);
      }
    });
  }

  private applyBuilding(found: Building): void {
    this.building = found;
    this.templateUrl = found.useStandardTemplates === false ? (found.settlementTemplateUrl ?? null) : null;
    this.offsets = this.parseOffsets(found.settlementFieldPositionsJson);
    this.hideFrame = found.settlementHideFrame ?? true;
  }

  // El backend guarda en camelCase; se acepta tambien PascalCase por si quedo algo guardado de otra forma.
  private parseOffsets(json?: string | null): Record<string, FieldOffset> {
    if (!json) return {};
    try {
      const raw = JSON.parse(json) as Record<string, Record<string, unknown>>;
      const pick = (v: Record<string, unknown>, name: string): unknown => v[name] ?? v[name.charAt(0).toUpperCase() + name.slice(1)];
      const result: Record<string, FieldOffset> = {};
      for (const [key, value] of Object.entries(raw)) {
        result[key] = {
          dx: Number(pick(value, 'dx') ?? 0),
          dy: Number(pick(value, 'dy') ?? 0),
          fontSize: (pick(value, 'fontSize') ?? null) as number | null,
          width: (pick(value, 'width') ?? null) as number | null,
          rowHeight: (pick(value, 'rowHeight') ?? null) as number | null,
          hidden: (pick(value, 'hidden') ?? undefined) as boolean | undefined
        };
      }
      return result;
    } catch {
      return {};
    }
  }

  // Cambia solo lo indicado de un bloque y conserva el resto (posicion, letra, ancho, oculto).
  private patch(key: string, change: Partial<FieldOffset>): void {
    const current = this.offsets[key] ?? { dx: 0, dy: 0 };
    this.offsets = { ...this.offsets, [key]: { ...current, ...change } };
  }

  screenX(f: CalibField): number {
    return (f.x + (this.offsets[f.key]?.dx ?? 0)) * this.SCALE;
  }

  screenY(f: CalibField): number {
    return (f.top - (this.offsets[f.key]?.dy ?? 0)) * this.SCALE;
  }

  fontSizeOf(f: CalibField): number {
    return this.offsets[f.key]?.fontSize ?? f.defaultFontSize;
  }

  widthOf(f: CalibField): number {
    return this.offsets[f.key]?.width ?? f.width;
  }

  // Alto del bloque solo para la imagen de la firma (los demas toman el de su contenido).
  isOpen(name: string): boolean { return this.openSections[name] === true; }
  toggleSection(name: string): void { this.openSections = { ...this.openSections, [name]: !this.isOpen(name) }; }
  setAllSections(open: boolean): void {
    this.openSections = Object.fromEntries(SECTION_ORDER.map((name) => [name, open]));
  }

  heightOf(f: CalibField): number | null {
    return f.kind === 'image' ? IMAGE_H_PT * this.SCALE : null;
  }

  alignOf(f: CalibField): string | null {
    return f.align === 'R' ? 'right' : f.align === 'C' ? 'center' : null;
  }

  isHidden(f: CalibField): boolean {
    return this.offsets[f.key]?.hidden ?? f.hiddenByDefault === true;
  }

  samplesOf(f: CalibField): string[] {
    return COLUMN_SAMPLES[f.key as ColumnKey] ?? [];
  }

  get rowHeight(): number {
    return this.offsets[ROWS_KEY]?.rowHeight ?? DEFAULT_ROW_HEIGHT;
  }

  setRowHeight(value: number): void {
    if (!value || value < 6 || value > 80) return;
    this.patch(ROWS_KEY, { rowHeight: value });
  }

  stepRowHeight(delta: number): void {
    this.setRowHeight(Math.round((this.rowHeight + delta) * 2) / 2);
  }

  setFontSize(f: CalibField, value: number): void {
    if (!value || value <= 0) return;
    this.patch(f.key, { fontSize: value });
  }

  stepFontSize(f: CalibField, delta: number): void {
    this.setFontSize(f, Math.max(4, Math.round((this.fontSizeOf(f) + delta) * 2) / 2));
  }

  setWidth(f: CalibField, value: number): void {
    if (!value || value < 10 || value > 600) return;
    this.patch(f.key, { width: value });
  }

  stepWidth(f: CalibField, delta: number): void {
    this.setWidth(f, Math.max(10, Math.round(this.widthOf(f) + delta)));
  }

  setHidden(f: CalibField, hidden: boolean): void {
    this.patch(f.key, { hidden });
  }

  startDrag(field: CalibField, event: MouseEvent): void {
    event.preventDefault();
    this.draggingField = field;
    this.draggingKey = field.key;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    const o = this.offsets[field.key];
    this.dragBaseDx = o?.dx ?? 0;
    this.dragBaseDy = o?.dy ?? 0;
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.draggingField) return;
    const dx = this.dragBaseDx + (event.clientX - this.dragStartX) / this.SCALE;
    const dy = this.dragBaseDy - (event.clientY - this.dragStartY) / this.SCALE; // pantalla abajo = dy negativo
    this.patch(this.draggingField.key, { dx, dy });
    this.cdr.markForCheck();
  }

  private handleMouseUp(): void {
    this.draggingField = null;
    this.draggingKey = null;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  resetAll(): void {
    if (!confirm('¿Reiniciar todas las posiciones, anchos y el alto de fila a los valores por defecto?')) return;
    this.offsets = {};
  }

  save(): void {
    if (!this.building) return;
    this.saving = true;
    this.buildingsApi.updateSettlementPositions(this.building.id, { positions: this.offsets, hideFrame: this.hideFrame })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (updated) => {
          this.applyBuilding(updated);
          this.saving = false;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Posiciones guardadas.', life: 4000 });
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron guardar las posiciones.'), life: 5000 });
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  // El backend genera el PDF de prueba con lo que ya esta guardado, no con lo que esta en pantalla sin
  // guardar — por eso hay que guardar antes de abrirlo.
  openSamplePdf(): void {
    if (!this.building) return;
    this.saving = true;
    this.buildingsApi.updateSettlementPositions(this.building.id, { positions: this.offsets, hideFrame: this.hideFrame })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (updated) => {
          this.applyBuilding(updated);
          this.saving = false;
          this.cdr.markForCheck();
          window.open(this.buildingsApi.getSettlementSamplePdfUrl(updated.id, this.auth.getToken() ?? ''), '_blank');
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron guardar las posiciones.'), life: 5000 });
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }
}
