import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root',
})
export class WebConfigService extends ConfigService {
  loadConfig(): Observable<Record<string, unknown>> {
    console.log('Loading configuration from WebConfigService');
    return of({
      source: 'web',
      featureFlags: {
        newDashboard: true,
        useLocalStorage: true,
      },
    });
  }
}
