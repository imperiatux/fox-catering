import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';

function signToken(payload: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(payload).digest('base64');
  return `${Buffer.from(payload).toString('base64')}:${sig}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const { password } = req.body ?? {};
  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'password is required' });
  }

  // Timing-safe comparison
  let passwordsMatch = false;
  try {
    const a = new TextEncoder().encode(password);
    const b = new TextEncoder().encode(adminPassword);
    if (a.length === b.length) {
      passwordsMatch = timingSafeEqual(a, b);
    } else {
      // Still run a dummy comparison to avoid timing leak
      timingSafeEqual(new Uint8Array(b.length), b);
    }
  } catch {
    passwordsMatch = false;
  }

  if (!passwordsMatch) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const payload = `admin:${Date.now()}`;
  const token = signToken(payload, adminPassword);

  // COOKIE_SECURE=false disables the Secure flag for local HTTP (Docker/dev).
  // Defaults to true so production (Vercel/HTTPS) is always secure.
  const secure = process.env.COOKIE_SECURE !== 'false' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `fox_admin_session=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Strict; Max-Age=28800; Path=/`
  );
  return res.status(200).json({ ok: true });
}
