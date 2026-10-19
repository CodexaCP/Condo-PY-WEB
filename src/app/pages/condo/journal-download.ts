import { exportFileName } from './finance-format';

// Nombre de archivo de un libro oficial (finanzas-libro-diario-Edificio-2026.pdf) y descarga de un archivo recibido como blob.
export function bookFileName(kind: string, buildingName: string, fiscalYear: number | string, extension: 'pdf' | 'xlsx'): string {
  return exportFileName(kind, buildingName, String(fiscalYear)).replace(/\.xlsx$/, `.${extension}`);
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
