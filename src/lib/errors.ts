export type BookingErrorCode =
  | "NOT_FOUND"
  | "INVALID"
  | "NOT_SEARCHING"
  | "INELIGIBLE"
  | "OVERLAP"
  | "LOST_RACE"
  | "ALREADY_PAID";

export class BookingError extends Error {
  constructor(
    message: string,
    readonly code: BookingErrorCode,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export function isExclusionViolation(error: unknown) {
  const text = error instanceof Error ? `${error.message}\n${"meta" in error ? JSON.stringify(error) : ""}` : String(error);
  return text.includes("23P01") || text.includes("bookings_no_provider_overlap");
}
