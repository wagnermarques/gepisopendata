import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-view-about',
  template: `
    <div class="about-container">
      <mat-card class="about-card">
        <mat-card-header>
          <mat-icon mat-card-avatar color="primary">info</mat-icon>
          <mat-card-title>Sobre o Gepis Dados Abertos</mat-card-title>
          <mat-card-subtitle>Versão 0.1.0</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>
            Gepis Dados Abertos é uma iniciativa do grupo de pesquisa <strong>Gepis</strong> para promover 
            a utilização de dados abertos.
          </p>
          <p>
            Este projeto visa facilitar o acesso, visualização e análise de conjuntos de dados públicos, 
            contribuindo para a transparência e a pesquisa acadêmica.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .about-container {
      padding: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 150px);
    }
    .about-card {
      max-width: 500px;
      width: 100%;
    }
    mat-card-content p {
      line-height: 1.6;
      margin-top: 16px;
    }
  `],
  imports: [MatIconModule, MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewAbout {}
