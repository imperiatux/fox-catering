import { NextRequest, NextResponse } from "next/server";
import { validateAdminSession } from "@/lib/auth";
import { getSettings, setSettings } from "@/lib/redis";
import type { AppSettings } from "@/types";

export async function GET(request: NextRequest) {
  const valid = await validateAdminSession(request);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  const valid = await validateAdminSession(request);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<AppSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate fields if present
  if (body.cutoffHour !== undefined && (body.cutoffHour < 0 || body.cutoffHour > 23 || !Number.isInteger(body.cutoffHour))) {
    return NextResponse.json({ error: "cutoffHour must be an integer 0–23" }, { status: 400 });
  }
  if (body.cutoffMinute !== undefined && (body.cutoffMinute < 0 || body.cutoffMinute > 59 || !Number.isInteger(body.cutoffMinute))) {
    return NextResponse.json({ error: "cutoffMinute must be an integer 0–59" }, { status: 400 });
  }
  if (body.activeDays !== undefined && (!Array.isArray(body.activeDays) || body.activeDays.some((d) => d < 1 || d > 7 || !Number.isInteger(d)))) {
    return NextResponse.json({ error: "activeDays must be an array of integers 1–7" }, { status: 400 });
  }
  if (body.whatsappPhone !== undefined && typeof body.whatsappPhone !== "string") {
    return NextResponse.json({ error: "whatsappPhone must be a string" }, { status: 400 });
  }
  for (const key of ["priceNonVeg", "priceVeg", "priceSoupNonVeg", "priceSoupVeg", "priceMainNonVeg", "priceMainVeg", "priceCustom"] as const) {
    const val = body[key];
    if (val !== undefined && (typeof val !== "number" || val < 0 || !isFinite(val))) {
      return NextResponse.json({ error: `${key} must be a non-negative number` }, { status: 400 });
    }
  }

  const updated = await setSettings(body);
  return NextResponse.json(updated);
}
