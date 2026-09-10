import { NextRequest, NextResponse } from "next/server";
import { validateAdminSession } from "@/lib/auth";
import { getOrders, getAllTips, localDateString } from "@/lib/redis";

export async function GET(request: NextRequest) {
  const valid = await validateAdminSession(request);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = localDateString();
  const [orders, tips] = await Promise.all([
    getOrders(date),
    getAllTips(date),
  ]);

  const tipsTotal = Object.values(tips).reduce((s, v) => s + v, 0);

  return NextResponse.json({ orders, tips, tipsTotal });
}
