import { NextResponse } from "next/server";
import { createDraftBooking } from "@/lib/booking";
import { apiError } from "@/lib/http";
import { createBookingSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = createBookingSchema.parse(await request.json());
    const booking = await createDraftBooking({
      ...body,
      scheduledStart: new Date(body.scheduledStart),
    });
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
