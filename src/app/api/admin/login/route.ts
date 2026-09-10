import { NextResponse } from "next/server";
import { setSession } from "@/lib/redis";
import { COOKIE_NAME } from "@/lib/auth";

const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours in seconds

export async function POST(request: Request) {
  const { username, password } = await request.json();

  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (
    !expectedUsername ||
    !expectedPassword ||
    username !== expectedUsername ||
    password !== expectedPassword
  ) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 },
    );
  }

  const token = crypto.randomUUID();
  await setSession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
