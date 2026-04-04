import { Routes } from '@angular/router';
import { ViewHome } from './components/views/web/view-home/view-home';
import { ViewAbout } from './components/views/web/view-about/view-about';
import { DesktopHomeView } from './components/views/desktop/desktop-home-view/desktop-home-view';
import { isTauriGuard } from './guards/is-tauri.guard';

export const routes: Routes = [
  {
    path: '',
    component: ViewHome,
  },
  {
    path: 'about',
    component: ViewAbout,
  },
  {
    path: 'desktop',
    canActivate: [isTauriGuard],
    children: [
      {
        path: '',
        component: DesktopHomeView,
      },
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
