import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { VoiceCommandInterpretation } from './models';

@Injectable({ providedIn: 'root' })
export class VoiceCommandsApiService {
  private readonly http = inject(HttpClient);

  interpret(text: string, buildingId?: string): Observable<VoiceCommandInterpretation> {
    let params = new HttpParams().set('text', text);
    if (buildingId) params = params.set('buildingId', buildingId);
    return this.http.get<VoiceCommandInterpretation>(`${API_BASE_URL}/voice-commands/interpret`, { params });
  }
}
