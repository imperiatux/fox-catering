import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyAdminSession } from './auth';

function makeToken(password: string, offsetMs = 0) {
  const ts = (Date.now() + offsetMs).toString();
  const payload = Buffer.from('admin:' + ts).toString('base64');
  const sig = crypto.createHmac('sha256', password).update('admin:' + ts).digest('base64');
  return `${payload}:${sig}`;
}

function mockReq(token?: string) {
  return {
    headers: { cookie: token ? `fox_admin_session=${token}` : '' },
  } as any;
}

describe('verifyAdminSession', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'test-secret';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-07-14T07:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.ADMIN_PASSWORD;
  });

  it('accepts a valid token', () => {
    expect(verifyAdminSession(mockReq(makeToken('test-secret')))).toBe(true);
  });

  it('rejects a token older than eight hours', () => {
    const token = makeToken('test-secret', -(8 * 60 * 60 * 1000 + 1));

    expect(verifyAdminSession(mockReq(token))).toBe(false);
  });

  it('rejects a tampered token', () => {
    const token = makeToken('test-secret');
    const tampered = `${token.slice(0, -1)}x`;

    expect(verifyAdminSession(mockReq(tampered))).toBe(false);
  });

  it('rejects a request without a cookie', () => {
    expect(verifyAdminSession(mockReq())).toBe(false);
  });
});
