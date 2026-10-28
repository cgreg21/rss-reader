import { registerLocaleData } from '@angular/common';
import localeAr from '@angular/common/locales/ar';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import localeEs from '@angular/common/locales/es';
import localeFr from '@angular/common/locales/fr';
import localeJa from '@angular/common/locales/ja';

[localeAr, localeDe, localeEn, localeEs, localeFr, localeJa].forEach((data) => registerLocaleData(data));
