import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureCat } from "@/lib/data";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다. 대시보드를 새로고침한 뒤 다시 시도해주세요." }, { status: 401 });
  const cat = await ensureCat(user.userId);
  if (cat.owner_id !== user.userId) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const imageKey = new URL(request.url).searchParams.get("imageKey") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!imageKey.startsWith(`${cat.id}/`) || !contentType.startsWith("image/") || !request.body) {
    return NextResponse.json({ error: "올바른 사진을 선택해주세요." }, { status: 400 });
  }
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "사진은 20MB 이하로 올려주세요." }, { status: 400 });
  }

  try {
    await env.BUCKET!.put(imageKey, request.body, { httpMetadata: { contentType } });
  } catch (error) {
    console.error("album photo stream upload failed", error);
    return NextResponse.json({ error: "사진 파일 저장에 실패했어요. 잠시 뒤 다시 시도해주세요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
