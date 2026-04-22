import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ConfigService } from '../services/config.service';
import { TauriConfigService } from '../services/tauri-config.service';
import { isTauri } from '../services/environment';

export const isTauriGuard: CanActivateFn = (route, state) => {
  const configService = inject(ConfigService);
  const router = inject(Router);
  
  const isTauriEnv = isTauri();
  const isTauriService = configService instanceof TauriConfigService;
  
  console.log('isTauriGuard check:', { isTauriEnv, isTauriService });

  if (isTauriEnv || isTauriService) {
    return true;
  }

  console.warn('Access denied: This view is only available in the Desktop (Tauri) version.');
  router.navigate(['/']);
  return false;
};
