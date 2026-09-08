import { NextRequest, NextResponse } from "next/server";
import { getTip, setTip, localDateString } from "@/lib/redis";

const DEFAULT_TIP = 1;

/**
 * GET /api/tip?nickname=...
 * Returns { tip: number } for today. Defaults to DEFAULT_TIP if not yet set.
 */
export async function GET(request: NextRequest) {
  const nickname = request.nextUrl.searchParams.get("nickname")?.trim();
  if (!nickname) {
    return NextResponse.json({ error: "nickname is required" }, { status: 400 });
  }

  const stored = await getTip(localDateString(), nickname);
  return NextResponse.json({ tip: stored ?? DEFAULT_TIP });
}

/**
 * POST /api/tip
 * Body: { nickname, tip }
 * Stores the tip for this nickname today.
 */
export async function POST(request: NextRequest) {
  let body: { nickname?: unknown; tip?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  if (!nickname) {
    return NextResponse.json({ error: "nickname is required" }, { status: 400 });
  }

  const tip = Number(body.tip);
  if (!isFinite(tip) || tip < 0) {
    return NextResponse.json({ error: "tip must be a non-negative number" }, { status: 400 });
  }

  await setTip(localDateString(), nickname, tip);
  return NextResponse.json({ tip });
}
