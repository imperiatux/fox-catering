import { NextRequest, NextResponse } from "next/server";
import { validateAdminSession } from "@/lib/auth";
import { getOrders } from "@/lib/redis";

export async function GET(request: NextRequest) {
  const valid = await validateAdminSession(request);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new Date().toISOString().split("T")[0];
  const orders = await getOrders(date);

  return NextResponse.json({ orders });
}
