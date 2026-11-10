'use strict';

/**
 * business_hours.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Business hours / "accepting orders" window.
 *
 *   GET /api/business-hours — public status + weekly schedule
 *
 * The `business_hours` table stores one row per day_of_week (0 = Sunday).
 * A row with is_closed = TRUE means the cafe is closed the whole day.
 * If close_time < open_time the window is treated as overnight
 * (e.g. 22:00 → 02:00).
 *
 * The same helper is used by POST /api/orders so an order can never be
 * placed outside business hours, even if a client is out of date.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const db = require('../../config/db');

const TIMEZONE = process.env.BUSINESS_TIMEZONE || 'Asia/Manila';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// ─── Time helpers ─────────────────────────────────────────────────────────────

/** "07:00:00" | "07:00" → "07:00" */
function normalizeTime(value) {
  if (value == null) return null;
  return String(value).slice(0, 5);
}

/** "07:30" → 450 (minutes since midnight) */
function timeToMinutes(value) {
  const t = normalizeTime(value);
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

/** "07:30" → "7:30 AM" */
function formatTime12h(value) {
  const mins = timeToMinutes(value);
  if (mins == null) return '';
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function serializeDay(row) {
  if (!row) return null;
  const dayOfWeek = Number(row.day_of_week);
  return {
    day_of_week: dayOfWeek,
    day_name: DAY_NAMES[dayOfWeek] || '',
    open_time: normalizeTime(row.open_time),
    close_time: normalizeTime(row.close_time),
    is_closed: Boolean(row.is_closed),
  };
}

/**
 * Is `nowMinutes` inside the given day's window?
 * Handles overnight windows (close < open).
 */
function isWithinWindow(row, nowMinutes) {
  if (!row || row.is_closed) return false;

  const open = timeToMinutes(row.open_time);
  const close = timeToMinutes(row.close_time);
  if (open == null || close == null) return false;

  // open == close → treat as open all day (24h).
  if (open === close) return true;

  if (close > open) return nowMinutes >= open && nowMinutes < close;

  // Overnight window, e.g. 22:00 → 02:00.
  return nowMinutes >= open || nowMinutes < close;
}

/** Find the next opening slot starting from the current day/time. */
function findNextOpen(rows, dayOfWeek, nowMinutes) {
  const byDay = new Map(rows.map((r) => [Number(r.day_of_week), r]));

  for (let offset = 0; offset <= 7; offset++) {
    const dow = (dayOfWeek + offset) % 7;
    const row = byDay.get(dow);
    if (!row || row.is_closed) continue;

    const open = timeToMinutes(row.open_time);
    if (open == null) continue;

    // Today: only count openings still ahead of us.
    if (offset === 0 && open <= nowMinutes) continue;

    return { row, offset };
  }

  return null;
}

// ─── Core status computation ──────────────────────────────────────────────────

/**
 * Compute the current open/closed status from the database.
 * Accepts an optional pg client so it can run inside a transaction.
 */
async function computeBusinessHoursStatus(queryable = db) {
  const hoursResult = await queryable.query(
    `SELECT day_of_week, open_time, close_time, is_closed
       FROM business_hours
      ORDER BY day_of_week ASC`,
  );

  const nowResult = await queryable.query(
    `SELECT EXTRACT(DOW FROM (CURRENT_TIMESTAMP AT TIME ZONE $1))::int AS day_of_week,
            to_char((CURRENT_TIMESTAMP AT TIME ZONE $1), 'HH24:MI')     AS current_time`,
    [TIMEZONE],
  );

  const rows = hoursResult.rows;
  const dayOfWeek = Number(nowResult.rows[0].day_of_week);
  const currentTime = normalizeTime(nowResult.rows[0].current_time);
  const nowMinutes = timeToMinutes(currentTime) ?? 0;

  const byDay = new Map(rows.map((r) => [Number(r.day_of_week), r]));
  const todayRow = byDay.get(dayOfWeek) || null;
  const yesterdayRow = byDay.get((dayOfWeek + 6) % 7) || null;

  // No configuration at all → don't block anything (backwards compatible).
  if (rows.length === 0) {
    return {
      timezone: TIMEZONE,
      is_open: true,
      state: 'open',
      message: 'Open now',
      current: {
        day_of_week: dayOfWeek,
        day_name: DAY_NAMES[dayOfWeek],
        time: currentTime,
      },
      today: null,
      active: null,
      next_open: null,
      days: [],
    };
  }

  // Check today's window, then yesterday's overnight tail.
  let activeRow = null;
  if (isWithinWindow(todayRow, nowMinutes)) {
    activeRow = todayRow;
  } else if (isWithinWindow(yesterdayRow, nowMinutes)) {
    const yesterdayClose = timeToMinutes(yesterdayRow.close_time);
    const yesterdayOpen = timeToMinutes(yesterdayRow.open_time);
    // Only an overnight window can still be active on the next day.
    if (
      yesterdayClose != null &&
      yesterdayOpen != null &&
      yesterdayClose < yesterdayOpen &&
      nowMinutes < yesterdayClose
    ) {
      activeRow = yesterdayRow;
    }
  }

  const isOpen = activeRow != null;

  let message;
  let nextOpen = null;

  if (isOpen) {
    const close = timeToMinutes(activeRow.close_time);
    if (close != null && timeToMinutes(activeRow.open_time) === close) {
      message = 'Open now · 24 hours';
    } else {
      message = `Open now · until ${formatTime12h(activeRow.close_time)}`;
    }
  } else {
    nextOpen = findNextOpen(rows, dayOfWeek, nowMinutes);
    if (nextOpen) {
      const when =
        nextOpen.offset === 0
          ? 'today'
          : nextOpen.offset === 1
            ? 'tomorrow'
            : DAY_NAMES[Number(nextOpen.row.day_of_week)];
      message = `Closed · Opens ${when} at ${formatTime12h(nextOpen.row.open_time)}`;
    } else {
      message = 'Closed';
    }
  }

  return {
    timezone: TIMEZONE,
    is_open: isOpen,
    state: isOpen ? 'open' : 'closed',
    message,
    current: {
      day_of_week: dayOfWeek,
      day_name: DAY_NAMES[dayOfWeek],
      time: currentTime,
    },
    today: serializeDay(todayRow),
    active: serializeDay(activeRow),
    next_open: nextOpen
      ? {
          ...serializeDay(nextOpen.row),
          day_offset: nextOpen.offset,
          opens_at: formatTime12h(nextOpen.row.open_time),
        }
      : null,
    days: rows.map(serializeDay),
  };
}

// ─── GET /api/business-hours ──────────────────────────────────────────────────

async function getBusinessHours(req, res, next) {
  try {
    const status = await computeBusinessHoursStatus(db);
    res.set('Cache-Control', 'no-store');
    return res.json(status);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBusinessHours,
  computeBusinessHoursStatus,
  TIMEZONE,
};
