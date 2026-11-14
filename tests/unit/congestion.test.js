import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shuttleEstimate, pickupEstimate, doorEstimate, foodEstimate, estimateLeg,
} from '../../src/lib/congestion.js';
import { assessTravel } from '../../src/lib/travel.js';

const AURORA = 1;
const FOUNDRY = 2;
const travel = [
  { fromVenueId: AURORA, toVenueId: FOUNDRY, mode: 'Shuttle', minutes: 25, costUsd: 0 },
  { fromVenueId: AURORA, toVenueId: FOUNDRY, mode: 'Rideshare', minutes: 16, costUsd: 18 },
  { fromVenueId: AURORA, toVenueId: FOUNDRY, mode: 'Transit', minutes: 34, costUsd: 3 },
  { fromVenueId: FOUNDRY, toVenueId: AURORA, mode: 'Shuttle', minutes: 27, costUsd: 0 },
];
const at = (venueId, walkMinutes = 0) => ({ venue: { id: venueId }, room: { walkMinutes } });
const ENDS = ['10:45'];
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

describe('Shuttle estimate', () => {
  test('at a quiet time it is the wait for the next departure only', () => {
    const e = shuttleEstimate({ time: '09:30', sessionEnds: ENDS });
    assert.equal(e.queue, 0);
    assert.equal(e.wait, 10);
    assert.equal(e.total, 10);
  });

  test('the wait is 0 at a departure and 19 a minute after it', () => {
    assert.equal(shuttleEstimate({ time: '09:20', sessionEnds: ENDS }).wait, 0);
    assert.equal(shuttleEstimate({ time: '09:21', sessionEnds: ENDS }).wait, 19);
    assert.equal(shuttleEstimate({ time: '09:40', sessionEnds: ENDS }).wait, 0);
  });

  test('the queue peaks just after sessions end and is gone about 20 minutes later', () => {
    const peak = shuttleEstimate({ time: '10:50', sessionEnds: ENDS }).queue;
    assert.ok(peak > 0);
    assert.equal(shuttleEstimate({ time: '10:45', sessionEnds: ENDS }).queue, peak);
    assert.equal(shuttleEstimate({ time: '10:55', sessionEnds: ENDS }).queue, peak);
    const mid = shuttleEstimate({ time: '11:00', sessionEnds: ENDS }).queue;
    assert.ok(mid > 0 && mid < peak);
    assert.equal(shuttleEstimate({ time: '11:05', sessionEnds: ENDS }).queue, 0);
    assert.equal(shuttleEstimate({ time: '10:44', sessionEnds: ENDS }).queue, 0);
  });
});

describe('Rideshare pickup', () => {
  test('is longer at a slot change than at a quiet time', () => {
    const busy = pickupEstimate({ time: '10:50', sessionEnds: ENDS });
    const quiet = pickupEstimate({ time: '09:30', sessionEnds: ENDS });
    assert.ok(busy.wait > quiet.wait);
  });
});

describe('Door advice', () => {
  test('90% full or more says arrive 10 minutes early', () => {
    const e = doorEstimate({ seatsTaken: 90, capacity: 100 });
    assert.equal(e.earlyMinutes, 10);
    assert.match(e.advice, /arrive 10 min early/i);
  });
  test('a full session says waitlist only', () => {
    const e = doorEstimate({ seatsTaken: 100, capacity: 100 });
    assert.match(e.advice, /waitlist only/i);
    assert.equal(e.earlyMinutes, 0);
  });
  test('a half-empty session has no advice', () => {
    const e = doorEstimate({ seatsTaken: 50, capacity: 100 });
    assert.equal(e.advice, null);
    assert.equal(e.earlyMinutes, 0);
  });
});

describe('Food wait', () => {
  test('is higher at 12:30 than at 10:00', () => {
    assert.ok(foodEstimate({ time: '12:30' }).wait > foodEstimate({ time: '10:00' }).wait);
  });
});

describe('Whole legs', () => {
  test('each direction is estimated from its own row', () => {
    const out = estimateLeg({ travel, from: at(AURORA), to: at(FOUNDRY), gapMinutes: 90, time: '09:30', sessionEnds: ENDS });
    const back = estimateLeg({ travel, from: at(FOUNDRY), to: at(AURORA), gapMinutes: 90, time: '09:30', sessionEnds: ENDS });
    assert.equal(out.options.find((o) => o.mode === 'Shuttle').total, 25);
    assert.equal(back.options.find((o) => o.mode === 'Shuttle').total, 27);
    assert.equal(back.options.length, 1);
  });

  test('the same venue gives nothing', () => {
    assert.equal(estimateLeg({ travel, from: at(AURORA), to: at(AURORA), gapMinutes: 15, time: '09:30', sessionEnds: ENDS }), null);
  });

  test('a leg that fits on paper stops fitting once the wait is added', () => {
    const args = { travel, from: at(AURORA), to: at(FOUNDRY), gapMinutes: 30 };
    assert.equal(assessTravel(args).options.find((o) => o.mode === 'Shuttle').fits, true);
    const shuttle = estimateLeg({ ...args, time: '09:21', sessionEnds: ENDS }).options.find((o) => o.mode === 'Shuttle');
    assert.equal(shuttle.fits, true);
    assert.equal(shuttle.wait, 19);
    assert.equal(shuttle.totalNow, 44);
    assert.equal(shuttle.fitsNow, false);
    const quick = estimateLeg({ ...args, time: '09:20', sessionEnds: ENDS }).options.find((o) => o.mode === 'Shuttle');
    assert.equal(quick.fitsNow, true);
  });
});

describe('Every estimate', () => {
  test('is never negative, is deterministic and reads as an estimate', () => {
    const labels = [];
    for (let m = 0; m < 24 * 60; m++) {
      const time = hhmm(m);
      const args = { time, sessionEnds: ENDS };
      const outs = [shuttleEstimate(args), pickupEstimate(args), foodEstimate({ time })];
      const leg = estimateLeg({ travel, from: at(AURORA, 3), to: at(FOUNDRY, 3), gapMinutes: 40, ...args });
      for (const e of outs) {
        for (const [k, v] of Object.entries(e)) if (typeof v === 'number') assert.ok(v >= 0, `${k} at ${time}`);
        labels.push(e.label);
      }
      labels.push(leg.label);
      for (const o of leg.options) assert.ok(o.wait >= 0 && o.totalNow >= o.total);
      assert.deepEqual(shuttleEstimate(args), shuttleEstimate(args));
      assert.deepEqual(estimateLeg({ travel, from: at(AURORA, 3), to: at(FOUNDRY, 3), gapMinutes: 40, ...args }), leg);
    }
    for (const seatsTaken of [0, 50, 90, 100]) {
      const e = doorEstimate({ seatsTaken, capacity: 100 });
      assert.ok(e.earlyMinutes >= 0);
      labels.push(e.label);
    }
    for (const l of labels) assert.match(l, /usually|about|~|estimate/i);
  });
});
