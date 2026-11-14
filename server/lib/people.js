import { db } from '../db.js';
import { toInvite, toMinutes, toUser } from './query.js';

/**
 * The People deck: who an attendee may still meet, who they matched with, and
 * the pass or like that moves someone between the two.
 */

const getUser = db.prepare('SELECT * FROM users WHERE id = ?');
const slugsOf = db.prepare(`
  SELECT t.slug FROM user_tracks ut JOIN tracks t ON t.id = ut.track_id
  WHERE ut.user_id = ? ORDER BY t.id`);
const trackCount = db.prepare('SELECT COUNT(*) n FROM user_tracks WHERE user_id = ?');

const deckRows = db.prepare(`
  SELECT u.* FROM users u
  WHERE u.id != @id AND u.role = @opposite
    AND EXISTS (SELECT 1 FROM user_tracks a JOIN user_tracks b ON b.track_id = a.track_id
                WHERE a.user_id = @id AND b.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM people_decisions d WHERE d.user_id = @id AND d.target_id = u.id)
  ORDER BY u.id`);

// Mutual likes only. Neither side's current role or tracks is looked at, so a
// match survives either of them changing.
const matchRows = db.prepare(`
  SELECT u.* FROM users u
  WHERE EXISTS (SELECT 1 FROM people_decisions d WHERE d.user_id = @id AND d.target_id = u.id AND d.choice = 'like')
    AND EXISTS (SELECT 1 FROM people_decisions d WHERE d.user_id = u.id AND d.target_id = @id AND d.choice = 'like')
  ORDER BY u.id`);

const insertDecision = db.prepare('INSERT OR IGNORE INTO people_decisions (user_id, target_id, choice) VALUES (?, ?, ?)');
const storedChoice = db.prepare('SELECT choice FROM people_decisions WHERE user_id = ? AND target_id = ?');
const likedBy = db.prepare(`SELECT 1 FROM people_decisions WHERE user_id = ? AND target_id = ? AND choice = 'like'`);

export const COFFEE_MESSAGE = 'Up for a coffee and a chill?';
export const NO_TIME_MESSAGE = 'No time is available for a coffee.';

const allSlots = db.prepare('SELECT DISTINCT day, starts_at FROM sessions ORDER BY day, starts_at');
const busySlots = db.prepare(`
  SELECT s.day, s.starts_at FROM reservations r JOIN sessions s ON s.id = r.session_id
  WHERE r.user_id = ? AND r.status = 'confirmed'`);
const insertInvite = db.prepare(
  'INSERT OR IGNORE INTO match_invites (user_a, user_b, message, day, starts_at) VALUES (?, ?, ?, ?, ?)');
const storedInvite = db.prepare('SELECT * FROM match_invites WHERE user_a = ? AND user_b = ?');

const card = (row) => toUser(row, { trackSlugs: slugsOf.all(row.id).map((t) => t.slug) });

/** The attendee needs a role and at least one saved track before they have a deck. */
export function isReady(user) {
  return !!user.role && trackCount.get(user.id).n > 0;
}

export function deckFor(userId) {
  const me = getUser.get(userId);
  if (!isReady(me)) return [];
  return deckRows.all({ id: userId, opposite: me.role === 'buyer' ? 'seller' : 'buyer' }).map(card);
}

export function matchesFor(userId) {
  return matchRows.all({ id: userId }).map((row) => {
    const invite = storedInvite.get(Math.min(userId, row.id), Math.max(userId, row.id));
    return { ...card(row), invite: invite ? toInvite(invite) : null };
  });
}

/**
 * Stores the first choice and keeps it; `matched` is true when the other side already liked back.
 * A like that completes a match also fixes its coffee `invite` (once; a repeat never rewrites it),
 * from `now` = `{ day, time }`, the clock of whoever made the match.
 */
export function decide(userId, targetId, choice, now) {
  insertDecision.run(userId, targetId, choice);
  const stored = storedChoice.get(userId, targetId).choice;
  const matched = stored === 'like' && !!likedBy.get(targetId, userId);
  if (!matched) return { choice: stored, matched };
  const [a, b] = userId < targetId ? [userId, targetId] : [targetId, userId];
  const slot = inviteFor(a, b, now);
  insertInvite.run(a, b, slot ? COFFEE_MESSAGE : NO_TIME_MESSAGE, slot?.day ?? null, slot?.starts_at ?? null);
  return { choice: stored, matched, invite: toInvite(storedInvite.get(a, b)) };
}

/** The first slot from `now` on in which neither attendee holds a confirmed seat; waitlist places do not count. */
function inviteFor(a, b, now) {
  const busy = new Set([a, b].flatMap((id) => busySlots.all(id).map((s) => `${s.day} ${s.starts_at}`)));
  const from = now?.day && now?.time ? toMinutes(now.time) : null;
  return allSlots.all().find((s) => {
    if (from !== null && (s.day < now.day || (s.day === now.day && toMinutes(s.starts_at) < from))) return false;
    return !busy.has(`${s.day} ${s.starts_at}`);
  });
}
