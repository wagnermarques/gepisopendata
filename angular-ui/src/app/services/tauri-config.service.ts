import { Injectable, inject, isDevMode } from '@angular/core';
import { catchError, from, map, Observable, of, Subject } from 'rxjs';
import { ConfigService } from './config.service';
import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import { listen, Event } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

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
    if (isDevMode()) {
      console.log('Initializing Menu Listener...');
    }
    try {
      // Listen to global events
      await listen('menu-navigation', (event: Event<string>) => {
        if (isDevMode()) {
          console.log('GLOBAL Menu navigation event received:', event.payload);
        }
        this.menuNavigationSubject.next(event.payload);
      });

      // Also listen to webview-specific events as a fallback
      const webview = getCurrentWebviewWindow();
      await webview.listen('menu-navigation', (event: Event<string>) => {
        if (isDevMode()) {
          console.log('WEBVIEW Menu navigation event received:', event.payload);
        }
        this.menuNavigationSubject.next(event.payload);
      });
      
      if (isDevMode()) {
        console.log('Menu listeners attached successfully.');
      }
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
