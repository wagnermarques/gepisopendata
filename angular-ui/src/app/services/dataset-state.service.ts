import { Injectable, signal } from '@angular/core';

export interface AnalysisConfig {
  groupName: string;
  files: string[];
  dictionary?: string | null;
  variables: {
    name: string;
    type: string;
    description?: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class DatasetStateService {
  selectedGroup = signal<string | null>(localStorage.getItem('selectedGroup'));
  analysisConfig = signal<AnalysisConfig | null>(this.loadAnalysisConfig());

  setSelectedGroup(name: string) {
    this.selectedGroup.set(name);
    localStorage.setItem('selectedGroup', name);
  }

  getSelectedGroup(): string | null {
    return this.selectedGroup();
  }

  setAnalysisConfig(config: AnalysisConfig) {
    this.analysisConfig.set(config);
    localStorage.setItem('analysisConfig', JSON.stringify(config));
  }

  getAnalysisConfig(): AnalysisConfig | null {
    return this.analysisConfig();
  }

  private loadAnalysisConfig(): AnalysisConfig | null {
    const saved = localStorage.getItem('analysisConfig');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}
