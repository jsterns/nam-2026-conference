import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/**
 * The tracks an attendee picks on their profile: stored per attendee, replaced
 * as a whole on save, and never empty.
 */

let api;
let close;
let slugs;

before(async () => {
  ({ api, close } = await startApi());
  slugs = (await api.json('/bootstrap')).tracks.map((t) => t.slug);
});
after(() => close());

describe('PUT /users/:id/tracks', () => {
  test('stores the slugs, and a later save replaces them rather than adding', async () => {
    const two = [slugs[2], slugs[0]];
    const saved = await api.put('/users/1/tracks', { trackSlugs: two });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body, { trackSlugs: [slugs[0], slugs[2]] }, 'sorted by track id');
    assert.deepEqual((await api.json('/users/1')).trackSlugs, [slugs[0], slugs[2]]);

    await api.put('/users/1/tracks', { trackSlugs: [slugs[1]] });
    assert.deepEqual((await api.json('/users/1')).trackSlugs, [slugs[1]]);
  });

  test('another attendee is untouched', async () => {
    await api.put('/users/1/tracks', { trackSlugs: [slugs[0]] });
    assert.deepEqual((await api.json('/users/2')).trackSlugs, []);
  });

  test('all ten tracks are fine', async () => {
    const res = await api.put('/users/3/tracks', { trackSlugs: slugs });
    assert.equal(res.status, 200);
    assert.equal(res.body.trackSlugs.length, slugs.length);
  });

  test('refuses an empty list, a non-array and an unknown slug, keeping what was stored', async () => {
    await api.put('/users/4/tracks', { trackSlugs: [slugs[1]] });
    for (const body of [{ trackSlugs: [] }, { trackSlugs: 'ai' }, {}, { trackSlugs: [slugs[0], 'no-such-track'] }]) {
      const res = await api.put('/users/4/tracks', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(typeof res.body.error, 'string');
    }
    assert.deepEqual((await api.json('/users/4')).trackSlugs, [slugs[1]]);
  });

  test('an unknown attendee is a 404', async () => {
    assert.equal((await api.put('/users/999999/tracks', { trackSlugs: [slugs[0]] })).status, 404);
  });
});
