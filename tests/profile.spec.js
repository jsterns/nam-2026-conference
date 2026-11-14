import { test, expect } from '@playwright/test';
import { API, visit, momentOn, conferenceDays, laneFor, bookableFor, shotForPR } from './helpers.js';

/**
 * One walk through the profile page. The rules (empty and unknown selections
 * refused, replace-on-save, seeded attendees start with none) are proved in
 * tests/api/tracks.test.js and seed.test.js; this checks what only the page
 * shows. A saved selection can be changed but never cleared, so the walk never
 * assumes the lane starts empty, and it ends with its seats given back.
 */
test.describe('Profile', () => {
  test('choose buyer or seller, keep it across a reload and a switch', async ({ page, request }, testInfo) => {
    const lane = await laneFor('profile.role', testInfo);
    const stored = async () => (await (await request.get(`${API}/users/${lane.user}`)).json());
    const me = await stored();
    const buyer = page.getByTestId('role-buyer');
    const seller = page.getByTestId('role-seller');
    const save = page.getByTestId('save-role');

    await visit(page, '/profile', { as: lane.user });
    await expect(buyer).toBeVisible();
    // A retry finds the role already saved; a first try finds neither chosen.
    if (me.role === null) {
      await expect(buyer).not.toBeChecked();
      await expect(seller).not.toBeChecked();
      await expect(save).toBeDisabled();
    }

    await seller.check();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByTestId('role-saved')).toBeVisible();
    await shotForPR(page, 'profile role choice');

    await page.reload();
    await expect(seller).toBeChecked();
    await expect(buyer).not.toBeChecked();
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await page.getByRole('option', { selected: false }).first().click();
    await expect(page.getByRole('button', { name: new RegExp(`Viewing as ${me.name}`) })).toHaveCount(0);
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await page.getByRole('option', { name: new RegExp(me.name) }).click();
    await expect(seller).toBeChecked();
    expect((await stored()).role).toBe('seller');
  });

  test('pick tracks, get suggestions, book from them, untick a track', async ({ page, request }, testInfo) => {
    const lane = await laneFor('profile.walk', testInfo);
    const at = await momentOn(0, '11:00');
    const days = await conferenceDays();
    const all = await (await request.get(`${API}/sessions`)).json();
    const overlaps = (a, b) => a.day === b.day && a.startsAt < b.endsAt && b.startsAt < a.endsAt;

    // A target to take, and a different-track session that clashes with it.
    const target = (await bookableFor(request, lane.user, lane.day)).find((s) => s.seatsLeft > 3);
    const rival = all.find((s) => s.id !== target.id && overlaps(s, target) && s.track.slug !== target.track.slug
      && s.seatsLeft > 0 && !s.isKeynote && s.format !== 'Social');
    expect(target && rival, 'no target and clashing session in this lane').toBeTruthy();
    lane.name = (await (await request.get(`${API}/users/${lane.user}`)).json()).name;
    let mine;
    const A = target.track.slug;
    const B = rival.track.slug;

    const list = page.getByTestId('suggested-list');
    const rowOf = (s) => list.getByTestId('session-card').filter({ hasText: s.title });
    const box = (slug) => page.getByTestId(`track-${slug}`);
    const save = page.getByTestId('save-tracks');

    try {
      await visit(page, '/profile', { as: lane.user, at });
      await expect(box(A)).toBeVisible();

      // Nothing ticked: Save is refused in the page, with a reason, and sends nothing.
      for (const b of await page.locator('[data-testid^="track-"]:checked').all()) await b.uncheck();
      await expect(save).toBeDisabled();
      await expect(page.getByTestId('tracks-required')).toBeVisible();

      await box(A).check();
      await box(B).check();
      await expect(save).toBeEnabled();
      await save.click();
      await expect(page.getByTestId('tracks-saved')).toBeVisible();

      // Kept after a reload, and after switching attendee and back.
      await page.reload();
      await expect(box(A)).toBeChecked();
      await expect(box(B)).toBeChecked();
      await page.getByRole('button', { name: /Switch attendee/ }).click();
      await page.getByRole('option', { selected: false }).first().click();
      await expect(page.getByRole('button', { name: new RegExp(`Viewing as ${lane.name}`) })).toHaveCount(0);
      await page.getByRole('button', { name: /Switch attendee/ }).click();
      await page.getByRole('option', { name: new RegExp(lane.name) }).click();
      await expect(box(A)).toBeChecked();
      await expect(box(B)).toBeChecked();

      // Only chosen tracks, nothing ended at 11:00 on day 1, nothing already held.
      const me = await (await request.get(`${API}/users/${lane.user}`)).json();
      const held = new Set(me.reservations.map((r) => r.sessionId));
      const names = all.filter((s) => [A, B].includes(s.track.slug));
      const ended = names.filter((s) => s.day === days[0] && s.endsAt <= '11:00');
      const heldOnes = names.filter((s) => held.has(s.id));
      await expect(rowOf(target)).toBeVisible();
      expect(ended.length, 'the seed has sessions that have ended by 11:00').toBeGreaterThan(0);
      for (const s of [...ended, ...heldOnes]) await expect(rowOf(s)).toHaveCount(0);
      const trackNames = new Set([target.track.name, rival.track.name]);
      for (const text of await list.getByTestId('session-card').allInnerTexts()) {
        expect([...trackNames].some((n) => text.includes(n)), text).toBe(true);
      }
      await shotForPR(page, 'profile tracks and suggestions');

      // Take one: a seat, and it leaves the list without a reload.
      await rowOf(target).getByRole('button', { name: 'Add to my agenda' }).click();
      await expect(rowOf(target)).toHaveCount(0);
      mine = await (await request.get(`${API}/users/${lane.user}`)).json();
      expect(mine.reservations.find((r) => r.sessionId === target.id)?.status).toBe('confirmed');

      // A clash opens the dialog; Swap trades the seats and the list follows.
      await rowOf(rival).getByRole('button', { name: 'Add to my agenda' }).click();
      await expect(page.getByTestId('conflict-dialog')).toBeVisible();
      await page.getByTestId('conflict-swap').click();
      await expect(rowOf(target)).toBeVisible();
      await expect(rowOf(rival)).toHaveCount(0);

      // Unticking B and saving removes its sessions.
      await box(B).uncheck();
      await save.click();
      await expect(page.getByTestId('tracks-saved')).toBeVisible();
      await expect(rowOf(target)).toBeVisible();
      for (const text of await list.getByTestId('session-card').allInnerTexts()) {
        expect(text, 'a row from the unticked track').not.toContain(rival.track.name);
      }
    } finally {
      mine = await (await request.get(`${API}/users/${lane.user}`)).json();
      for (const s of [target, rival]) {
        if (mine.reservations.some((r) => r.sessionId === s.id)) await request.delete(`${API}/users/${lane.user}/reservations/${s.id}`);
      }
    }
  });
});
