import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export abstract class ConfigService {
  abstract loadConfig(): Observable<Record<string, unknown>>;
}
