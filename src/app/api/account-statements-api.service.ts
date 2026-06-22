import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AccountStatementDetail, AccountStatementPeriod, ExpenseReceipt } from './models';

@Injectable({ providedIn: 'root' })
export class AccountStatementsApiService {
  private readonly http = inject(HttpClient);

  getUnitStatements(unitId: string): Observable<AccountStatementPeriod[]> {
    return this.http.get<AccountStatementPeriod[]>(`${API_BASE_URL}/account-statements/units/${unitId}`);
  }

  getUnitStatementDetail(unitId: string, expensePeriodId: string): Observable<AccountStatementDetail> {
    return this.http.get<AccountStatementDetail>(
      `${API_BASE_URL}/account-statements/units/${unitId}/periods/${expensePeriodId}`
    );
  }

  getExpenseReceipt(unitId: string, expensePeriodId: string): Observable<ExpenseReceipt> {
    return this.http.get<ExpenseReceipt>(
      `${API_BASE_URL}/account-statements/units/${unitId}/periods/${expensePeriodId}/receipt`
    );
  }
}
