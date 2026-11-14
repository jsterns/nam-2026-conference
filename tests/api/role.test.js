import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/**
 * The role an attendee picks on their profile: buyer or seller, stored per
 * attendee, changeable, and nothing else is accepted.
 */

let api;
let close;

before(async () => {
  ({ api, close } = await startApi());
});
after(() => close());

describe('PUT /users/:id/role', () => {
  test('stores the role and a later save replaces it', async () => {
    const saved = await api.put('/users/1/role', { role: 'seller' });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body, { role: 'seller' });
    assert.equal((await api.json('/users/1')).role, 'seller');

    await api.put('/users/1/role', { role: 'buyer' });
    assert.equal((await api.json('/users/1')).role, 'buyer');
  });

  test('another attendee is untouched', async () => {
    await api.put('/users/1/role', { role: 'seller' });
    assert.equal((await api.json('/users/2')).role, null);
  });

  test('an unknown attendee is a 404', async () => {
    const res = await api.put('/users/9999/role', { role: 'buyer' });
    assert.equal(res.status, 404);
  });

  test('refuses any other role with a 400, keeping what was stored', async () => {
    await api.put('/users/4/role', { role: 'buyer' });
    for (const body of [{ role: 'organiser' }, { role: '' }, { role: 42 }, { role: 'Buyer' }, {}]) {
      const res = await api.put('/users/4/role', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(typeof res.body.error, 'string');
    }
    assert.equal((await api.json('/users/4')).role, 'buyer');
  });
});
