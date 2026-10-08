import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BookingError } from "@/lib/errors";

export function apiError(error: unknown) {
  if (error instanceof BookingError) {
    const status =
      error.code === "NOT_FOUND" ? 404 : error.code === "INVALID" || error.code === "INELIGIBLE" ? 422 : 409;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Check the booking details and try again.", issues: error.issues },
      { status: 400 },
    );
  }
  // Log the error to the console
  console.error("Error in API:", error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
