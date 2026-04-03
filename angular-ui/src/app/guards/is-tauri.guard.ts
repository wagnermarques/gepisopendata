import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ConfigService } from '../services/config.service';
import { TauriConfigService } from '../services/tauri-config.service';

export const isTauriGuard: CanActivateFn = (route, state) => {
  const configService = inject(ConfigService);
  const router = inject(Router);

  if (configService instanceof TauriConfigService) {
    return true;
  }

  console.warn('Access denied: This view is only available in the Desktop (Tauri) version.');
  router.navigate(['/']);
  return false;
};
