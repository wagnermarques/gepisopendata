import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { invoke } from '@tauri-apps/api/core';
import { Router } from '@angular/router';
import { DatasetStateService } from '../../../../../services/dataset-state.service';
import { FormsModule } from '@angular/forms';

interface ColumnInfo {
  name: string;
  type: string;
  included?: boolean;
  description?: string;
}

interface FileInfo {
  name: string;
  selected: boolean;
}

interface DictionaryEntry {
  name: string;
  description: string;
  var_type: string;
}

@Component({
  selector: 'app-variable-config-view',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatFormFieldModule,
    MatSnackBarModule,
    FormsModule,
  ],
  template: `
    <div class="container">
      <div class="header">
        <button mat-icon-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>Configurar Variáveis: {{ groupName() }}</h1>
      </div>

      <div class="content-grid">
        <div class="left-panel">
          <mat-card appearance="outlined" class="files-card">
            <mat-card-header>
              <mat-card-title>Arquivos Encontrados ({{ files().length }})</mat-card-title>
              <mat-card-subtitle>
                Tipo de dado detectado: <strong class="format-badge">{{ format() | uppercase }}</strong>
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="file-list">
                @if (isLoadingFiles()) {
                  <mat-progress-bar mode="indeterminate"></mat-progress-bar>
                } @else {
                  <div class="file-list-actions">
                    <mat-checkbox (change)="toggleAllFiles($event.checked)" 
                                  [checked]="isAllFilesSelected()"
                                  [indeterminate]="isSomeFilesSelected()">
                      Selecionar Todos
                    </mat-checkbox>
                  </div>
                  @for (file of files(); track file.name) {
                    <div class="file-item">
                      <mat-checkbox [checked]="file.selected" 
                                   (change)="toggleFile(file, $event.checked)">
                      </mat-checkbox>
                      <mat-icon>insert_drive_file</mat-icon>
                      <span class="file-name" [title]="file.name">{{ file.name }}</span>
                    </div>
                  }
                  @if (files().length === 0 && !isLoadingFiles()) {
                    <p class="empty-files">Nenhum arquivo encontrado com a extensão {{ format() }}</p>
                  }
                }
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card appearance="outlined" class="dictionary-card">
            <mat-card-header>
              <mat-card-title>Dicionário de Dados</mat-card-title>
              <mat-card-subtitle>Selecione um arquivo Excel para carregar as descrições e tipos</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Arquivo de Dicionário (.xlsx, .xls)</mat-label>
                <mat-select [(ngModel)]="selectedDictionary" (selectionChange)="onDictionaryChange()">
                  <mat-option [value]="null">Nenhum (Usar apenas nomes)</mat-option>
                  @for (dict of excelFiles(); track dict) {
                    <mat-option [value]="dict">{{ dict }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              @if (isLoadingDictionary()) {
                <mat-progress-bar mode="indeterminate"></mat-progress-bar>
              }
            </mat-card-content>
          </mat-card>
        </div>

        <mat-card appearance="outlined" class="columns-card">
          <mat-card-header>
            <mat-card-title>Colunas Comuns Identificadas</mat-card-title>
            <mat-card-subtitle>
              @if (selectedFilesCount() === 0) {
                Selecione ao menos um arquivo para ver as colunas.
              } @else {
                Colunas presentes em todos os {{ selectedFilesCount() }} arquivo(s) selecionado(s).
                <div class="header-info">
                  <mat-icon>info</mat-icon>
                  <span>Considerando a <strong>primeira linha</strong> como cabeçalho e delimitador <strong>';'</strong></span>
                </div>
              }
            </mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            @if (columns().length > 0 && !isLoadingColumns()) {
              <div class="table-actions-top">
                <div class="selection-info">
                  <strong>{{ selectedCount() }}</strong> variáveis selecionadas
                </div>
                <button mat-raised-button color="primary" [disabled]="selectedCount() === 0" (click)="saveConfig()">
                  Salvar e Ir para Análises
                  <mat-icon>assessment</mat-icon>
                </button>
              </div>
            }

            @if (isLoadingColumns()) {
              <div class="loading-state">
                <p>Atualizando colunas...</p>
                <mat-progress-bar mode="query"></mat-progress-bar>
              </div>
            } @else if (selectedFilesCount() > 0 && columns().length === 0) {
              <div class="empty-state">
                <mat-icon color="warn">warning</mat-icon>
                <p>Nenhuma coluna comum encontrada entre os arquivos selecionados.</p>
                <p class="hint">Certifique-se de que os arquivos possuem a mesma estrutura.</p>
              </div>
            } @else if (selectedFilesCount() === 0) {
              <div class="empty-state">
                <mat-icon>file_open</mat-icon>
                <p>Nenhum arquivo selecionado.</p>
              </div>
            } @else {
              <table mat-table [dataSource]="columns()" class="full-width-table">
                
                <!-- Checkbox Column -->
                <ng-container matColumnDef="select">
                  <th mat-header-cell *matHeaderCellDef>
                    <mat-checkbox (change)="$event ? toggleAll() : null"
                                  [checked]="isAllSelected()">
                    </mat-checkbox>
                  </th>
                  <td mat-cell *matCellDef="let row">
                    <mat-checkbox (change)="$event ? toggleRow(row) : null"
                                  [checked]="row.included">
                    </mat-checkbox>
                  </td>
                </ng-container>

                <!-- Column Name -->
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Nome da Variável</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="var-name-cell">
                      <span class="var-name">{{ row.name }}</span>
                      @if (row.description) {
                        <span class="var-description">{{ row.description }}</span>
                      }
                    </div>
                  </td>
                </ng-container>

                <!-- Data Type -->
                <ng-container matColumnDef="type">
                  <th mat-header-cell *matHeaderCellDef>Tipo Sugerido</th>
                  <td mat-cell *matCellDef="let row">
                    <span class="type-badge" [class.number]="row.type === 'Número'">
                      {{ row.type }}
                    </span>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;" 
                    [class.row-excluded]="!row.included"></tr>
              </table>
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
    .left-panel { display: flex; flex-direction: column; gap: 24px; }

    .full-width { width: 100%; }
    .dictionary-card { margin-top: 0; }

    .file-list { 
      max-height: 400px; 
      overflow-y: auto; 
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .file-list-actions {
      padding: 8px;
      border-bottom: 1px solid #eee;
      margin-bottom: 8px;
    }
    .file-item { 
      display: flex; 
      align-items: center; 
      gap: 4px; 
      padding: 4px 8px; 
      background: #f9f9f9; 
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .file-item mat-icon { font-size: 18px; width: 18px; height: 18px; color: #777; }
    .file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .format-badge { color: #3f51b5; }
    .empty-files { font-size: 0.85rem; color: #999; font-style: italic; text-align: center; margin-top: 16px; }

    .header-info { 
      display: flex; 
      align-items: center; 
      gap: 6px; 
      margin-top: 8px; 
      color: #666; 
      font-size: 0.8rem;
      background: #f5f5f5;
      padding: 4px 12px;
      border-radius: 4px;
      width: fit-content;
    }
    .header-info mat-icon { font-size: 16px; width: 16px; height: 16px; color: #3f51b5; }

    .table-actions-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #f8f9fa;
      border-bottom: 1px solid #eee;
      margin-bottom: 8px;
    }

    .var-name-cell { display: flex; flex-direction: column; gap: 2px; padding: 4px 0; }
    .var-name { font-weight: 500; color: #333; }
    .var-description { font-size: 0.75rem; color: #666; font-style: italic; }

    .full-width-table { width: 100%; margin-top: 16px; }
    
    .loading-state, .empty-state { text-align: center; padding: 40px; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 16px; }
    .hint { font-size: 0.85rem; color: #777; }

    .type-badge {
      font-size: 0.75rem;
      padding: 2px 8px;
      background: #f0f0f0;
      border-radius: 4px;
      color: #666;
    }
    .type-badge.number { background: #e3f2fd; color: #1976d2; }

    .row-excluded { opacity: 0.5; }

    .selection-info { font-size: 0.9rem; color: #666; font-style: italic; }

    @media (max-width: 900px) {
      .content-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class VariableConfigView implements OnInit {
  private router = inject(Router);
  private stateService = inject(DatasetStateService);
  private snackBar = inject(MatSnackBar);
  
  groupName = signal<string | null>(this.stateService.getSelectedGroup());
  columns = signal<ColumnInfo[]>([]);
  files = signal<FileInfo[]>([]);
  excelFiles = signal<string[]>([]);
  format = signal<string>('');
  
  selectedDictionary: string | null = null;
  dictionaryEntries: DictionaryEntry[] = [];

  isLoadingFiles = signal(false);
  isLoadingColumns = signal(false);
  isLoadingDictionary = signal(false);
  
  displayedColumns = ['select', 'name', 'type'];

  ngOnInit() {
    this.initialLoad();
    this.loadExcelFiles();
  }

  async initialLoad() {
    const name = this.groupName();
    if (!name) return;

    this.isLoadingFiles.set(true);
    this.isLoadingColumns.set(true);
    try {
      const result = await invoke<any>('analyze_group', { groupName: name });
      this.format.set(result.format);
      this.files.set(result.files.map((f: string) => ({ name: f, selected: true })));
      // Set included: false by default as requested
      this.columns.set(result.common_columns.map((c: any) => ({ ...c, included: false })));
    } catch (err) {
      console.error('Falha ao carregar grupo:', err);
    } finally {
      this.isLoadingFiles.set(false);
      this.isLoadingColumns.set(false);
    }
  }

  async loadExcelFiles() {
    const name = this.groupName();
    if (!name) return;
    try {
      const files = await invoke<string[]>('get_excel_files', { groupName: name });
      this.excelFiles.set(files);
    } catch (err) {
      console.error('Erro ao buscar arquivos Excel:', err);
    }
  }

  async onDictionaryChange() {
    const name = this.groupName();
    if (!name) return;

    if (!this.selectedDictionary) {
      this.dictionaryEntries = [];
      this.resetToHeuristicTypes();
      return;
    }

    this.isLoadingDictionary.set(true);
    try {
      this.dictionaryEntries = await invoke<DictionaryEntry[]>('parse_dictionary', { 
        groupName: name, 
        fileName: this.selectedDictionary 
      });
      this.applyDescriptionsAndTypes();
    } catch (err) {
      console.error('Erro ao carregar dicionário:', err);
    } finally {
      this.isLoadingDictionary.set(false);
    }
  }

  applyDescriptionsAndTypes() {
    this.columns.update(cols => cols.map(col => {
      const entry = this.dictionaryEntries.find(e => 
        e.name.toLowerCase().trim() === col.name.toLowerCase().trim()
      );
      return {
        ...col,
        description: entry ? entry.description : col.description,
        type: entry ? entry.var_type : col.type
      };
    }));
  }

  async resetToHeuristicTypes() {
    // Re-run heuristic analysis for types if dictionary is removed
    const selectedFiles = this.files().filter(f => f.selected).map(f => f.name);
    if (selectedFiles.length > 0) {
      await this.updateColumns();
    }
  }

  async updateColumns() {
    const name = this.groupName();
    const selectedFiles = this.files().filter(f => f.selected).map(f => f.name);
    
    if (!name || selectedFiles.length === 0) {
      this.columns.set([]);
      return;
    }

    this.isLoadingColumns.set(true);
    try {
      const detected = await invoke<ColumnInfo[]>('get_columns_for_files', { 
        groupName: name, 
        files: selectedFiles 
      });
      
      const currentCols = this.columns();
      const updatedCols = detected.map(c => {
        const prev = currentCols.find(p => p.name === c.name);
        // Find dictionary match
        const dictEntry = this.dictionaryEntries.find(e => 
          e.name.toLowerCase().trim() === c.name.toLowerCase().trim()
        );

        return {
          ...c,
          included: prev?.included ?? false,
          description: dictEntry ? dictEntry.description : prev?.description,
          type: dictEntry ? dictEntry.var_type : c.type
        };
      });

      this.columns.set(updatedCols);
    } catch (err) {
      console.error('Erro ao atualizar colunas:', err);
    } finally {
      this.isLoadingColumns.set(false);
    }
  }

  toggleFile(file: FileInfo, selected: boolean) {
    this.files.update(fs => fs.map(f => f.name === file.name ? { ...f, selected } : f));
    this.updateColumns();
  }

  toggleAllFiles(selected: boolean) {
    this.files.update(fs => fs.map(f => ({ ...f, selected })));
    this.updateColumns();
  }

  isAllFilesSelected() {
    return this.files().length > 0 && this.files().every(f => f.selected);
  }

  isSomeFilesSelected() {
    return this.files().some(f => f.selected) && !this.isAllFilesSelected();
  }

  selectedFilesCount() {
    return this.files().filter(f => f.selected).length;
  }

  isAllSelected() {
    return this.columns().length > 0 && this.columns().every(c => c.included);
  }

  toggleAll() {
    if (!this.selectedDictionary && this.columns().length > 0) {
      this.snackBar.open('Por favor, selecione primeiro um Dicionário de Dados para definir os tipos das variáveis.', 'OK', { duration: 5000 });
      return;
    }
    const target = !this.isAllSelected();
    this.columns.update(cols => cols.map(c => ({ ...c, included: target })));
  }

  toggleRow(row: ColumnInfo) {
    if (!this.selectedDictionary && !row.included) {
      this.snackBar.open('Por favor, selecione primeiro um Dicionário de Dados para definir os tipos das variáveis.', 'OK', { duration: 5000 });
      return;
    }
    this.columns.update(cols => cols.map(c => 
      c.name === row.name ? { ...c, included: !c.included } : c
    ));
  }

  selectedCount() {
    return this.columns().filter(c => c.included).length;
  }

  saveConfig() {
    const config = {
      groupName: this.groupName() || 'unknown',
      files: this.files().filter(f => f.selected).map(f => f.name),
      dictionary: this.selectedDictionary,
      variables: this.columns().filter(c => c.included).map(v => ({
        name: v.name,
        type: v.type,
        description: v.description
      }))
    };
    
    console.log('Configuração salva:', config);
    this.stateService.setAnalysisConfig(config);
    this.router.navigate(['/desktop/analysis/descritiva']);
  }

  goBack() {
    this.router.navigate(['/desktop/analysis/select']);
  }
}
