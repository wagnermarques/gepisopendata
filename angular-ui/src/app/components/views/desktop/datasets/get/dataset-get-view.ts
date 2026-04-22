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
import { invoke } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';
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
  ],
  template: `
    <div class="container">
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Obter Conjunto de Dados</mat-card-title>
          <mat-card-subtitle>Cadastre os metadados e realize o download dos arquivos</mat-card-subtitle>
        </mat-card-header>
        
        <mat-card-content>
          <form [formGroup]="datasetForm" (ngSubmit)="downloadDataset()" class="form-container">
            
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

            <div class="section-title">Download</div>
            <div class="row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>URLs para Download (uma por linha)</mat-label>
                <textarea matInput formControlName="urls" rows="3" placeholder="https://exemplo.gov.br/dados.zip"></textarea>
                <mat-error *ngIf="datasetForm.get('urls')?.hasError('required')">Pelo menos uma URL é obrigatória</mat-error>
              </mat-form-field>
            </div>

            <div class="row multi-col">
              <mat-form-field appearance="outline">
                <mat-label>Autor/Responsável</mat-label>
                <input matInput formControlName="autor">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Tags (separadas por vírgula)</mat-label>
                <input matInput formControlName="tags" placeholder="Ex: educação, censo, brasil">
              </mat-form-field>
            </div>

            @if (isDownloading()) {
              <div class="progress-section">
                <p>Processando via Rust (Download, Extração e Metadados)... por favor aguarde.</p>
                <mat-progress-bar mode="indeterminate"></mat-progress-bar>
              </div>
            }

            <div class="actions">
              <button mat-raised-button color="primary" type="submit" [disabled]="datasetForm.invalid || isDownloading()">
                <mat-icon>cloud_download</mat-icon> Registrar e Baixar
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
  `]
})
export class DatasetGetView implements OnInit {
  private fb = inject(FormBuilder);
  isDownloading = signal(false);
  
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
    urls: ['', [Validators.required]],
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

  async downloadDataset() {
    if (this.datasetForm.invalid) return;

    const { urls, tituloCurto } = this.datasetForm.value;
    const urlList = urls!.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    
    if (urlList.length === 0) {
      await message('Por favor, insira pelo menos uma URL válida.', { title: 'Erro', kind: 'error' });
      return;
    }

    this.isDownloading.set(true);

    try {
      for (const url of urlList) {
        await invoke('download_dataset', { 
          url, 
          metadata: this.datasetForm.value 
        });
      }

      await message(`Conjunto de dados "${tituloCurto}" registrado, baixado e processado com sucesso!`, {
        title: 'Sucesso',
        kind: 'info',
      });
      
      // Refresh registry and groups
      await this.loadRegistry();

      this.datasetForm.reset({
        frequencia: 'Anual',
        isSerieHistorica: false,
        grupo: '',
        formato: 'csv'
      });

    } catch (err) {
      console.error('Download/Registry error:', err);
      await message(`Erro no processamento: ${err}`, {
        title: 'Erro',
        kind: 'error',
      });
    } finally {
      this.isDownloading.set(false);
    }
  }
}
