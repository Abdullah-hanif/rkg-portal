import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { getDispatchBoard } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const board = await getDispatchBoard();
    return NextResponse.json(board);
  } catch (error) {
    return apiError(error);
  }
}
