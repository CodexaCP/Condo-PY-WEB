import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { MorosityReport } from './models';

export interface MorosityReportFilters {
  buildingId?: string;
  unitId?: string;
  expensePeriodId?: string;
  ownerSearch?: string;
  agingBucket?: string;
  page?: number;
  pageSize?: number;
}

export interface MorosityReminderResult {
  emailsSent: number;
  unitsSkippedNoEmail: number;
}

@Injectable({ providedIn: 'root' })
export class MorosityApiService {
  private readonly http = inject(HttpClient);

  getReport(filters?: MorosityReportFilters): Observable<MorosityReport> {
    let params = new HttpParams();
    if (filters?.buildingId) params = params.set('buildingId', filters.buildingId);
    if (filters?.unitId) params = params.set('unitId', filters.unitId);
    if (filters?.expensePeriodId) params = params.set('expensePeriodId', filters.expensePeriodId);
    if (filters?.ownerSearch) params = params.set('ownerSearch', filters.ownerSearch);
    if (filters?.agingBucket) params = params.set('agingBucket', filters.agingBucket);
    if (filters?.page) params = params.set('page', String(filters.page));
    if (filters?.pageSize) params = params.set('pageSize', String(filters.pageSize));
    return this.http.get<MorosityReport>(`${API_BASE_URL}/morosity`, { params });
  }

  sendReminders(filters?: MorosityReportFilters): Observable<MorosityReminderResult> {
    let params = new HttpParams();
    if (filters?.buildingId) params = params.set('buildingId', filters.buildingId);
    if (filters?.unitId) params = params.set('unitId', filters.unitId);
    if (filters?.expensePeriodId) params = params.set('expensePeriodId', filters.expensePeriodId);
    if (filters?.ownerSearch) params = params.set('ownerSearch', filters.ownerSearch);
    if (filters?.agingBucket) params = params.set('agingBucket', filters.agingBucket);
    return this.http.post<MorosityReminderResult>(`${API_BASE_URL}/morosity/send-reminders`, null, { params });
  }
}
