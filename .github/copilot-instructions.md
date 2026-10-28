# Conventions

- Angular component templates must live in a separate `.html` file next to the component (`templateUrl: './name.component.html'`). Never use inline `template:` strings.
- Each component or page lives in its own subfolder named after it (e.g. `ui/radial-menu/radial-menu.component.ts` + `.html`).
- Services and directives live in `services/` and `directives/` subfolders of their feature folder (e.g. `ui/services/snackbar.service.ts`).
