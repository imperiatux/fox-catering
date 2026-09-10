import { NextRequest, NextResponse } from "next/server";
import { validateAdminSession } from "@/lib/auth";
import { getOrders, deleteOrder, setTip, deleteTip, localDateString } from "@/lib/redis";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const valid = await validateAdminSession(request);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const date = localDateString();

  // Capture the nickname before deleting so we can adjust their tip after.
  const orders = await getOrders(date);
  const target = orders.find((o) => o.id === id);

  await deleteOrder(date, id);

  if (target) {
    const remaining = await getOrders(date);
    const nickOrders = remaining.filter((o) => o.nickname === target.nickname);
    if (nickOrders.length === 0) {
      // No orders left — remove the tip entirely.
      await deleteTip(date, target.nickname);
    } else {
      // Recalculate tip as 1 RON × remaining qty.
      const newTip = nickOrders.reduce((s, o) => s + o.qty, 0);
      await setTip(date, target.nickname, newTip);
    }
  }

  return NextResponse.json({ success: true });
}
