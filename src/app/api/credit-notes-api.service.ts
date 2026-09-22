import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  AdjustableCharge,
  CreditNote,
  CreditNoteAttachment,
  CreditNoteAttachmentKind,
  CreditNoteStatus,
  CreateCreditNoteRequest,
  RegisterCreditNoteFiscalDataRequest
} from './models';

@Injectable({ providedIn: 'root' })
export class CreditNotesApiService {
  private readonly http = inject(HttpClient);

  getAdjustableCharges(invoiceId: string): Observable<AdjustableCharge[]> {
    return this.http.get<AdjustableCharge[]>(`${API_BASE_URL}/credit-notes/adjustable-charges`, {
      params: new HttpParams().set('invoiceId', invoiceId)
    });
  }

  getAll(filters?: { invoiceId?: string; buildingId?: string; status?: CreditNoteStatus }): Observable<CreditNote[]> {
    let params = new HttpParams();
    if (filters?.invoiceId) params = params.set('invoiceId', filters.invoiceId);
    if (filters?.buildingId) params = params.set('buildingId', filters.buildingId);
    if (filters?.status) params = params.set('status', filters.status);
    return this.http.get<CreditNote[]>(`${API_BASE_URL}/credit-notes`, { params });
  }

  getById(id: string): Observable<CreditNote> {
    return this.http.get<CreditNote>(`${API_BASE_URL}/credit-notes/${id}`);
  }

  create(request: CreateCreditNoteRequest): Observable<CreditNote> {
    return this.http.post<CreditNote>(`${API_BASE_URL}/credit-notes`, request);
  }

  approve(id: string): Observable<CreditNote> {
    return this.http.post<CreditNote>(`${API_BASE_URL}/credit-notes/${id}/approve`, {});
  }

  emit(id: string, invoiceSeriesId: string): Observable<CreditNote> {
    return this.http.post<CreditNote>(`${API_BASE_URL}/credit-notes/${id}/emit`, { invoiceSeriesId });
  }

  reject(id: string, motivo: string): Observable<CreditNote> {
    return this.http.post<CreditNote>(`${API_BASE_URL}/credit-notes/${id}/reject`, { motivo });
  }

  void(id: string, motivo: string): Observable<CreditNote> {
    return this.http.post<CreditNote>(`${API_BASE_URL}/credit-notes/${id}/void`, { motivo });
  }

  registerFiscalData(id: string, request: RegisterCreditNoteFiscalDataRequest): Observable<CreditNote> {
    return this.http.put<CreditNote>(`${API_BASE_URL}/credit-notes/${id}/fiscal-data`, request);
  }

  addAttachment(id: string, url: string, fileName: string, kind: CreditNoteAttachmentKind): Observable<CreditNoteAttachment> {
    return this.http.post<CreditNoteAttachment>(`${API_BASE_URL}/credit-notes/${id}/attachments`, { url, fileName, kind });
  }

  deleteAttachment(id: string, attachmentId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/credit-notes/${id}/attachments/${attachmentId}`);
  }
}
