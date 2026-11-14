import { test, expect } from '@playwright/test';
import { API, conferenceDays, waitForResults, shotForPR } from './helpers.js';

/**
 * The welcome dialog. Plain page.goto, not visit(): storage must start empty.
 * No seats are booked, so no data lane is needed.
 */
test('welcome opens once, lists what is new, and its Try it links land', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByTestId('welcome-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'New in this update' })).toBeVisible();
  await expect(dialog.getByTestId(/^welcome-try-/)).toHaveCount(2);
  await expect(dialog.getByText('Pick several tracks at once')).toBeVisible();
  await expect(dialog.getByText("Know when you can't get there in time")).toBeVisible();
  await shotForPR(page, 'the welcome dialog on first visit');

  // Escape, then no reopening on reload, then the footer button.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: /What.s new/  }).click();
  await expect(dialog).toBeVisible();

  // Close button and backdrop.
  await dialog.getByRole('button', { name: 'Close' }).last().click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: /What.s new/  }).click();
  await page.getByTestId('welcome-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(dialog).toBeHidden();

  // Tracks: exactly two chips pressed, count matches the API.
  await page.getByRole('button', { name: /What.s new/  }).click();
  await page.getByTestId('welcome-try-tracks').click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/schedule\?/);
  await waitForResults(page);
  const url = new URL(page.url());
  const slugs = url.searchParams.get('track');
  expect(slugs.split(',')).toHaveLength(2);
  const pressed = page.locator('button[aria-pressed="true"]').filter({ hasNotText: /^All$/ });
  const chips = await pressed.evaluateAll((els) => els.filter((e) => e.className.includes('rounded-full') && e.className.includes('shrink-0')).length);
  expect(chips).toBe(2);
  const sessions = await (await fetch(`${API}/sessions?day=${(await conferenceDays())[0]}&trackSlug=${slugs}`)).json();
  const list = Array.isArray(sessions) ? sessions : sessions.sessions;
  await expect(page.getByTestId('result-count')).toContainText(String(list.length));

  // Venue: a Foundry session whose next slot has an Aurora session.
  await page.getByRole('button', { name: /What.s new/  }).click();
  await page.getByTestId('welcome-try-venues').click();
  await expect(page).toHaveURL(/\/sessions\/\d+/);
  const id = Number(new URL(page.url()).pathname.split('/').pop());
  const s = await (await fetch(`${API}/sessions/${id}`)).json();
  expect(s.venue.name).toMatch(/Foundry/);
  const all = await (await fetch(`${API}/sessions?day=${s.day}`)).json();
  const day = Array.isArray(all) ? all : all.sessions;
  const later = day.filter((x) => x.startsAt >= s.endsAt).map((x) => x.startsAt).sort();
  const nextSlot = later[0];
  expect(day.some((x) => x.startsAt === nextSlot && /Aurora/.test(x.venue.name))).toBe(true);
});
