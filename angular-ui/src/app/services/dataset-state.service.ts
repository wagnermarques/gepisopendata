import { Injectable, signal, computed, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './environment';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface AnalysisArtifact {
  id: string;
  label: string;
  type: 'barchart' | 'table' | 'statistics';
  params: any;
  data?: {
    x: any[];
    y: any[];
  };
  createdAt: string;
}

export interface AnalysisConfig {
  id?: string;
  name: string;
  groupName: string;
  files: string[];
  dictionary?: string | null;
  variables: {
    name: string;
    type: string;
    description?: string;
  }[];
  publishedArtifacts?: AnalysisArtifact[];
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DatasetStateService {
  private http = inject(HttpClient);
  
  selectedGroup = signal<string | null>(localStorage.getItem('selectedGroup'));
  
  // List of all saved analyses
  allAnalyses = signal<AnalysisConfig[]>([]);
  
  // The analysis currently being viewed/edited
  currentAnalysis = signal<AnalysisConfig | null>(null);

  constructor() {
    this.refreshHistory();
  }

  async refreshHistory() {
    try {
      let history: AnalysisConfig[] = [];
      
      if (isTauri()) {
        history = await invoke<AnalysisConfig[]>('get_analyses');
      } else {
        // Fallback for Web/GitHub Pages: Fetch from public assets
        const result = await firstValueFrom(
          this.http.get<AnalysisConfig[]>('data/analyses-history.json').pipe(
            catchError(() => of([]))
          )
        );
        history = result || [];
      }

      this.allAnalyses.set(history.sort((a, b) => 
        new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime()
      ));
      
      // If we don't have a current analysis, set the most recent one as default
      if (!this.currentAnalysis() && history.length > 0) {
        this.currentAnalysis.set(history[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico de análises:', err);
    }
  }

  setSelectedGroup(name: string) {
    this.selectedGroup.set(name);
    localStorage.setItem('selectedGroup', name);
  }

  getSelectedGroup(): string | null {
    return this.selectedGroup();
  }

  async saveAnalysis(config: AnalysisConfig) {
    if (!isTauri()) {
      console.warn('Salvamento de análise não disponível em modo Web.');
      return;
    }

    try {
      await invoke('save_analysis', { config });
      await this.refreshHistory();
      // Update current analysis to the one we just saved
      const saved = this.allAnalyses().find(a => a.name === config.name || a.id === config.id);
      if (saved) this.currentAnalysis.set(saved);
    } catch (err) {
      console.error('Erro ao salvar análise:', err);
    }
  }

  async deleteAnalysis(id: string) {
    if (!isTauri()) return;

    try {
      await invoke('delete_analysis', { id });
      if (this.currentAnalysis()?.id === id) {
        this.currentAnalysis.set(null);
      }
      await this.refreshHistory();
    } catch (err) {
      console.error('Erro ao deletar análise:', err);
    }
  }

  setCurrentAnalysis(analysis: AnalysisConfig) {
    this.currentAnalysis.set(analysis);
  }

  getAnalysisConfig(): AnalysisConfig | null {
    return this.currentAnalysis();
  }
}
