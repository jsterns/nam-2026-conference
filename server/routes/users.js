import { Router } from 'express';
import { db } from '../db.js';
import { SESSION_SELECT, toUser, toSpeaker, toSession } from '../lib/query.js';
import { reserveSeat, releaseSeat, seatState } from '../lib/seats.js';
import { attendanceState, checkIn, rateSession } from '../lib/attendance.js';
import { deckFor, matchesFor, decide, isReady } from '../lib/people.js';
import { todayFor, scheduleFor } from '../lib/agenda.js';
import { agendaCalendar, baseUrlFor } from '../lib/ical.js';

export const usersRouter = Router();

const allUsers = db.prepare('SELECT * FROM users ORDER BY id');
const getUser = db.prepare('SELECT * FROM users WHERE id = ?');
const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?');
const speakerExists = db.prepare('SELECT 1 FROM speakers WHERE id = ?');
const getSpeaker = db.prepare('SELECT * FROM speakers WHERE id = ?');
const followedSpeakers = db.prepare(`
  SELECT sp.* FROM speaker_follows sf JOIN speakers sp ON sp.id = sf.speaker_id
  WHERE sf.user_id = ? ORDER BY sp.name`);
const presenting = db.prepare(`${SESSION_SELECT}
  JOIN session_speakers ss ON ss.session_id = s.id
  WHERE ss.speaker_id = ? ORDER BY s.day, s.starts_at`);
const myReservations = db.prepare('SELECT session_id, status FROM reservations WHERE user_id = ?');
const myCheckIns = db.prepare('SELECT session_id FROM check_ins WHERE user_id = ?');
const myRatings = db.prepare('SELECT session_id, stars FROM ratings WHERE user_id = ?');
const myTrackSlugs = db.prepare(`
  SELECT t.slug FROM user_tracks ut JOIN tracks t ON t.id = ut.track_id
  WHERE ut.user_id = ? ORDER BY t.id`);
const trackIdBySlug = db.prepare('SELECT id FROM tracks WHERE slug = ?');
const clearTracks = db.prepare('DELETE FROM user_tracks WHERE user_id = ?');
const addTrack = db.prepare('INSERT INTO user_tracks (user_id, track_id) VALUES (?, ?)');
const setRole = db.prepare('UPDATE users SET role = ? WHERE id = ?');
const follow = db.prepare('INSERT OR IGNORE INTO speaker_follows (user_id, speaker_id) VALUES (?, ?)');
const unfollow = db.prepare('DELETE FROM speaker_follows WHERE user_id = ? AND speaker_id = ?');

/** Sessions this user is presenting, if their account is linked to a speaker. */
const speakingSessions = (speakerId) =>
  (speakerId ? presenting.all(speakerId).map((r) => toSession(r)) : []);

usersRouter.get('/', (req, res) => {
  res.json(allUsers.all().map((u) => toUser(u)));
});

usersRouter.get('/:id', (req, res) => {
  const row = getUser.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Attendee not found' });

  res.json(toUser(row, {
    followedSpeakers: followedSpeakers.all(row.id).map((s) => toSpeaker(s)),
    speaker: row.speaker_id ? toSpeaker(getSpeaker.get(row.speaker_id)) : null,
    speakingSessions: speakingSessions(row.speaker_id),
    reservations: myReservations.all(row.id).map((r) => ({ sessionId: r.session_id, status: r.status })),
    checkIns: myCheckIns.all(row.id).map((c) => c.session_id),
    ratings: myRatings.all(row.id).map((r) => ({ sessionId: r.session_id, stars: r.stars })),
    trackSlugs: myTrackSlugs.all(row.id).map((t) => t.slug),
  }));
});

const replaceTracks = db.transaction((userId, trackIds) => {
  clearTracks.run(userId);
  for (const id of trackIds) addTrack.run(userId, id);
});

/**
 * PUT /api/users/:id/tracks  { trackSlugs }
 * Replaces the tracks this attendee picked. At least one is needed, and every
 * slug must name a track.
 */
usersRouter.put('/:id/tracks', (req, res) => {
  if (!userExists.get(req.params.id)) return res.status(404).json({ error: 'Attendee not found' });
  const { trackSlugs } = req.body ?? {};
  if (!Array.isArray(trackSlugs) || trackSlugs.length === 0) {
    return res.status(400).json({ error: 'Choose at least one track' });
  }
  const ids = trackSlugs.map((slug) => trackIdBySlug.get(String(slug))?.id);
  if (ids.some((id) => id === undefined)) return res.status(400).json({ error: 'Unknown track' });

  const userId = Number(req.params.id);
  replaceTracks(userId, [...new Set(ids)]);
  res.json({ trackSlugs: myTrackSlugs.all(userId).map((t) => t.slug) });
});

/**
 * PUT /api/users/:id/role  { role }
 * Stores whether the attendee is a buyer or a seller. Anything else is refused.
 */
usersRouter.put('/:id/role', (req, res) => {
  if (!userExists.get(req.params.id)) return res.status(404).json({ error: 'Attendee not found' });
  const { role } = req.body ?? {};
  if (role !== 'buyer' && role !== 'seller') {
    return res.status(400).json({ error: 'Role must be buyer or seller' });
  }
  setRole.run(role, req.params.id);
  res.json({ role });
});

/**
 * GET /api/users/:id/people
 * The deck (opposite role, a shared track, nobody already decided) and the matches.
 * `ready` is false without a role or a saved track, and the deck is then empty.
 */
usersRouter.get('/:id/people', (req, res) => {
  const row = getUser.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Attendee not found' });
  res.json({ ready: isReady(row), deck: deckFor(row.id), matches: matchesFor(row.id) });
});

