import { expect, test } from '@playwright/test';

test('affiche la liste vide au premier lancement', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Aucun flux.')).toBeVisible();
});

test('la page options est découpée en onglets', async ({ page }) => {
  await page.goto('/feeds');
  await expect(page.locator('header strong')).toHaveText(/Options/);
  await expect(page.getByRole('heading', { name: 'Ajouter un flux' })).toBeVisible();

  await page.getByRole('button', { name: 'Lecture' }).click();
  await expect(page.getByRole('heading', { name: 'Mots masqués' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ajouter un flux' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Synchro' }).click();
  await expect(page.getByRole('heading', { name: 'Synchronisation' })).toBeVisible();

  await page.getByRole('button', { name: 'Système' }).click();
  await expect(page.getByRole('heading', { name: 'Cache des images' })).toBeVisible();
});

test('change le thème depuis les options', async ({ page }) => {
  await page.goto('/feeds');
  await page.getByRole('button', { name: 'Lecture' }).click();
  await page.getByRole('button', { name: 'Clair' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('le bouton retour ramène à la liste', async ({ page }) => {
  await page.goto('/feeds');
  await page.getByRole('link', { name: 'Retour' }).first().click();
  await expect(page).toHaveURL(/\/$/);
});
