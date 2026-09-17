import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const body = await request.json() as { entryId?: string; visitorKey?: string; liked?: boolean };
  const entryId = String(body.entryId ?? "");
  const visitorKey = String(body.visitorKey ?? "").slice(0, 80);
  if (!entryId || visitorKey.length < 8) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const entry = await env.DB!.prepare("SELECT album_entries.id, album_entries.cat_id FROM album_entries JOIN cats ON cats.id = album_entries.cat_id WHERE album_entries.id = ? AND album_entries.is_public = 1 AND cats.share_slug = ?").bind(entryId, slug).first<{ id: string; cat_id: string }>();
  if (!entry) return NextResponse.json({ error: "사진을 찾을 수 없습니다." }, { status: 404 });
  if (body.liked) await env.DB!.prepare("INSERT OR IGNORE INTO album_likes (id, cat_id, album_entry_id, visitor_key, created_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), entry.cat_id, entry.id, visitorKey, new Date().toISOString()).run();
  else await env.DB!.prepare("DELETE FROM album_likes WHERE album_entry_id = ? AND visitor_key = ?").bind(entry.id, visitorKey).run();
  const result = await env.DB!.prepare("SELECT COUNT(*) AS count FROM album_likes WHERE album_entry_id = ?").bind(entry.id).first<{ count: number }>();
  return NextResponse.json({ count: Number(result?.count ?? 0) });
}
