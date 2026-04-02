import {
  ApplicationConfig,
  inject,
  provideZoneChangeDetection,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { ConfigService } from './services/config.service';
import { isTauri } from './services/environment';
import { WebConfigService } from './services/web-config.service';
import { TauriConfigService } from './services/tauri-config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    provideAnimationsAsync(),
    provideHttpClient(),
    WebConfigService,
    TauriConfigService,
    {
      provide: ConfigService,
      useFactory: () =>
        isTauri() ? inject(TauriConfigService) : inject(WebConfigService),
    },
  ],
};