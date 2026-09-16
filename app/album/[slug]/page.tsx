import { getPublicAlbum, imageUrl } from "@/lib/data";
import { CalendarDays, Heart, PawPrint } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicAlbum(slug);
  if (!data) return { title: "성장앨범을 찾을 수 없어요" };
  return { title: `${data.cat.name}의 성장앨범 | 냥로그`, description: data.cat.bio };
}

export default async function PublicAlbum({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicAlbum(slug);
  if (!data) notFound();
  return (
    <main className="public-album">
      <header className="public-top"><a className="brand" href={`/album/${slug}`}><span className="brand-mark"><PawPrint /></span><span>냥로그</span></a><span>공개 성장앨범</span></header>
      <section className="album-cover"><img src="/tori.png" alt={`${data.cat.name} 대표 사진`} /><div><span className="pet-pill"><Heart />함께 자라는 중</span><h1>{data.cat.name}의 성장앨범</h1><p>{data.cat.bio}</p><div className="cover-meta"><span><PawPrint />{data.cat.breed}</span><span><CalendarDays />{data.cat.birth_date.replaceAll("-", ".")} 출생</span></div></div></section>
      <section className="memory-section"><div className="section-heading"><div><span className="eyebrow">MEMORIES</span><h2>우리의 소중한 순간들</h2></div><p>{data.album.length}개의 공개된 기록</p></div><div className="public-grid">{data.album.map((entry, index) => <article className={index === 0 ? "featured" : ""} key={entry.id}><div><img src={imageUrl(entry)} alt={entry.caption} />{entry.milestone && <span>{entry.milestone}</span>}</div><time>{entry.taken_at.replaceAll("-", ".")}</time><h3>{entry.caption}</h3></article>)}</div></section>
      <footer className="album-footer"><PawPrint /><span>냥로그로 만든 성장앨범</span></footer>
    </main>
  );
}
