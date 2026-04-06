import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatasetStateService, AnalysisConfig } from '../../../../../services/dataset-state.service';
import { Router } from '@angular/router';
import { invoke } from '@tauri-apps/api/core';

@Component({
  selector: 'app-descritiva-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressBarModule,
    MatDividerModule,
    MatListModule,
    MatTooltipModule,
  ],
  template: `
    <div class="container">
      <div class="header">
        <button mat-icon-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>Análises Descritivas</h1>
      </div>

      <div class="content-grid">
        <!-- Left Panel: History -->
        <div class="left-panel">
          <mat-card appearance="outlined" class="history-card">
            <mat-card-header>
              <mat-card-title>Análises Anteriores</mat-card-title>
              <mat-card-subtitle>Histórico de configurações salvas</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <mat-nav-list class="history-list">
                @for (item of stateService.allAnalyses(); track item.id) {
                  <mat-list-item [class.selected]="config()?.id === item.id" (click)="selectAnalysis(item)">
                    <mat-icon matListItemIcon>history</mat-icon>
                    <span matListItemTitle>{{ item.name }}</span>
                    <span matListItemLine>{{ item.groupName }} • {{ item.variables.length }} variáveis</span>
                    <button mat-icon-button matListItemMeta (click)="deleteAnalysis($event, item.id!)" matTooltip="Excluir">
                      <mat-icon color="warn">delete</mat-icon>
                    </button>
                  </mat-list-item>
                }
                @if (stateService.allAnalyses().length === 0) {
                  <p class="empty-history">Nenhuma análise anterior encontrada.</p>
                }
              </mat-nav-list>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Right Panel: Current Analysis & ETL -->
        <div class="right-panel">
          @if (config(); as analysisConfig) {
            <mat-card appearance="outlined" class="info-card">
              <mat-card-header>
                <div class="card-header-with-actions">
                  <div>
                    <mat-card-title>{{ analysisConfig.name }}</mat-card-title>
                    <mat-card-subtitle>
                      Grupo: <strong>{{ analysisConfig.groupName }}</strong> | 
                      Arquivos: <strong>{{ analysisConfig.files.length }}</strong>
                    </mat-card-subtitle>
                  </div>
                  <button mat-stroked-button (click)="editCurrent()">
                    <mat-icon>edit</mat-icon> Editar Configuração
                  </button>
                </div>
              </mat-card-header>
              <mat-card-content>
                <div class="etl-section">
                  <h3>Preparação dos Dados (ETL)</h3>
                  <p>Consolide os arquivos selecionados para habilitar as ferramentas de análise.</p>
                  
                  @if (etlStatus() === 'idle') {
                    <button mat-raised-button color="accent" (click)="startEtl()">
                      <mat-icon>merge_type</mat-icon>
                      Consolidar Base de Dados (ETL)
                    </button>
                  } @else if (etlStatus() === 'processing') {
                    <div class="status-box processing">
                      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
                      <p>Processando via Polars...</p>
                    </div>
                  } @else if (etlStatus() === 'success') {
                    <div class="status-box success">
                      <mat-icon>check_circle</mat-icon>
                      <div class="success-info">
                        <p>Base consolidada com sucesso!</p>
                        <small>{{ processedFilePath() }}</small>
                      </div>
                    </div>
                  } @else if (etlStatus() === 'error') {
                    <div class="status-box error">
                      <mat-icon>error</mat-icon>
                      <p>Erro: {{ etlError() }}</p>
                      <button mat-button (click)="startEtl()">Tentar Novamente</button>
                    </div>
                  }
                </div>

                <mat-divider></mat-divider>

                <div class="variable-summary">
                  <h3>Variáveis Selecionadas ({{ analysisConfig.variables.length }}):</h3>
                  <table mat-table [dataSource]="analysisConfig.variables" class="compact-table">
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Nome</th>
                      <td mat-cell *matCellDef="let variable">
                        <div class="var-name">{{ variable.name }}</div>
                        <div class="var-desc" *ngIf="variable.description">{{ variable.description }}</div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="type">
                      <th mat-header-cell *matHeaderCellDef>Tipo</th>
                      <td mat-cell *matCellDef="let variable">
                        <span class="type-badge" [class.number]="variable.type === 'Número'">{{ variable.type }}</span>
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="['name', 'type']"></tr>
                    <tr mat-row *matRowDef="let row; columns: ['name', 'type'];"></tr>
                  </table>
                </div>
              </mat-card-content>
            </mat-card>

            @if (etlStatus() === 'success') {
              <div class="analysis-placeholder active">
                <mat-icon>assessment</mat-icon>
                <h2>Análises Disponíveis</h2>
                <div class="analysis-actions">
                  <button mat-flat-button color="primary">Frequências</button>
                  <button mat-flat-button color="primary">Medidas de Tendência</button>
                  <button mat-flat-button color="primary" (click)="goToBarChart()">
                    <mat-icon>bar_chart</mat-icon> Gráficos de Barras
                  </button>
                  <button mat-flat-button color="primary">Cruzamentos</button>
                </div>

              </div>
            } @else {
              <div class="analysis-placeholder">
                <mat-icon>lock</mat-icon>
                <h2>Aguardando ETL</h2>
                <p>O processo de ETL é necessário para normalizar os dados antes da análise.</p>
              </div>
            }
          } @else {
            <div class="empty-state">
              <mat-icon color="warn">warning</mat-icon>
              <h2>Nenhuma configuração selecionada</h2>
              <p>Selecione uma análise no histórico ou crie uma nova.</p>
              <button mat-raised-button color="primary" (click)="goBack()">
                Criar Nova Configuração
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0; color: #3f51b5; }

    .content-grid { display: grid; grid-template-columns: 350px 1fr; gap: 24px; align-items: start; }
    
    .history-list { background: #fff; }
    .history-list .selected { background: rgba(63, 81, 181, 0.08); border-left: 4px solid #3f51b5; }
    .empty-history { padding: 16px; text-align: center; color: #999; font-style: italic; font-size: 0.9rem; }

    .card-header-with-actions { display: flex; justify-content: space-between; align-items: flex-start; width: 100%; }

    .info-card { margin-bottom: 24px; }
    .compact-table { width: 100%; margin-top: 8px; }
    .var-name { font-weight: 500; }
    .var-desc { font-size: 0.75rem; color: #777; font-style: italic; }
    .type-badge { font-size: 0.7rem; padding: 2px 6px; background: #f0f0f0; border-radius: 4px; }
    .type-badge.number { background: #e3f2fd; color: #1976d2; }

    .etl-section { padding: 8px 0 16px 0; }
    .status-box { display: flex; align-items: center; gap: 16px; padding: 12px; border-radius: 8px; margin-top: 8px; }
    .status-box.processing { background: #e3f2fd; }
    .status-box.success { background: #e8f5e9; color: #2e7d32; }
    .status-box.error { background: #ffebee; color: #c62828; }
    .success-info small { font-family: monospace; font-size: 0.75rem; }

    .analysis-placeholder { text-align: center; padding: 40px; background: #fafafa; border-radius: 8px; border: 2px dashed #ddd; }
    .analysis-placeholder.active { opacity: 1; background: #fff; border-style: solid; border-color: #3f51b5; }
    .analysis-placeholder mat-icon { font-size: 48px; width: 48px; height: 48px; color: #ccc; margin-bottom: 8px; }
    .analysis-placeholder.active mat-icon { color: #3f51b5; }
    .analysis-actions { display: flex; justify-content: center; gap: 12px; margin-top: 16px; }

    .empty-state { text-align: center; padding: 60px; background: #f5f5f5; border-radius: 8px; }
    
    @media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }
  `]
})
export class DescritivaView implements OnInit {
  stateService = inject(DatasetStateService);
  private router = inject(Router);

