import type { Locale } from "./types";

const SQ_MONTHS_LONG = [
  "janar",
  "shkurt",
  "mars",
  "prill",
  "maj",
  "qershor",
  "korrik",
  "gusht",
  "shtator",
  "tetor",
  "nëntor",
  "dhjetor",
];

const SQ_MONTHS_SHORT = [
  "jan",
  "shk",
  "mar",
  "pri",
  "maj",
  "qer",
  "korr",
  "gush",
  "sht",
  "tet",
  "nën",
  "dhj",
];

const SQ_WEEKDAYS_LONG = [
  "e diel",
  "e hënë",
  "e martë",
  "e mërkurë",
  "e enjte",
  "e premte",
  "e shtunë",
];

const SQ_WEEKDAYS_SHORT = [
  "Die",
  "Hën",
  "Mar",
  "Mër",
  "Enj",
  "Pre",
  "Sht",
];

function dateValue(value: Date | string | number) {
  return value instanceof Date ? value : new Date(value);
}

function dateValueInTimeZone(
  date: Date,
  timeZone?: string,
) {
  if (!timeZone) return date;

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(date);
    const values = parts.reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});

    return new Date(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
  } catch {
    return date;
  }
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function sqDateParts(date: Date, options: Intl.DateTimeFormatOptions) {
  const dateStyle = options.dateStyle;
  const weekday =
    options.weekday || (dateStyle === "full" ? "long" : undefined);
  const day = options.day || (dateStyle ? "numeric" : undefined);
  const month =
    options.month ||
    (dateStyle === "full" || dateStyle === "long"
      ? "long"
      : dateStyle
        ? "short"
        : undefined);
  const year = options.year || (dateStyle ? "numeric" : undefined);

  const parts: string[] = [];

  if (weekday) {
    parts.push(
      weekday === "long"
        ? SQ_WEEKDAYS_LONG[date.getDay()]
        : SQ_WEEKDAYS_SHORT[date.getDay()],
    );
  }

  const calendarParts: string[] = [];
  if (day) {
    calendarParts.push(
      day === "2-digit" ? twoDigits(date.getDate()) : String(date.getDate()),
    );
  }
  if (month) {
    if (month === "long") calendarParts.push(SQ_MONTHS_LONG[date.getMonth()]);
    else if (month === "short")
      calendarParts.push(SQ_MONTHS_SHORT[date.getMonth()]);
    else if (month === "2-digit")
      calendarParts.push(twoDigits(date.getMonth() + 1));
    else calendarParts.push(String(date.getMonth() + 1));
  }
  if (year) {
    calendarParts.push(
      year === "2-digit"
        ? String(date.getFullYear()).slice(-2)
        : String(date.getFullYear()),
    );
  }

  if (calendarParts.length > 0) parts.push(calendarParts.join(" "));

  return parts.join(weekday && calendarParts.length > 0 ? ", " : "");
}

function sqTimeParts(date: Date, options: Intl.DateTimeFormatOptions) {
  const timeStyle = options.timeStyle;
  const includeHour = Boolean(options.hour || timeStyle);
  const includeMinute = Boolean(options.minute || timeStyle);
  const includeSecond = Boolean(
    options.second ||
      timeStyle === "medium" ||
      timeStyle === "long" ||
      timeStyle === "full",
  );

  if (!includeHour && !includeMinute && !includeSecond) return "";

  const parts = [twoDigits(date.getHours())];
  if (includeMinute) parts.push(twoDigits(date.getMinutes()));
  if (includeSecond) parts.push(twoDigits(date.getSeconds()));
  return parts.join(":");
}

export function formatLocalizedDate(
  value: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = dateValue(value);
  if (Number.isNaN(date.getTime())) return "";

  if (locale !== "sq") {
    return new Intl.DateTimeFormat("en-GB", options).format(date);
  }

  const effectiveOptions: Intl.DateTimeFormatOptions =
    Object.keys(options).length > 0
      ? options
      : { dateStyle: "medium", timeStyle: "short" };
  const displayDate = dateValueInTimeZone(date, effectiveOptions.timeZone);
  const formattedDate = sqDateParts(displayDate, effectiveOptions);
  const formattedTime = sqTimeParts(displayDate, effectiveOptions);

  if (formattedDate && formattedTime) return `${formattedDate}, ${formattedTime}`;
  return formattedDate || formattedTime;
}
