import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { invoke } from '@tauri-apps/api/core';
import { message, open } from '@tauri-apps/plugin-dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs/operators';

@Component({
  selector: 'app-dataset-get-view',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatDividerModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatButtonToggleModule,
  ],
  template: `
    <div class="container">
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Obter Conjunto de Dados</mat-card-title>
          <mat-card-subtitle>Cadastre os metadados e realize o download dos arquivos</mat-card-subtitle>
        </mat-card-header>
        
        <mat-card-content>
          <div class="mode-selector">
            <mat-button-toggle-group [value]="sourceMode()" (change)="sourceMode.set($event.value)" aria-label="Fonte dos Dados">
              <mat-button-toggle value="url">
                <mat-icon>cloud_download</mat-icon> Baixar da Web (URL)
              </mat-button-toggle>
              <mat-button-toggle value="local">
                <mat-icon>folder_open</mat-icon> Importar Local
              </mat-button-toggle>
            </mat-button-toggle-group>
          </div>

          <form [formGroup]="datasetForm" (ngSubmit)="submitDataset()" class="form-container">
            
            <div class="section-title">Agrupamento e Série</div>
            <div class="row multi-col">
              <mat-form-field appearance="outline">
                <mat-label>Grupo / Coleção</mat-label>
                <input type="text"
                       placeholder="Ex: Censo Escolar, Comércio Exterior"
                       aria-label="Grupo"
                       matInput
                       formControlName="grupo"
                       [matAutocomplete]="auto">
                <mat-autocomplete #auto="matAutocomplete">
                  @for (option of filteredGroups(); track option) {
                    <mat-option [value]="option">{{option}}</mat-option>
                  }
                </mat-autocomplete>
                <mat-hint>Nome para agrupar múltiplos arquivos relacionados</mat-hint>
              </mat-form-field>

              <div class="checkbox-container">
                <mat-checkbox formControlName="isSerieHistorica">Este dado faz parte de uma série histórica?</mat-checkbox>
              </div>
            </div>

            @if (datasetsInSelectedGroup().length > 0) {
              <div class="existing-datasets">
                <div class="small-label">Datasets já existentes neste grupo:</div>
                <mat-chip-set>
                  @for (dataset of datasetsInSelectedGroup(); track dataset) {
                    <mat-chip>{{ dataset }}</mat-chip>
                  }
                </mat-chip-set>
              </div>
            }

            <mat-divider style="margin: 16px 0;"></mat-divider>

            <div class="section-title">Informações Básicas</div>
            <div class="row multi-col">
              <mat-form-field appearance="outline">
                <mat-label>Título Curto</mat-label>
                <input matInput formControlName="tituloCurto" placeholder="Ex: Censo Escolar 2023">
                <mat-error *ngIf="datasetForm.get('tituloCurto')?.hasError('required')">O título curto é obrigatório</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Formato Esperado</mat-label>
                <mat-select formControlName="formato">
                  <mat-option value="csv">CSV</mat-option>
                  <mat-option value="parquet">Parquet</mat-option>
                  <mat-option value="json">JSON</mat-option>
                  <mat-option value="xlsx">Excel (.xlsx)</mat-option>
                  <mat-option value="zip">Arquivo Comprimido (.zip)</mat-option>
                  <mat-option value="outro">Outro</mat-option>
                </mat-select>
                <mat-hint>Se for ZIP, tentaremos extrair este formato</mat-hint>
              </mat-form-field>
            </div>

            <div class="row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Título Longo</mat-label>
                <input matInput formControlName="tituloLongo" placeholder="Ex: Microdados do Censo Escolar da Educação Básica 2023">
                <mat-error *ngIf="datasetForm.get('tituloLongo')?.hasError('required')">O título longo é obrigatório</mat-error>
              </mat-form-field>
            </div>

            <div class="row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Descrição</mat-label>
                <textarea matInput formControlName="descricao" rows="3" placeholder="Breve descrição do conjunto de dados"></textarea>
              </mat-form-field>
            </div>

            <div class="row multi-col">
              <mat-form-field appearance="outline">
                <mat-label>Órgão Emissor</mat-label>
                <input matInput formControlName="orgaoEmissao" placeholder="Ex: INEP">
                <mat-error *ngIf="datasetForm.get('orgaoEmissao')?.hasError('required')">O órgão emissor é obrigatório</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Data de Referência</mat-label>
                <input matInput formControlName="dataReferencia" placeholder="Ex: 2023 ou 01/2023">
                <mat-error *ngIf="datasetForm.get('dataReferencia')?.hasError('required')">A data de referência é obrigatória</mat-error>
              </mat-form-field>
            </div>

            <div class="row multi-col">
              <mat-form-field appearance="outline">
                <mat-label>Frequência de Atualização</mat-label>
                <mat-select formControlName="frequencia">
                  <mat-option value="Anual">Anual</mat-option>
                  <mat-option value="Mensal">Mensal</mat-option>
                  <mat-option value="Diário">Diário</mat-option>
                  <mat-option value="Irregular">Irregular</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Licença</mat-label>
                <input matInput formControlName="licenca" placeholder="Ex: ODbL, CC-BY">
              </mat-form-field>
            </div>

            @if (sourceMode() === 'url') {
              <div class="section-title">Download</div>
              <div class="row">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>URLs para Download (uma por linha)</mat-label>
                  <textarea matInput formControlName="urls" rows="3" placeholder="https://exemplo.gov.br/dados.zip"></textarea>
                  <mat-error *ngIf="datasetForm.get('urls')?.hasError('required')">Pelo menos uma URL é obrigatória</mat-error>
                </mat-form-field>
              </div>
            } @else {
              <div class="section-title">Arquivos Locais</div>
              <div class="local-files-container">
                <button type="button" mat-stroked-button color="accent" (click)="selectLocalFiles()">
                  <mat-icon>add_box</mat-icon> Selecionar Arquivos Desktop
                </button>
                
                @if (selectedLocalFiles().length > 0) {
                  <div class="selected-files-list">
                    <p><strong>Arquivos selecionados:</strong></p>
                    <ul>
                      @for (file of selectedLocalFiles(); track file) {
                        <li>{{ file.split('/').pop() }} <span class="path-hint">({{ file }})</span></li>
                      }
                    </ul>
                  </div>
                } @else {
                  <p class="no-files-hint">Nenhum arquivo selecionado.</p>
                }
              </div>
            }

            <div class="row multi-col" style="margin-top: 16px;">
              <mat-form-field appearance="outline">
                <mat-label>Autor/Responsável</mat-label>
                <input matInput formControlName="autor">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Tags (separadas por vírgula)</mat-label>
                <input matInput formControlName="tags" placeholder="Ex: educação, censo, brasil">
              </mat-form-field>
            </div>

            @if (isProcessing()) {
              <div class="progress-section">
                <p>Processando via Rust (Cópia/Download, Extração e Metadados)... por favor aguarde.</p>
                <mat-progress-bar mode="indeterminate"></mat-progress-bar>
              </div>
            }

            <div class="actions">
              <button mat-raised-button color="primary" type="submit" [disabled]="isSubmitDisabled()">
                <mat-icon>{{ sourceMode() === 'url' ? 'cloud_download' : 'save_alt' }}</mat-icon> 
                {{ sourceMode() === 'url' ? 'Registrar e Baixar' : 'Registrar e Importar' }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .container { padding: 20px; max-width: 900px; margin: 0 auto; }
    .form-container { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
    .full-width { width: 100%; }
    .multi-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: center; }
    .actions { display: flex; justify-content: flex-end; margin-top: 20px; }
    .progress-section { margin: 20px 0; }
    .section-title { font-size: 0.9rem; font-weight: 500; color: #666; margin: 10px 0 5px 0; text-transform: uppercase; letter-spacing: 1px; }
    .checkbox-container { padding-bottom: 20px; }
    .existing-datasets { margin: 8px 0; padding: 8px; background: #f5f5f5; border-radius: 4px; }
    .small-label { font-size: 0.75rem; color: #777; margin-bottom: 4px; }
    mat-card-title { font-weight: bold; color: #3f51b5; }
    .mode-selector { margin-bottom: 10px; display: flex; justify-content: center; }
    .local-files-container { padding: 10px; border: 1px dashed #ccc; border-radius: 4px; background: #fafafa; }
    .selected-files-list { margin-top: 10px; font-size: 0.9rem; }
    .selected-files-list ul { margin: 5px 0; padding-left: 20px; }
    .path-hint { color: #888; font-size: 0.8rem; }
    .no-files-hint { color: #999; font-size: 0.85rem; margin-top: 10px; font-style: italic; }
  `]
})
export class DatasetGetView implements OnInit {
  private fb = inject(FormBuilder);
  
