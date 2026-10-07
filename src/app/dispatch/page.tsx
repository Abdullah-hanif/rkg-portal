import { DispatchBoard, type BoardData } from "@/components/dispatch-board";
import { SetupNotice } from "@/components/setup-notice";
import { getDispatchBoard } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  try {
    const board = JSON.parse(JSON.stringify(await getDispatchBoard())) as BoardData;
    return <DispatchBoard initial={board} />;
  } catch {
    return <SetupNotice />;
  }
}
