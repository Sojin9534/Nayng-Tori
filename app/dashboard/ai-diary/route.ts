import { getUploadUserId } from "@/lib/upload-auth";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

const MAX_IMAGE_BASE64_LENGTH = 3_500_000;
const WORKERS_AI_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";

type WorkersAiBinding = {
  run: (
    model: string,
    input: { image: number[]; prompt: string; max_tokens: number },
  ) => Promise<{ description?: unknown }>;
};

function parseSuggestions(text: string) {
  const json = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  try {
    const data = JSON.parse(json) as { suggestions?: unknown };
    if (Array.isArray(data.suggestions)) {
      const suggestions = normalizeSuggestions(data.suggestions);
      if (suggestions.length >= 3) return suggestions;
    }
  } catch {
    // A model may return the three suggestions as plain lines instead of JSON.
  }

  return normalizeSuggestions(
    text
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ""))
      .filter((line) => line && !line.startsWith("{") && !line.startsWith("}")),
  );
}

function normalizeSuggestions(items: unknown[]) {
  return [...new Set(items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 4 && item.length <= 80))]
    .slice(0, 3);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function POST(request: Request) {
  if (!await getUploadUserId(request)) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const ai = (env as typeof env & { AI?: WorkersAiBinding }).AI;
  if (!ai) {
    return NextResponse.json({ error: "AI 그림일기 기능이 아직 연결되지 않았어요." }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { imageData?: unknown; mimeType?: unknown } | null;
  if (!body || typeof body.imageData !== "string" || typeof body.mimeType !== "string" || !body.imageData || body.imageData.length > MAX_IMAGE_BASE64_LENGTH || !/^image\/(jpeg|png|webp)$/.test(body.mimeType)) {
    return NextResponse.json({ error: "AI 추천용 사진을 준비하지 못했어요. JPG·PNG·WebP 사진으로 다시 시도해주세요." }, { status: 400 });
  }

  const prompt = [
    "사진을 보고 고양이 성장앨범에 쓸 한국어 한 줄 그림일기 문구를 정확히 3개 만들어라.",
    "사진에 실제로 보이지 않는 장소, 사람, 행동, 감정을 지어내지 마라.",
    "각 문구는 따뜻하고 귀엽게, 12~36자로 쓴다. 이모지와 따옴표는 쓰지 마라.",
    "반드시 {\\\"suggestions\\\":[\\\"문구 1\\\",\\\"문구 2\\\",\\\"문구 3\\\"]} 형식의 JSON만 반환하라.",
  ].join("\n");

  let aiResponse: { description?: unknown };
  try {
    aiResponse = await ai.run(WORKERS_AI_MODEL, {
      image: Array.from(decodeBase64(body.imageData)),
      prompt,
      max_tokens: 180,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 180) : "";
    return NextResponse.json({
      error: detail
        ? `Workers AI 오류: ${detail}`
        : "AI가 지금은 문구를 만들지 못했어요. 잠시 후 다시 눌러주세요.",
    }, { status: 502 });
  }

  const text = typeof aiResponse.description === "string" ? aiResponse.description : "";
  const suggestions = parseSuggestions(text);
  if (suggestions.length < 3) {
    return NextResponse.json({ error: "AI 문구를 읽지 못했어요. 다시 추천을 눌러주세요." }, { status: 502 });
  }

  return NextResponse.json({ suggestions });
}
