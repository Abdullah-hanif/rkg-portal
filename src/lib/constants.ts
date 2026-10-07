export const MARKET = {
  city: "Atlanta",
  region: "GA",
  timeZone: "America/New_York",
  depositRate: 0.3,
} as const;

export const DURATIONS = [60, 90, 120] as const;
export type DurationMinutes = (typeof DURATIONS)[number];

export function isDuration(value: number): value is DurationMinutes {
  return (DURATIONS as readonly number[]).includes(value);
}
