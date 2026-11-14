import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/**
 * What the seed promises the app, checked on the seeded database itself.
 *
 * An attendee chooses interests from the topic tags, so a seeded interest
 * that is not one can never be shown — and a save from the picker drops it.
 * Kenji's `Edge`, a tech tag, did exactly that on #219.
 */

let api;
let close;

before(async () => { ({ api, close } = await startApi()); });
after(() => close());

describe('Seeded attendees', () => {
  test('every interest is a topic tag', async () => {
    const { users, tags } = await api.json('/bootstrap');
    const topics = new Set(tags.filter((t) => t.kind === 'topic').map((t) => t.name));
    assert.ok(topics.size > 0 && users.some((u) => u.interests.length), 'the seed has topics and interests to check');
    const strays = users.flatMap((u) => u.interests.filter((i) => !topics.has(i)).map((i) => `${u.name}: ${i}`));
    assert.deepEqual(strays, []);
  });

  test('the six attendees start with no role', async () => {
    const { users } = await api.json('/bootstrap');
    assert.equal(users.length, 36, 'six attendees and a crowd of thirty');
    for (const u of users.slice(0, 6)) assert.equal((await api.json(`/users/${u.id}`)).role, null, u.name);
  });

  test('the six attendees start with no tracks chosen', async () => {
    const { users } = await api.json('/bootstrap');
    assert.deepEqual(users.slice(0, 6).map((u) => u.id), [1, 2, 3, 4, 5, 6]);
    for (const u of users.slice(0, 6)) assert.deepEqual((await api.json(`/users/${u.id}`)).trackSlugs, [], u.name);
  });
});

describe('The mock crowd', () => {
  const crowdIds = Array.from({ length: 30 }, (_, i) => i + 7);

  test('each has a role and two to four tracks, and both roles are used', async () => {
    const { users } = await api.json('/bootstrap');
    assert.deepEqual(users.slice(6).map((u) => u.id), crowdIds);
    const roles = new Set();
    for (const id of crowdIds) {
      const u = await api.json(`/users/${id}`);
      assert.ok(['buyer', 'seller'].includes(u.role), `${u.name} has a role`);
      assert.ok(u.trackSlugs.length >= 2 && u.trackSlugs.length <= 4, `${u.name} has 2 to 4 tracks`);
      roles.add(u.role);
    }
    assert.deepEqual([...roles].sort(), ['buyer', 'seller']);
  });

  test('none is a host, so the switcher lists only the six', async () => {
    const { users } = await api.json('/bootstrap');
    const hosts = users.filter((u) => u.company === 'Equal Experts').map((u) => u.name);
    assert.deepEqual(hosts, ['Jonas Claesson', 'Andy Vays', 'Abraham Marín Pérez']);
  });

  test('every track has at least three buyers and three sellers', async () => {
    const count = {};
    for (const id of crowdIds) {
      const u = await api.json(`/users/${id}`);
      for (const t of u.trackSlugs) {
        count[t] ??= { buyer: 0, seller: 0 };
        count[t][u.role]++;
      }
    }
    const { tracks } = await api.json('/bootstrap');
    for (const t of tracks) {
      assert.ok(count[t.slug]?.buyer >= 3, `${t.slug} has three buyers`);
      assert.ok(count[t.slug]?.seller >= 3, `${t.slug} has three sellers`);
    }
  });

  test('every track has a buyer and a seller from each seat group', async () => {
    const pairs = {};
    for (const id of crowdIds) {
      const u = await api.json(`/users/${id}`);
      for (const t of u.trackSlugs) (pairs[t] ??= new Set()).add(`${u.role} ${(id - 7) % 3}`);
    }
    const { tracks } = await api.json('/bootstrap');
    for (const t of tracks) {
      for (const role of ['buyer', 'seller']) {
        for (const g of [0, 1, 2]) assert.ok(pairs[t.slug]?.has(`${role} ${g}`), `${t.slug} has a ${role} in group ${g}`);
      }
    }
  });

  const heldBy = async (id) => (await api.json(`/users/${id}/schedule`)).days.flatMap((d) => d.sessions);

  test('each holds only confirmed seats, one per slot, in the slots their group calls for', async () => {
    const sessions = await api.json('/sessions');
    const slots = [...new Set(sessions.map((s) => `${s.day} ${s.startsAt}`))].sort();
    for (const id of crowdIds) {
      const group = (id - 7) % 3;
      const held = await heldBy(id);
      assert.ok(held.every((s) => s.reservation === 'confirmed'), `attendee ${id} has no waitlist place`);
      const booked = held.map((s) => `${s.day} ${s.startsAt}`).sort();
      assert.deepEqual(booked, slots.filter((_, i) => i % 3 !== group), `attendee ${id} group ${group}`);
    }
  });

  test('no session the crowd sits in is full, every Day 1 morning seat is checked in, and nobody rated', async () => {
    const sessions = await api.json('/sessions');
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const day1 = sessions.map((s) => s.day).sort()[0];
    let morning = 0;
    for (const id of crowdIds) {
      for (const s of await heldBy(id)) {
        assert.ok(byId.get(s.id).seatsTaken < byId.get(s.id).capacity, `${s.title} has room`);
        assert.equal(s.myStars, null, `attendee ${id} left no rating`);
        if (s.day === day1 && s.endsAt <= '12:15') {
          morning++;
          assert.equal(s.checkedIn, true, `attendee ${id} at ${s.title}`);
        }
      }
    }
    assert.ok(morning > 0, 'the crowd has Day 1 morning seats');
    const stars = new Map();
    for (const id of [1, 2, 3, 4, 5, 6]) {
      for (const s of await heldBy(id)) if (s.myStars != null) stars.set(s.id, (stars.get(s.id) ?? 0) + 1);
    }
    for (const s of sessions) assert.equal(s.ratingCount, stars.get(s.id) ?? 0, `${s.title} ratings come from the six alone`);
  });
});
