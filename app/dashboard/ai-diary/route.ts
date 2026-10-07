import { getUploadUserId } from "@/lib/upload-auth";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

const MAX_IMAGE_BASE64_LENGTH = 3_500_000;
const GEMINI_MODEL = "gemini-3.1-flash-lite";

function parseSuggestions(text: string) {
  const json = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  try {
    const data = JSON.parse(json) as { suggestions?: unknown };
    if (!Array.isArray(data.suggestions)) return [];
    return [...new Set(data.suggestions
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter((item) => item.length >= 4 && item.length <= 80))]
      .slice(0, 3);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  if (!await getUploadUserId(request)) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const apiKey = (env as typeof env & { GEMINI_API_KEY?: string }).GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI 그림일기 기능이 아직 연결되지 않았어요." }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { imageData?: unknown; mimeType?: unknown } | null;
  if (!body || typeof body.imageData !== "string" || typeof body.mimeType !== "string" || !body.imageData || body.imageData.length > MAX_IMAGE_BASE64_LENGTH || !/^image\/(jpeg|png|webp)$/.test(body.mimeType)) {
    return NextResponse.json({ error: "AI 추천용 사진을 준비하지 못했어요. JPG·PNG·WebP 사진으로 다시 시도해주세요." }, { status: 400 });
  }

  const prompt = [
    "너는 고양이 성장앨범의 그림일기 문구를 쓰는 작가다.",
    "사진을 보고 한국어 한 줄 문구를 정확히 3개 제안해라.",
    "사진에 실제로 보이지 않는 장소, 사람, 행동, 감정을 지어내지 말고 따뜻하고 귀엽게 쓴다.",
    "각 문구는 12~36자, 이모지와 따옴표 없이 작성한다.",
    '반드시 {"suggestions":["문구 1","문구 2","문구 3"]} 형식의 JSON만 반환한다.',
  ].join("\n");

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: body.mimeType, data: body.imageData } }, { text: prompt }] }],
      }),
    },
  );

  if (!geminiResponse.ok) {
    const providerError = await geminiResponse.json().catch(() => null) as { error?: { message?: unknown } } | null;
    const detail = typeof providerError?.error?.message === "string" ? providerError.error.message.replace(/\\s+/g, " ").slice(0, 180) : "";
    if (geminiResponse.status === 401 || geminiResponse.status === 403) {
      return NextResponse.json({ error: "Gemini API 키 권한을 확인해주세요." }, { status: 502 });
    }
    if (geminiResponse.status === 429) {
      return NextResponse.json({ error: "AI 추천 횟수가 잠시 한도에 도달했어요. 잠시 후 다시 눌러주세요." }, { status: 429 });
    }
    return NextResponse.json({ error: detail ? `Gemini 오류 ${geminiResponse.status}: ${detail}` : `Gemini 오류 ${geminiResponse.status}가 발생했어요.` }, { status: 502 });
  }

  const gemini = await geminiResponse.json().catch(() => null) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null;
  const text = gemini?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const suggestions = parseSuggestions(text);
  if (suggestions.length < 3) {
    return NextResponse.json({ error: "AI 문구를 읽지 못했어요. 다시 추천을 눌러주세요." }, { status: 502 });
  }

  return NextResponse.json({ suggestions });
}
