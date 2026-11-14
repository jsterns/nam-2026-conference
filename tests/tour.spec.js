import { test, expect } from '@playwright/test';
import { visit, shotForPR } from './helpers.js';

/**
 * The guided tour from the welcome card. No seat is booked, so no data lane.
 */
const box = async (loc) => (await loc.boundingBox());
const near = (a, b, d = 3) => Math.abs(a - b) <= d;

async function startTour(page) {
  await page.getByRole('button', { name: /What.s new/ }).click();
  await page.getByTestId('welcome-tour').click();
  await expect(page.getByTestId('tour-callout')).toBeVisible();
}

test('the tour walks both new features and ends three ways', async ({ page }) => {
  const writes = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET' && r.url().includes('/api/users/')) writes.push(r.url());
  });
  await visit(page, '/');
  await startTour(page);

  const callout = page.getByTestId('tour-callout');
  const highlight = page.getByTestId('tour-highlight');
  const vp = page.viewportSize();

  // Step 1: schedule, chips highlighted, callout beside them.
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(callout).toContainText('1 of 2');
  await expect(callout.getByRole('button', { name: 'Back' })).toHaveCount(0);
  const chips = page.locator('[data-tour="schedule-tracks"]');
  await expect(chips).toBeVisible();
  await expect(highlight).toBeVisible();
  await expect.poll(async () => {
    const h = await box(highlight); const c = await box(chips);
    return h && c && near(h.x, c.x - 6, 8) && near(h.y, c.y - 6, 8);
  }).toBe(true);
  const cb = await box(callout);
  expect(cb.x).toBeGreaterThanOrEqual(0);
  expect(cb.x + cb.width).toBeLessThanOrEqual(vp.width + 1);
  expect(cb.y + cb.height).toBeLessThanOrEqual(vp.height + 1);
  await shotForPR(page, 'tour step 1, the track chips highlighted');

  // Step 2: the session page, seat button highlighted.
  await callout.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/sessions\/\d+$/);
  await expect(callout).toContainText('2 of 2');
  await expect(callout.getByRole('button', { name: 'Done' })).toBeVisible();
  const seat = page.locator('[data-tour="seat-button"]');
  await expect(seat).toBeVisible();
  await expect.poll(async () => {
    const h = await box(highlight); const c = await box(seat);
    return h && c && near(h.x, c.x - 6, 8) && near(h.y, c.y - 6, 8);
  }).toBe(true);
  await shotForPR(page, 'tour step 2, the seat button highlighted');

  // Back returns to step 1.
  await callout.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(callout).toContainText('1 of 2');

  // A missing target: the marker is stripped as the page mounts, so step 2 has
  // nothing to find. The callout centres, no highlight, and Done still works.
  await page.evaluate(() => {
    window.__noTour = true;
    new MutationObserver(() => document.querySelectorAll('[data-tour]').forEach((n) => n.removeAttribute('data-tour')))
      .observe(document.documentElement, { subtree: true, childList: true, attributes: true });
  });
  await callout.getByRole('button', { name: 'Next' }).click();
  await expect(callout).toContainText('2 of 2');
  await expect(highlight).toHaveCount(0);
  await expect.poll(async () => {
    const c = await box(callout);
    return near(c.x + c.width / 2, vp.width / 2, 6) && near(c.y + c.height / 2, vp.height / 2, 6);
  }).toBe(true);

  // Done, Skip and Escape each end it without moving the attendee.
  const ends = [
    () => callout.getByRole('button', { name: 'Done' }).click(),
    () => callout.getByRole('button', { name: 'Skip tour' }).click(),
    () => page.keyboard.press('Escape'),
  ];
  for (const end of ends) {
    const url = page.url();
    await end();
    await expect(callout).toHaveCount(0);
    await expect(highlight).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement && document.activeElement !== document.body)).toBe(true);
    expect(page.url()).toBe(url);
    await startTour(page);
    await callout.getByRole('button', { name: 'Next' }).click();
  }

  expect(writes).toEqual([]);
});
