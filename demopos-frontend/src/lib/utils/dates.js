/**
 * Date utility helpers using LOCAL time (not UTC).
 *
 * Using `new Date().toISOString()` returns the UTC date, which is wrong for
 * users in negative-offset timezones (e.g., UTC-5 at 11 PM shows yesterday).
 * These helpers use local year/month/day to match what the user sees.
 */

/**
 * Format a Date object as YYYY-MM-DD using local time.
 * @param {Date} date
 * @returns {string}
 */
export function localDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Returns today's date as YYYY-MM-DD in local time.
 * @returns {string}
 */
export function today() {
  return localDateStr()
}

/**
 * Returns the date N days ago as YYYY-MM-DD in local time.
 * @param {number} n
 * @returns {string}
 */
export function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateStr(d)
}

/**
 * Returns the Monday of the current week as YYYY-MM-DD in local time.
 * @returns {string}
 */
export function thisWeekStart() {
  const now = new Date()
  const day = now.getDay() // 0 = Sun
  const mon = new Date(now)
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  return localDateStr(mon)
}

/**
 * Returns { start, end } for the full calendar month of year/month (0-indexed).
 * @param {number} year
 * @param {number} month  0-indexed (JS Date style)
 * @returns {{ start: string, end: string }}
 */
export function monthRange(year, month) {
  return {
    start: localDateStr(new Date(year, month, 1)),
    end:   localDateStr(new Date(year, month + 1, 0)),
  }
}

/**
 * Returns { start, end } for the current calendar month.
 * @returns {{ start: string, end: string }}
 */
export function currentMonthRange() {
  const now = new Date()
  return monthRange(now.getFullYear(), now.getMonth())
}

/**
 * Returns { start, end } for the previous calendar month.
 * @returns {{ start: string, end: string }}
 */
export function lastMonthRange() {
  const now = new Date()
  return monthRange(now.getFullYear(), now.getMonth() - 1)
}

/**
 * Returns true if two YYYY-MM-DD strings fall in the same calendar month.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function sameMonth(a, b) {
  return a.slice(0, 7) === b.slice(0, 7)
}

/**
 * Format a date value as dd/MM/yyyy for display.
 * Accepts Date objects, ISO strings, or anything parseable by new Date().
 * Returns '—' for null/undefined/invalid.
 * @param {Date|string|null|undefined} value
 * @returns {string}
 */
export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  const dd   = String(d.getDate()).padStart(2, '0')
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}
