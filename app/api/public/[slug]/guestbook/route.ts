import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { makePasswordHash } from "@/lib/message-password";
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params; const body = await request.json() as Record<string, unknown>; if (body.website) return NextResponse.json({ ok: true });
  const nickname = String(body.nickname ?? "").trim().slice(0, 20), content = String(body.content ?? "").trim().slice(0, 300), password = String(body.password ?? ""); if (!nickname || !content || password.length < 4 || password.length > 20) return NextResponse.json({ error: "닉네임, 방명록, 4자 이상 비밀번호를 입력해주세요." }, { status: 400 });
  const cat = await env.DB!.prepare("SELECT id FROM cats WHERE share_slug = ?").bind(slug).first<{ id: string }>(); if (!cat) return NextResponse.json({ error: "앨범이 없습니다." }, { status: 404 });
  await env.DB!.prepare("INSERT INTO guestbook_entries (id, cat_id, nickname, content, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), cat.id, nickname, content, await makePasswordHash(password), new Date().toISOString()).run(); return NextResponse.json({ ok: true });
}
