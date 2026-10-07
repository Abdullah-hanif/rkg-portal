import { NextResponse } from "next/server";
import { getBooking } from "@/lib/booking";
import { apiError } from "@/lib/http";
import { BookingError } from "@/lib/errors";
import { webhookPayloadFor } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const booking = await getBooking(id);
    if (!booking) throw new BookingError("Booking not found.", "NOT_FOUND");
    return NextResponse.json({
      booking: {
        ...booking,
        payments: booking.payments.map((payment) => ({
          ...payment,
          webhookPayload: webhookPayloadFor(payment),
        })),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
