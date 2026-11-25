// Plain helpers for the upgraded dashboard: greeting, next event, countdown, streak,
// avenue bars and the prospect dues contact.

export function greetingFor(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function todayLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

export function firstName(name = "") {
  const clean = String(name).replace(/^Rtr\.?\s+/i, "").trim();
  return clean.split(/\s+/)[0] || "";
}

function eventStart(event) {
  // Events carry a date only; count down to 10 am IST that day as a neutral start.
  return new Date(`${event.date}T10:00:00+05:30`);
}

// The soonest event that has not started yet.
export function nextEvent(events = [], now = new Date()) {
  return [...events]
    .filter((event) => event?.date && eventStart(event) > now)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

export function countdownParts(event, now = new Date()) {
  if (!event) return null;
  let ms = Math.max(0, eventStart(event).getTime() - now.getTime());
  const days = Math.floor(ms / 86_400_000); ms -= days * 86_400_000;
  const hours = Math.floor(ms / 3_600_000); ms -= hours * 3_600_000;
  const minutes = Math.floor(ms / 60_000); ms -= minutes * 60_000;
  const seconds = Math.floor(ms / 1000);
  return { days, hours, minutes, seconds };
}

export function daysUntil(event, now = new Date()) {
  if (!event) return null;
  const start = new Date(`${event.date}T00:00:00+05:30`);
  const today = new Date(now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00+05:30");
  return Math.round((start - today) / 86_400_000);
}

// Events attended in a row, counting back from the most recent counted event.
export function attendanceStreak(recent = []) {
  let streak = 0;
  for (const event of [...recent].sort((a, b) => b.date.localeCompare(a.date))) {
    if (event.label === "Present") streak += 1;
    else if (event.label === "Absent") break;
  }
  return streak;
}

// A short line under the greeting: the next event, then the streak.
export function dashboardNudge({ upcoming = [], recent = [], now = new Date() } = {}) {
  const parts = [];
  const event = nextEvent(upcoming, now);
  const days = daysUntil(event, now);
  if (event && days !== null) {
    const when = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    parts.push(`Next up: ${event.name} ${when}.`);
  }
  const streak = attendanceStreak(recent);
  if (streak >= 2) parts.push(`You've attended ${streak} events in a row.`);
  return parts.join(" ");
}

// One bar per avenue, from the attendance breakdown the dashboard already receives.
export function avenueBars(breakdown = []) {
  return breakdown
    .filter((row) => row.avenue && row.totalCounted)
    .map((row) => ({
      avenue: row.avenue,
      present: row.present ?? 0,
      total: row.totalCounted,
      percent: Math.round(((row.present ?? 0) / row.totalCounted) * 100),
    }))
    .sort((a, b) => b.total - a.total);
}

export function normalizeDuesContact(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 120) : "";
  const role = typeof raw.role === "string" ? raw.role.trim().slice(0, 120) : "";
  const phone = typeof raw.phone === "string" ? raw.phone.trim().slice(0, 40) : "";
  const digits = phone.replace(/[^\d+]/g, "");
  if (!name || !/^\+?\d{8,15}$/.test(digits)) return null;
  return { name, role, phone, tel: `tel:${digits}`, whatsapp: `https://wa.me/${digits.replace(/^\+/, "")}` };
}
