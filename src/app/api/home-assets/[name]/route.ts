import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const ALLOWED: Record<string, string> = {
  'Abaya.png': 'image/png',
  'Emarati.png': 'image/png',
};

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const contentType = ALLOWED[name];
  if (!contentType) return new NextResponse('Not found', { status: 404 });
  try {
    const file = await readFile(path.join(process.cwd(), 'Final Assets', 'Human Sprites', name));
    return new NextResponse(file, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' } });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
