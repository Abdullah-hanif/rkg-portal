import { NextResponse } from "next/server";
import { raceAccept } from "@/lib/booking";
import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await raceAccept(id);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
