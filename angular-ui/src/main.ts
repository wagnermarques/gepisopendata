import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { PlotlyService } from 'angular-plotly.js';

// Initialize Plotly with the global instance from index.html CDN
if ((window as any).Plotly) {
  PlotlyService.setPlotly((window as any).Plotly);
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
