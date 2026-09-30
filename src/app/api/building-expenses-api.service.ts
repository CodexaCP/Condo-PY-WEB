import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { BuildingExpense, BuildingExpenseImportResult, CreateBuildingExpenseRequest } from './models';

@Injectable({ providedIn: 'root' })
export class BuildingExpensesApiService {
  private readonly http = inject(HttpClient);

  getAll(filters?: { buildingId?: string; expensePeriodId?: string }): Observable<BuildingExpense[]> {
    let params = new HttpParams();

    if (filters?.buildingId) {
      params = params.set('buildingId', filters.buildingId);
    }

    if (filters?.expensePeriodId) {
      params = params.set('expensePeriodId', filters.expensePeriodId);
    }

    return this.http.get<BuildingExpense[]>(`${API_BASE_URL}/building-expenses`, { params });
  }

  create(request: CreateBuildingExpenseRequest): Observable<BuildingExpense> {
    return this.http.post<BuildingExpense>(`${API_BASE_URL}/building-expenses`, request);
  }

  update(id: string, request: CreateBuildingExpenseRequest): Observable<BuildingExpense> {
    return this.http.put<BuildingExpense>(`${API_BASE_URL}/building-expenses/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/building-expenses/${id}`);
  }

  downloadImportTemplate(buildingId: string): Observable<Blob> {
    const params = new HttpParams().set('buildingId', buildingId);
    return this.http.get(`${API_BASE_URL}/building-expenses/import-template`, { params, responseType: 'blob' });
  }

  // Sin confirm solo valida el Excel (vista previa); con confirm guarda todas las filas o ninguna.
  importFromExcel(
    file: File,
    buildingId: string,
    expensePeriodId: string,
    options: { confirm: boolean; replaceExisting: boolean }
  ): Observable<BuildingExpenseImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('buildingId', buildingId);
    formData.append('expensePeriodId', expensePeriodId);
    formData.append('confirm', String(options.confirm));
    formData.append('replaceExisting', String(options.replaceExisting));
    return this.http.post<BuildingExpenseImportResult>(`${API_BASE_URL}/building-expenses/import`, formData);
  }

  uploadReceipt(id: string, file: File): Observable<BuildingExpense> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<BuildingExpense>(`${API_BASE_URL}/building-expenses/${id}/receipt`, formData);
  }

  getReceiptUrl(id: string): string {
    return `${API_BASE_URL}/building-expenses/${id}/receipt`;
  }

  deleteReceipt(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/building-expenses/${id}/receipt`);
  }
}
