# AIXPROMPT

정적(무백엔드) 프롬프트 갤러리. 사용자 페이지는 복사만 가능, 카드는 관리자만 등록합니다.

## 구조
- `index.html`: 사용자 페이지. `data/prompts.json`을 읽어 카드 렌더링. 텍스트 박스 호버 시 반투명 `#131313`(50%) 오버레이와 "복사하기"가 표시됩니다.
- `admin.html`: 관리자 페이지. 로컬 이미지 업로드, 프롬프트/제목 입력 → GitHub API로 `public/images/*` 업로드 후 `data/prompts.json`에 항목 추가 커밋.
- `data/prompts.json`: 카드 데이터 배열.
- `public/images/`: 업로드된 이미지가 저장되는 경로.

## 관리자 사용법
1. `admin.html` 열기(공개 링크 배포 지양, 관리 PC에서만 사용 권장).
2. 이미지 선택(선택), 제목, 프롬프트 입력.
3. Repo: `stresspoon/AIXPROMPT`, Branch: `main` 입력.
4. GitHub Personal Access Token 입력.
   - 권한: `Repository contents: Read and write`(fine-grained 토큰 권장).
   - 토큰은 브라우저에서만 사용, 서버 저장 없음.
5. 저장(커밋) → 이미지(`public/images/yyyymmdd-hhmmss-파일명`) 업로드 → `data/prompts.json`에 새 항목 추가 커밋.
6. 수 초 내 Vercel이 자동 배포하여 `index.html`에 반영됩니다.

### 토큰 생성 가이드(요약)
- GitHub → Settings → Developer settings → Personal access tokens (fine-grained).
- Repository access: Only select repositories → `stresspoon/AIXPROMPT` 선택.
- Permissions → Repository contents: Read and write.

## 보안/운영 주의
- 토큰을 클라이언트에서 입력하므로 공개 페이지에 노출하지 마세요. 관리자만 접근.
- 저장소를 Private으로 두고 Vercel 배포만 노출하거나, `admin.html`은 별도 비공개 호스트에서 사용 권장.
- 필요 시 브랜치 전략(예: `admin` 브랜치 → PR 병합)으로 운영.

## 개발
- 정적 사이트로 어떤 호스팅(Vercel/Pages/Static Server)에서도 동작.
- 스타일은 기존 `aixpromt_prompt_gallery_single.html` 톤을 유지하며, 기능만 단순화(복사 전용).

## 라이선스
MIT
