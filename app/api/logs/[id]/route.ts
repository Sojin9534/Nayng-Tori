import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureCat } from "@/lib/data";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

const allowedTypes = new Set(["meal", "water", "poop", "weight", "symptom", "medicine"]);
async function ownedCat() { const user = await getChatGPTUser(); if (!user) return null; const cat = await ensureCat(user.userId); return cat.owner_id === user.userId ? cat : null; }

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const cat = await ownedCat(); if (!cat) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const { id } = await context.params; const body = await request.json() as Record<string, unknown>; const type = String(body.type ?? "");
  if (!allowedTypes.has(type)) return NextResponse.json({ error: "기록 유형을 확인해주세요." }, { status: 400 });
  const value = body.value === "" || body.value == null ? null : Number(body.value);
  await env.DB!.prepare("UPDATE life_logs SET type = ?, value = ?, unit = ?, status = ?, memo = ?, occurred_at = ? WHERE id = ? AND cat_id = ?")
    .bind(type, Number.isFinite(value) ? value : null, String(body.unit ?? ""), String(body.status ?? ""), String(body.memo ?? "").slice(0, 300), String(body.occurredAt ?? new Date().toISOString()), id, cat.id).run();
  return NextResponse.json({ ok: true });
}
export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const cat = await ownedCat(); if (!cat) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }); const { id } = await context.params;
  await env.DB!.prepare("DELETE FROM life_logs WHERE id = ? AND cat_id = ?").bind(id, cat.id).run(); return NextResponse.json({ ok: true });
}
