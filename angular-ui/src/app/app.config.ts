import {
  ApplicationConfig,
  inject,
  provideZoneChangeDetection,
  provideZonelessChangeDetection, isDevMode, importProvidersFrom,
} from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { PlotlyModule } from 'angular-plotly.js';

import { routes } from './app.routes';
import { ConfigService } from './services/config.service';
import { isTauri } from './services/environment';
import { WebConfigService } from './services/web-config.service';
import { TauriConfigService } from './services/tauri-config.service';
import { provideServiceWorker } from '@angular/service-worker';

// Provide a mock if Plotly isn't available yet to avoid constructor crash, 
// though the CDN should be there by now.
const getPlotlyInstance = () => {
  const plotly = (window as any).Plotly;
  if (!plotly) {
    console.warn('Plotly not found in window, using mock to avoid crash.');
    return { plot: () => {}, newPlot: () => {}, react: () => {}, Plots: { resize: () => {} } };
  }
  return plotly;
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    provideAnimationsAsync(),
    provideHttpClient(),
    importProvidersFrom(PlotlyModule.forRoot(getPlotlyInstance())),
    WebConfigService,
    TauriConfigService,
    {
      provide: ConfigService,
      useFactory: () =>
        isTauri() ? inject(TauriConfigService) : inject(WebConfigService),
    }, provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ],
};