import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { DatasetStateService, AnalysisArtifact, AnalysisConfig } from '../../../../../services/dataset-state.service';
import { ActivatedRoute, Router } from '@angular/router';
import { isTauri } from '../../../../../services/environment';

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
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    FormsModule,
    PlotlyModule,
  ],
  template: `
    <div class="container">
      <div class="header">
        <button mat-icon-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
        </button>
        
        <ng-container *ngIf="!isEditing(); else editHeader">
          <h1>{{ artifact()?.label || 'Visualizar Publicação' }}</h1>
          <button mat-icon-button *ngIf="isDesktop()" (click)="startEdit()" matTooltip="Editar detalhes do gráfico">
            <mat-icon>edit</mat-icon>
          </button>
        </ng-container>
        
        <ng-template #editHeader>
          <mat-form-field appearance="outline" class="edit-title-field">
            <mat-label>Título do Gráfico</mat-label>
            <input matInput [(ngModel)]="tempLabel" (keyup.enter)="saveChanges()">
          </mat-form-field>
          <div class="edit-actions">
            <button mat-button (click)="cancelEdit()">Cancelar</button>
            <button mat-flat-button color="primary" (click)="saveChanges()">Salvar</button>
          </div>
        </ng-template>
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
        <div class="view-grid" [class.editing-active]="isEditing()">
          <mat-card appearance="outlined" class="main-chart-card">
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

          <mat-card appearance="outlined" class="edit-panel" *ngIf="isEditing()">
            <mat-card-header>
              <mat-card-title>Configurações Visuais</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="edit-form">
                <mat-form-field appearance="outline">
                  <mat-label>Título do Eixo X</mat-label>
                  <input matInput [(ngModel)]="tempXTitle" placeholder="Ex: Categorias">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Título do Eixo Y</mat-label>
                  <input matInput [(ngModel)]="tempYTitle" placeholder="Ex: Valores">
                </mat-form-field>
                
                <p class="edit-hint">As alterações serão aplicadas ao salvar no cabeçalho.</p>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      }
    </div>
  `,
  styles: [`
    .container { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; min-height: 56px; }
    .header h1 { margin: 0; color: #3f51b5; }
    
    .edit-title-field { flex: 1; max-width: 600px; }
    .edit-actions { display: flex; gap: 8px; }

    .view-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
    .view-grid.editing-active { grid-template-columns: 1fr 300px; }

    .chart-container { width: 100%; height: 600px; display: block; }

    .edit-panel { background: #f8f9fa; }
    .edit-form { display: flex; flex-direction: column; gap: 16px; padding-top: 16px; }
    .edit-hint { font-size: 0.75rem; color: #666; font-style: italic; }

    .loading-state, .error-state { 
      text-align: center; 
      padding: 100px; 
      background: #fff; 
      border-radius: 8px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.05); 
    }
    .error-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 16px; }

    @media (max-width: 900px) { 
      .view-grid.editing-active { grid-template-columns: 1fr; }
    }
  `]
})
export class PublishedArtifactView implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private stateService = inject(DatasetStateService);
  private snackBar = inject(MatSnackBar);

  analysis = signal<AnalysisConfig | null>(null);
  artifact = signal<AnalysisArtifact | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  
  isDesktop = signal(isTauri());
  isEditing = signal(false);
  
  tempLabel = '';
  tempXTitle = '';
  tempYTitle = '';

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
        xaxis: { 
          title: artifact.xTitle || categoryVar, 
          automargin: true 
        },
        yaxis: { 
          title: artifact.yTitle || this.getMetricLabel(metric), 
          automargin: true 
        },
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

  startEdit() {
    const art = this.artifact();
    if (!art) return;
    
    this.tempLabel = art.label;
    this.tempXTitle = art.xTitle || art.params.categoryVar || '';
    this.tempYTitle = art.yTitle || this.getMetricLabel(art.params.metric) || '';
    this.isEditing.set(true);
  }

  cancelEdit() {
    this.isEditing.set(false);
  }

  async saveChanges() {
    const art = this.artifact();
    const config = this.analysis();
    
    if (!art || !config) return;

    // Update artifact object
    art.label = this.tempLabel;
    art.xTitle = this.tempXTitle;
    art.yTitle = this.tempYTitle;

    // Update analysis config
    const artifactIndex = config.publishedArtifacts?.findIndex(a => a.id === art.id);
    if (artifactIndex !== undefined && artifactIndex !== -1 && config.publishedArtifacts) {
      config.publishedArtifacts[artifactIndex] = { ...art };
    }

    try {
      await this.stateService.saveAnalysis(config);
      this.artifact.set({ ...art });
      this.preparePlotlyData(art);
      this.isEditing.set(false);
      this.snackBar.open('Alterações salvas com sucesso!', 'Fechar', { duration: 3000 });
    } catch (err) {
      console.error('Erro ao salvar alterações:', err);
      this.snackBar.open('Erro ao salvar alterações.', 'Fechar', { duration: 5000 });
    }
  }

  goBack() {
    this.router.navigate(['/desktop/analysis/descritiva']);
  }
}
