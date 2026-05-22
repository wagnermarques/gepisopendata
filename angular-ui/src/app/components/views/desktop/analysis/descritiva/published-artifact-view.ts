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
                <div class="section-group">
                  <h4>Títulos dos Eixos</h4>
                  <mat-form-field appearance="outline">
                    <mat-label>Título do Eixo X</mat-label>
                    <input matInput [(ngModel)]="tempXTitle" placeholder="Ex: Categorias">
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Título do Eixo Y</mat-label>
                    <input matInput [(ngModel)]="tempYTitle" placeholder="Ex: Valores">
                  </mat-form-field>
                </div>

                <mat-divider></mat-divider>

                <div class="section-group">
                  <h4>Formatação do Eixo Y (Rótulos)</h4>
                  <div class="row-fields">
                    <mat-form-field appearance="outline">
                      <mat-label>Prefixo (ex: $)</mat-label>
                      <input matInput [(ngModel)]="tempYPrefix">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Sufixo (ex: %)</mat-label>
                      <input matInput [(ngModel)]="tempYSuffix">
                    </mat-form-field>
                  </div>
                </div>

                <mat-divider></mat-divider>

                <div class="section-group">
                  <h4>Renomear Categorias (Eixo X)</h4>
                  <div class="category-edit-list">
                    @for (cat of artifact()?.data?.x; track cat) {
                      <div class="category-edit-row">
                        <span class="orig-cat" [title]="cat">{{ cat }}</span>
                        <mat-icon>arrow_forward</mat-icon>
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <input matInput [placeholder]="cat" [(ngModel)]="tempXLabelMap[cat]">
                        </mat-form-field>
                      </div>
                    }
                  </div>
                </div>
                
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
    .view-grid.editing-active { grid-template-columns: 1fr 380px; }

    .chart-container { width: 100%; height: 600px; display: block; }

    .edit-panel { background: #f8f9fa; max-height: 800px; overflow-y: auto; }
    .edit-form { display: flex; flex-direction: column; gap: 16px; padding-top: 16px; }
    .section-group { display: flex; flex-direction: column; gap: 12px; }
    .section-group h4 { margin: 0 0 4px 0; color: #555; font-size: 0.9rem; }
    .row-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    
    .category-edit-list { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; padding-right: 8px; }
    .category-edit-row { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; }
    .orig-cat { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #666; font-weight: 500; }
    .category-edit-row mat-icon { font-size: 16px; width: 16px; height: 16px; color: #999; }
    .category-edit-row mat-form-field { flex: 2; }

    .edit-hint { font-size: 0.75rem; color: #666; font-style: italic; }

    .loading-state, .error-state { 
      text-align: center; 
      padding: 100px; 
      background: #fff; 
      border-radius: 8px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.05); 
    }
    .error-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 16px; }

    @media (max-width: 1100px) { 
      .view-grid.editing-active { grid-template-columns: 1fr; }
      .edit-panel { max-height: none; }
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
  tempYPrefix = '';
  tempYSuffix = '';
  tempXLabelMap: Record<string, string> = {};

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
    
    const xValues = artifact.data?.x.map(val => 
      (artifact.xLabelMap && artifact.xLabelMap[val]) ? artifact.xLabelMap[val] : val
    );

    this.graphData = {
      data: [{
        x: xValues,
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
          tickprefix: artifact.yPrefix || '',
          ticksuffix: artifact.ySuffix || '',
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
    this.tempYPrefix = art.yPrefix || '';
    this.tempYSuffix = art.ySuffix || '';
    
    // Clone label map or initialize
    this.tempXLabelMap = art.xLabelMap ? { ...art.xLabelMap } : {};
    
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
    art.yPrefix = this.tempYPrefix;
    art.ySuffix = this.tempYSuffix;
    art.xLabelMap = { ...this.tempXLabelMap };

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
