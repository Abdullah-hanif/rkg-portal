import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { prepareDeposit } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await prepareDeposit(id);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
