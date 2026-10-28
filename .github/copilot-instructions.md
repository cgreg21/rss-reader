# Conventions

- Angular component templates must live in a separate `.html` file next to the component (`templateUrl: './name.component.html'`). Never use inline `template:` strings.
- Each component or page lives in its own subfolder named after it (e.g. `ui/radial-menu/radial-menu.component.ts` + `.html`).
- Services and directives live in `services/` and `directives/` subfolders of their feature folder (e.g. `ui/services/snackbar.service.ts`).
- No hard-coded UI text: translations are JSON files `src/app/i18n/{fr,en,es,de,ar}.json` (`fr.json` is the reference; every file must keep the same keys and `{placeholders}`). Use the `translate` pipe in templates and `I18nService.t()` in TS; dates via `localDate` / `I18nService.date()`; errors via `MessageError(key)` + `errorText()`.
- Layout must be RTL-safe: use logical Tailwind utilities (`start/end`, `ms/me`, `ps/pe`, `text-start/end`, `rtl:` variants) and multiply horizontal offsets by `I18nService.sign()`.
