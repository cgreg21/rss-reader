// Specs assert French texts: the browser language is pinned to French unless a spec picks another one.
Object.defineProperty(navigator, 'languages', { value: ['fr-FR', 'fr'], configurable: true });
Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true });
