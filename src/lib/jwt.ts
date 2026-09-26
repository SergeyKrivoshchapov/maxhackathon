// lib/jwt.ts
import crypto from 'node:crypto';

const ALG = 'HS256';

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(input: string): Buffer {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  return Buffer.from(input, 'base64');
}

export type JwtPayload = {
  sub: string;
  role?: string;
  maxUserId?: number;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
};

export function signJwt(
  payload: JwtPayload,
  secret: string,
  expiresInSec = 60 * 60 * 24 * 7
): string {
  const now = Math.floor(Date.now() / 1000);
  const body: JwtPayload = { ...payload, iat: now, exp: now + expiresInSec };
  const header = { alg: ALG, typ: 'JWT' };

  const encodedHeader = b64url(JSON.stringify(header));
  const encodedPayload = b64url(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${b64url(signature)}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [h, p, s] = parts;
  const data = `${h}.${p}`;

  const expected = crypto.createHmac('sha256', secret).update(data).digest();
  const received = b64urlDecode(s);

  if (
    expected.length !== received.length ||
    !crypto.timingSafeEqual(expected, received)
  ) {
    return null;
  }

  const header = JSON.parse(b64urlDecode(h).toString('utf8'));
  if (header.alg !== ALG) return null;

  const payload = JSON.parse(b64urlDecode(p).toString('utf8')) as JwtPayload;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}