import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { clearAgenda, startApi } from './harness.js';

/** The likes the seed plants, so a fresh attendee can match straight away. */

let api;
let close;
let slugs;

before(async () => {
  ({ api, close } = await startApi());
  slugs = (await api.json('/bootstrap')).tracks.map((t) => t.slug);
});
after(() => close());

const setUp = async (id, role, trackSlugs) => {
  await api.put(`/users/${id}/role`, { role });
  await api.put(`/users/${id}/tracks`, { trackSlugs });
};
const people = (id) => api.json(`/users/${id}/people`);
const decide = (id, target, choice) => api.put(`/users/${id}/people/${target}`, { choice });

// Runs first: it spends attendee 6's decisions on one track, and the next block likes whoever is left.
describe('the coffee slots of the mock crowd', () => {
  test('one opposite-role match from each seat group is offered three different slots', async () => {
    const sessions = await api.json('/sessions');
    const clock = { day: sessions.map((s) => s.day).sort()[0], time: '08:00' };
    await setUp(6, 'seller', [slugs[0]]);
    await clearAgenda(api, 6);
    const { deck } = await people(6);
    // crowd member id belongs to seat group (id - 7) % 3
    const byGroup = new Map();
    for (const c of deck) if (!byGroup.has((c.id - 7) % 3)) byGroup.set((c.id - 7) % 3, c.id);
    assert.equal(byGroup.size, 3, 'the deck holds a buyer from each seat group');
    const invites = [];
    for (const target of byGroup.values()) {
      const res = await api.put(`/users/6/people/${target}`, { choice: 'like', ...clock });
      assert.equal(res.body.matched, true);
      invites.push(`${res.body.invite.day} ${res.body.invite.startsAt}`);
    }
    assert.equal(new Set(invites).size, 3, `three different slots, got ${invites}`);
  });
});

describe('the seeded likes', () => {
  test('each seeded attendee, in either role, has a card who already likes them', async () => {
    for (let id = 1; id <= 6; id++) {
      for (const role of ['buyer', 'seller']) {
        await setUp(id, role, slugs);
        const { deck } = await people(id);
        const results = [];
        // the crowd is who likes back; the other five attendees have decided nothing
        for (const card of deck.filter((c) => c.id > 6)) results.push((await decide(id, card.id, 'like')).body.matched);
        assert.ok(results.length > 0 && results.every(Boolean), `every like of attendee ${id} as a ${role} matches`);
      }
    }
  });
});
