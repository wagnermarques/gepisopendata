import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DatasetStateService, AnalysisArtifact, AnalysisConfig } from '../../../../../services/dataset-state.service';
import { ActivatedRoute, Router } from '@angular/router';

// Plotly via Window Integration (requires script in index.html)
import { PlotlyModule } from 'angular-plotly.js';

@Component({
  selector: 'app-published-artifact-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    PlotlyModule,
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
      } @else if (error()) {
        <div class="error-state">
          <mat-icon color="warn">error</mat-icon>
          <h2>Erro ao carregar publicação</h2>
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
            @if (graphData) {
              <plotly-plot 
                [data]="graphData.data" 
                [layout]="graphData.layout" 
                [config]="graphData.config"
                [useResizeHandler]="true"
                class="chart-container">
              </plotly-plot>
            } @else {
              <div class="empty-state">
                <p>Nenhum dado encontrado para este artefato.</p>
              </div>
            }
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .container { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0; color: #3f51b5; }

    .chart-container { width: 100%; height: 600px; display: block; }

    .loading-state, .error-state { 
      text-align: center; 
      padding: 100px; 
      background: #fff; 
      border-radius: 8px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.05); 
    }
    .error-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 16px; }
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

  graphData: any = null;

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.loadArtifact(params['analysisId'], params['artifactId']);
    });
  }

  async loadArtifact(analysisId: string, artifactId: string) {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Find the analysis in history (loaded from public/data for web)
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

      // We use the PERSISTED data if available (works on both Web and Desktop)
      if (targetArtifact.data && targetArtifact.type === 'barchart') {
        this.preparePlotlyData(targetArtifact);
      } else {
        this.error.set('Este artefato não contém dados persistidos ou é de um tipo sem suporte web.');
      }

    } catch (err: any) {
      console.error('Erro ao carregar artefato:', err);
      this.error.set(err.toString());
    } finally {
      this.isLoading.set(false);
    }
  }

  preparePlotlyData(artifact: AnalysisArtifact) {
    const { categoryVar, metric } = artifact.params;
    
    this.graphData = {
      data: [{
        x: artifact.data?.x,
        y: artifact.data?.y,
        type: 'bar',
        marker: { color: '#3f51b5' }
      }],
      layout: {
        title: artifact.label,
        xaxis: { title: categoryVar, automargin: true },
        yaxis: { title: this.getMetricLabel(metric), automargin: true },
        margin: { t: 50, b: 100, l: 60, r: 20 }
      },
      config: { responsive: true, displayModeBar: false }
    };
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
