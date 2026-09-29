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

  const isDirectUpload = request.headers.get("content-type")?.includes("application/json");
  let imageKey: string | null = null;
  let caption = "오늘의 토리";
  let takenAt = new Date().toISOString().slice(0, 10);
  let milestone = "";
  let isPublic = false;

  if (isDirectUpload) {
    const body = await request.json().catch(() => null) as { imageKey?: unknown; caption?: unknown; takenAt?: unknown; milestone?: unknown; isPublic?: unknown } | null;
    imageKey = typeof body?.imageKey === "string" ? body.imageKey : "";
    if (!imageKey.startsWith(`${cat.id}/`)) return NextResponse.json({ error: "올바른 사진을 선택해주세요." }, { status: 400 });
    const uploaded = await env.BUCKET!.head(imageKey);
    if (!uploaded?.httpMetadata?.contentType?.startsWith("image/")) return NextResponse.json({ error: "사진 업로드가 완료되지 않았어요. 다시 시도해주세요." }, { status: 400 });
    caption = typeof body?.caption === "string" ? body.caption : caption;
    takenAt = typeof body?.takenAt === "string" ? body.takenAt : takenAt;
    milestone = typeof body?.milestone === "string" ? body.milestone : "";
    isPublic = body?.isPublic === true;
  } else {
    const form = await request.formData();
    const file = form.get("photo");
    if (file instanceof File && file.size > 0) {
      const contentType = imageType(file);
      if (!contentType.startsWith("image/") || file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "JPG·PNG·HEIC 등 20MB 이하 사진만 올릴 수 있어요." }, { status: 400 });
      }
      imageKey = `${cat.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      try {
        await env.BUCKET!.put(imageKey, await file.arrayBuffer(), { httpMetadata: { contentType } });
      } catch (error) {
        console.error("album photo R2 upload failed", error);
        return NextResponse.json({ error: "사진 파일 저장에 실패했어요. 잠시 뒤 다시 시도해주세요." }, { status: 500 });
      }
    }
    caption = String(form.get("caption") ?? caption);
    takenAt = String(form.get("takenAt") ?? takenAt);
    milestone = String(form.get("milestone") ?? "");
    isPublic = form.get("isPublic") === "true";
  }

  try {
    await env.DB!.prepare(
      "INSERT INTO album_entries (id, cat_id, image_key, fallback_url, caption, taken_at, milestone, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      crypto.randomUUID(), cat.id, imageKey, imageKey ? null : "/tori.png",
      caption, takenAt, milestone || null, isPublic ? 1 : 0, new Date().toISOString(),
    ).run();
  } catch (error) {
    console.error("album entry D1 insert failed", error);
    if (imageKey) await env.BUCKET!.delete(imageKey).catch((cleanupError) => console.error("orphaned album photo cleanup failed", cleanupError));
    return NextResponse.json({ error: "사진 기록 저장에 실패했어요. 잠시 뒤 다시 시도해주세요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
