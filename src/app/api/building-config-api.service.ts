import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  BudgetAlerts,
  BuildingConfigOverview,
  ConfigAuditFilters,
  ConfigAuditPage,
  FundPolicy,
  LateFeePolicy,
  NoticeRules,
  PeriodClosing,
  UnitLateFeeExemptionRequest,
  UpdateFundPolicyRequest,
  UpdateLateFeePolicyRequest,
  UpdateNoticeRuleItem,
  VatTreatmentUpdateItem,
  VatTreatments
} from './building-config.models';
import { Unit } from './models';

// Centro de configuración del edificio. Un edificio ajeno responde 404 y un rol sin permiso, 403.
@Injectable({ providedIn: 'root' })
export class BuildingConfigApiService {
  private readonly http = inject(HttpClient);

  private url(buildingId: string, path: string): string {
    return `${API_BASE_URL}/building-config/${buildingId}/${path}`;
  }

  getOverview(buildingId: string): Observable<BuildingConfigOverview> {
    return this.http.get<BuildingConfigOverview>(this.url(buildingId, 'overview'));
  }

  getAudit(buildingId: string, filters: ConfigAuditFilters = {}): Observable<ConfigAuditPage> {
    let params = new HttpParams();
    if (filters.section) params = params.set('section', filters.section);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.page) params = params.set('page', filters.page);
    if (filters.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<ConfigAuditPage>(this.url(buildingId, 'audit'), { params });
  }

  // ── Período y cierre ──

  getClosing(buildingId: string): Observable<PeriodClosing> {
    return this.http.get<PeriodClosing>(this.url(buildingId, 'closing'));
  }

  setClosingEnabled(buildingId: string, enabled: boolean): Observable<PeriodClosing> {
    return this.http.put<PeriodClosing>(this.url(buildingId, 'closing'), { enabled });
  }

  closeMonth(buildingId: string, year: number, month: number): Observable<PeriodClosing> {
    return this.http.post<PeriodClosing>(this.url(buildingId, `closing/${year}/${month}/close`), {});
  }

  reopenMonth(buildingId: string, year: number, month: number, reason: string): Observable<PeriodClosing> {
    return this.http.post<PeriodClosing>(this.url(buildingId, `closing/${year}/${month}/reopen`), { reason });
  }

  // ── Mora, fondos, alertas del presupuesto y avisos ──

  getLateFee(buildingId: string): Observable<LateFeePolicy> {
    return this.http.get<LateFeePolicy>(this.url(buildingId, 'late-fee'));
  }

  updateLateFee(buildingId: string, request: UpdateLateFeePolicyRequest): Observable<LateFeePolicy> {
    return this.http.put<LateFeePolicy>(this.url(buildingId, 'late-fee'), request);
  }

  // Exonera una unidad de la mora (con motivo) o le quita la exoneración.
  setUnitLateFeeExemption(unitId: string, request: UnitLateFeeExemptionRequest): Observable<Unit> {
    return this.http.put<Unit>(`${API_BASE_URL}/units/${unitId}/late-fee-exemption`, request);
  }

  getFundPolicy(buildingId: string): Observable<FundPolicy> {
    return this.http.get<FundPolicy>(this.url(buildingId, 'fund-policy'));
  }

  updateFundPolicy(buildingId: string, request: UpdateFundPolicyRequest): Observable<FundPolicy> {
    return this.http.put<FundPolicy>(this.url(buildingId, 'fund-policy'), request);
  }

  getBudgetAlerts(buildingId: string): Observable<BudgetAlerts> {
    return this.http.get<BudgetAlerts>(this.url(buildingId, 'budget-alerts'));
  }

  updateBudgetAlerts(buildingId: string, warnPercent: number): Observable<BudgetAlerts> {
    return this.http.put<BudgetAlerts>(this.url(buildingId, 'budget-alerts'), { warnPercent });
  }

  getNoticeRules(buildingId: string): Observable<NoticeRules> {
    return this.http.get<NoticeRules>(this.url(buildingId, 'notice-rules'));
  }

  updateNoticeRules(buildingId: string, rules: UpdateNoticeRuleItem[]): Observable<NoticeRules> {
    return this.http.put<NoticeRules>(this.url(buildingId, 'notice-rules'), { rules });
  }

  // ── Impuestos ──

  getVatTreatments(buildingId: string): Observable<VatTreatments> {
    return this.http.get<VatTreatments>(this.url(buildingId, 'vat-treatments'));
  }

  updateVatTreatments(buildingId: string, items: VatTreatmentUpdateItem[]): Observable<VatTreatments> {
    return this.http.put<VatTreatments>(this.url(buildingId, 'vat-treatments'), { items });
  }
}
