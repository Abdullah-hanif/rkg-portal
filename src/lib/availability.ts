import { MARKET } from "@/lib/constants";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type AvailabilityWindow = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
};

export function zonedParts(date: Date, timeZone = MARKET.timeZone): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const hour = Number(read("hour"));

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: hour === 24 ? 0 : hour,
    minute: Number(read("minute")),
    dayOfWeek: WEEKDAY_INDEX[read("weekday")] ?? 0,
  };
}

export function dateKeyFromParts(parts: Pick<ZonedParts, "year" | "month" | "day">) {
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = MARKET.timeZone,
) {
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(utc, timeZone);
    const actual = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    const diff = desired - actual;
    if (diff === 0) break;
    utc = new Date(utc.getTime() + diff);
  }

  return utc;
}

export function addCalendarDays(year: number, month: number, day: number, days: number) {
  const utc = new Date(Date.UTC(year, month - 1, day + days, 12, 0));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function providerCovers(
  windows: AvailabilityWindow[],
  dayOfWeek: number,
  startMinute: number,
  endMinute: number,
) {
  return windows.some(
    (window) =>
      window.dayOfWeek === dayOfWeek &&
      startMinute >= window.startMinute &&
      endMinute <= window.endMinute,
  );
}

export function coversWindow(windows: AvailabilityWindow[], start: Date, end: Date) {
  const startParts = zonedParts(start);
  const endParts = zonedParts(end);
  if (dateKeyFromParts(startParts) !== dateKeyFromParts(endParts)) return false;

  const startMinute = startParts.hour * 60 + startParts.minute;
  const endMinute = endParts.hour * 60 + endParts.minute;
  return providerCovers(windows, startParts.dayOfWeek, startMinute, endMinute);
}

export type SlotProvider = {
  id: string;
  name: string;
  availability: AvailabilityWindow[];
};

export type TimeSlot = {
  start: string;
  label: string;
  providerIds: string[];
  providerNames: string[];
};

export type DaySlots = {
  dateKey: string;
  label: string;
  slots: TimeSlot[];
};

export function buildSlots(providers: SlotProvider[], durationMinutes: number, days = 4): DaySlots[] {
  const now = zonedParts(new Date());
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET.timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET.timeZone,
    hour: "numeric",
    minute: "2-digit",
  });

  const result: DaySlots[] = [];
  const earliest = Date.now() + 5 * 60_000;

  for (let offset = 0; offset < days; offset += 1) {
    const date = addCalendarDays(now.year, now.month, now.day, offset);
    const slots: TimeSlot[] = [];

    for (let minute = 9 * 60; minute + durationMinutes <= 20 * 60; minute += 30) {
      const hour = Math.floor(minute / 60);
      const mins = minute % 60;
      const start = zonedTimeToUtc(date.year, date.month, date.day, hour, mins);
      if (start.getTime() < earliest) continue;

      const endMinute = minute + durationMinutes;
      const probe = zonedParts(start);
      const eligible = providers.filter((provider) =>
        providerCovers(provider.availability, probe.dayOfWeek, minute, endMinute),
      );
      if (eligible.length === 0) continue;

      slots.push({
        start: start.toISOString(),
        label: timeFormatter.format(start),
        providerIds: eligible.map((provider) => provider.id),
        providerNames: eligible.map((provider) => provider.name.split(" ")[0]),
      });
    }

    const labelDate = zonedTimeToUtc(date.year, date.month, date.day, 12, 0);
    result.push({
      dateKey: dateKeyFromParts(date),
      label: dayFormatter.format(labelDate),
      slots,
    });
  }

  return result;
}
