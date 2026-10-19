import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CreateFinanceTransferRequest, FinanceTransfer, FinanceTransferPreview, FinanceTransfers } from './finance-operations.models';

// Operaciones guiadas de Finanzas (api/finance/operations). Las ven los cuatro roles administrativos; las cargan y anulan solo SuperAdmin y
// Administrador de empresa. Una operación no se edita: se anula con motivo. Errores con { error, message }: finance_period_closed,
// transfer_fiscal_year_closed, transfer_negative_balance, transfer_fund_negative, transfer_reconciled...
@Injectable({ providedIn: 'root' })
export class FinanceOperationsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/finance/operations`;

  listTransfers(buildingId: string): Observable<FinanceTransfers> {
    return this.http.get<FinanceTransfers>(`${this.base}/transfers`, { params: new HttpParams().set('buildingId', buildingId) });
  }

  previewTransfer(buildingId: string, request: CreateFinanceTransferRequest): Observable<FinanceTransferPreview> {
    return this.http.post<FinanceTransferPreview>(`${this.base}/transfers/preview`, request, { params: new HttpParams().set('buildingId', buildingId) });
  }

  createTransfer(buildingId: string, request: CreateFinanceTransferRequest): Observable<FinanceTransfer> {
    return this.http.post<FinanceTransfer>(`${this.base}/transfers`, request, { params: new HttpParams().set('buildingId', buildingId) });
  }

  voidTransfer(buildingId: string, id: string, reason: string): Observable<FinanceTransfer> {
    return this.http.post<FinanceTransfer>(`${this.base}/transfers/${id}/void`, { reason }, { params: new HttpParams().set('buildingId', buildingId) });
  }
}
