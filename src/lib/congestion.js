import { toMinutes } from './clock.js';
import { assessTravel } from './travel.js';

/**
 * Estimated waits and queues, derived from the conference clock.
 *
 * Pure and deterministic: the same time and inputs always give the same
 * numbers, and nothing here reads the real clock. Every result carries a
 * `label` worded as an estimate, because none of it is live data.
 *
 * `time` is `HH:MM`; `sessionEnds` is the list of `HH:MM` end times of
 * sessions at the departure venue.
 */

// Tuning
const SHUTTLE_FIRST = 7 * 60; // departures every 20 min from 07:00
const SHUTTLE_EVERY = 20;
const SURGE_PEAK_MINUTES = 10; // full surge this long after sessions end
const SURGE_END_MINUTES = 20; // gone by this long after
const SHUTTLE_QUEUE_PEAK = 15; // extra minutes at the peak
const PICKUP_BASE = 6;
const PICKUP_SURGE = 8;
const EVENING_START = 18 * 60;
const EVENING_UPLIFT = 3;
const FOOD_BASE = 3;
const FOOD_LUNCH_CENTRE = 12 * 60 + 30;
const FOOD_LUNCH_HALF_WIDTH = 60;
const FOOD_LUNCH_PEAK = 12;
const DOOR_BUSY_AT = 0.9;
const DOOR_EARLY_MINUTES = 10;

/** 1 for the first 10 minutes after the latest session end, easing to 0 by 20. */
function surge(now, sessionEnds = []) {
  let since = Infinity;
  for (const end of sessionEnds) {
    const d = now - toMinutes(end);
    if (d >= 0 && d < since) since = d;
  }
  if (since <= SURGE_PEAK_MINUTES) return 1;
  if (since >= SURGE_END_MINUTES) return 0;
  return (SURGE_END_MINUTES - since) / (SURGE_END_MINUTES - SURGE_PEAK_MINUTES);
}

/** Minutes until the next departure: 0 at a departure, 19 a minute after one. */
function nextDepartureWait(now) {
  if (now <= SHUTTLE_FIRST) return SHUTTLE_FIRST - now;
  return (SHUTTLE_EVERY - ((now - SHUTTLE_FIRST) % SHUTTLE_EVERY)) % SHUTTLE_EVERY;
}

export function shuttleEstimate({ time, sessionEnds }) {
  const now = toMinutes(time);
  const wait = nextDepartureWait(now);
  const queue = Math.round(SHUTTLE_QUEUE_PEAK * surge(now, sessionEnds));
  return {
    wait,
    queue,
    total: wait + queue,
    label: queue > 0
      ? `Usually about ${wait + queue} min to board, with a queue after sessions (estimate)`
      : `Usually about ${wait} min to the next shuttle (estimate)`,
  };
}

export function pickupEstimate({ time, sessionEnds }) {
  const now = toMinutes(time);
  const evening = now >= EVENING_START ? EVENING_UPLIFT : 0;
  const wait = Math.round(PICKUP_BASE + PICKUP_SURGE * surge(now, sessionEnds) + evening);
  return { wait, label: `Pickup usually about ${wait} min (estimate)` };
}

export function doorEstimate({ seatsTaken, capacity }) {
  const ratio = capacity > 0 ? seatsTaken / capacity : 0;
  if (capacity > 0 && ratio >= 1) {
    return { earlyMinutes: 0, advice: 'Full - waitlist only', label: 'Full, so waitlist only (estimate)' };
  }
  if (ratio >= DOOR_BUSY_AT) {
    return {
      earlyMinutes: DOOR_EARLY_MINUTES,
      advice: `Busy - arrive ${DOOR_EARLY_MINUTES} min early`,
      label: `Usually fills up, so arrive about ${DOOR_EARLY_MINUTES} min early (estimate)`,
    };
  }
  return { earlyMinutes: 0, advice: null, label: 'No queue expected at the door (estimate)' };
}

export function foodEstimate({ time }) {
  const now = toMinutes(time);
  const closeness = Math.max(0, 1 - Math.abs(now - FOOD_LUNCH_CENTRE) / FOOD_LUNCH_HALF_WIDTH);
  const wait = Math.round(FOOD_BASE + FOOD_LUNCH_PEAK * closeness);
  return { wait, label: `Usually about ${wait} min wait (estimate)` };
}

/**
 * `assessTravel`, plus what waiting adds. Each option gains `wait`, `totalNow`
 * and `fitsNow`: a leg that fits on paper may not once you queue for it.
 */
export function estimateLeg({ travel, from, to, gapMinutes, time, sessionEnds }) {
  const base = assessTravel({ travel, from, to, gapMinutes });
  if (!base) return null;

  const shuttle = shuttleEstimate({ time, sessionEnds });
  const pickup = pickupEstimate({ time, sessionEnds });
  const waitFor = (mode) => (mode === 'Shuttle' ? shuttle.total
    : mode === 'Rideshare' || mode === 'Taxi' ? pickup.wait : 0);

  const options = base.options
    .map((o) => {
      const wait = waitFor(o.mode);
      const totalNow = o.total + wait;
      return { ...o, wait, totalNow, fitsNow: gapMinutes >= totalNow };
    })
    .sort((a, b) => a.totalNow - b.totalNow);

  return {
    ...base,
    options,
    fastestNow: options[0],
    impossibleNow: options.every((o) => !o.fitsNow),
    label: 'Journey times include usual waits, about right but an estimate',
  };
}
