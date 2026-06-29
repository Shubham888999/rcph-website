import { getAvenue, getAvenueGradient } from "./avenues.js";

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function addOneDay(dateString) {
  let [year, month, day] = dateString.split("-").map(Number);
  day += 1;
  if (day > daysInMonth(year, month)) {
    day = 1;
    month += 1;
  }
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function adaptEventForCalendar(event) {
  const avenues = event.avenues.map((code) => getAvenue(code));
  const colorCodes = event.avenues.length ? event.avenues : ["Unknown"];
  return {
    id: event.id,
    title: event.name,
    start: event.date,
    end: event.endDate && event.endDate !== event.date ? addOneDay(event.endDate) : undefined,
    allDay: true,
    backgroundColor: getAvenue(colorCodes[0]).color,
    borderColor: getAvenue(colorCodes[0]).color,
    extendedProps: {
      description: event.description,
      avenues,
      inclusiveEndDate: event.endDate,
      source: event.source,
      original: event,
      avenueGradient: getAvenueGradient(colorCodes),
    },
  };
}

export function adaptEventsForCalendar(events) {
  return events.map(adaptEventForCalendar);
}
