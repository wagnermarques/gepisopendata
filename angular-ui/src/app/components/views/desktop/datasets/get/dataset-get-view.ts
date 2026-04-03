import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { fetch } from '@tauri-apps/plugin-http';
import { BaseDirectory, writeFile } from '@tauri-apps/plugin-fs';
import { message } from '@tauri-apps/plugin-dialog';

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
  ],
  template: `
    <div class="container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Obter Conjunto de Dados (INEP)</mat-card-title>
          <mat-card-subtitle>Configure os metadados e baixe os microdados do Censo Escolar</mat-card-subtitle>
        </mat-card-header>
        
        <mat-card-content>
          <form [formGroup]="datasetForm" (ngSubmit)="downloadDataset()" class="form-container">
            <div class="row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Título</mat-label>
                <input matInput formControlName="titulo" placeholder="Ex: Microdados do Censo Escolar 2023">
              </mat-form-field>
            </div>

            <div class="row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Descrição</mat-label>
                <textarea matInput formControlName="descricao" rows="3"></textarea>
              </mat-form-field>
            </div>

            <div class="row multi-col">
              <mat-form-field appearance="outline">
                <mat-label>Ano de Referência</mat-label>
                <input matInput formControlName="ano" type="number">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Frequência de Atualização</mat-label>
                <mat-select formControlName="frequencia">
                  <mat-option value="Anual">Anual</mat-option>
                  <mat-option value="Mensal">Mensal</mat-option>
                  <mat-option value="Irregular">Irregular</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>URL de Download (ZIP)</mat-label>
                <input matInput formControlName="url" placeholder="https://download.inep.gov.br/...">
              </mat-form-field>
            </div>

            <div class="row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Licença</mat-label>
                <input matInput formControlName="licenca">
              </mat-form-field>
            </div>

            @if (isDownloading()) {
              <div class="progress-section">
                <p>Baixando dados... por favor aguarde.</p>
                <mat-progress-bar mode="indeterminate"></mat-progress-bar>
              </div>
            }

            <div class="actions">
              <button mat-raised-button color="primary" type="submit" [disabled]="datasetForm.invalid || isDownloading()">
                <mat-icon>download</mat-icon> Baixar e Salvar Metadados
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .container { padding: 20px; max-width: 800px; margin: 0 auto; }
    .form-container { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
    .full-width { width: 100%; }
    .multi-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .actions { display: flex; justify-content: flex-end; margin-top: 20px; }
    .progress-section { margin: 20px 0; }
  `]
})
export class DatasetGetView {
  private fb = inject(FormBuilder);
  isDownloading = signal(false);

  datasetForm = this.fb.group({
    titulo: ['Microdados do Censo Escolar 2023', Validators.required],
    descricao: ['Dados detalhados sobre estabelecimentos de ensino, turmas, alunos e profissionais escolares.', Validators.required],
    ano: [2023, [Validators.required, Validators.min(1900)]],
    frequencia: ['Anual', Validators.required],
    url: ['https://download.inep.gov.br/microdados/microdados_censo_escolar_2023.zip', [Validators.required, Validators.pattern('https?://.*')]],
    licenca: ['Open Data Commons Open Database License (ODbL)', Validators.required],
    autor: ['INEP - Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira'],
    tags: ['Censo Escolar, Educação Básica, Microdados'],
  });

  async downloadDataset() {
    if (this.datasetForm.invalid) return;

    const { url, titulo } = this.datasetForm.value;
    this.isDownloading.set(true);

    try {
      // 1. Download the file using Tauri v2 HTTP plugin
      // In v2, fetch works more like the standard web fetch but with extra capabilities
      const response = await fetch(url!, {
        method: 'GET',
      });

      if (!response.ok) throw new Error('Falha no download');

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const fileName = url!.split('/').pop() || 'dataset.zip';

      // 2. Save file to app data directory
      await writeFile(fileName, data, { baseDir: BaseDirectory.AppData });

      // 3. Save metadata as JSON
      const metadata = this.datasetForm.value;
      const metadataFileName = `${fileName}.metadata.json`;
      await writeFile(
        metadataFileName, 
        new TextEncoder().encode(JSON.stringify(metadata, null, 2)), 
        { baseDir: BaseDirectory.AppData }
      );

      await message(`Conjunto de dados "${titulo}" baixado com sucesso em AppData!`, {
        title: 'Sucesso',
        kind: 'info',
      });
      
    } catch (err) {
      console.error(err);
      await message(`Erro ao baixar conjunto de dados: ${err}`, {
        title: 'Erro',
        kind: 'error',
      });
    } finally {
      this.isDownloading.set(false);
    }
  }
}
