import { getUploadUserId } from "@/lib/upload-auth";
import { ensureCat } from "@/lib/data";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const userId = await getUploadUserId(request);
  if (!userId) return NextResponse.json({ error: "로그인 확인이 만료됐어요. 대시보드를 새로고침한 뒤 다시 시도해주세요." }, { status: 401 });
  const cat = await ensureCat(userId);
  if (cat.owner_id !== userId) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const body = await request.json().catch(() => null) as { imageKey?: unknown; captionEncoded?: unknown; takenAt?: unknown; milestoneEncoded?: unknown; isPublic?: unknown } | null;
  const imageKey = typeof body?.imageKey === "string" ? body.imageKey : "";
  if (!imageKey.startsWith(`${cat.id}/`)) return NextResponse.json({ error: "올바른 사진을 선택해주세요." }, { status: 400 });

  const uploaded = await env.BUCKET!.head(imageKey);
  if (!uploaded?.httpMetadata?.contentType?.startsWith("image/")) {
    return NextResponse.json({ error: "사진 업로드가 완료되지 않았어요. 다시 시도해주세요." }, { status: 400 });
  }

  const decodeText = (value: unknown, fallback: string) => {
    if (typeof value !== "string") return fallback;
    try { return decodeURIComponent(value); } catch { return fallback; }
  };
  const caption = decodeText(body?.captionEncoded, "오늘의 토리");
  const takenAt = typeof body?.takenAt === "string" ? body.takenAt : new Date().toISOString().slice(0, 10);
  const milestone = decodeText(body?.milestoneEncoded, "");
  const isPublic = body?.isPublic === true;

  try {
    await env.DB!.prepare(
      "INSERT INTO album_entries (id, cat_id, image_key, fallback_url, caption, taken_at, milestone, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      crypto.randomUUID(), cat.id, imageKey, null,
      caption, takenAt, milestone || null, isPublic ? 1 : 0, new Date().toISOString(),
    ).run();
  } catch (error) {
    console.error("album entry D1 insert failed", error);
    await env.BUCKET!.delete(imageKey).catch((cleanupError) => console.error("orphaned album photo cleanup failed", cleanupError));
    return NextResponse.json({ error: "사진 기록 저장에 실패했어요. 잠시 뒤 다시 시도해주세요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
