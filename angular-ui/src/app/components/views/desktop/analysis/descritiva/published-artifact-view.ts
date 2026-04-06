import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DatasetStateService, AnalysisArtifact, AnalysisConfig } from '../../../../../services/dataset-state.service';
import { isTauri } from '../../../../../services/environment';
import { ActivatedRoute, Router } from '@angular/router';
import { invoke } from '@tauri-apps/api/core';

import * as Plotly from 'plotly.js-dist-min';

@Component({
  selector: 'app-published-artifact-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="container">
      <div class="header">
        <button mat-icon-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>{{ artifact()?.label || 'Visualizar Publicação' }}</h1>
      </div>

      @if (isLoading()) {
        <div class="loading-state">
          <mat-progress-bar mode="query"></mat-progress-bar>
          <p>Carregando dados da publicação...</p>
        </div>
      } @else if (!isTauriMode()) {
        <div class="info-state">
          <mat-icon color="primary">desktop_windows</mat-icon>
          <h2>Visualização Limitada</h2>
          <p>Para processar os dados originais e gerar este gráfico, é necessário utilizar a versão <strong>Desktop (Tauri)</strong> do aplicativo.</p>
          <p>Na versão Web, você pode consultar o histórico de publicações, mas o processamento Polars/Rust requer acesso local aos arquivos.</p>
          <button mat-raised-button color="primary" (click)="goBack()">Voltar</button>
        </div>
      } @else if (error()) {
        <div class="error-state">
          <mat-icon color="warn">error</mat-icon>
          <h2>Erro ao carrerar publicação</h2>
          <p>{{ error() }}</p>
          <button mat-raised-button color="primary" (click)="goBack()">Voltar</button>
        </div>
      } @else {
        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-subtitle>
              Análise: <strong>{{ analysis()?.name }}</strong> | 
              Publicado em: <strong>{{ artifact()?.createdAt | date:'short' }}</strong>
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div id="artifact-content" class="chart-container"></div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .container { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0; color: #3f51b5; }

    .chart-container { width: 100%; height: 600px; margin-top: 16px; }

    .loading-state, .error-state, .info-state { 
      text-align: center; 
      padding: 100px; 
      background: #fff; 
      border-radius: 8px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.05); 
    }
    .error-state mat-icon, .info-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 16px; }
    .info-state h2 { color: #3f51b5; }
    .info-state p { max-width: 600px; margin: 8px auto; color: #666; }
  `]
})
export class PublishedArtifactView implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private stateService = inject(DatasetStateService);

  analysis = signal<AnalysisConfig | null>(null);
  artifact = signal<AnalysisArtifact | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  isTauriMode = signal(isTauri());

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.loadArtifact(params['analysisId'], params['artifactId']);
    });
  }

  async loadArtifact(analysisId: string, artifactId: string) {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Find the analysis in history
      const analyses = this.stateService.allAnalyses();
      const targetAnalysis = analyses.find(a => a.id === analysisId);
      
      if (!targetAnalysis) {
        this.error.set('Configuração de análise não encontrada.');
        return;
      }

      const targetArtifact = targetAnalysis.publishedArtifacts?.find(art => art.id === artifactId);
      
      if (!targetArtifact) {
        this.error.set('Artefato publicado não encontrado.');
        return;
      }

      this.analysis.set(targetAnalysis);
      this.artifact.set(targetArtifact);

      if (!this.isTauriMode()) {
        this.isLoading.set(false);
        return;
      }

      // Render based on type
      if (targetArtifact.type === 'barchart') {
        await this.loadBarChartData(targetAnalysis, targetArtifact);
      } else {
        this.error.set('Tipo de artefato não suportado.');
      }

    } catch (err: any) {
      console.error('Erro ao carregar artefato:', err);
      this.error.set(err.toString());
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadBarChartData(analysis: AnalysisConfig, artifact: AnalysisArtifact) {
    const { categoryVar, valueVar, metric } = artifact.params;
    
    try {
      const appDataDir = await invoke<string>('get_app_data_dir');
      const filePath = `${appDataDir}/processed_data/${analysis.groupName}/analysis_ready.csv`;

      const data = await invoke<any>('get_barchart_data', {
        filePath,
        categoryCol: categoryVar,
        valueCol: valueVar || categoryVar,
        metric: metric
      });

      // Wait for DOM to be ready
      setTimeout(() => this.renderBarChart(data.categories, data.values, artifact.label, categoryVar, metric), 100);
    } catch (err: any) {
      throw new Error(`Erro ao processar dados Polars: ${err}`);
    }
  }

  renderBarChart(x: string[], y: number[], label: string, categoryVar: string, metric: string) {
    const trace: any = {
      x: x,
      y: y,
      type: 'bar',
      marker: { color: '#3f51b5' }
    };

    const layout: any = {
      title: label,
      xaxis: { title: categoryVar, automargin: true },
      yaxis: { title: this.getMetricLabel(metric), automargin: true },
      margin: { t: 50, b: 100, l: 60, r: 20 }
    };

    Plotly.newPlot('artifact-content', [trace], layout, { responsive: true });
  }

  getMetricLabel(metric: string) {
    switch(metric) {
      case 'sum': return 'Soma';
      case 'avg': return 'Média';
      default: return 'Contagem';
    }
  }

  goBack() {
    this.router.navigate(['/desktop/analysis/descritiva']);
  }
}
