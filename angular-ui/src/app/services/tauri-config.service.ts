import { Injectable } from '@angular/core';
import { catchError, from, map, Observable, of } from 'rxjs';
import { ConfigService } from './config.service';
import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';

@Injectable({
  providedIn: 'root',
})
export class TauriConfigService extends ConfigService {
  loadConfig(): Observable<Record<string, unknown>> {
    console.log('Loading configuration from TauriConfigService');

    const defaultConfig = {
      source: 'tauri-default',
      featureFlags: {
        newDashboard: true,
        useLocalStorage: false,
        nativeFileAccess: true,
      },
    };

    // In Tauri, we read from the filesystem.
    // We use `from` to convert the Promise from `readTextFile` into an Observable.
    return from(
      readTextFile('config.json', {
        baseDir: BaseDirectory.AppConfig,
      })
    ).pipe(
      map((content) => JSON.parse(content)),
      // If reading or parsing fails (e.g., file not found), catch the error
      // and return a default configuration.
      catchError((err) => {
        console.warn(
          `Could not load config.json from app config dir, using default. Error: ${err}`
        );
        return of(defaultConfig);
      })
    );
  }
}
