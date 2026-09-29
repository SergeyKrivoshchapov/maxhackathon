import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

const UPLOAD_DIR = '/data/uploads';
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif',
];

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  return map[mime] ?? 'jpg';
}

export async function POST(req: NextRequest) {
  try {
    const profile = await getProfileFromRequest();
    if (!profile) {
      return NextResponse.json({ error: 'unauth' }, { status: 401 });
    }

    const formData = await req.formData();

    // ← ВАЖНО: getAll, а не get
    const files = formData.getAll('file').filter((f): f is File => f instanceof File);

    console.log('[upload] received files:', files.length);

    if (!files.length) {
      return NextResponse.json({ error: 'no files' }, { status: 400 });
    }
    if (files.length > 5) {
      return NextResponse.json({ error: 'max 5 files' }, { status: 400 });
    }

    const folderRaw = String(formData.get('folder') ?? 'tickets');
    const folder = ['tickets', 'messages'].includes(folderRaw) ? folderRaw : 'tickets';
    const dir = join(/* turbopackIgnore: true */ UPLOAD_DIR, folder);

    await mkdir(dir, { recursive: true });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const urls: string[] = [];

    for (const file of files) {
      if (!ALLOWED.includes(file.type)) {
        console.warn('[upload] skip mime:', file.type, file.name);
        continue;
      }
      if (file.size > MAX_SIZE) {
        console.warn('[upload] skip too big:', file.size, file.name);
        continue;
      }

      const ext = extFromMime(file.type);
      const filename = `${randomUUID()}.${ext}`;
      const filepath = join(/* turbopackIgnore: true */ dir, filename);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filepath, buffer);

      const publicUrl = `${appUrl}/uploads/${folder}/${filename}`;
      urls.push(publicUrl);

      console.log('[upload] saved:', filepath, '→', publicUrl);
    }

    if (!urls.length) {
      return NextResponse.json({ error: 'no valid files' }, { status: 400 });
    }

    return NextResponse.json({ urls }, { status: 201 });
  } catch (e: any) {
    console.error('[upload] fatal', e);
    return NextResponse.json(
      { error: e?.message ?? 'upload failed' },
      { status: 500 }
    );
  }
}