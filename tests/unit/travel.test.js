import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { routesBetween, assessTravel, hopsFor, hopSummary } from '../../src/lib/travel.js';

const AURORA = 1;
const FOUNDRY = 2;

/** The two-venue travel table, in the camelCase shape `toTravel` returns. */
const travel = [
  { fromVenueId: AURORA, toVenueId: FOUNDRY, mode: 'Shuttle', minutes: 25, costUsd: 0 },
  { fromVenueId: AURORA, toVenueId: FOUNDRY, mode: 'Rideshare', minutes: 16, costUsd: 18 },
  { fromVenueId: AURORA, toVenueId: FOUNDRY, mode: 'Transit', minutes: 34, costUsd: 3 },
  { fromVenueId: AURORA, toVenueId: FOUNDRY, mode: 'Walk', minutes: 118, costUsd: 0 },
  { fromVenueId: FOUNDRY, toVenueId: AURORA, mode: 'Shuttle', minutes: 27, costUsd: 0 },
];

const at = (venueId, walkMinutes = 0) => ({ venue: { id: venueId }, room: { walkMinutes } });

describe('Routes between the two sites', () => {
  test('only the legs going the way you are travelling come back', () => {
    const out = routesBetween(travel, AURORA, FOUNDRY);
    assert.equal(out.length, 4);
    assert.ok(out.every((t) => t.fromVenueId === AURORA && t.toVenueId === FOUNDRY));
  });

  test('the quickest mode is listed first', () => {
    assert.deepEqual(routesBetween(travel, AURORA, FOUNDRY).map((t) => t.mode),
      ['Rideshare', 'Shuttle', 'Transit', 'Walk']);
  });

  test('the return journey is its own route, and is not assumed symmetrical', () => {
    assert.deepEqual(routesBetween(travel, FOUNDRY, AURORA).map((t) => t.minutes), [27]);
  });

  test('a pair of venues with no leg between them gives nothing, not a crash', () => {
    assert.deepEqual(routesBetween(travel, AURORA, 99), []);
  });
});

describe('Whether you can make the next session', () => {
  test('two sessions in the same building need no travel advice at all', () => {
    assert.equal(assessTravel({ travel, from: at(AURORA), to: at(AURORA), gapMinutes: 15 }), null);
  });

  test('a missing session on either side gives nothing to assess', () => {
    assert.equal(assessTravel({ travel, from: null, to: at(FOUNDRY), gapMinutes: 60 }), null);
    assert.equal(assessTravel({ travel, from: at(AURORA), to: null, gapMinutes: 60 }), null);
  });

  test('walking across town is not offered as a mode between venues', () => {
    const out = assessTravel({ travel, from: at(AURORA), to: at(FOUNDRY), gapMinutes: 60 });
    assert.ok(!out.options.some((o) => o.mode === 'Walk'));
    assert.equal(out.options.length, 3);
  });

  test('the walk to the destination room is added to every mode', () => {
    const out = assessTravel({ travel, from: at(AURORA), to: at(FOUNDRY, 6), gapMinutes: 60 });
    assert.equal(out.walk, 6);
    assert.deepEqual(out.options.map((o) => [o.mode, o.total]),
      [['Rideshare', 22], ['Shuttle', 31], ['Transit', 40]]);
    assert.equal(out.fastest.mode, 'Rideshare');
  });

  test('a gap exactly as long as the journey fits — the door does not shut early', () => {
    const fits = (gapMinutes) => assessTravel({ travel, from: at(AURORA), to: at(FOUNDRY, 6), gapMinutes })
      .options.find((o) => o.mode === 'Rideshare').fits;
    assert.equal(fits(22), true);
    assert.equal(fits(21), false);
  });

  test('a gap too short for anything is impossible, and says so', () => {
    const out = assessTravel({ travel, from: at(AURORA), to: at(FOUNDRY, 6), gapMinutes: 10 });
    assert.equal(out.impossible, true);
    assert.equal(out.freeTooSlow, false);
    assert.ok(out.options.every((o) => !o.fits));
  });

  test('the free shuttle missing it while a paid ride makes it is the interesting answer', () => {
    const out = assessTravel({ travel, from: at(AURORA), to: at(FOUNDRY, 6), gapMinutes: 25 });
    assert.equal(out.free.mode, 'Shuttle');
    assert.equal(out.free.fits, false);
    assert.equal(out.freeTooSlow, true);
    assert.equal(out.impossible, false);
  });

  test('once the free shuttle fits there is nothing to warn about', () => {
    const out = assessTravel({ travel, from: at(AURORA), to: at(FOUNDRY, 6), gapMinutes: 45 });
    assert.equal(out.free.fits, true);
    assert.equal(out.freeTooSlow, false);
    assert.equal(out.impossible, false);
  });

  test('with no free mode at all there is no free option to report', () => {
    const paidOnly = travel.filter((t) => t.costUsd !== 0);
    const out = assessTravel({ travel: paidOnly, from: at(AURORA), to: at(FOUNDRY), gapMinutes: 45 });
    assert.equal(out.free, undefined);
    assert.equal(out.freeTooSlow, false);
  });

  test('a destination room with no walk time is treated as zero, not undefined', () => {
    const out = assessTravel({ travel, from: at(AURORA), to: { venue: { id: FOUNDRY }, room: {} }, gapMinutes: 30 });
    assert.equal(out.walk, 0);
    assert.equal(out.fastest.total, 16);
    assert.equal(out.gapMinutes, 30);
  });

  test('venues with only a walking leg between them offer no advice', () => {
    const walkOnly = travel.filter((t) => t.mode === 'Walk');
    assert.equal(assessTravel({ travel: walkOnly, from: at(AURORA), to: at(FOUNDRY), gapMinutes: 300 }), null);
  });
});

