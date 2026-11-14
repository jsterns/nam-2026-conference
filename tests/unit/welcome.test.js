import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  WELCOME_ENTRIES, newEntries, welcomeHref, hasSeenWelcome, markWelcomeSeen, takeLaunchParams,
} from '../../src/lib/welcome.js';

const days = [{ date: '2031-01-05' }, { date: '2031-01-06' }, { date: '2031-01-07' }];

describe('Welcome entries', () => {
  test('only the new ones are listed, and each is complete', () => {
    const fresh = newEntries();
    assert.ok(fresh.length >= 1);
    assert.ok(fresh.every((e) => e.isNew));
    assert.equal(new Set(WELCOME_ENTRIES.map((e) => e.id)).size, WELCOME_ENTRIES.length);
    for (const e of WELCOME_ENTRIES) {
      assert.ok(e.title && e.description && e.to, `${e.id} is incomplete`);
    }
  });

  test('no Try it link carries a hard-coded date or clock pin', () => {
    for (const e of WELCOME_ENTRIES) {
      const href = welcomeHref(e, { days });
      assert.doesNotMatch(href, /\d{4}-\d{2}-\d{2}/, e.id);
      assert.doesNotMatch(href, /at=/, e.id);
    }
  });

  test('a function target is built from the days passed in', () => {
    const href = welcomeHref({ to: ({ days: d }) => `/x?at=${d[1].date}T09:00` }, { days });
    assert.equal(href, '/x?at=2031-01-06T09:00');
  });
});

describe('Seen flag', () => {
  beforeEach(() => { delete globalThis.localStorage; });

  test('unseen on empty storage, seen once marked', () => {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
    assert.equal(hasSeenWelcome(), false);
    markWelcomeSeen();
    assert.equal(store.get('orbit:welcomeSeen'), '1');
    assert.equal(hasSeenWelcome(), true);
  });

  test('storage that throws means unseen and no crash', () => {
    const boom = () => { throw new Error('blocked'); };
    globalThis.localStorage = { getItem: boom, setItem: boom };
    assert.equal(hasSeenWelcome(), false);
    assert.doesNotThrow(() => markWelcomeSeen());
  });
});

describe('takeLaunchParams', () => {
  test('reports neither and leaves the search alone', () => {
    assert.deepEqual(takeLaunchParams(''), { welcome: false, tour: false, search: '' });
    assert.deepEqual(takeLaunchParams('?at=x'), { welcome: false, tour: false, search: '?at=x' });
  });

  test('takes welcome and tour with or without a value, keeping other keys', () => {
    assert.deepEqual(takeLaunchParams('?at=x&welcome=1&tour'), { welcome: true, tour: true, search: '?at=x' });
    assert.deepEqual(takeLaunchParams('?tour'), { welcome: false, tour: true, search: '' });
    assert.deepEqual(takeLaunchParams('?welcome'), { welcome: true, tour: false, search: '' });
  });
});
