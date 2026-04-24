import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { invoke } from '@tauri-apps/api/core';
import { message, ask } from '@tauri-apps/plugin-dialog';
import { DatasetStateService } from '../../../../../services/dataset-state.service';

interface Dataset {
  id: string;
  grupo: string;
  tituloCurto: string;
  tituloLongo: string;
  orgaoEmissao: string;
  dataReferencia: string;
  formato: string;
  files: string[];
  localPath: string;
  dateAdded: string;
  urls: string;
  exists?: boolean;
}

@Component({
  selector: 'app-dataset-list-view',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatSnackBarModule,
    RouterLink,
  ],
  template: `
    <div class="container">
      <div class="header">
        <h1>Conjuntos de Dados Registrados</h1>
        <p>Visualize e gerencie os arquivos baixados e seus metadados.</p>
      </div>

      @if (groupedDatasets().length === 0) {
        <mat-card class="empty-state">
          <mat-card-content>
            <mat-icon>folder_off</mat-icon>
            <p>Nenhum conjunto de dados encontrado.</p>
            <button mat-stroked-button color="primary" routerLink="/desktop/datasets/get">
              Baixar meu primeiro dataset
            </button>
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-accordion multi>
          @for (group of groupedDatasets(); track group.name) {
            <mat-expansion-panel [expanded]="true">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>folder</mat-icon>
                  <strong>Grupo: {{ group.name || 'Sem Grupo' }}</strong>
                </mat-panel-title>
                <mat-panel-description>
                  {{ group.items.length }} dataset(s) nesta coleção
                  <button mat-icon-button color="warn" matTooltip="Excluir todo o grupo" (click)="deleteGroup($event, group.name)">
                    <mat-icon>delete_sweep</mat-icon>
                  </button>
                </mat-panel-description>
              </mat-expansion-panel-header>

              <div class="dataset-grid">
                @for (item of group.items; track item.id) {
                  <mat-card class="dataset-card" [class.missing]="item.exists === false" appearance="outlined">
                    <mat-card-header>
                      <div mat-card-avatar class="format-icon">
                        {{ item.formato | uppercase }}
                      </div>
                      <mat-card-title>
                        {{ item.tituloCurto }}
                        @if (item.exists === false) {
                          <mat-icon color="warn" matTooltip="Arquivos locais não encontrados" class="status-icon">warning</mat-icon>
                        }
                      </mat-card-title>
                      <mat-card-subtitle>{{ item.orgaoEmissao }} - Ref: {{ item.dataReferencia }}</mat-card-subtitle>
                    </mat-card-header>
                    
                    <mat-card-content>
                      <p class="description">{{ item.tituloLongo }}</p>
                      
                      <div class="file-list">
                        <div class="small-label">Arquivos esperados:</div>
                        <mat-chip-set>
                          @for (file of item.files; track file) {
                            <mat-chip class="file-chip" [matTooltip]="file">
                              <mat-icon matChipAvatar>description</mat-icon>
                              {{ file }}
                            </mat-chip>
                          }
                        </mat-chip-set>
                      </div>

                      @if (isRedownloading() === item.id) {
                        <div class="redownload-progress">
                          <p>Baixando novamente...</p>
                          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
                        </div>
                      }

                      @if (isCollaborating() === item.id) {
                        <div class="collaboration-progress">
                          <p>Enviando para GitHub...</p>
                          <mat-progress-bar mode="indeterminate" color="accent"></mat-progress-bar>
                        </div>
                      }
                    </mat-card-content>

                    <mat-card-actions align="end">
                      <button mat-icon-button color="warn" matTooltip="Excluir dataset" (click)="deleteDataset(item)">
                        <mat-icon>delete</mat-icon>
                      </button>
                      <span class="spacer"></span>
                      @if (item.exists !== false) {
                        <button mat-button color="primary" (click)="openFolder(item.localPath)">
                          <mat-icon>folder_open</mat-icon> Abrir Pasta
                        </button>
                      } @else {
                        <button mat-flat-button color="warn" (click)="redownload(item)" [disabled]="isRedownloading() !== null">
                          <mat-icon>download</mat-icon> Baixar Novamente
                        </button>
                      }
                    </mat-card-actions>
                  </mat-card>
                }
              </div>
            </mat-expansion-panel>
          }
        </mat-accordion>
      }
    </div>
  `,
  styles: [`
    .container { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 32px; }
    .header h1 { margin: 0; color: #3f51b5; }
    
    .empty-state { text-align: center; padding: 48px; color: #666; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 16px; }

    mat-expansion-panel { margin-bottom: 16px; }
    mat-panel-title mat-icon { margin-right: 8px; color: #fb8c00; }

    .dataset-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 16px;
      padding: 16px 0;
    }

    .dataset-card {
      height: 100%;
      display: flex;
      flex-direction: column;
      transition: all 0.3s ease;
    }

    .dataset-card.missing {
      border-color: #f44336;
      background-color: #fff9f9;
    }

    .status-icon { vertical-align: middle; font-size: 18px; width: 18px; height: 18px; margin-left: 4px; }

    .format-icon {
      background: #e8eaf6;
      color: #3f51b5;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 0.7rem;
      border-radius: 4px;
    }

    .description {
      font-size: 0.9rem;
      color: #555;
      margin: 12px 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .file-list { margin-top: auto; }
    .small-label { font-size: 0.7rem; color: #888; text-transform: uppercase; margin-bottom: 4px; }
    .file-chip { font-size: 0.75rem; }
    
    .redownload-progress { margin-top: 16px; }
    .redownload-progress p { font-size: 0.8rem; color: #f44336; margin-bottom: 4px; }
    .spacer { flex: 1 1 auto; }
    mat-card-actions { border-top: 1px solid #eee; padding: 8px 16px; display: flex; align-items: center; }
  `]
})
export class DatasetListView implements OnInit {
  private datasetState = inject(DatasetStateService);
  datasets = signal<Dataset[]>([]);
  groupedDatasets = signal<{ name: string, items: Dataset[] }[]>([]);
  isRedownloading = signal<string | null>(null);
  isCollaborating = signal<string | null>(null);