/**
 * PUT /api/users/:id/people/:targetId  { choice: 'like' | 'pass', day?, time? }
 * The first decision stands; a repeat answers with it and changes nothing. A like that
 * makes a match also answers with its coffee invite, picked from the clock in `day`/`time`.
 */
usersRouter.put('/:id/people/:targetId', (req, res) => {
  if (!userExists.get(req.params.id) || !userExists.get(req.params.targetId)) {
    return res.status(404).json({ error: 'Attendee not found' });
  }
  const { choice } = req.body ?? {};
  if (choice !== 'like' && choice !== 'pass') {
    return res.status(400).json({ error: 'Choice must be like or pass' });
  }
  if (Number(req.params.id) === Number(req.params.targetId)) {
    return res.status(400).json({ error: 'You cannot decide on yourself' });
  }
  res.json(decide(Number(req.params.id), Number(req.params.targetId), choice,
    { day: req.body?.day, time: req.body?.time }));
});

/** A subscribable feed of everything this attendee holds a seat for. */
usersRouter.get('/:id/agenda.ics', (req, res) => {
  const ics = agendaCalendar(Number(req.params.id), baseUrlFor(req));
  if (!ics) return res.status(404).json({ error: 'Attendee not found' });
  res.type('text/calendar').set('Content-Disposition', 'attachment; filename="orbit-agenda.ics"').send(ics);
});

/**
 * GET /api/users/:id/today?day=&time=
 *
 * Everything a personal view needs about *this* attendee at *this* moment:
 * what they are in now, what is next, what they are waiting on, and — for the
 * slots they have left empty — a few suggestions drawn from what they have
 * actually been booking rather than what they once declared.
 */
usersRouter.get('/:id/today', (req, res) => {
  if (!userExists.get(req.params.id)) return res.status(404).json({ error: 'Attendee not found' });
  const { day, time } = req.query;
  if (!day) return res.status(400).json({ error: 'day is required' });

  res.json(todayFor(Number(req.params.id), { day, time }));
});

/**
 * GET /api/users/:id/schedule
 * Every session this attendee holds a seat or a waitlist place for, grouped by
 * day, with that day's clashes and totals.
 */
usersRouter.get('/:id/schedule', (req, res) => {
  const user = getUser.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Attendee not found' });

  res.json({ user: toUser(user), days: scheduleFor(user.id) });
});

/**
 * Seats. PUT takes one (or joins the waitlist if the room is full), DELETE
 * gives it back and promotes whoever has waited longest. Both return the whole
 * seat state so the client never has to guess.
 */
usersRouter.put('/:id/reservations/:sessionId', (req, res) => {
  if (!userExists.get(req.params.id)) return res.status(404).json({ error: 'Attendee not found' });
  const state = reserveSeat(Number(req.params.id), Number(req.params.sessionId),
    { day: req.body?.day, time: req.body?.time });
  if (!state) return res.status(404).json({ error: 'Session not found' });
  // 409: overlaps a seat you hold, or the session is already over
  res.status(state.rejected ? 409 : 200).json(state);
});

/**
 * Turning up and saying what you thought. `now` comes from the client, because
 * the conference clock is simulated — see CLAUDE.md.
 */
usersRouter.get('/:id/attendance/:sessionId', (req, res) => {
  const state = attendanceState(Number(req.params.sessionId), Number(req.params.id),
    { day: req.query.day, time: req.query.time });
  if (!state) return res.status(404).json({ error: 'Session not found' });
  res.json(state);
});

usersRouter.put('/:id/checkins/:sessionId', (req, res) => {
  if (!userExists.get(req.params.id)) return res.status(404).json({ error: 'Attendee not found' });
  const state = checkIn(Number(req.params.id), Number(req.params.sessionId),
    { day: req.body?.day, time: req.body?.time });
  if (!state) return res.status(404).json({ error: 'Session not found' });
  res.status(state.rejected ? 409 : 200).json(state);
});

usersRouter.put('/:id/ratings/:sessionId', (req, res) => {
  const stars = Number(req.body?.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'stars must be an integer from 1 to 5' });
  }
  const { comment } = req.body ?? {};
  if (comment !== undefined && comment !== null && (typeof comment !== 'string' || comment.length > 1000)) {
    return res.status(400).json({ error: 'comment must be a string of at most 1000 characters' });
  }
  if (!userExists.get(req.params.id)) return res.status(404).json({ error: 'Attendee not found' });
  const state = rateSession(Number(req.params.id), Number(req.params.sessionId),
    { stars, comment: req.body?.comment }, { day: req.body?.day, time: req.body?.time });
  if (!state) return res.status(404).json({ error: 'Session not found' });
  res.status(state.rejected ? 409 : 200).json(state);
});

usersRouter.delete('/:id/reservations/:sessionId', (req, res) => {
  const state = releaseSeat(Number(req.params.id), Number(req.params.sessionId));
  if (!state) return res.status(404).json({ error: 'Session not found' });
  res.json(state);
});

usersRouter.get('/:id/reservations/:sessionId', (req, res) => {
  const state = seatState(Number(req.params.sessionId), Number(req.params.id));
  if (!state) return res.status(404).json({ error: 'Session not found' });
  res.json(state);
});

usersRouter.put('/:id/follows/:speakerId', (req, res) => {
  if (!userExists.get(req.params.id)) return res.status(404).json({ error: 'Attendee not found' });
  if (!speakerExists.get(req.params.speakerId)) {
    return res.status(404).json({ error: 'Speaker not found' });
  }
  follow.run(req.params.id, req.params.speakerId);
  res.json({ following: true, speakerId: Number(req.params.speakerId) });
});

usersRouter.delete('/:id/follows/:speakerId', (req, res) => {
  unfollow.run(req.params.id, req.params.speakerId);
  res.json({ following: false, speakerId: Number(req.params.speakerId) });
});
