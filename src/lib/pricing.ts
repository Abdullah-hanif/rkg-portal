import { MARKET } from "@/lib/constants";

export function quote(hourlyRateCents: number, durationMinutes: number) {
  const totalCents = Math.round((hourlyRateCents * durationMinutes) / 60);
  const depositCents = Math.round(totalCents * MARKET.depositRate);
  const balanceCents = totalCents - depositCents;
  return { totalCents, depositCents, balanceCents };
}

export function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatHours(minutes: number) {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hr` : `${hours} hr`;
}

export function formatWindow(startMinute: number, endMinute: number) {
  const fmt = (minute: number) => {
    const hour24 = Math.floor(minute / 60);
    const mins = minute % 60;
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    return mins === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(mins).padStart(2, "0")} ${suffix}`;
  };
  return `${fmt(startMinute)}–${fmt(endMinute)} ET`;
}

export function formatAppointment(start: Date, end: Date) {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET.timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(start);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET.timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time.format(start)}–${time.format(end)} ET`;
}

export function statusLabel(status: string) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "CONFIRMED_SEARCHING":
      return "Searching";
    case "PROVIDER_ASSIGNED":
      return "Assigned";
    case "SERVICE_STARTED":
      return "In session";
    default:
      return status;
  }
}
