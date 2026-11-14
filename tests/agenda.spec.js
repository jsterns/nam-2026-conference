import { test, expect } from '@playwright/test';
import { API, visit, momentOn, laneFor, bookableFor, shotForPR, failOnPageErrors } from './helpers.js';

const hours = (mins) => `${Number((mins / 60).toFixed(1))}h`;

async function dayOf(request, userId, date) {
  const plan = await (await request.get(`${API}/users/${userId}/schedule`)).json();
  return plan.days.find((d) => d.date === date);
}

test.describe('My Agenda', () => {
  test('lists what you hold by day, marks the queue and the clash, and updates on removal', async ({ page, request }, testInfo) => {
    const lane = await laneFor('agenda.page', testInfo);
    const errors = failOnPageErrors(page);
    const put = (id) => request.put(`${API}/users/${lane.user}/reservations/${id}`, { data: {} });
    const booked = [];

    try {
      // A full session to queue for, an open one beside it (a clash: the guard
      // only looks at confirmed seats), and one apart from both.
      const free = await bookableFor(request, lane.user, lane.day);
      const overlaps = (a, b) => a.startsAt < b.endsAt && b.startsAt < a.endsAt;
      const queued = free.find((s) => s.isFull && free.some((o) => !o.isFull && overlaps(s, o)));
      expect(queued, 'no full session with an open one beside it').toBeTruthy();
      const beside = free.find((o) => !o.isFull && o.id !== queued.id && overlaps(queued, o));
      const apart = free.find((o) => !o.isFull && !overlaps(queued, o));
      expect(apart, 'no open session apart from the queued one').toBeTruthy();

      for (const s of [queued, beside, apart]) {
        const res = await put(s.id);
        expect(res.ok(), `booking ${s.id}`).toBeTruthy();
        booked.push(s.id);
      }
      const before = await dayOf(request, lane.user, lane.day);
      expect(before.waitlistedMinutes).toBe(queued.durationMins);

      await visit(page, '/my-agenda', { as: lane.user, at: await momentOn(0, '07:00') });
      await expect(page.getByTestId('agenda-coming-soon')).toHaveCount(0);

      const dayEl = page.locator(`[data-testid="agenda-day"][data-date="${lane.day}"]`);
      await expect(dayEl).toBeVisible();
      const card = (s) => dayEl.getByTestId('session-card').filter({ hasText: s.title });
      await expect(card(queued)).toContainText('Waitlisted');
      await expect(card(beside)).not.toContainText('Waitlisted');
      await expect(dayEl.getByTestId('agenda-clash')).toHaveCount(2);
      await expect(dayEl.getByTestId('agenda-booked-hours')).toHaveText(hours(before.totalMinutes));
      await expect(dayEl).toContainText(`+${hours(before.waitlistedMinutes)} waitlisted`);
      await shotForPR(page, 'My Agenda with a waitlisted session and a clash');

      // Remove the open session beside the queue: row, clash and hours go with it.
      await card(beside).getByRole('button', { name: 'Remove from my agenda' }).click();
      booked.splice(booked.indexOf(beside.id), 1);
      await expect(card(beside)).toHaveCount(0);
      await expect(dayEl.getByTestId('agenda-clash')).toHaveCount(0);
      await expect(dayEl.getByTestId('agenda-booked-hours')).toHaveText(hours(before.totalMinutes - beside.durationMins));
      await expect(card(queued)).toContainText('Waitlisted');

      // Nothing booked: the page points back to the schedule.
      await page.route('**/api/users/*/schedule', (route) => route.fulfill({
        json: { user: { id: lane.user }, days: [] },
      }));
      await page.reload();
      const empty = page.getByTestId('agenda-empty');
      await expect(empty).toBeVisible();
      await expect(empty.getByRole('link', { name: /schedule/i })).toHaveAttribute('href', '/schedule');
      await expect(page.getByTestId('agenda-day')).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      for (const id of booked) await request.delete(`${API}/users/${lane.user}/reservations/${id}`);
    }
  });
});
