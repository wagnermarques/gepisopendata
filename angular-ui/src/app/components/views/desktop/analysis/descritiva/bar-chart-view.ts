import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { DatasetStateService } from '../../../../../services/dataset-state.service';
import { Router } from '@angular/router';
import { invoke } from '@tauri-apps/api/core';

// Plotly via Window Integration (requires script in index.html)
import { PlotlyModule } from 'angular-plotly.js';

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
    MatInputModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatButtonToggleModule,
    MatTooltipModule,
    MatDividerModule,
    FormsModule,
    PlotlyModule,
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
        <!-- Configuration Panel -->
        <div class="config-panel">
          <!-- Selection Summary -->
          <mat-card appearance="outlined" class="summary-card">
            <mat-card-content>
              <div class="selection-summary">
                <div class="selection-slot" [class.active]="categoryVar()">
                  <span class="slot-label">Eixo X (Categorias)</span>
                  <div class="slot-value">
                    <mat-icon>label</mat-icon>
                    <span>{{ categoryVar() || 'Nenhuma variável' }}</span>
                  </div>
                </div>
                
                <div class="selection-slot" [class.active]="valueVar()">
                  <span class="slot-label">Eixo Y (Valores)</span>
                  <div class="slot-value">
                    <mat-icon>numbers</mat-icon>
                    <span>{{ valueVar() || (metric() === 'count' ? 'Contagem Automática' : 'Nenhuma variável') }}</span>
                  </div>
                </div>
              </div>

              <div class="metric-selector">
                <span class="slot-label">Operação Estatística</span>
                <mat-button-toggle-group [(ngModel)]="metric" (change)="updateChart()" class="full-width">
                  <mat-button-toggle value="count">Frequência</mat-button-toggle>
                  <mat-button-toggle value="sum">Soma</mat-button-toggle>
                  <mat-button-toggle value="avg">Média</mat-button-toggle>
                </mat-button-toggle-group>
              </div>

              <button mat-flat-button color="accent" class="publish-btn" [disabled]="!categoryVar()" (click)="publishArtifact()">
                <mat-icon>publish</mat-icon> Publicar este Gráfico
              </button>
            </mat-card-content>
          </mat-card>

          <!-- Variable Selection List -->
          <mat-card appearance="outlined" class="variable-list-card">
            <mat-card-header>
              <mat-card-title>Selecione as Variáveis</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <mat-form-field appearance="outline" class="full-width search-field" subscriptSizing="dynamic">
                <mat-icon matPrefix>search</mat-icon>
                <input matInput [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Filtrar variáveis...">
              </mat-form-field>

              <div class="variable-list">
                @for (v of filteredVariables(); track v.name) {
                  <div class="variable-row" 
                       [class.is-x]="categoryVar() === v.name" 
                       [class.is-y]="valueVar() === v.name">
                    <div class="var-info">
                      <span class="var-name">{{ v.name }}</span>
                      <span class="var-type" [class.number]="v.type === 'Número'">{{ v.type }}</span>
                    </div>
                    <div class="var-actions">
                      <button mat-icon-button (click)="setX(v.name)" 
                              [color]="categoryVar() === v.name ? 'primary' : ''"
                              matTooltip="Usar no Eixo X">
                        <mat-icon>align_horizontal_left</mat-icon>
                      </button>
                      <button mat-icon-button (click)="setY(v.name)" 
                              [color]="valueVar() === v.name ? 'primary' : ''"
                              matTooltip="Usar no Eixo Y">
                        <mat-icon>align_vertical_bottom</mat-icon>
                      </button>
                    </div>
                  </div>
                  <mat-divider></mat-divider>
                }
                @if (filteredVariables().length === 0) {
                  <div class="empty-list">Nenhuma variável encontrada.</div>
                }
              </div>
            </mat-card-content>
          </mat-card>
        </div>

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
                <p>Selecione as variáveis à esquerda para visualizar o gráfico.</p>
                <small>Escolha uma variável para o <strong>Eixo X</strong> para começar.</small>
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

    .content-grid { display: grid; grid-template-columns: 400px 1fr; gap: 24px; align-items: start; }
    .config-panel { display: flex; flex-direction: column; gap: 16px; }
    .full-width { width: 100%; }

    /* Summary Card */
    .summary-card { background: #f8f9fa; }
    .selection-summary { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
    .selection-slot { padding: 12px; background: #fff; border: 1px solid #ddd; border-radius: 8px; transition: all 0.2s; }
    .selection-slot.active { border-color: #3f51b5; background: #e8eaf6; }
    .slot-label { font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; margin-bottom: 4px; display: block; }
    .slot-value { display: flex; align-items: center; gap: 8px; color: #333; font-weight: 500; }
    .slot-value mat-icon { color: #999; font-size: 20px; width: 20px; height: 20px; }
    .selection-slot.active .slot-value { color: #3f51b5; }
    .selection-slot.active .slot-value mat-icon { color: #3f51b5; }
    
    .metric-selector { margin-bottom: 20px; }
    .publish-btn { width: 100%; height: 48px; }

    /* Variable List Card */
    .variable-list-card { flex: 1; }
    .search-field { margin-bottom: 12px; }
    .variable-list { max-height: 500px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; }
    .variable-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; transition: background 0.2s; }
    .variable-row:hover { background: #f5f5f5; }
    .variable-row.is-x { background: rgba(63, 81, 181, 0.05); }
    .variable-row.is-y { background: rgba(0, 150, 136, 0.05); }
    .var-info { display: flex; flex-direction: column; gap: 2px; }
    .var-name { font-weight: 500; font-size: 0.9rem; }
    .var-type { font-size: 0.7rem; color: #777; padding: 2px 6px; background: #eee; border-radius: 4px; width: fit-content; }
    .var-type.number { background: #e3f2fd; color: #1976d2; }
    .var-actions { display: flex; gap: 4px; }
    .empty-list { padding: 24px; text-align: center; color: #999; font-style: italic; }

    /* Preview Card */
    .chart-container { width: 100%; height: 600px; display: block; }
    .loading-state, .empty-preview { 
      height: 500px; 
      display: flex; 
      flex-direction: column; 
      justify-content: center; 
      align-items: center; 
      text-align: center;
      color: #999;
    }
    .empty-preview mat-icon { font-size: 80px; width: 80px; height: 80px; margin-bottom: 24px; opacity: 0.3; }
    .empty-preview p { font-size: 1.2rem; margin-bottom: 8px; color: #666; }

    @media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }
  `]
})
export class BarChartView implements OnInit {
  private stateService = inject(DatasetStateService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  config = this.stateService.currentAnalysis;
  
  searchQuery = signal('');
  filteredVariables = computed(() => {
    const vars = this.config()?.variables || [];
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return vars;
    return vars.filter(v => v.name.toLowerCase().includes(query));
  });

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

  setX(name: string) {
    if (this.categoryVar() === name) {
      this.categoryVar.set(null);
    } else {
      this.categoryVar.set(name);
    }
    this.updateChart();
  }

  setY(name: string) {
    if (this.valueVar() === name) {
      this.valueVar.set(null);
    } else {
      this.valueVar.set(name);
    }
    this.updateChart();
  }

  async updateChart() {
    const cat = this.categoryVar();
    const val = this.valueVar() || cat;
    const met = this.metric();
    const analysis = this.config();

    if (!cat || !analysis) {
      this.graphData = null;
      return;
    }

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
      this.snackBar.open('Erro ao gerar gráfico: ' + err, 'Fechar', { duration: 5000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  preparePlotlyData(x: string[], y: number[], title: string, metric: string) {
    const analysis = this.config();
    const xVarInfo = analysis?.variables.find(v => v.name === title);
    const statType = xVarInfo?.statisticalType;
    const plotlyType = this.mapToPlotlyType(statType);

    // Create pairs and sort based on statistical type
    let paired = x.map((val, i) => ({ x: val, y: y[i] }));
    
    if (statType === 'qualitativa_ordinal' || statType === 'categorica_temporal_ano') {
      paired.sort((a, b) => {
        const na = parseFloat(a.x);
        const nb = parseFloat(b.x);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.x.localeCompare(b.x, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    const sortedX = paired.map(p => p.x);
    const sortedY = paired.map(p => p.y);

    this.graphData = {
      data: [{
        x: sortedX,
        y: sortedY,
        type: 'bar',
        marker: { color: '#3f51b5' }
      }],
      layout: {
        title: `${this.metricLabel()} de ${this.valueVar() || title} por ${title}`,
        xaxis: { 
          title: title, 
          type: plotlyType,
          categoryorder: (statType === 'qualitativa_ordinal' || statType === 'categorica_temporal_ano') ? 'category ascending' : 'trace',
          automargin: true 
        },
        yaxis: { title: this.metricLabel(), automargin: true },
        margin: { t: 50, b: 100, l: 60, r: 20 }
      },
      config: { responsive: true, displayModeBar: false }
    };
  }

  mapToPlotlyType(statType?: string): string {
    switch (statType) {
      case 'qualitativa_nominal':
      case 'qualitativa_ordinal':
      case 'categorica_temporal_ano':
        return 'category';
      case 'categorica_temporal_timestamp':
        return 'date';
      case 'quantitativa_continua':
      case 'quantitativa_discreta':
        return 'linear';
      default:
        return '-'; // Plotly auto-detect
    }
  }

  async publishArtifact() {
    if (!this.lastResultData) return;

    const label = prompt('Digite um rótulo para esta publicação:');
    if (!label) return;

    const analysis = this.config();
    if (!analysis) return;

    const cat = this.categoryVar();
    const xVarInfo = analysis.variables.find(v => v.name === cat);

    const artifact = {
      id: crypto.randomUUID(),
      label: label,
      type: 'barchart' as const,
      params: {
        categoryVar: cat,
        valueVar: this.valueVar(),
        metric: this.metric(),
        statisticalType: xVarInfo?.statisticalType // Persist for rendering
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
