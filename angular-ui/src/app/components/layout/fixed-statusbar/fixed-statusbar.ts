import { Component, signal, inject, OnInit } from '@angular/core';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ConfigService } from '../../../services/config.service';

@Component({
  selector: 'app-fixed-statusbar',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, MatIconModule],
  templateUrl: './fixed-statusbar.html',
  styleUrl: './fixed-statusbar.css',
})
export class FixedStatusbar implements OnInit {
  currentTime = signal(new Date());
  environmentText = signal<string>('');
  
  private configService = inject(ConfigService);

  constructor() {
    setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  ngOnInit(): void {
    this.configService.loadConfig().subscribe(config => {
      const source = config['source'] as string;
      if (source && source.startsWith('tauri')) {
        this.environmentText.set('Running in desktop');
      } else {
        this.environmentText.set('Running on web');
      }
    });
  }
}
