import { toMinutes } from './clock.js';

/** 150 → "2.5h", 120 → "2h". */
export const hoursLabel = (mins) => `${Number((mins / 60).toFixed(1))}h`;

const minutesHeld = (sessions, status) => sessions
  .filter((s) => s.reservation === status)
  .reduce((n, s) => n + s.durationMins, 0);

/** Every overlapping pair, both statuses — the same rule as `agenda.js:clashesIn`. */
function clashesIn(sessions) {
  const clashes = [];
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      if (toMinutes(a.startsAt) < toMinutes(b.endsAt) && toMinutes(b.startsAt) < toMinutes(a.endsAt)) {
        clashes.push({ type: 'overlap', sessionIds: [a.id, b.id] });
      }
    }
  }
  return clashes;
}

/**
 * The fetched schedule re-read through the store, so a removed session leaves
 * the page at once: sessions the attendee no longer holds drop out, status comes
 * from `reservationFor`, and conflicts, minute totals and venues are recomputed
 * for what is left. A day with nothing left disappears.
 */
export function viewDays(days, reservationFor) {
  return days
    .map((d) => {
      const sessions = d.sessions
        .map((s) => ({ ...s, reservation: reservationFor(s.id) }))
        .filter((s) => s.reservation);
      return {
        ...d,
        sessions,
        conflicts: clashesIn(sessions),
        totalMinutes: minutesHeld(sessions, 'confirmed'),
        waitlistedMinutes: minutesHeld(sessions, 'waitlisted'),
        venuesVisited: [...new Set(sessions.map((s) => s.venue.shortName))],
      };
    })
    .filter((d) => d.sessions.length > 0);
}
