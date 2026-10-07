import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { processStripeEvent } from "@/lib/payments";
import { stripeEventSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const event = stripeEventSchema.parse(await request.json());
    const result = await processStripeEvent(event);
    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      booking: result.booking,
      payment: result.payment,
    });
  } catch (error) {
    return apiError(error);
  }
}
