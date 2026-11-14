import { test, expect } from '@playwright/test';
import { API, visit, laneFor, momentOn, shotForPR } from './helpers.js';

/**
 * One walk through the People deck. The rules (who is in the deck, stored
 * decisions, what a match is, the seeded likes, a role change) are proved in
 * tests/api/people.test.js; this checks what only the page shows. Role and
 * likes are kept for good, so the walk reads the deck from the API instead of
 * assuming where it starts.
 */
test.describe('People', () => {
  test('pass, like, match without a reload, and each attendee their own deck', async ({ page, request }, testInfo) => {
    const lane = await laneFor('people.deck', testInfo);
    const put = (path, data) => request.put(`${API}${path}`, { data });
    const deckOf = async (id) => (await (await request.get(`${API}/users/${id}/people`)).json());
    const tracks = (await (await request.get(`${API}/bootstrap`)).json()).tracks.map((t) => t.slug);

    // someone with no role and no tracks sees the prompt and no deck
    const me = await (await request.get(`${API}/users/${lane.user}`)).json();
    await visit(page, '/people', { as: 3 });
    await expect(page.getByTestId('people-prompt')).toBeVisible();
    await expect(page.getByTestId('people-prompt').getByRole('link')).toHaveAttribute('href', '/profile');
    await expect(page.getByTestId('people-card')).toHaveCount(0);

    await put(`/users/${lane.user}/role`, { role: 'seller' });
    await put(`/users/${lane.user}/tracks`, { trackSlugs: tracks });
    // the seed has buyers who like each lane attendee, none of them first in the deck
    const likers = { 5: [19, 21], 4: [17] }[lane.user];
    const { deck } = await deckOf(lane.user);
    const liker = deck.find((c) => likers.includes(c.id));
    const [first] = deck;
    expect(liker, 'a buyer who already likes this attendee is in the deck').toBeTruthy();
    expect(first.id).not.toBe(liker.id);

    // the clock is pinned, so the coffee slot a match is offered does not depend on the hour
    await visit(page, '/people', { as: lane.user, at: await momentOn(0, '08:00') });
    await expect(page.getByTestId('people-card')).toContainText(first.name);
    await shotForPR(page, 'people deck');

    // like someone who has not liked back: card gone, nothing under Matches
    const matchesBefore = await page.getByTestId('match-item').count();
    await page.getByTestId('people-like').click();
    await expect(page.getByTestId('people-card')).not.toContainText(first.name);
    await expect(page.getByTestId('match-item')).toHaveCount(matchesBefore);
    await page.reload();
    await expect(page.getByTestId('people-card')).not.toContainText(first.name);

    // pass everyone ahead of the liker, then like the liker: a match with no reload
    for (const c of deck.filter((c) => c.id < liker.id && c.id !== first.id)) {
      await put(`/users/${lane.user}/people/${c.id}`, { choice: 'pass' });
    }
    await page.reload();
    await expect(page.getByTestId('people-card')).toContainText(liker.name);
    await page.getByTestId('people-like').click();
    const matchItem = page.getByTestId('match-item').filter({ hasText: liker.name });
    await expect(matchItem).toBeVisible();
    // the coffee invite shows at once, with a day and time, and is what the server stored
    const invite = matchItem.getByTestId('match-invite');
    await expect(invite).toHaveText(/^Up for a coffee and a chill\? \w+, \w+ \d+, \d+:\d{2} [AP]M$/);
    await shotForPR(page, 'people match');
    const stored = (await deckOf(lane.user)).matches.find((m) => m.id === liker.id).invite;
    expect(stored.message).toBe('Up for a coffee and a chill?');
    await page.reload();
    await expect(invite).toBeVisible();

    // a passed card stays gone too
    const next = (await deckOf(lane.user)).deck[0];
    await expect(page.getByTestId('people-card')).toContainText(next.name);
    await page.getByTestId('people-pass').click();
    await expect(page.getByTestId('people-card')).not.toContainText(next.name);
    await page.reload();
    await expect(page.getByTestId('people-card')).not.toContainText(next.name);
    await expect(page.getByTestId('match-item').filter({ hasText: liker.name })).toBeVisible();

    // switching attendee shows their deck and their matches
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await page.getByRole('option', { selected: false }).first().click();
    await expect(page.getByRole('button', { name: new RegExp(`Viewing as ${me.name}`) })).toHaveCount(0);
    await expect(page.getByTestId('match-item').filter({ hasText: liker.name })).toHaveCount(0);

    // fits the screen
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
