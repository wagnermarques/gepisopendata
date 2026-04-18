import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { invoke } from '@tauri-apps/api/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface GithubConfig {
  username: String;
  token: String;
  owner: String;
  repo: String;
}

@Component({
  selector: 'app-collaboration-settings-view',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule
  ],
  template: `
    <div class="container">
      <div class="header">
        <h1>Configurações de Colaboração</h1>
        <p>Configure sua conta do GitHub para compartilhar datasets e análises com outros usuários.</p>
      </div>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-icon mat-card-avatar color="primary">hub</mat-icon>
          <mat-card-title>Integração com GitHub</mat-card-title>
          <mat-card-subtitle>Trabalhe de forma descentralizada usando seu repositório.</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="configForm" class="settings-form">
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Usuário GitHub</mat-label>
                <input matInput formControlName="username" placeholder="ex: seu-usuario">
                <mat-icon matSuffix>person</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Personal Access Token (PAT)</mat-label>
                <input matInput formControlName="token" [type]="hideToken ? 'password' : 'text'" placeholder="ghp_xxxx">
                <button mat-icon-button matSuffix (click)="hideToken = !hideToken" [attr.aria-label]="'Hide password'" [attr.aria-pressed]="hideToken">
                  <mat-icon>{{hideToken ? 'visibility_off' : 'visibility'}}</mat-icon>
                </button>
                <mat-hint>Requer escopo 'repo'</mat-hint>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Dono do Repositório (Owner)</mat-label>
                <input matInput formControlName="owner" placeholder="ex: gepis">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Nome do Repositório</mat-label>
                <input matInput formControlName="repo" placeholder="ex: gepisopendata">
              </mat-form-field>
            </div>
          </form>

          @if (isTesting()) {
            <div class="test-progress">
              <p>Testando conexão...</p>
              <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            </div>
          }
        </mat-card-content>

        <mat-card-actions align="end">
          <button mat-button color="accent" (click)="testConnection()" [disabled]="configForm.invalid || isTesting() || isSaving()">
            <mat-icon>security</mat-icon> Testar Conexão
          </button>
          <button mat-raised-button color="primary" (click)="saveConfig()" [disabled]="configForm.invalid || isSaving()">
            <mat-icon>save</mat-icon> Salvar Configurações
          </button>
        </mat-card-actions>
      </mat-card>

      <div class="instructions">
        <h3>Como obter um Token?</h3>
        <ol>
          <li>Vá em <strong>Settings</strong> no seu GitHub.</li>
          <li>Clique em <strong>Developer settings</strong> > <strong>Personal access tokens</strong> > <strong>Tokens (classic)</strong>.</li>
          <li>Gere um novo token com o escopo <strong>'repo'</strong> selecionado.</li>
        </ol>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 24px; max-width: 800px; margin: 0 auto; }
    .header { margin-bottom: 24px; }
    .header h1 { margin: 0; color: #3f51b5; }
    
    .settings-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 24px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .test-progress { margin-top: 16px; }

    .instructions {
      margin-top: 32px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
    }

    @media (max-width: 600px) {
      .form-row { grid-template-columns: 1fr; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollaborationSettingsView implements OnInit {
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  configForm = this.fb.group({
    username: ['', Validators.required],
    token: ['', Validators.required],
    owner: ['', Validators.required],
    repo: ['', Validators.required]
  });

  hideToken = true;
  isTesting = signal(false);
  isSaving = signal(false);

  ngOnInit() {
    this.loadConfig();
  }

  async loadConfig() {
    try {
      const config = await invoke<GithubConfig | null>('get_github_config');
      if (config) {
        this.configForm.patchValue(config as any);
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  }

  async testConnection() {
    this.isTesting.set(true);
    const { token, owner, repo } = this.configForm.value;
    try {
      const result = await invoke<string>('test_github_connection', { 
        token, owner, repo 
      });
      this.snackBar.open(result, 'OK', { duration: 5000 });
    } catch (err) {
      this.snackBar.open(`Erro: ${err}`, 'Fechar', { 
        duration: 5000,
        panelClass: ['error-snackbar']
      });
    } finally {
      this.isTesting.set(false);
    }
  }

  async saveConfig() {
    this.isSaving.set(true);
    try {
      await invoke('save_github_config', { config: this.configForm.value });
      this.snackBar.open('Configurações salvas com sucesso!', 'OK', { duration: 3000 });
    } catch (err) {
      this.snackBar.open(`Erro ao salvar: ${err}`, 'Fechar', { duration: 5000 });
    } finally {
      this.isSaving.set(false);
    }
  }
}