  sourceMode = signal<'url' | 'local'>('url');
  selectedLocalFiles = signal<string[]>([]);
  isProcessing = signal(false);
  
  // Entire registry data
  registry = signal<any[]>([]);
  
  // Unique groups for autocomplete
  allGroups = signal<string[]>([]);

  datasetForm = this.fb.group({
    grupo: [''],
    isSerieHistorica: [false],
    tituloCurto: ['', Validators.required],
    formato: ['csv', Validators.required],
    tituloLongo: ['', Validators.required],
    descricao: [''],
    orgaoEmissao: ['', Validators.required],
    dataReferencia: ['', Validators.required],
    frequencia: ['Anual'],
    licenca: [''],
    urls: [''], // Required removed from here, handled in submit check
    autor: [''],
    tags: [''],
  });

  // Track current group value
  grupoValue = toSignal(this.datasetForm.get('grupo')!.valueChanges.pipe(startWith('')));

  // Filtered groups for autocomplete
  filteredGroups = computed(() => {
    const filterValue = (this.grupoValue() || '').toLowerCase();
    return this.allGroups().filter(option => option.toLowerCase().includes(filterValue));
  });

  // Datasets belonging to the CURRENTLY TYPED group
  datasetsInSelectedGroup = computed(() => {
    const currentGroup = this.grupoValue();
    if (!currentGroup) return [];
    
    return this.registry()
      .filter(item => item.grupo === currentGroup)
      .map(item => item.tituloCurto);
  });

