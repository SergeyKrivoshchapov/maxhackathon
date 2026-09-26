import { cookies } from 'next/headers';
import { verifyJwt, type JwtPayload } from './jwt';

export async function getSession(): Promise<JwtPayload | null> {
  const token = (await cookies()).get('app_token')?.value;
  if (!token) return null;
  return verifyJwt(token, process.env.APP_JWT_SECRET!);
}