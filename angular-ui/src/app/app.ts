import { Component, ViewChild, HostListener, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { invoke } from '@tauri-apps/api/core';
import { FixedHead } from './components/layout/fixed-head/fixed-head';
import { FixedStatusbar } from "./components/layout/fixed-statusbar/fixed-statusbar";

import { MatSidenavModule, MatDrawer } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { ConfigService } from './services/config.service';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [
    RouterOutlet,
    RouterLink,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatDividerModule,
    FixedHead,
    FixedStatusbar,
    JsonPipe,
  ],
})
export class App implements OnInit {
  @ViewChild('drawer') drawer!: MatDrawer;
  isSmallScreen = false;

  configService = inject(ConfigService);
  config = signal<Record<string, unknown> | null>(null);

  constructor() {
    this.checkScreenSize();
  }

  ngOnInit(): void {
    this.configService.loadConfig().subscribe((config) => {
      this.config.set(config);
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  toggleDrawer() {
    this.drawer.toggle();
  }

  checkScreenSize() {
    this.isSmallScreen = window.innerWidth < 768;
  }
}
