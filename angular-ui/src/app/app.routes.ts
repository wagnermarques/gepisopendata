import { Routes } from '@angular/router';
import { ViewHome } from './components/views/view-home/view-home';
import { ViewConfig } from './components/views/view-config/view-config';
import { ViewBase }   from './components/views/view-base/view-base';

import { DesktopHomeView } from './components/views/desktop-home-view/desktop-home-view';
import { AppsHomeView } from './components/views/apps-home-view/apps-home-view';
import { isTauriGuard } from './guards/is-tauri.guard';

export const routes: Routes = [
  {
    path: '',
    component: ViewHome,
  },
  {
    path: 'baseview',
    component: ViewBase,
  },
  {
    path: 'configs',
    component: ViewConfig,
  },
  {
    path: 'appshomevew',
    component: AppsHomeView,
  },
  {
    path: 'desktophomeview',
    component: DesktopHomeView,
  },
  {
    path: 'desktop',
    canActivate: [isTauriGuard],
    children: [
      {
        path: 'datasets/get',
        loadComponent: () =>
          import('./components/views/desktop/datasets/get/dataset-get-view').then(
            (m) => m.DatasetGetView
          ),
      },
    ],
  },
];
