import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureCat } from "@/lib/data";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
export async function DELETE(_: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getChatGPTUser(); if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }); const cat = await ensureCat(user.userId); if (cat.owner_id !== user.userId) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const { kind, id } = await context.params; const table = kind === "comment" ? "album_comments" : kind === "guestbook" ? "guestbook_entries" : null; if (!table) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  await env.DB!.prepare(`DELETE FROM ${table} WHERE id = ? AND cat_id = ?`).bind(id, cat.id).run(); return NextResponse.json({ ok: true });
}
