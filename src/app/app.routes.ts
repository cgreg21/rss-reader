import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/articles/articles.page').then((m) => m.ArticlesPage) },
  { path: 'article/:id', loadComponent: () => import('./pages/article/article.page').then((m) => m.ArticlePage) },
  { path: 'feeds', loadComponent: () => import('./pages/options/options.page').then((m) => m.OptionsPage) },
  { path: 'about', loadComponent: () => import('./pages/about/about.page').then((m) => m.AboutPage) },
  { path: '**', redirectTo: '' },
];
