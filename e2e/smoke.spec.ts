import { test, expect } from '@playwright/test';

/**
 * Broad smoke tests over the running viewer: the landing page renders, the
 * self-tour is reachable, and stepping a tour drives the code surface.
 */

test('landing page shows the project and its tours', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.brand')).toContainText('code');
  // The repository tours itself; at least one tour card must be present.
  await expect(page.getByRole('link', { name: /run|start|tour/i }).first()).toBeVisible();
});

test('the file tree toggles from the activity bar', async ({ page }) => {
  await page.goto('/');
  const treeToggle = page.getByRole('button', { name: 'Toggle file tree' });

  // Closed by default: no tree pane.
  await expect(page.locator('.pane.tree')).toHaveCount(0);

  await treeToggle.click();
  await expect(page.locator('.pane.tree')).toBeVisible();
  await expect(treeToggle).toHaveAttribute('aria-pressed', 'true');

  await treeToggle.click();
  await expect(page.locator('.pane.tree')).toHaveCount(0);
});

test('running the pipeline tour opens a file in the code pane', async ({ page }) => {
  await page.goto('/#/tour/pipeline/run');

  // The tour's first step auto-opens a source file.
  await expect(page.locator('.pane.code')).toBeVisible();
  await expect(page.locator('.cv-code')).toBeVisible();
  await expect(page.locator('.tabs .tab').first()).toBeVisible();

  // Stepping forward keeps a file open (may switch tabs).
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.cv-code')).toBeVisible();
});
