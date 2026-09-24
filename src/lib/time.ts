import type { ScheduleItem } from './types';

export const CAMPUS_TZ = 'Africa/Casablanca';
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type CampusNow = { date: string; dow: number; minutes: number };

/** Current date/time on campus (Ifrane, Morocco), independent of the device's time zone. */
export function campusNow(d = new Date()): CampusNow {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: CAMPUS_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const dow = DAYS_SHORT.indexOf(get('weekday')) + 1;
    const hour = Number(get('hour')) % 24;
    if (dow > 0 && !Number.isNaN(hour)) {
      return { date: `${get('year')}-${get('month')}-${get('day')}`, dow, minutes: hour * 60 + Number(get('minute')) };
    }
  } catch {
    // fall through to device-local time
  }
  const js = d.getDay();
  return { date: toISODate(d), dow: js === 0 ? 7 : js, minutes: d.getHours() * 60 + d.getMinutes() };
}

export function toISODate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function dowOf(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

/** Operating hours: weekdays 08:00–23:00, weekends 11:00–21:00. */
export function openHours(dow: number) {
  return dow >= 6 ? { open: 11 * 60, close: 21 * 60 } : { open: 8 * 60, close: 23 * 60 };
}

export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

export const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** "14:30:00" -> "2:30 PM" */
export function fmtTime(t: string | number) {
  const m = typeof t === 'number' ? t : toMin(t);
  const h = Math.floor(m / 60) % 24;
  const mm = String(m % 60).padStart(2, '0');
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${suffix}`;
}

export const fmtRange = (a: string, b: string) => `${fmtTime(a)} – ${fmtTime(b)}`;

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  try {
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
  } catch {
    return iso.slice(0, 10);
  }
}

export type LiveStatus =
  | { state: 'closed'; label: string; detail: string }
  | { state: 'busy'; label: string; detail: string; item: ScheduleItem }
  | { state: 'free'; label: string; detail: string };

/** Live availability of one facility given its weekly program. */
export function liveStatus(items: ScheduleItem[], now: CampusNow): LiveStatus {
  const { open, close } = openHours(now.dow);
  const today = items.filter((i) => i.day_of_week === now.dow).sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
  if (now.minutes < open || now.minutes >= close) {
    return {
      state: 'closed',
      label: 'Closed',
      detail: now.minutes < open ? `Opens at ${fmtTime(open)}` : `Opens tomorrow`,
    };
  }
  const current = today.filter((i) => toMin(i.start_time) <= now.minutes && now.minutes < toMin(i.end_time));
  if (current.length) {
    const item = current[0];
    return {
      state: 'busy',
      label: 'In use',
      detail: `${current.map((c) => c.activity).join(' + ')} until ${fmtTime(item.end_time)}`,
      item,
    };
  }
  const next = today.find((i) => toMin(i.start_time) > now.minutes);
  return {
    state: 'free',
    label: 'Available',
    detail: next ? `Free until ${fmtTime(next.start_time)} (${next.activity})` : `Free until closing (${fmtTime(close)})`,
  };
}

/** Free windows for a given day, between opening hours, minus scheduled items. */
export function freeWindows(items: ScheduleItem[], dow: number) {
  const { open, close } = openHours(dow);
  const busy = items
    .filter((i) => i.day_of_week === dow)
    .map((i) => [Math.max(open, toMin(i.start_time)), Math.min(close, toMin(i.end_time))] as const)
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cur = open;
  for (const [a, b] of busy) {
    if (a > cur) out.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (cur < close) out.push([cur, close]);
  return out;
}

export function monthStart(iso: string) {
  return iso.slice(0, 7) + '-01';
}
