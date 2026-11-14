/**
 * Travel-time helpers for a conference spread across two sites.
 *
 * The Foundry is 6.2 miles from Aurora. Getting between them is a real
 * cost in minutes, and any feature that reasons about an attendee's day
 * should account for it.
 */

/** All modes between two venues, cheapest-in-time first. */
export function routesBetween(travel, fromVenueId, toVenueId) {
  return travel
    .filter((t) => t.fromVenueId === fromVenueId && t.toVenueId === toVenueId)
    .sort((a, b) => a.minutes - b.minutes);
}

/**
 * Can you get from one session to the next in the gap between them?
 *
 * Returns every mode that fits and every mode that does not, because the
 * interesting answer is rarely yes or no — it is usually "not on the free
 * shuttle, but a rideshare just about does it".
 */
export function assessTravel({ travel, from, to, gapMinutes }) {
  if (!from || !to || from.venue.id === to.venue.id) return null;

  const walk = to.room.walkMinutes ?? 0;
  const options = travel
    .filter((t) => t.fromVenueId === from.venue.id && t.toVenueId === to.venue.id && t.mode !== 'Walk')
    .map((t) => ({ ...t, total: t.minutes + walk, fits: gapMinutes >= t.minutes + walk }))
    .sort((a, b) => a.total - b.total);

  if (!options.length) return null;
  const free = options.find((o) => o.costUsd === 0);

  return {
    gapMinutes,
    walk,
    options,
    fastest: options[0],
    free,
    // nothing fits at all, or only something you have to pay for
    impossible: options.every((o) => !o.fits),
    freeTooSlow: Boolean(free && !free.fits && options.some((o) => o.fits)),
  };
}

const mins = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * The hops between this session and the confirmed seats right next to it that
 * day, one per direction, only where the venue changes. `schedule` is the
 * `/users/:id/schedule` payload (`{ days }`); `reservationFor` is the
 * store's, so a seat dropped on the page drops its hop at once. Only the
 * nearest neighbour counts, and you must hold this session too.
 */
export function hopsFor({ session, schedule, travel, reservationFor }) {
  if (reservationFor(session.id) !== 'confirmed') return [];
  const mine = (schedule?.days ?? []).flatMap((d) => d.sessions)
    .filter((s) => s.id !== session.id && s.day === session.day && reservationFor(s.id) === 'confirmed');
  const before = mine.filter((s) => mins(s.endsAt) <= mins(session.startsAt))
    .sort((a, b) => mins(b.endsAt) - mins(a.endsAt))[0];
  const after = mine.filter((s) => mins(s.startsAt) >= mins(session.endsAt))
    .sort((a, b) => mins(a.startsAt) - mins(b.startsAt))[0];

  return [
    before && { direction: 'previous', other: before, from: before, to: session, gap: mins(session.startsAt) - mins(before.endsAt) },
    after && { direction: 'next', other: after, from: session, to: after, gap: mins(after.startsAt) - mins(session.endsAt) },
  ].filter(Boolean)
    .map(({ direction, other, from, to, gap }) => ({ direction, other, assessment: assessTravel({ travel, from, to, gapMinutes: gap }) }))
    .filter((h) => h.assessment);
}

const cost = (o) => (o.costUsd ? `$${o.costUsd.toFixed(2)}` : 'free');

/** One plain sentence on whether the hop works. */
export function hopSummary(a) {
  if (a.impossible) {
    return `You will not make it in time: nothing gets you there in ${a.gapMinutes} minutes.`;
  }
  if (a.freeTooSlow) {
    const paid = a.options.filter((o) => o.fits).sort((x, y) => x.costUsd - y.costUsd || x.total - y.total)[0];
    return `The free shuttle is too slow for ${a.gapMinutes} minutes. ${paid.mode} fits (${paid.total} min, ${cost(paid)}).`;
  }
  if (a.free?.fits) return `The free shuttle works: ${a.free.total} minutes in a ${a.gapMinutes}-minute gap.`;
  const best = a.options.find((o) => o.fits);
  return `${best.mode} fits (${best.total} min, ${cost(best)}).`;
}
