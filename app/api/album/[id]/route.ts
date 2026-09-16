import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureCat } from "@/lib/data";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const cat = await ensureCat(user.userId);
  if (cat.owner_id !== user.userId) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json() as { isPublic?: boolean; caption?: string; takenAt?: string; milestone?: string };
  if (body.caption !== undefined) await env.DB!.prepare("UPDATE album_entries SET caption = ?, taken_at = ?, milestone = ?, is_public = ? WHERE id = ? AND cat_id = ?")
    .bind(body.caption.trim().slice(0, 120) || "토리의 하루", String(body.takenAt ?? ""), String(body.milestone ?? "").trim().slice(0, 50) || null, body.isPublic ? 1 : 0, id, cat.id).run();
  else await env.DB!.prepare("UPDATE album_entries SET is_public = ? WHERE id = ? AND cat_id = ?").bind(body.isPublic ? 1 : 0, id, cat.id).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser(); if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const cat = await ensureCat(user.userId); if (cat.owner_id !== user.userId) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }); const { id } = await context.params;
  const entry = await env.DB!.prepare("SELECT image_key FROM album_entries WHERE id = ? AND cat_id = ?").bind(id, cat.id).first<{ image_key: string | null }>();
  await env.DB!.batch([env.DB!.prepare("DELETE FROM album_comments WHERE album_entry_id = ? AND cat_id = ?").bind(id, cat.id), env.DB!.prepare("DELETE FROM album_entries WHERE id = ? AND cat_id = ?").bind(id, cat.id)]);
  if (entry?.image_key) await env.BUCKET!.delete(entry.image_key); return NextResponse.json({ ok: true });
}
