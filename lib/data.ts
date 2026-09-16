import { env } from "cloudflare:workers";

export type LifeLog = {
  id: string;
  type: string;
  value: number | null;
  unit: string | null;
  status: string | null;
  memo: string;
  occurred_at: string;
};

export type AlbumEntry = {
  id: string;
  image_key: string | null;
  fallback_url: string | null;
  caption: string;
  taken_at: string;
  milestone: string | null;
  is_public: number;
};

function db() {
  if (!env.DB) throw new Error("기록 저장소를 사용할 수 없습니다.");
  return env.DB;
}

export async function ensureCat(ownerId: string) {
  const database = db();
  const existing = await database
    .prepare("SELECT * FROM cats WHERE share_slug = ? LIMIT 1")
    .bind("tori")
    .first<Record<string, string>>();
  if (existing) {
    if (existing.owner_id === "demo-owner" && ownerId !== "demo-owner") {
      await database
        .prepare("UPDATE cats SET owner_id = ? WHERE id = ?")
        .bind(ownerId, existing.id)
        .run();
      return { ...existing, owner_id: ownerId };
    }
    return existing;
  }

  const id = crypto.randomUUID();
  await database
    .prepare(
      "INSERT INTO cats (id, owner_id, name, birth_date, breed, bio, share_slug, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      ownerId,
      "토리",
      "2026-05-11",
      "브리티시 숏헤어",
      "햇살과 츄르, 캠핑을 좋아하는 토리의 성장기록",
      "tori",
      new Date().toISOString(),
    )
    .run();

  const now = new Date();
  const logs = [
    ["meal", 45, "g", "잘 먹음", "아침 건사료"],
    ["water", 160, "ml", "보통", "자동급수기 기준"],
    ["poop", 1, "회", "정상", "상태 좋아요"],
    ["weight", 4.8, "kg", "유지", "저녁 식사 전 측정"],
  ];
  await database.batch(
    logs.map((log, index) =>
      database
        .prepare(
          "INSERT INTO life_logs (id, cat_id, author_id, type, value, unit, status, memo, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          crypto.randomUUID(),
          id,
          ownerId,
          log[0],
          log[1],
          log[2],
          log[3],
          log[4],
          new Date(now.getTime() - index * 36e5).toISOString(),
        ),
    ),
  );

  const albumDates = ["2026-05-11", "2026-07-20", "2026-09-14"];
  const captions = ["우리 집에 처음 온 날", "햇살 아래에서 보낸 느긋한 오후", "처음 함께 떠난 캠핑"];
  await database.batch(
    albumDates.map((date, index) =>
      database
        .prepare(
          "INSERT INTO album_entries (id, cat_id, fallback_url, caption, taken_at, milestone, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
        )
        .bind(
          crypto.randomUUID(),
          id,
          "/tori.png",
          captions[index],
          date,
          index === 0 ? "첫 만남" : index === 2 ? "첫 캠핑" : null,
          new Date().toISOString(),
        ),
    ),
  );
  return { id, owner_id: ownerId, name: "토리", birth_date: "2026-05-11", share_slug: "tori" };
}

export async function getDashboard(ownerId: string) {
  const cat = await ensureCat(ownerId);
  if (cat.owner_id !== ownerId) throw new Error("이 고양이의 기록을 볼 권한이 없습니다.");
  const [logs, album] = await Promise.all([
    db().prepare("SELECT id, type, value, unit, status, memo, occurred_at FROM life_logs WHERE cat_id = ? ORDER BY occurred_at DESC LIMIT 40").bind(cat.id).all<LifeLog>(),
    db().prepare("SELECT id, image_key, fallback_url, caption, taken_at, milestone, is_public FROM album_entries WHERE cat_id = ? ORDER BY taken_at DESC LIMIT 40").bind(cat.id).all<AlbumEntry>(),
  ]);
  return { cat, logs: logs.results, album: album.results };
}

export async function getPublicAlbum(slug: string) {
  const database = db();
  if (slug === "tori") await ensureCat("demo-owner");
  const cat = await database
    .prepare("SELECT id, name, birth_date, breed, bio, share_slug FROM cats WHERE share_slug = ? LIMIT 1")
    .bind(slug)
    .first<Record<string, string>>();
  if (!cat) return null;
  const album = await database
    .prepare("SELECT id, image_key, fallback_url, caption, taken_at, milestone, is_public FROM album_entries WHERE cat_id = ? AND is_public = 1 ORDER BY taken_at DESC")
    .bind(cat.id)
    .all<AlbumEntry>();
  return { cat, album: album.results };
}

export function imageUrl(entry: AlbumEntry) {
  return entry.image_key ? `/api/media/${encodeURIComponent(entry.image_key)}` : entry.fallback_url ?? "/tori.png";
}

