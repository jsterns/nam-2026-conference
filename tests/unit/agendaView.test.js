import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { viewDays, hoursLabel } from '../../src/lib/agendaView.js';

const s = (id, startsAt, endsAt, durationMins, venue = 'Main') => ({
  id, startsAt, endsAt, durationMins, venue: { shortName: venue },
});
const day = (date, sessions) => ({ date, sessions });
const held = (map) => (id) => map[id] ?? null;

describe('viewDays', () => {
  test('groups what the store holds by day, confirmed and waitlisted alike', () => {
    const days = [
      day('2026-11-14', [s(1, '09:00', '10:00', 60), s(2, '11:00', '12:00', 60)]),
      day('2026-11-15', [s(3, '09:00', '09:30', 30)]),
    ];
    const out = viewDays(days, held({ 1: 'confirmed', 2: 'waitlisted', 3: 'confirmed' }));
    assert.deepEqual(out.map((d) => d.date), ['2026-11-14', '2026-11-15']);
    assert.deepEqual(out[0].sessions.map((x) => [x.id, x.reservation]), [[1, 'confirmed'], [2, 'waitlisted']]);
  });

  test('totals confirmed time only and keeps queued time apart', () => {
    const days = [day('d', [s(1, '09:00', '10:00', 60), s(2, '10:15', '11:00', 45), s(3, '13:00', '14:30', 90)])];
    const [d] = viewDays(days, held({ 1: 'confirmed', 2: 'waitlisted', 3: 'confirmed' }));
    assert.equal(d.totalMinutes, 150);
    assert.equal(d.waitlistedMinutes, 45);
  });

  test('marks overlapping sessions as a clash, even when one is waitlisted', () => {
    const days = [day('d', [s(1, '09:00', '10:00', 60), s(2, '09:30', '10:30', 60), s(3, '10:30', '11:00', 30)])];
    const [d] = viewDays(days, held({ 1: 'confirmed', 2: 'waitlisted', 3: 'confirmed' }));
    assert.deepEqual(d.conflicts, [{ type: 'overlap', sessionIds: [1, 2] }]);
  });

  test('a session the store no longer holds drops out, with its clash and its minutes', () => {
    const days = [day('d', [s(1, '09:00', '10:00', 60), s(2, '09:30', '10:30', 60, 'North')])];
    const [d] = viewDays(days, held({ 1: 'confirmed' }));
    assert.deepEqual(d.sessions.map((x) => x.id), [1]);
    assert.deepEqual(d.conflicts, []);
    assert.equal(d.totalMinutes, 60);
    assert.deepEqual(d.venuesVisited, ['Main']);
  });

  test('a day with nothing left disappears, and nothing held gives no days', () => {
    const days = [day('a', [s(1, '09:00', '10:00', 60)]), day('b', [s(2, '09:00', '10:00', 60)])];
    assert.deepEqual(viewDays(days, held({ 2: 'waitlisted' })).map((d) => d.date), ['b']);
    assert.deepEqual(viewDays(days, held({})), []);
    assert.deepEqual(viewDays([], held({})), []);
  });

  test('takes status from the store, not the fetched payload', () => {
    const days = [day('d', [{ ...s(1, '09:00', '10:00', 60), reservation: 'waitlisted' }])];
    const [d] = viewDays(days, held({ 1: 'confirmed' }));
    assert.equal(d.sessions[0].reservation, 'confirmed');
    assert.equal(d.totalMinutes, 60);
    assert.equal(d.waitlistedMinutes, 0);
  });
});

describe('hoursLabel', () => {
  test('shows hours to one decimal without a trailing zero', () => {
    assert.equal(hoursLabel(0), '0h');
    assert.equal(hoursLabel(45), '0.8h');
    assert.equal(hoursLabel(120), '2h');
    assert.equal(hoursLabel(150), '2.5h');
  });
});
