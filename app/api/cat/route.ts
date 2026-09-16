import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureCat } from "@/lib/data";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const cat = await ensureCat(user.userId);
  if (cat.owner_id !== user.userId) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const birthDate = String(form.get("birthDate") ?? "").trim();
  const breed = String(form.get("breed") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  if (!name || name.length > 30 || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !breed || breed.length > 50 || bio.length > 160) {
    return NextResponse.json({ error: "입력한 기본 정보를 확인해주세요." }, { status: 400 });
  }

  const file = form.get("photo");
  let profileImageKey = cat.profile_image_key ?? null;
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "8MB 이하 이미지 파일만 올릴 수 있어요." }, { status: 400 });
    }
    profileImageKey = `${cat.id}/profile-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    await env.BUCKET!.put(profileImageKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  }

  await env.DB!.prepare(
    "UPDATE cats SET name = ?, birth_date = ?, breed = ?, bio = ?, profile_image_key = ? WHERE id = ? AND owner_id = ?",
  ).bind(name, birthDate, breed, bio, profileImageKey, cat.id, user.userId).run();
  return NextResponse.json({ ok: true });
}
