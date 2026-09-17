"use client";

import { useEffect, useMemo, useState } from "react";
import { Bone, Camera, ChevronRight, Droplets, HeartPulse, LogOut, MessageCircle, PawPrint, Pencil, Plus, Scale, Share2, Sparkles, Trash2, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import type { AlbumEntry, LifeLog, PublicMessage } from "@/lib/data";

type AlbumView = AlbumEntry & { imageUrl: string };
type DashboardData = {
  cat: { id: string; name: string; birth_date: string; breed: string; bio: string; profile_image_key: string | null; imageUrl: string };
  logs: LifeLog[];
  album: AlbumView[];
  comments: PublicMessage[];
  guestbook: PublicMessage[];
};

const logMeta = {
  meal: { label: "밥", icon: Utensils, color: "#ee7c66", unit: "g" },
  water: { label: "물", icon: Droplets, color: "#5aa6c8", unit: "ml" },
  poop: { label: "대변", icon: PawPrint, color: "#8a6b58", unit: "회" },
  weight: { label: "체중", icon: Scale, color: "#7c77bd", unit: "kg" },
  symptom: { label: "증상", icon: HeartPulse, color: "#d65b75", unit: "회" },
  medicine: { label: "약", icon: Bone, color: "#6a9d78", unit: "회" },
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date(value));
}

function ageLabel(birthDate: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(birthDate).getTime()) / 86400000));
  return `태어난 지 ${days}일`;
}

