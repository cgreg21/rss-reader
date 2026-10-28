import { isDevMode, provideZonelessChangeDetection } from '@angular/core';
import { LocationStrategy } from '@angular/common';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app/app.routes';
import { ReplaceLocationStrategy } from './app/pwa/replace-location-strategy';
import { RootComponent } from './app/root/root.component';

bootstrapApplication(RootComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: LocationStrategy, useClass: ReplaceLocationStrategy },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
}).catch((error: unknown) => console.error(error));
