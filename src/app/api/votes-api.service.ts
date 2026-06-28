import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Vote, VoteUpsertRequest, VoteCastRequest } from './models';
import { API_BASE_URL } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class VotesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/votes`;

  getAll(buildingId?: string): Observable<Vote[]> {
    let params = new HttpParams();
    if (buildingId) params = params.set('buildingId', buildingId);
    return this.http.get<Vote[]>(this.base, { params });
  }

  getById(id: string): Observable<Vote> {
    return this.http.get<Vote>(`${this.base}/${id}`);
  }

  create(request: VoteUpsertRequest): Observable<Vote> {
    return this.http.post<Vote>(this.base, request);
  }

  update(id: string, request: VoteUpsertRequest): Observable<Vote> {
    return this.http.put<Vote>(`${this.base}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  open(id: string): Observable<Vote> {
    return this.http.post<Vote>(`${this.base}/${id}/open`, {});
  }

  close(id: string): Observable<Vote> {
    return this.http.post<Vote>(`${this.base}/${id}/close`, {});
  }

  cast(id: string, request: VoteCastRequest): Observable<Vote> {
    return this.http.post<Vote>(`${this.base}/${id}/cast`, request);
  }

  removeCast(id: string, castId: string): Observable<Vote> {
    return this.http.delete<Vote>(`${this.base}/${id}/casts/${castId}`);
  }
}
