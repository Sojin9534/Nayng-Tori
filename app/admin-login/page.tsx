export default function AdminLogin() {
  return <main style={{maxWidth: 540, margin: "80px auto", padding: 24}}>
    <h1>관리자 인증이 필요해요</h1>
    <p>관리자 계정으로 Cloudflare Access에 로그인해 주세요. 연결 설정이 아직 끝나지 않았다면 관리자에게 확인해 주세요.</p>
    <a href="/cdn-cgi/access/logout">인증 초기화</a><br/>
    <a href="/dashboard">관리자 화면 다시 열기</a><br/>
    <a href="/album/tori">토리 성장앨범 보기</a>
  </main>;
}
