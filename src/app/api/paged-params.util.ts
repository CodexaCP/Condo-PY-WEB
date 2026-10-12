import { HttpParams } from '@angular/common/http';

// Arma los parámetros de un listado paginado sin mandar los filtros vacíos.
export function pagedParams(values: Record<string, string | number | null | undefined>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    params = params.set(key, String(value));
  }
  return params;
}
