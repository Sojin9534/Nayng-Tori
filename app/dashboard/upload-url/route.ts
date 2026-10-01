import { getUploadUserId } from "@/lib/upload-auth";
import { ensureCat } from "@/lib/data";
import { NextResponse } from "next/server";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const imageTypes: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif",
};

function resolveImageType(fileName: string, value: unknown) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const contentType = typeof value === "string" ? value : "";
  return contentType.startsWith("image/") ? contentType : imageTypes[extension] ?? "";
}

export async function POST(request: Request) {
  const userId = await getUploadUserId(request);
  if (!userId) return NextResponse.json({ error: "로그인 확인이 만료됐어요. 대시보드를 새로고침한 뒤 다시 시도해주세요." }, { status: 401 });
  const cat = await ensureCat(userId);
  if (cat.owner_id !== userId) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const body = await request.json().catch(() => null) as { fileName?: unknown; contentType?: unknown; size?: unknown } | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const size = typeof body?.size === "number" ? body.size : 0;
  const contentType = resolveImageType(fileName, body?.contentType);
  if (!fileName || !contentType || size <= 0 || size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "JPG·PNG·HEIC 등 20MB 이하 사진만 올릴 수 있어요." }, { status: 400 });
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  return NextResponse.json({
    imageKey: `${cat.id}/${crypto.randomUUID()}-${safeName}`,
    contentType,
  });
}
