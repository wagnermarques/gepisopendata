import { Component, inject, viewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { SearchInPageService } from '../../../services/search-in-page.service';

@Component({
  selector: 'app-fixed-search',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  template: `
    @if (searchService.isOpen()) {
      <div class="search-overlay">
        <div class="search-bar">
          <mat-icon class="search-icon">search</mat-icon>
          <input #searchInput
                 [(ngModel)]="searchText" 
                 (keyup.enter)="next()" 
                 (keyup.escape)="close()"
                 (input)="onInput()"
                 placeholder="Localizar na página..." />
          
          <div class="actions">
            <button mat-icon-button (click)="prev()" title="Anterior">
              <mat-icon>expand_less</mat-icon>
            </button>
            <button mat-icon-button (click)="next()" title="Próxima">
              <mat-icon>expand_more</mat-icon>
            </button>
            <button mat-icon-button (click)="close()" title="Fechar">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .search-overlay {
      position: fixed;
      top: 80px; /* Below the main header */
      right: 40px;
      z-index: 1000;
      animation: slideIn 0.2s ease-out;
    }

    .search-bar {
      display: flex;
      align-items: center;
      background: white;
      padding: 4px 8px 4px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      border: 1px solid #e0e0e0;
      gap: 8px;
      min-width: 350px;
    }

    .search-icon { color: #666; }

    input {
      border: none;
      outline: none;
      font-size: 14px;
      flex: 1;
      padding: 8px 0;
    }

    .actions {
      display: flex;
      gap: 2px;
      border-left: 1px solid #eee;
      padding-left: 8px;
    }

    button { color: #555; }

    @keyframes slideIn {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class FixedSearch {
  searchService = inject(SearchInPageService);
  inputElement = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  searchText = '';

  constructor() {
    effect(() => {
      if (this.searchService.isOpen()) {
        setTimeout(() => this.inputElement()?.nativeElement.focus(), 100);
      }
    });
  }

  onInput() {
    if (this.searchText) {
      this.searchService.findNext(this.searchText);
    }
  }

  next() {
    this.searchService.findNext(this.searchText);
  }

  prev() {
    this.searchService.findPrev(this.searchText);
  }

  close() {
    this.searchService.close();
    this.searchText = '';
  }
}
