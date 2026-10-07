import { NextResponse } from "next/server";
import { acceptBooking } from "@/lib/booking";
import { apiError } from "@/lib/http";
import { acceptSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = acceptSchema.parse(await request.json());
    const booking = await acceptBooking(id, body.providerId);
    return NextResponse.json({ booking });
  } catch (error) {
    return apiError(error);
  }
}
