# 개인 Cloudflare 배포 준비

이 설정은 Sojin9534/Nayng-Tori 전용입니다. 기존 ChatGPT Sites 배포와 데이터는 변경하지 않습니다.
빌드 성공은 데이터 이전 완료를 뜻하지 않습니다. 실제 계정에서 배포·로그인·데이터 이전 검증은 아직 필요합니다.

## Workers Builds

- 저장소: Sojin9534/Nayng-Tori
- 프로젝트 이름: nayng-tori
- Build command: `pnpm run build:cloudflare`
- Deploy command: `pnpm run deploy:cloudflare`
- Node.js: 22.13 이상
- 개인 설정: wrangler.personal.json
- 빌드 결과: dist/server/wrangler.json (이 파일로 배포)

D1 DB 바인딩은 nyangtori-db, R2 BUCKET 바인딩은 nyangtori-photos입니다.
R2 Public Access를 활성화할 필요는 없습니다. 사진은 앱의 /api/media 경로로 제공합니다.
현재 미디어 경로는 파일 주소를 아는 누구나 조회할 수 있으므로 비공개 사진 저장소 용도로 사용하지 마세요.

## DB 초기화

Cloudflare 빌드가 배포될 때 자동으로 실행됩니다. 필요하면 Cloudflare에 인증된 로컬 환경에서 직접 실행할 수도 있습니다.

```sh
pnpm run db:migrate:cloudflare
```

이 명령은 테이블을 생성합니다. 기존 사이트 데이터는 복사하지 않습니다.
기존 데이터가 이미 들어있는 DB에는 먼저 스키마와 마이그레이션 이력을 확인해야 합니다.
사진은 R2 파일 키를 유지해 별도로 복사해야 합니다.

## 관리자 로그인 (Cloudflare Access)

ChatGPT Sites의 로그인 헤더를 개인 Workers에서 신뢰하지 않습니다.
개인 배포에서는 서명 검증된 Cloudflare Access JWT와 지정 관리자 이메일을 사용합니다.

1. 새 Worker URL을 확보합니다.
2. Cloudflare Zero Trust에서 해당 호스트의 /dashboard 및 /dashboard/*를 보호하는 Access 앱을 설정합니다.
3. Allow 정책에는 관리자 이메일 하나만 넣습니다. 이메일 일회용 코드 또는 설정된 Google 로그인 공급자를 사용할 수 있습니다.
4. 공개 /album/*, /api/public/* 경로에는 관리자 전용 정책을 적용하지 않습니다.
5. 이 저장소의 `wrangler.personal.json`에 관리자 설정이 들어 있습니다. 팀에서 다른 Access 앱의 토큰도 발급하는 경우에는 `ACCESS_AUD`도 추가해 특정 앱 토큰만 허용할 수 있습니다.

서명된 토큰의 발급자와 관리자 이메일이 맞지 않으면 관리자 API는 인증을 거부합니다.
로그인 후 API는 Access 쿠키도 검증합니다. 임의 oai-authenticated-user-* 헤더로는 개인 배포의 관리자 권한을 얻지 못합니다.
workers.dev에서 경로별 Access 구성을 제공하지 않는 경우 별도 도메인 연결 또는 다른 로그인 구성이 필요합니다. 전체 호스트 보호를 켜면 친구들의 공개 앨범도 잠기므로 이를 그대로 공유하지 마세요.

## 이전 순서

1. 기존 DB 전체와 R2 파일을 백업합니다. 댓글 비밀번호 해시가 포함된 백업은 비공개로 보관합니다.
2. 새 DB에 스키마를 준비하고 기존 ID·관계·owner_id를 유지하여 데이터를 가져옵니다.
3. R2에 기존 키 그대로 파일을 복사합니다.
4. 관리자 변수와 Access 정책을 설정합니다.
5. 공개 앨범, 관리자 로그인, 기록/사진 작성·수정·삭제, 댓글·방명록·하트를 확인합니다.
6. 데이터 건수와 사진 로딩을 비교한 뒤 새 주소를 공유합니다. 기존 사이트는 확인 전 삭제하지 않습니다.

## 검증 결과

- 개인 Cloudflare 빌드 성공, 생성된 설정의 DB/R2 바인딩 확인.
- 인증 테스트 12개 통과 (서명, 만료, 발급자, 선택적 대상 앱, 관리자 이메일, 쿠키, 위조 헤더, 설정 누락).
- 전체 TypeScript 검사에는 기존 UI 파일 오류 6개가 남아 있습니다. 변경 전 코드에서도 동일한 오류를 확인했습니다.
- 실제 Cloudflare 배포, Access 로그인, DB/R2 이전은 아직 실행하지 않았습니다.

공식 인증 문서: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
