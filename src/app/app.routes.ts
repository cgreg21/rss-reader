import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/articles.page').then((m) => m.ArticlesPage) },
  { path: 'article/:id', loadComponent: () => import('./pages/article.page').then((m) => m.ArticlePage) },
  { path: 'feeds', loadComponent: () => import('./pages/feeds.page').then((m) => m.FeedsPage) },
  { path: 'about', loadComponent: () => import('./pages/about.page').then((m) => m.AboutPage) },
  { path: '**', redirectTo: '' },
];
