# AIXPROMPT

정적(무백엔드) 프롬프트 갤러리. 사용자 페이지는 복사만 가능, 카드는 관리자만 등록합니다.

## 구조
- `index.html`: 사용자 페이지. `data/prompts.json`을 읽어 카드 렌더링. 텍스트 박스 호버 시 반투명 `#131313`(50%) 오버레이와 "복사하기" 표시. 제목이 없으면 숨김.
- `admin.html`: 관리자 페이지. 로그인(아이디/비번) 후 업로드/저장. 서버리스 API를 호출하여 이미지 업로드 및 `data/prompts.json` 갱신을 커밋.
- `api/auth-check`: Basic 인증 체크(서버 환경변수 기반).
- `api/append-card`: 이미지 업로드 + `data/prompts.json`에 항목 추가 커밋.
- `data/prompts.json`: 카드 데이터 배열.
- `public/images/`: 업로드된 이미지가 저장되는 경로.

## 관리자 사용법(토큰 입력 불필요)
1. `admin.html` 접속 → 아이디/비밀번호 로그인 (기본값: `admin` / `AIXPROMPT!2025`).
2. 이미지 선택(선택), 프롬프트 입력.
3. 저장(커밋) → 서버리스 API가 GitHub에 커밋 수행.
4. 수 초 내 Vercel 자동 배포 → 사용자 페이지 자동 반영.

### 토큰 생성 가이드(요약)
- GitHub → Settings → Developer settings → Personal access tokens (fine-grained).
- Repository access: Only select repositories → `stresspoon/AIXPROMPT` 선택.
- Permissions → Repository contents: Read and write.

## 보안/운영 주의
- `admin.html`은 로그인 필요. 기본 자격 증명은 환경변수로 교체 권장.
- 환경변수: `ADMIN_USER`, `ADMIN_PASS`, `GITHUB_TOKEN`, `REPO_SLUG`, `REPO_BRANCH` (Vercel Project Settings → Environment Variables)
- 저장소를 Private으로 두고 Vercel만 공개해도 동작.

## 개발
- 정적 사이트로 어떤 호스팅(Vercel/Pages/Static Server)에서도 동작.
- 스타일은 기존 `aixpromt_prompt_gallery_single.html` 톤을 유지하며, 기능만 단순화(복사 전용).

## 라이선스
MIT
