import { type NextRequest } from "next/server";
import { getSession } from "@/lib/redis";

export const COOKIE_NAME = "admin_session";

/**
 * Reads the `admin_session` cookie from the request and validates it against
 * Redis. Returns true if the session exists and is valid.
 */
export async function validateAdminSession(
  request: NextRequest,
): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const value = await getSession(token);
  return value === "admin";
}
