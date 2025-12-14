import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';

import { routes } from './app.routes';
import { ConfigService } from './services/config.service';
import { isTauri } from './services/environment';
import { WebConfigService } from './services/web-config.service';
import { TauriConfigService } from './services/tauri-config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    MatTabsModule,
    MatExpansionModule,
    WebConfigService,
    TauriConfigService,
    {
      provide: ConfigService,
      useFactory: () =>
        isTauri() ? inject(TauriConfigService) : inject(WebConfigService),
    },
  ],
};