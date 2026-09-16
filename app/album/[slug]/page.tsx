import { catImageUrl, getPublicAlbum } from "@/lib/data";
import { CalendarDays, Heart, PawPrint, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { PublicInteractions } from "./public-interactions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicAlbum(slug);
  if (!data) return { title: "성장앨범을 찾을 수 없어요" };
  return { title: `${data.cat.name}의 성장앨범 | 냥토리`, description: data.cat.bio };
}

export default async function PublicAlbum({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicAlbum(slug);
  if (!data) notFound();
  return (
    <main className="public-album">
      <header className="public-top"><a className="brand" href={`/album/${slug}`}><span className="brand-mark"><img src="/tori-mascot.png" alt="" /></span><span>냥토리</span></a><span><Heart />{data.cat.name}의 공개앨범</span></header>
      <section className="album-cover-wrap">
        <div className="cover-sparkle cover-sparkle-one">✦</div><div className="cover-sparkle cover-sparkle-two">♥</div>
        <section className="album-cover"><div className="cover-photo"><img src={catImageUrl(data.cat)} alt={`${data.cat.name} 대표 사진`} /><span><Sparkles />오늘도 귀여움</span></div><div className="cover-copy"><span className="pet-pill"><Heart />함께 자라는 중</span><h1>{data.cat.name}의<br />성장앨범</h1><p>{data.cat.bio}</p><div className="cover-meta"><span><PawPrint />{data.cat.breed}</span><span><CalendarDays />{data.cat.birth_date.replaceAll("-", ".")} 출생</span></div></div><img className="cover-mascot" src="/tori-mascot.png" alt="토리 캐릭터" /></section>
      </section>
      <section className="memory-section"><div className="section-heading public-heading"><div><span className="eyebrow">TORI&apos;S MEMORIES</span><h2>토리의 소중한 순간들</h2></div><p><strong>{data.album.length}</strong>개의 추억을 함께 보고 있어요</p></div>{!data.album.length && <div className="public-empty"><img src="/icon-album.png" alt="" /><h3>첫 번째 추억을 기다리고 있어요</h3><p>토리의 사진이 공개되면 이곳에서 함께 볼 수 있어요.</p></div>}<PublicInteractions slug={slug} album={data.album} initialComments={data.comments} initialGuestbook={data.guestbook} /></section>
      <footer className="album-footer"><img src="/tori-mascot.png" alt="" /><div><strong>토리의 하루를 보러 와줘서 고마워요!</strong><span>냥토리로 만든 성장앨범</span></div></footer>
    </main>
  );
}
