import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { requireChatGPTUser } from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";
const oldMedia = "https://nyanglog.biz-sojin9534.chatgpt.site";

type RecordRow = Record<string, unknown>;
type Transfer = {
  version: number;
  cat: RecordRow;
  album_entries: RecordRow[];
  album_comments: RecordRow[];
  guestbook_entries: RecordRow[];
  life_logs: RecordRow[];
  album_likes: RecordRow[];
};

const text = (row: RecordRow, key: string) => String(row[key] ?? "");
const nullableText = (row: RecordRow, key: string) => row[key] == null ? null : String(row[key]);
const asNumber = (row: RecordRow, key: string) => row[key] == null ? null : Number(row[key]);

function isTransfer(value: unknown): value is Transfer {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<Transfer>;
  return data.version === 1 && Boolean(data.cat) && Array.isArray(data.album_entries) && Array.isArray(data.album_comments) && Array.isArray(data.guestbook_entries) && Array.isArray(data.life_logs) && Array.isArray(data.album_likes);
}

export async function POST(request: Request) {
  await requireChatGPTUser("/dashboard");
  const form = await request.formData();
  const file = form.get("transfer");
  if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "내려받은 이전 파일을 선택해주세요." }, { status: 400 });
  let transfer: Transfer;
  try {
    transfer = JSON.parse(await file.text());
  } catch {
    return NextResponse.json({ error: "이전 파일을 읽지 못했어요." }, { status: 400 });
  }
  if (!isTransfer(transfer) || !text(transfer.cat, "id")) return NextResponse.json({ error: "냥토리 이전 파일이 아닙니다." }, { status: 400 });

  const db = env.DB!;
  const originalCat = text(transfer.cat, "id");
  const current = await db.prepare("SELECT owner_id FROM cats WHERE share_slug = ?").bind(text(transfer.cat, "share_slug")).first<{ owner_id: string }>();
  if (current && current.owner_id !== env.ADMIN_OWNER_ID) return NextResponse.json({ error: "새 냥토리에 이미 개인 기록이 있어 이전을 중단했어요." }, { status: 409 });

  await db.batch([
    db.prepare("DELETE FROM album_comments"),
    db.prepare("DELETE FROM album_likes"),
    db.prepare("DELETE FROM album_entries"),
    db.prepare("DELETE FROM guestbook_entries"),
    db.prepare("DELETE FROM life_logs"),
    db.prepare("DELETE FROM cats"),
    db.prepare("INSERT INTO cats (id, owner_id, name, birth_date, breed, bio, share_slug, created_at, profile_image_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(originalCat, env.ADMIN_OWNER_ID, text(transfer.cat, "name"), text(transfer.cat, "birth_date"), text(transfer.cat, "breed"), text(transfer.cat, "bio"), text(transfer.cat, "share_slug"), text(transfer.cat, "created_at"), nullableText(transfer.cat, "profile_image_key")),
    ...transfer.album_entries.map((item) => db.prepare("INSERT INTO album_entries (id, cat_id, image_key, fallback_url, caption, taken_at, milestone, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(text(item, "id"), originalCat, nullableText(item, "image_key"), nullableText(item, "fallback_url"), text(item, "caption"), text(item, "taken_at"), nullableText(item, "milestone"), asNumber(item, "is_public") ?? 0, text(item, "created_at"))),
    ...transfer.life_logs.map((item) => db.prepare("INSERT INTO life_logs (id, cat_id, author_id, type, value, unit, status, memo, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(text(item, "id"), originalCat, env.ADMIN_OWNER_ID, text(item, "type"), asNumber(item, "value"), nullableText(item, "unit"), nullableText(item, "status"), text(item, "memo"), text(item, "occurred_at"))),
    ...transfer.album_likes.map((item) => db.prepare("INSERT OR IGNORE INTO album_likes (id, cat_id, album_entry_id, visitor_key, created_at) VALUES (?, ?, ?, ?, ?)").bind(text(item, "id"), originalCat, text(item, "album_entry_id"), text(item, "visitor_key"), text(item, "created_at"))),
    ...transfer.album_comments.map((item) => db.prepare("INSERT INTO album_comments (id, cat_id, album_entry_id, nickname, content, created_at, password_hash) VALUES (?, ?, ?, ?, ?, ?, NULL)").bind(text(item, "id"), originalCat, text(item, "album_entry_id"), text(item, "nickname"), text(item, "content"), text(item, "created_at"))),
    ...transfer.guestbook_entries.map((item) => db.prepare("INSERT INTO guestbook_entries (id, cat_id, nickname, content, created_at, password_hash) VALUES (?, ?, ?, ?, ?, ?, NULL)").bind(text(item, "id"), originalCat, text(item, "nickname"), text(item, "content"), text(item, "created_at"))),
  ]);

  const keys = [nullableText(transfer.cat, "profile_image_key"), ...transfer.album_entries.map((item) => nullableText(item, "image_key"))].filter((key): key is string => Boolean(key));
  const settled = await Promise.allSettled(keys.map(async (key) => {
    const source = oldMedia + "/api/media/" + key.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(source);
    if (!response.ok || !response.body) throw new Error("사진을 불러오지 못했어요.");
    await env.BUCKET!.put(key, response.body, { httpMetadata: { contentType: response.headers.get("content-type") ?? "image/jpeg" } });
  }));
  return NextResponse.json({ ok: true, copied: settled.filter((result) => result.status === "fulfilled").length, total: keys.length, likes: transfer.album_likes.length });
}
