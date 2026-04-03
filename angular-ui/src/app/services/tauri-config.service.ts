import { Injectable, inject, isDevMode } from '@angular/core';
import { catchError, from, map, Observable, of, Subject } from 'rxjs';
import { ConfigService } from './config.service';
import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';

@Injectable({
  providedIn: 'root',
})
export class TauriConfigService extends ConfigService {
  private menuNavigationSubject = new Subject<string>();
  menuNavigation$ = this.menuNavigationSubject.asObservable();

  constructor() {
    super();
    this.initMenuListener();
  }

  private async initMenuListener() {
    try {
      await listen<string>('menu-navigation', (event) => {
        if (isDevMode()) {
          console.log('Menu navigation event received:', event.payload);
        }
        this.menuNavigationSubject.next(event.payload);
      });
    } catch (err) {
      console.error('Failed to listen to menu-navigation events:', err);
    }
  }

  loadConfig(): Observable<Record<string, unknown>> {
    if (isDevMode()) {
      console.log('Loading configuration from TauriConfigService');
    }

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
