import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureCat } from "@/lib/data";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const imageTypes: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif",
};

function imageType(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return file.type.startsWith("image/") ? file.type : imageTypes[extension] || file.type;
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const cat = await ensureCat(user.userId);
  if (cat.owner_id !== user.userId) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("photo");
  let imageKey: string | null = null;
  if (file instanceof File && file.size > 0) {
    const contentType = imageType(file);
    if (!contentType.startsWith("image/") || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "JPG·PNG·HEIC 등 20MB 이하 사진만 올릴 수 있어요." }, { status: 400 });
    }
    imageKey = `${cat.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    await env.BUCKET!.put(imageKey, file.stream(), { httpMetadata: { contentType } });
  }
  await env.DB!.prepare(
    "INSERT INTO album_entries (id, cat_id, image_key, fallback_url, caption, taken_at, milestone, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    crypto.randomUUID(), cat.id, imageKey, imageKey ? null : "/tori.png",
    String(form.get("caption") ?? "오늘의 토리"), String(form.get("takenAt") ?? new Date().toISOString().slice(0, 10)),
    String(form.get("milestone") ?? "") || null, form.get("isPublic") === "true" ? 1 : 0, new Date().toISOString(),
  ).run();
  return NextResponse.json({ ok: true });
}