  ngOnInit() {
    this.loadRegistry();
  }

  async loadRegistry() {
    try {
      const data = await invoke<any[]>('get_registry');
      this.registry.set(data);
      
      const groups = data
        .map(item => item.grupo)
        .filter((value, index, self) => value && self.indexOf(value) === index);
      this.allGroups.set(groups);
    } catch (err) {
      console.warn('Could not load registry', err);
    }
  }

  async selectLocalFiles() {
    const format = this.datasetForm.get('formato')?.value;
    let extensions: string[] = [];
    
    switch(format) {
      case 'csv': extensions = ['csv']; break;
      case 'parquet': extensions = ['parquet']; break;
      case 'json': extensions = ['json']; break;
      case 'xlsx': extensions = ['xlsx', 'xls']; break;
      case 'zip': extensions = ['zip']; break;
      default: extensions = ['*'];
    }

    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Arquivos de Dados',
          extensions: extensions
        }]
      });

      if (selected && Array.isArray(selected)) {
        this.selectedLocalFiles.set(selected);
      } else if (selected && typeof selected === 'string') {
        this.selectedLocalFiles.set([selected]);
      }
    } catch (err) {
      console.error('Error opening file dialog:', err);
    }
  }

  isSubmitDisabled(): boolean {
    if (this.datasetForm.invalid || this.isProcessing()) return true;
    
    if (this.sourceMode() === 'url') {
      const urls = this.datasetForm.get('urls')?.value;
      return !urls || urls.trim().length === 0;
    } else {
      return this.selectedLocalFiles().length === 0;
    }
  }

  async submitDataset() {
    if (this.isSubmitDisabled()) return;

    this.isProcessing.set(true);
    const { tituloCurto } = this.datasetForm.value;

    try {
      if (this.sourceMode() === 'url') {
        const { urls } = this.datasetForm.value;
        const urlList = urls!.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        
        for (const url of urlList) {
          await invoke('download_dataset', { 
            url, 
            metadata: this.datasetForm.value 
          });
        }
      } else {
        await invoke('import_local_dataset', {
          filePaths: this.selectedLocalFiles(),
          metadata: this.datasetForm.value
        });
      }

      const actionText = this.sourceMode() === 'url' ? 'baixado' : 'importado';
      await message(`Conjunto de dados "${tituloCurto}" registrado e ${actionText} com sucesso!`, {
        title: 'Sucesso',
        kind: 'info',
      });
      
      // Refresh registry and groups
      await this.loadRegistry();

      // Reset form and selection
      this.datasetForm.reset({
        frequencia: 'Anual',
        isSerieHistorica: false,
        grupo: '',
        formato: 'csv'
      });
      this.selectedLocalFiles.set([]);

    } catch (err) {
      console.error('Process error:', err);
      await message(`Erro no processamento: ${err}`, {
        title: 'Erro',
        kind: 'error',
      });
    } finally {
      this.isProcessing.set(false);
    }
  }
}
