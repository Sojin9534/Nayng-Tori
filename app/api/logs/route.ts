import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureCat } from "@/lib/data";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

const allowedTypes = new Set(["meal", "water", "poop", "weight", "symptom", "medicine"]);

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const type = String(body.type ?? "");
  if (!allowedTypes.has(type)) return NextResponse.json({ error: "기록 유형을 확인해주세요." }, { status: 400 });
  const cat = await ensureCat(user.userId);
  if (cat.owner_id !== user.userId) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const value = body.value === "" || body.value == null ? null : Number(body.value);
  await env.DB!.prepare(
    "INSERT INTO life_logs (id, cat_id, author_id, type, value, unit, status, memo, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    crypto.randomUUID(), cat.id, user.userId, type, Number.isFinite(value) ? value : null,
    String(body.unit ?? ""), String(body.status ?? ""), String(body.memo ?? ""),
    String(body.occurredAt ?? new Date().toISOString()),
  ).run();
  return NextResponse.json({ ok: true });
}
