export const DEFAULT_TIME_ZONE = "Europe/London";

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function safeTimeZone(timeZone?: string | null) {
  if (!timeZone) return DEFAULT_TIME_ZONE;

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function partsInTimeZone(date: Date, timeZone?: string | null): DateTimeParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTimeZone(timeZone),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const values = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function parseDateAndTime(dateValue: string, timeValue: string): DateTimeParts {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  const invalid = {
    year: Number.NaN,
    month: Number.NaN,
    day: Number.NaN,
    hour: Number.NaN,
    minute: Number.NaN,
    second: Number.NaN,
  };

  if (!dateMatch || !timeMatch) {
    return invalid;
  }

  const parts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: 0,
  };

  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59
  ) {
    return invalid;
  }

  const check = new Date(asUtcTimestamp(parts));
  if (
    check.getUTCFullYear() !== parts.year ||
    check.getUTCMonth() !== parts.month - 1 ||
    check.getUTCDate() !== parts.day
  ) {
    return invalid;
  }

  return parts;
}

function asUtcTimestamp(parts: DateTimeParts) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

export function zonedDateTimeToUtc(
  dateValue: string,
  timeValue: string,
  timeZone?: string | null,
) {
  const targetParts = parseDateAndTime(dateValue, timeValue);
  const targetTimestamp = asUtcTimestamp(targetParts);

  if (Number.isNaN(targetTimestamp)) return new Date(Number.NaN);

  let utcDate = new Date(targetTimestamp);

  for (let index = 0; index < 3; index += 1) {
    const zonedParts = partsInTimeZone(utcDate, timeZone);
    const zonedTimestamp = asUtcTimestamp(zonedParts);
    const offset = targetTimestamp - zonedTimestamp;

    if (offset === 0) return utcDate;

    utcDate = new Date(utcDate.getTime() + offset);
  }

  return utcDate;
}

export function dateKeyInTimeZone(date: Date, timeZone?: string | null) {
  const parts = partsInTimeZone(date, timeZone);

  return `${String(parts.year).padStart(4, "0")}-${String(
    parts.month,
  ).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function minutesSinceMidnightInTimeZone(
  date: Date,
  timeZone?: string | null,
) {
  const parts = partsInTimeZone(date, timeZone);
  return parts.hour * 60 + parts.minute;
}

export function formatTimeRangeInTimeZone(
  start: Date,
  end: Date,
  timeZone?: string | null,
) {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: safeTimeZone(timeZone),
    hour: "2-digit",
    minute: "2-digit",
  };

  return `${start.toLocaleTimeString([], options)} - ${end.toLocaleTimeString(
    [],
    options,
  )}`;
}
