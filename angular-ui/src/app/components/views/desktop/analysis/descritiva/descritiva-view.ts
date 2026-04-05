import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { DatasetStateService, AnalysisConfig } from '../../../../../services/dataset-state.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-descritiva-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
  ],
  template: `
    <div class="container">
      <div class="header">
        <button mat-icon-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>Análises Descritivas</h1>
      </div>

      @if (config(); as analysisConfig) {
        <mat-card appearance="outlined" class="info-card">
          <mat-card-header>
            <mat-card-title>Configuração da Análise</mat-card-title>
            <mat-card-subtitle>
              Grupo: <strong>{{ analysisConfig.groupName }}</strong> | 
              Arquivos: <strong>{{ analysisConfig.files.length }}</strong> | 
              Variáveis: <strong>{{ analysisConfig.variables.length }}</strong>
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="variable-summary">
              <h3>Variáveis Selecionadas:</h3>
              <table mat-table [dataSource]="analysisConfig.variables" class="compact-table">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Nome</th>
                  <td mat-cell *matCellDef="let variable">{{ variable.name }}</td>
                </ng-container>
                <ng-container matColumnDef="type">
                  <th mat-header-cell *matHeaderCellDef>Tipo</th>
                  <td mat-cell *matCellDef="let variable">{{ variable.type }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="['name', 'type']"></tr>
                <tr mat-row *matRowDef="let row; columns: ['name', 'type'];"></tr>
              </table>
            </div>
          </mat-card-content>
        </mat-card>

        <div class="analysis-placeholder">
          <mat-icon>assessment</mat-icon>
          <h2>Pronto para iniciar as análises estatísticas</h2>
          <p>Esta funcionalidade está sendo implementada para processar os dados dos arquivos selecionados.</p>
        </div>
      } @else {
        <div class="empty-state">
          <mat-icon color="warn">warning</mat-icon>
          <h2>Nenhuma configuração encontrada</h2>
          <p>Por favor, configure as variáveis primeiro.</p>
          <button mat-raised-button color="primary" (click)="goBack()">
            Voltar para Configuração
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .container { padding: 24px; max-width: 1000px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0; color: #3f51b5; }

    .info-card { margin-bottom: 24px; }
    .compact-table { width: 100%; max-width: 500px; margin-top: 8px; }

    .analysis-placeholder, .empty-state { 
      text-align: center; 
      padding: 60px; 
      background: #f5f5f5; 
      border-radius: 8px;
      border: 2px dashed #ccc;
      margin-top: 40px;
    }
    .analysis-placeholder mat-icon, .empty-state mat-icon { 
      font-size: 64px; width: 64px; height: 64px; color: #999; margin-bottom: 16px; 
    }
    .analysis-placeholder h2 { color: #555; }
    .analysis-placeholder p { color: #777; }
  `]
})
export class DescritivaView implements OnInit {
  private stateService = inject(DatasetStateService);
  private router = inject(Router);

  config = signal<AnalysisConfig | null>(null);

  ngOnInit() {
    this.config.set(this.stateService.getAnalysisConfig());
  }

  goBack() {
    this.router.navigate(['/desktop/analysis/config']);
  }
}