describe('Hops between your own seats', () => {
  const sess = (id, venueId, startsAt, endsAt, day = '2026-01-01') =>
    ({ id, title: `Talk ${id}`, day, startsAt, endsAt, venue: { id: venueId }, room: { walkMinutes: 0 } });
  const held = (...ids) => (id) => (ids.includes(id) ? 'confirmed' : null);
  const days = (...sessions) => ({ days: [{ date: '2026-01-01', sessions }] });

  test('the lunch gap, 12:15 to 13:30, is long enough for the free shuttle', () => {
    const a = sess(1, AURORA, '11:00', '12:15');
    const b = sess(2, FOUNDRY, '13:30', '14:30');
    const [hop] = hopsFor({ session: a, schedule: days(a, b), travel, reservationFor: held(1, 2) });
    assert.equal(hop.direction, 'next');
    assert.equal(hop.other.id, 2);
    assert.equal(hop.assessment.gapMinutes, 75);
    assert.ok(hop.assessment.free.fits);
    assert.match(hopSummary(hop.assessment), /free shuttle works/i);
  });

  test('both sides name the other session', () => {
    const a = sess(1, AURORA, '10:15', '11:00');
    const b = sess(2, FOUNDRY, '11:30', '12:15');
    const schedule = days(a, b);
    const fromB = hopsFor({ session: b, schedule, travel, reservationFor: held(1, 2) });
    assert.deepEqual(fromB.map((h) => [h.direction, h.other.id]), [['previous', 1]]);
    assert.equal(fromB[0].assessment.gapMinutes, 30);
  });

  test('same venue gives no hop', () => {
    const a = sess(1, AURORA, '10:15', '11:00');
    const b = sess(2, AURORA, '11:30', '12:15');
    assert.deepEqual(hopsFor({ session: a, schedule: days(a, b), travel, reservationFor: held(1, 2) }), []);
  });

  test('waitlisted, unheld, or other-day neighbours do not count; the nearest one wins', () => {
    const a = sess(1, AURORA, '10:15', '11:00');
    const wait = sess(2, FOUNDRY, '11:30', '12:15');
    const other = sess(3, FOUNDRY, '11:30', '12:15', '2026-01-02');
    const reservationFor = (id) => ({ 1: 'confirmed', 2: 'waitlisted', 3: 'confirmed' })[id] ?? null;
    assert.deepEqual(hopsFor({ session: a, schedule: days(a, wait, other), travel, reservationFor }), []);
    const near = sess(4, AURORA, '11:15', '12:00');
    const far = sess(5, FOUNDRY, '12:30', '13:15');
    assert.deepEqual(hopsFor({ session: a, schedule: days(a, near, far), travel, reservationFor: held(1, 4, 5) }), []);
  });

  test('you must hold the page\'s own session too', () => {
    const a = sess(1, AURORA, '10:15', '11:00');
    const b = sess(2, FOUNDRY, '11:30', '12:15');
    assert.deepEqual(hopsFor({ session: a, schedule: days(a, b), travel, reservationFor: held(2) }), []);
  });

  test('when nothing fits it says you will not make it', () => {
    const a = assessTravel({ travel, from: at(AURORA), to: at(FOUNDRY), gapMinutes: 5 });
    assert.match(hopSummary(a), /will not make it/i);
  });

  test('when only paid options fit it says the shuttle is too slow and names the cheapest that fits, with cost', () => {
    const a = assessTravel({ travel, from: at(AURORA), to: at(FOUNDRY), gapMinutes: 20 });
    const text = hopSummary(a);
    assert.match(text, /free shuttle is too slow/i);
    assert.match(text, /Rideshare/);
    assert.match(text, /\$18/);
  });
});