  config = this.stateService.currentAnalysis;
  etlStatus = signal<'idle' | 'processing' | 'success' | 'error'>('idle');
  etlError = signal<string | null>(null);
  processedFilePath = signal<string | null>(null);

  ngOnInit() {
    // History is loaded by the service constructor
  }

  selectAnalysis(analysis: AnalysisConfig) {
    this.stateService.setCurrentAnalysis(analysis);
    this.etlStatus.set('idle');
    this.processedFilePath.set(null);
  }

  async deleteAnalysis(event: Event, id: string) {
    event.stopPropagation();
    if (confirm('Tem certeza que deseja excluir esta configuração?')) {
      await this.stateService.deleteAnalysis(id);
    }
  }

  editCurrent() {
    this.router.navigate(['/desktop/analysis/config']);
  }

  goToBarChart() {
    this.router.navigate(['/desktop/analysis/descritiva/barchart']);
  }

  async startEtl() {
    const analysisConfig = this.config();
    if (!analysisConfig) return;

    this.etlStatus.set('processing');
    this.etlError.set(null);

    try {
      const result = await invoke<string>('run_etl', {
        groupName: analysisConfig.groupName,
        files: analysisConfig.files,
        columns: analysisConfig.variables.map(v => v.name)
      });
      
      this.processedFilePath.set(result);
      this.etlStatus.set('success');
    } catch (err: any) {
      this.etlStatus.set('error');
      this.etlError.set(err.toString());
    }
  }

  goBack() {
    this.router.navigate(['/desktop/analysis/config']);
  }
}