export default function Dashboard({ initialData, userName, signOutPath }: { initialData: DashboardData; userName: string; signOutPath: string }) {
  const [data, setData] = useState(initialData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<keyof typeof logMeta>("meal");
  const [saving, setSaving] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"today" | "records" | "album">("today");
  const [activeTab, setActiveTab] = useState<"records" | "album">("records");
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = useMemo(() => data.logs.filter((log) => log.occurred_at.slice(0, 10) === today), [data.logs, today]);
  const summary = (type: keyof typeof logMeta) => {
    const items = todayLogs.filter((log) => log.type === type);
    if (type === "weight") return items[0]?.value ? `${items[0].value} kg` : "기록 전";
    const total = items.reduce((sum, item) => sum + (item.value ?? 0), 0);
    return total ? `${total}${items[0]?.unit ?? logMeta[type].unit}` : "기록 전";
  };

  function goToSection(section: "today" | "records" | "album") {
    setActiveSection(section);
    if (section !== "today") setActiveTab(section);
    window.requestAnimationFrame(() => {
      document.getElementById(section === "today" ? "today" : "content-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function saveLog(formData: FormData) {
    setSaving(true);
    const meta = logMeta[selectedType];
    const payload = { type: selectedType, value: formData.get("value"), unit: meta.unit, status: formData.get("status"), memo: formData.get("memo"), occurredAt: new Date().toISOString() };
    const response = await fetch("/api/logs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!response.ok) return toast.error("기록을 저장하지 못했어요.");
    setData((current) => ({ ...current, logs: [{ id: crypto.randomUUID(), ...payload, value: Number(payload.value), occurred_at: payload.occurredAt } as LifeLog, ...current.logs] }));
    setDialogOpen(false);
    toast.success(`${meta.label} 기록을 저장했어요.`);
  }

  async function savePhoto(formData: FormData) {
    setSaving(true);
    const response = await fetch("/api/album", { method: "POST", body: formData });
    setSaving(false);
    if (!response.ok) return toast.error((await response.json()).error ?? "사진을 저장하지 못했어요.");
    setPhotoOpen(false);
    toast.success("성장앨범에 사진을 추가했어요.");
    window.location.reload();
  }

  async function saveProfile(formData: FormData) {
    setSaving(true);
    try {
      const response = await fetch("/api/cat", { method: "PATCH", body: formData });
      if (!response.ok) return toast.error((await response.json()).error ?? "기본 정보를 저장하지 못했어요.");
      setProfileOpen(false);
      toast.success("기본 정보를 바꿨어요.");
      window.location.reload();
    } catch {
      toast.error("연결이 불안정해요. 다시 눌러주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublic(entry: AlbumView, isPublic: boolean) {
    setData((current) => ({ ...current, album: current.album.map((item) => item.id === entry.id ? { ...item, is_public: isPublic ? 1 : 0 } : item) }));
    const response = await fetch(`/api/album/${entry.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isPublic }) });
    if (!response.ok) toast.error("공개 설정을 변경하지 못했어요.");
    else toast.success(isPublic ? "친구에게 공개했어요." : "비공개로 바꿨어요.");
  }

  async function editLog(log: LifeLog) { const next = window.prompt("기록할 양 또는 횟수를 입력해주세요.", String(log.value ?? "")); if (next === null) return; const memo = window.prompt("메모를 수정해주세요.", log.memo ?? ""); if (memo === null) return; const meta = logMeta[log.type as keyof typeof logMeta] ?? logMeta.symptom; const response = await fetch(`/api/logs/${log.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: log.type, value: next, unit: log.unit ?? meta.unit, status: log.status ?? "", memo, occurredAt: log.occurred_at }) }); if (!response.ok) return toast.error("기록을 수정하지 못했어요."); toast.success("기록을 수정했어요."); window.location.reload(); }
  async function deleteLog(id: string) { if (!window.confirm("이 기록을 삭제할까요?")) return; const response = await fetch(`/api/logs/${id}`, { method: "DELETE" }); if (!response.ok) return toast.error("기록을 삭제하지 못했어요."); setData((current) => ({ ...current, logs: current.logs.filter((item) => item.id !== id) })); toast.success("기록을 삭제했어요."); }
  async function editAlbum(entry: AlbumView) { const takenAt = window.prompt("촬영 날짜를 YYYY-MM-DD 형식으로 입력해주세요.", entry.taken_at); if (takenAt === null) return; if (!/^\d{4}-\d{2}-\d{2}$/.test(takenAt) || Number.isNaN(new Date(`${takenAt}T00:00:00`).getTime())) return toast.error("날짜를 YYYY-MM-DD 형식으로 입력해주세요."); const caption = window.prompt("사진 일기를 수정해주세요.", entry.caption); if (caption === null) return; const milestone = window.prompt("기념일 문구를 수정해주세요.", entry.milestone ?? ""); if (milestone === null) return; const response = await fetch(`/api/album/${entry.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ caption, milestone, takenAt, isPublic: Boolean(entry.is_public) }) }); if (!response.ok) return toast.error("사진 일기를 수정하지 못했어요."); toast.success("사진 일기와 날짜를 수정했어요."); window.location.reload(); }
  async function deleteAlbum(id: string) { if (!window.confirm("이 사진과 댓글을 모두 삭제할까요?")) return; const response = await fetch(`/api/album/${id}`, { method: "DELETE" }); if (!response.ok) return toast.error("사진을 삭제하지 못했어요."); setData((current) => ({ ...current, album: current.album.filter((item) => item.id !== id) })); toast.success("사진을 삭제했어요."); }
  async function deleteMessage(kind: "comment" | "guestbook", id: string) { if (!window.confirm("이 글을 삭제할까요?")) return; const response = await fetch(`/api/messages/${kind}/${id}`, { method: "DELETE" }); if (!response.ok) return toast.error("글을 삭제하지 못했어요."); setData((current) => kind === "comment" ? { ...current, comments: current.comments.filter((item) => item.id !== id) } : { ...current, guestbook: current.guestbook.filter((item) => item.id !== id) }); toast.success("글을 삭제했어요."); }

  async function copyShareLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/album/tori`);
    toast.success("성장앨범 링크를 복사했어요.");
  }

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => unknown } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "add_cat_life_log",
      title: "고양이 생활기록 추가",
      description: "토리의 밥, 물, 배변, 체중 또는 건강 기록을 추가합니다.",
      inputSchema: { type: "object", properties: { type: { type: "string", enum: Object.keys(logMeta) }, value: { type: "number" }, memo: { type: "string" } }, required: ["type", "value"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input: { type: keyof typeof logMeta; value: number; memo?: string }) {
        const meta = logMeta[input.type];
        const response = await fetch("/api/logs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: input.type, value: input.value, unit: meta.unit, memo: input.memo ?? "", occurredAt: new Date().toISOString() }) });
        if (!response.ok) throw new Error("기록 저장 실패");
        window.location.reload();
        return { status: "saved", type: input.type, value: input.value, unit: meta.unit };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  return (
    <div className="app-shell">
      <Toaster position="top-center" richColors />
      <aside className="desktop-sidebar">
        <a className="brand" href="/" aria-label="냥토리 홈"><span className="brand-mark"><img src="/tori-mascot.png" alt="" /></span><span>냥토리</span></a>
        <nav aria-label="주요 메뉴"><button type="button" className={`nav-item ${activeSection === "today" ? "active" : ""}`} onClick={() => goToSection("today")}><img className="nav-mascot-icon" src="/icon-today.png" alt="" />오늘</button><button type="button" className={`nav-item ${activeSection === "records" ? "active" : ""}`} onClick={() => goToSection("records")}><img className="nav-mascot-icon" src="/icon-records.png" alt="" />기록</button><button type="button" className={`nav-item ${activeSection === "album" ? "active" : ""}`} onClick={() => goToSection("album")}><img className="nav-mascot-icon" src="/icon-album.png" alt="" />성장앨범</button></nav>
        <div className="sidebar-foot"><div className="mini-profile"><img src={data.cat.imageUrl} alt={data.cat.name} /><div><strong>{data.cat.name}</strong><span>{data.cat.breed}</span></div></div><a className="signout" href={signOutPath} target="_top"><LogOut />로그아웃</a></div>
      </aside>

      <main className="main-content">
        <header className="mobile-head"><a className="brand" href="/"><span className="brand-mark"><img src="/tori-mascot.png" alt="" /></span><span>냥토리</span></a><Button variant="outline" size="icon" onClick={copyShareLink} aria-label="성장앨범 공유"><img className="header-share-icon" src="/icon-share.png" alt="" /></Button></header>
        <section id="today" className="welcome-row"><div><span className="eyebrow">{formatDate(new Date().toISOString())}</span><h1>{data.cat.name}의 오늘</h1><p>{userName} 집사님, 오늘 기록을 남겨주세요.</p></div><Button className="share-button" onClick={copyShareLink}><Share2 />앨범 공유</Button></section>
        <section className="pet-hero"><img src={data.cat.imageUrl} alt={`${data.cat.name} 대표 사진`} /><div className="pet-hero-copy"><span className="pet-pill"><Sparkles />{ageLabel(data.cat.birth_date)}</span><h2>{data.cat.name}</h2><p>{data.cat.bio}</p><Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogTrigger asChild><Button className="profile-edit-button" variant="outline"><Pencil />기본 정보 수정</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>기본 정보 수정</DialogTitle><DialogDescription>저장하면 공개 성장앨범에도 바로 반영돼요.</DialogDescription></DialogHeader><form noValidate onSubmit={(event) => { event.preventDefault(); void saveProfile(new FormData(event.currentTarget)); }} className="form-stack"><label>대표 사진<Input name="photo" type="file" accept="image/*" /></label><label>이름<Input name="name" defaultValue={data.cat.name} maxLength={30} /></label><label>생일<Input name="birthDate" type="date" defaultValue={data.cat.birth_date} /></label><label>품종<Input name="breed" defaultValue={data.cat.breed} maxLength={50} /></label><label>소개<Input name="bio" defaultValue={data.cat.bio} maxLength={160} /></label><Button disabled={saving} type="submit">{saving ? "저장 중" : "변경사항 저장"}</Button></form></DialogContent></Dialog><div className="streak"><span>이번 주 기록</span><strong>5일</strong><div className="streak-dots">{[1,2,3,4,5,6,7].map((d) => <i className={d < 6 ? "filled" : ""} key={d} />)}</div></div></div></section>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <section className="quick-section"><div className="section-heading"><div><span className="eyebrow">QUICK LOG</span><h2>빠른 기록</h2></div><DialogTrigger asChild><Button variant="outline"><Plus />직접 입력</Button></DialogTrigger></div><div className="quick-grid">{(Object.keys(logMeta) as Array<keyof typeof logMeta>).slice(0, 6).map((type) => { const meta = logMeta[type]; const Icon = meta.icon; return <DialogTrigger asChild key={type}><button className="quick-card" onClick={() => setSelectedType(type)}><span className="quick-icon" style={{ background: `${meta.color}1e`, color: meta.color }}><Icon /></span><span>{meta.label}</span><strong>{summary(type)}</strong><ChevronRight /></button></DialogTrigger>; })}</div></section>
          <DialogContent className="record-dialog"><DialogHeader><DialogTitle>{logMeta[selectedType].label} 기록하기</DialogTitle><DialogDescription>지금 상태를 간단히 남겨주세요.</DialogDescription></DialogHeader><form action={saveLog} className="form-stack"><label>양 또는 횟수<div className="unit-input"><Input name="value" type="number" step="0.1" required placeholder="0" /><span>{logMeta[selectedType].unit}</span></div></label><label>상태<Input name="status" placeholder="예: 잘 먹음, 정상" /></label><label>메모<Input name="memo" placeholder="특이사항이 있다면 적어주세요" /></label><Button disabled={saving} type="submit">{saving ? "저장 중" : "기록 저장"}</Button></form></DialogContent>
        </Dialog>

        <Tabs id="content-tabs" value={activeTab} onValueChange={(value) => { const tab = value as "records" | "album"; setActiveTab(tab); setActiveSection(tab); }} className="content-tabs">
          <TabsList><TabsTrigger value="records">최근 기록</TabsTrigger><TabsTrigger value="album">성장앨범</TabsTrigger></TabsList>
          <TabsContent value="records" id="records"><div className="timeline-card">{data.logs.slice(0, 8).map((log) => { const meta = logMeta[log.type as keyof typeof logMeta] ?? logMeta.symptom; const Icon = meta.icon; return <article className="timeline-item" key={log.id}><span className="timeline-icon" style={{ color: meta.color, background: `${meta.color}1e` }}><Icon /></span><div><div><strong>{meta.label}</strong><time>{new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(log.occurred_at))}</time></div><p>{log.value != null ? `${log.value}${log.unit ?? ""}` : log.status}{log.memo ? ` · ${log.memo}` : ""}</p></div><div className="item-actions"><button onClick={() => editLog(log)} aria-label="기록 수정"><Pencil /></button><button onClick={() => deleteLog(log.id)} aria-label="기록 삭제"><Trash2 /></button></div></article>; })}</div></TabsContent>
          <TabsContent value="album" id="album"><div className="album-toolbar"><p>공개 스위치를 켠 사진만 친구에게 보여요.</p><Dialog open={photoOpen} onOpenChange={setPhotoOpen}><DialogTrigger asChild><Button><Camera />사진 추가</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>성장앨범에 추가</DialogTitle><DialogDescription>사진과 그날의 기억을 함께 남겨주세요.</DialogDescription></DialogHeader><form action={savePhoto} className="form-stack"><label>사진<Input name="photo" type="file" accept="image/*" /></label><label>촬영일<Input name="takenAt" type="date" defaultValue={today} required /></label><label>한 줄 기록<Input name="caption" required placeholder="오늘의 기억" /></label><label>기념일<Input name="milestone" placeholder="예: 첫 캠핑" /></label><label className="switch-row"><span>친구에게 공개</span><Switch name="isPublic" value="true" defaultChecked /></label><Button disabled={saving} type="submit">{saving ? "올리는 중" : "앨범에 추가"}</Button></form></DialogContent></Dialog></div><div className="album-grid diary-grid">{data.album.map((entry) => <article className="album-card diary-card" key={entry.id}><div className="album-image diary-photo"><img src={entry.imageUrl} alt={entry.caption} />{entry.milestone && <span>{entry.milestone}</span>}</div><div className="album-info diary-page"><time>{entry.taken_at.replaceAll("-", ".")}의 그림일기</time><h3>{entry.caption}</h3><label className="switch-row"><span>{entry.is_public ? "공개 중" : "나만 보기"}</span><Switch checked={Boolean(entry.is_public)} onCheckedChange={(checked) => togglePublic(entry, checked)} /></label><div className="album-actions"><Button variant="outline" size="sm" onClick={() => editAlbum(entry)}><Pencil />날짜·내용 수정</Button><Button variant="outline" size="sm" onClick={() => deleteAlbum(entry.id)}><Trash2 />삭제</Button></div></div></article>)}</div><section className="message-admin"><h3><MessageCircle />댓글과 방명록 관리</h3>{data.comments.map((item) => <article key={item.id}><div><strong>사진 댓글 · {item.nickname}</strong><p>{item.content}</p></div><button onClick={() => deleteMessage("comment", item.id)}><Trash2 />삭제</button></article>)}{data.guestbook.map((item) => <article key={item.id}><div><strong>방명록 · {item.nickname}</strong><p>{item.content}</p></div><button onClick={() => deleteMessage("guestbook", item.id)}><Trash2 />삭제</button></article>)}{!data.comments.length && !data.guestbook.length && <p className="no-messages">아직 남겨진 글이 없어요.</p>}</section></TabsContent>
        </Tabs>
      </main>
      <nav className="mobile-nav" aria-label="모바일 메뉴"><button type="button" className={activeSection === "today" ? "active" : ""} onClick={() => goToSection("today")}><img className="nav-mascot-icon" src="/icon-today.png" alt="" /><span>오늘</span></button><button type="button" className={activeSection === "records" ? "active" : ""} onClick={() => goToSection("records")}><img className="nav-mascot-icon" src="/icon-records.png" alt="" /><span>기록</span></button><button type="button" onClick={() => { setSelectedType("meal"); setDialogOpen(true); }}><span className="nav-add"><img src="/icon-add.png" alt="" /></span><span>기록하기</span></button><button type="button" className={activeSection === "album" ? "active" : ""} onClick={() => goToSection("album")}><img className="nav-mascot-icon" src="/icon-album.png" alt="" /><span>앨범</span></button><a href="/album/tori"><img className="nav-mascot-icon" src="/icon-share.png" alt="" /><span>공개보기</span></a></nav>
    </div>
  );
}
