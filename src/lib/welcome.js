/**
 * What the welcome dialog shows. An entry is "new" while it is worth pointing
 * a first-time visitor at; flip `isNew` off (or delete it) when it is not.
 *
 * `to` is a path, or a function of `{ days }` so a link that needs a date is
 * built from the conference's own days, never hard-coded. `target` is reserved
 * for a later guided tour and is not used by the UI yet.
 */
export const WELCOME_ENTRIES = [
  {
    id: 'tracks',
    title: 'Pick several tracks at once',
    description: 'Press more than one track chip on the schedule to see those tracks side by side.',
    isNew: true,
    to: '/schedule?track=agents-tool-use,rag-retrieval',
    tourTo: '/schedule',
    target: 'schedule-tracks',
    reveal: 'filters',
    tourText: 'Press more than one track chip to see those tracks side by side.',
  },
  {
    id: 'venues',
    title: "Know when you can't get there in time",
    description: 'This Foundry session is followed by one at Aurora, 6 miles away. Add both and see the travel warning.',
    isNew: true,
    to: '/sessions/68',
    target: 'seat-button',
    tourText: 'Add this session, then the Aurora one in the next slot, and the travel warning appears.',
    hint: 'Add this session, then the Aurora one in the next slot.',
  },
];

export const newEntries = () => WELCOME_ENTRIES.filter((e) => e.isNew);

export const welcomeHref = (entry, ctx = {}) => (typeof entry.to === 'function' ? entry.to(ctx) : entry.to);

/** One tour step per new entry. `target` names a `data-tour` element; `reveal` a `data-tour-reveal` control to open first on a phone. */
export const tourSteps = (entries, ctx = {}) => entries.map((e) => ({
  id: e.id,
  title: e.title,
  text: e.tourText ?? e.description,
  target: e.target,
  reveal: e.reveal,
  href: typeof e.tourTo === 'function' ? e.tourTo(ctx) : (e.tourTo ?? welcomeHref(e, ctx)),
}));

export const stepLabel = (i, n) => `${i + 1} of ${n}`;

const KEY = 'orbit:welcomeSeen';

export function hasSeenWelcome() {
  try { return globalThis.localStorage?.getItem(KEY) === '1'; } catch { return false; }
}

export function markWelcomeSeen() {
  try { globalThis.localStorage?.setItem(KEY, '1'); } catch { /* storage unavailable: it just opens next visit */ }
}
