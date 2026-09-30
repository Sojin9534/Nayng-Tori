import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureCat } from "@/lib/data";
import { env } from "cloudflare:workers";
import { AwsClient } from "aws4fetch";
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
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다. 대시보드를 새로고침한 뒤 다시 시도해주세요." }, { status: 401 });
  const cat = await ensureCat(user.userId);
  if (cat.owner_id !== user.userId) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const body = await request.json().catch(() => null) as { fileName?: unknown; contentType?: unknown; size?: unknown } | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const size = typeof body?.size === "number" ? body.size : 0;
  const contentType = resolveImageType(fileName, body?.contentType);
  if (!fileName || !contentType || size <= 0 || size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "JPG·PNG·HEIC 등 20MB 이하 사진만 올릴 수 있어요." }, { status: 400 });
  }

  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    return NextResponse.json({ error: "원본 사진 업로드 설정이 아직 완료되지 않았어요." }, { status: 503 });
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const imageKey = `${cat.id}/${crypto.randomUUID()}-${safeName}`;
  const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/nyangtori-photos/${imageKey.split("/").map(encodeURIComponent).join("/")}`);
  url.searchParams.set("X-Amz-Expires", "300");
  const signer = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const signed = await signer.sign(new Request(url, { method: "PUT", headers: { "content-type": contentType } }), { aws: { signQuery: true } });
  return NextResponse.json({ imageKey, uploadUrl: signed.url, contentType });
}
