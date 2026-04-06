import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { DatasetStateService } from '../../../../../services/dataset-state.service';
import { Router } from '@angular/router';
import { invoke } from '@tauri-apps/api/core';

// Plotly via Window Integration (requires script in index.html)
import { PlotlyViaWindowModule } from 'angular-plotly.js';

// Access global plotly for direct calls if needed, but the component handles most
declare var Plotly: any;

@Component({
  selector: 'app-bar-chart-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatSnackBarModule,
    FormsModule,
    PlotlyViaWindowModule,
  ],
  template: `
    <div class="container">
      <div class="header">
        <button mat-icon-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>Gráficos de Barras</h1>
      </div>

      <div class="content-grid">
        <!-- Configuration -->
        <mat-card appearance="outlined" class="config-card">
          <mat-card-header>
            <mat-card-title>Configuração do Gráfico</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="form-fields">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Categorias (Eixo X)</mat-label>
                <mat-select [(ngModel)]="categoryVar" (selectionChange)="updateChart()">
                  @for (v of config()?.variables; track v.name) {
                    <mat-option [value]="v.name">{{ v.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Valor/Métrica (Eixo Y)</mat-label>
                <mat-select [(ngModel)]="valueVar" (selectionChange)="updateChart()">
                  @for (v of config()?.variables; track v.name) {
                    <mat-option [value]="v.name">{{ v.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Operação Estatística</mat-label>
                <mat-select [(ngModel)]="metric" (selectionChange)="updateChart()">
                  <mat-option value="count">Contagem (Frequência)</mat-option>
                  <mat-option value="sum">Soma</mat-option>
                  <mat-option value="avg">Média</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="info-box" *ngIf="categoryVar()">
              <p>Gerando gráfico para <strong>{{ categoryVar() }}</strong> por <strong>{{ metricLabel() }}</strong> de <strong>{{ valueVar() }}</strong></p>
              <button mat-raised-button color="accent" class="publish-btn" (click)="publishArtifact()">
                <mat-icon>publish</mat-icon> Publicar este Gráfico
              </button>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Preview -->
        <mat-card appearance="outlined" class="preview-card">
          <mat-card-header>
            <mat-card-title>Visualização</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (isLoading()) {
              <div class="loading-state">
                <mat-progress-bar mode="indeterminate"></mat-progress-bar>
                <p>Calculando métricas via Polars...</p>
              </div>
            }
            
            @if (graphData && !isLoading()) {
              <plotly-plot 
                [data]="graphData.data" 
                [layout]="graphData.layout" 
                [config]="graphData.config"
                [useResizeHandler]="true"
                class="chart-container">
              </plotly-plot>
            }

            @if (!categoryVar() && !isLoading()) {
              <div class="empty-preview">
                <mat-icon>bar_chart</mat-icon>
                <p>Selecione as variáveis ao lado para visualizar o gráfico.</p>
              </div>
            }
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0; color: #3f51b5; }

    .content-grid { display: grid; grid-template-columns: 350px 1fr; gap: 24px; align-items: start; }
    .form-fields { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
    .full-width { width: 100%; }

    .info-box { margin-top: 24px; padding: 16px; background: #e8eaf6; border-radius: 4px; font-size: 0.9rem; color: #3f51b5; display: flex; flex-direction: column; gap: 12px; }
    .publish-btn { width: 100%; }

    .chart-container { width: 100%; height: 500px; display: block; }

    .loading-state, .empty-preview { 
      height: 400px; 
      display: flex; 
      flex-direction: column; 
      justify-content: center; 
      align-items: center; 
      text-align: center;
      color: #999;
    }
    .empty-preview mat-icon { font-size: 64px; width: 64px; height: 64px; margin-bottom: 16px; }

    @media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }
  `]
})
export class BarChartView implements OnInit {
  private stateService = inject(DatasetStateService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  config = this.stateService.currentAnalysis;
  
  categoryVar = signal<string | null>(null);
  valueVar = signal<string | null>(null);
  metric = signal<string>('count');
  isLoading = signal(false);

  graphData: any = null;
  lastResultData: { categories: string[], values: number[] } | null = null;

  metricLabel = () => {
    switch(this.metric()) {
      case 'sum': return 'Soma';
      case 'avg': return 'Média';
      default: return 'Contagem';
    }
  }

  ngOnInit() {
    if (!this.config()) {
      this.router.navigate(['/desktop/analysis/descritiva']);
    }
  }

  async updateChart() {
    const cat = this.categoryVar();
    const val = this.valueVar() || cat;
    const met = this.metric();
    const analysis = this.config();

    if (!cat || !analysis) return;

    this.isLoading.set(true);
    try {
      const appDataDir = await invoke<string>('get_app_data_dir');
      const filePath = `${appDataDir}/processed_data/${analysis.groupName}/analysis_ready.csv`;
      
      const data = await invoke<any>('get_barchart_data', {
        filePath,
        categoryCol: cat,
        valueCol: val,
        metric: met
      });

      this.lastResultData = data;
      this.preparePlotlyData(data.categories, data.values, cat, met);
    } catch (err) {
      console.error('Erro ao gerar gráfico:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  preparePlotlyData(x: string[], y: number[], title: string, metric: string) {
    this.graphData = {
      data: [{
        x: x,
        y: y,
        type: 'bar',
        marker: { color: '#3f51b5' }
      }],
      layout: {
        title: `${this.metricLabel()} de ${this.valueVar() || title} por ${title}`,
        xaxis: { title: title, automargin: true },
        yaxis: { title: this.metricLabel(), automargin: true },
        margin: { t: 50, b: 100, l: 60, r: 20 }
      },
      config: { responsive: true, displayModeBar: false }
    };
  }

  async publishArtifact() {
    if (!this.lastResultData) return;

    const label = prompt('Digite um rótulo para esta publicação:');
    if (!label) return;

    const analysis = this.config();
    if (!analysis) return;

    const artifact = {
      id: crypto.randomUUID(),
      label: label,
      type: 'barchart' as const,
      params: {
        categoryVar: this.categoryVar(),
        valueVar: this.valueVar(),
        metric: this.metric()
      },
      data: {
        x: this.lastResultData.categories,
        y: this.lastResultData.values
      },
      createdAt: new Date().toISOString()
    };

    if (!analysis.publishedArtifacts) {
      analysis.publishedArtifacts = [];
    }
    analysis.publishedArtifacts.push(artifact);

    await this.stateService.saveAnalysis(analysis);
    this.snackBar.open('Gráfico publicado com sucesso!', 'OK', { duration: 3000 });
  }

  goBack() {
    this.router.navigate(['/desktop/analysis/descritiva']);
  }
}