  private snackBar = inject(MatSnackBar);

  ngOnInit() {
    this.loadDatasets();
  }

  async deleteDataset(item: Dataset) {
    const confirmed = await ask(`Tem certeza que deseja excluir o dataset "${item.tituloCurto}"? Todos os arquivos locais serão removidos.`, {
      title: 'Confirmar Exclusão',
      kind: 'warning',
      okLabel: 'Excluir',
      cancelLabel: 'Cancelar'
    });

    if (confirmed) {
      try {
        await invoke('delete_dataset', { id: item.id });
        await message('Dataset excluído com sucesso.', { title: 'Sucesso', kind: 'info' });
        await this.loadDatasets();
      } catch (err) {
        console.error('Error deleting dataset:', err);
        await message(`Falha ao excluir: ${err}`, { title: 'Erro', kind: 'error' });
      }
    }
  }

  async deleteGroup(event: Event, groupName: string) {
    event.stopPropagation();
    const confirmed = await ask(`Tem certeza que deseja excluir TODO o grupo "${groupName}"? Isso removerá todos os datasets e arquivos desta coleção.`, {
      title: 'Confirmar Exclusão de Grupo',
      kind: 'warning',
      okLabel: 'Excluir Tudo',
      cancelLabel: 'Cancelar'
    });

    if (confirmed) {
      try {
        await invoke('delete_group', { groupName });
        await message('Grupo excluído com sucesso.', { title: 'Sucesso', kind: 'info' });
        await this.loadDatasets();
      } catch (err) {
        console.error('Error deleting group:', err);
        await message(`Falha ao excluir grupo: ${err}`, { title: 'Erro', kind: 'error' });
      }
    }
  }

  async loadDatasets() {
    try {
      const data = await invoke<Dataset[]>('get_registry');
      
      // Check file existence for each item
      const datasetsWithStatus = await Promise.all(data.map(async (item) => {
        const pathExists = await invoke<boolean>('check_path_exists', { path: item.localPath });
        return { ...item, exists: pathExists };
      }));

      this.datasets.set(datasetsWithStatus);
      
      // Grouping logic
      const groups = datasetsWithStatus.reduce((acc: any, item) => {
        const groupName = item.grupo || 'Sem Grupo';
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(item);
        return acc;
      }, {});

      const groupArray = Object.keys(groups).map(name => ({
        name,
        items: groups[name]
      }));
      
      this.groupedDatasets.set(groupArray);

      // Limpar o estado do grupo selecionado se ele não existir mais
      const selected = this.datasetState.getSelectedGroup();
      if (selected && !groups[selected]) {
        this.datasetState.clearSelectedGroupIfMatches(selected);
      }
    } catch (err) {
      console.error('Error loading datasets:', err);
    }
  }

  async redownload(item: Dataset) {
    this.isRedownloading.set(item.id);
    try {
      await invoke('download_dataset', { 
        url: item.urls, 
        metadata: item 
      });

      await message(`O conjunto de dados "${item.tituloCurto}" foi baixado novamente com sucesso!`, {
        title: 'Sucesso',
        kind: 'info'
      });

      await this.loadDatasets();
    } catch (err) {
      console.error('Redownload failed:', err);
      await message(`Falha ao baixar novamente: ${err}`, { title: 'Erro', kind: 'error' });
    } finally {
      this.isRedownloading.set(null);
    }
  }

  async openFolder(path: string) {
    try {
      await invoke('plugin:shell|open', { path });
    } catch (err) {
      console.error('Error opening folder:', err);
    }
  }

  async collaborate(item: Dataset) {
    this.isCollaborating.set(item.id);
    try {
      const result = await invoke<string>('push_dataset_to_github', { datasetId: item.id });
      this.snackBar.open(result, 'OK', { duration: 5000 });
    } catch (err) {
      this.snackBar.open(`Erro ao colaborar: ${err}`, 'Fechar', { duration: 8000 });
    } finally {
      this.isCollaborating.set(null);
    }
  }
}
