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
  const body = await request.json() as { isPublic?: boolean };
  await env.DB!.prepare("UPDATE album_entries SET is_public = ? WHERE id = ? AND cat_id = ?")
    .bind(body.isPublic ? 1 : 0, id, cat.id).run();
  return NextResponse.json({ ok: true });
}

