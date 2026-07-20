import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/**
 * Regenerates the README hero screenshot: the CodeSafari viewer mid-tour with
 * the file tree open on the left and a source file open in the code pane.
 *
 * The raw capture lands in `docs/` and is later wrapped in Safari chrome by
 * `scripts/screenshot.mjs` (see `npm run screenshot`). Keeping the capture in
 * its own spec means the whole regeneration pipeline is a single test run.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(__dirname, '../docs/viewer-explorer.png');

test('viewer with file tree open and a file open', async ({ page }) => {
  // The `pipeline` tour steps through real source, so its first step opens a
  // file into the code pane automatically.
  await page.goto('/#/tour/pipeline/run');

  // Wait for the tour to drive a file into the code pane.
  const codePane = page.locator('.pane.code');
  await expect(codePane).toBeVisible();
  await expect(page.locator('.cv-code')).toBeVisible();
  await expect(page.locator('.tabs .tab').first()).toBeVisible();

  // Open the file tree via the activity-bar folder button (closed by default).
  const treeToggle = page.getByRole('button', { name: 'Toggle file tree' });
  await expect(treeToggle).toHaveAttribute('aria-pressed', 'false');
  await treeToggle.click();

  const tree = page.locator('.pane.tree');
  await expect(tree).toBeVisible();
  await expect(page.locator('.tree-row').first()).toBeVisible();

  // Let Code Hike finish tokenizing / the highlight settle before capturing.
  await page.waitForTimeout(400);

  await page.locator('.app').screenshot({ path: OUTPUT });
});
