import type { VercelRequest } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  }
  return cookies;
}

export function verifyAdminSession(req: VercelRequest): boolean {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) return false;

    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return false;

    const cookies = parseCookies(cookieHeader);
    const token = cookies['fox_admin_session'];
    if (!token) return false;

    // Token format: base64(payload):base64(signature)
    const colonIdx = token.indexOf(':');
    if (colonIdx === -1) return false;

    const payloadB64 = token.slice(0, colonIdx);
    const sigB64 = token.slice(colonIdx + 1);

    const payload = Buffer.from(payloadB64, 'base64').toString('utf8');

    // Verify signature
    const expectedSig = createHmac('sha256', adminPassword).update(payload).digest('base64');
    const sigMatch = timingSafeEqual(
      new TextEncoder().encode(sigB64),
      new TextEncoder().encode(expectedSig)
    );
    if (!sigMatch) return false;

    // Verify payload format and age
    // payload = "admin:<timestamp>"
    const match = payload.match(/^admin:(\d+)$/);
    if (!match) return false;

    const issuedAt = parseInt(match[1], 10);
    if (Date.now() - issuedAt > SESSION_MAX_AGE_MS) return false;

    return true;
  } catch {
    return false;
  }
}
