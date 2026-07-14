# WealthCopy — L6에서 L7로 가는 경로 복사

WealthCopy는 현재 자산그룹과 생활 조건을 입력하면 다음 자산그룹으로 가는 대표 경로 3개를 비교하고, 사용자가 고른 경로를 월간 실행 체크리스트로 복사하는 OpenAI Build Week MVP입니다.

현재 데모의 범위는 `L6 → L7`입니다. 안정형·균형형·빠른형 경로의 기간과 월 필요 금액은 검증된 투자 성과가 아니라 기획용 대표 시나리오 추정치입니다.

## 구현된 사용자 흐름

1. 고정된 `L6 → L7` 여정에서 월소득, 월 가용액, 부채상환 비율, 비상자금, 가구 유형, 선호 경로와 추가 제약을 입력합니다.
2. 규칙 기반 Wealth Engine이 안정형·균형형·빠른형 경로를 같은 기준으로 계산합니다.
3. GPT‑5.6이 사용자의 정성적 제약과 서버가 만든 후보 경로를 해석해, 각 경로의 적합 이유·트레이드오프·다음 확인 항목을 구조화해 반환합니다.
4. 사용자가 감당 가능한 경로를 직접 선택하고, 교육용 시뮬레이션 확인란에 동의한 뒤 계획에 복사합니다.
5. 현금 여유, 부채 일정, 월 실행 한도, 월말 재점검으로 구성된 체크리스트에서 진행률을 관리합니다. 리마인더 스위치는 기본적으로 꺼져 있으며 실제 알림을 예약하지 않는 화면 데모입니다.

샘플 프로필은 월소득 650만 원, 월 가용액 310만 원, 부채상환 비율 18%, 비상자금 5개월, 1인 가구, 균형형 선호입니다. 순자산은 입력·저장·API 스키마에 포함하지 않습니다. 샘플 시작 버튼으로 입력 없이 전체 흐름을 시연할 수 있습니다.

## OpenAI의 역할

- 기본 모델은 `gpt-5.6`이며 서버의 Responses API를 사용합니다.
- `responses.parse`와 Zod 기반 Structured Outputs로 허용된 상태, 경로 ID, 이유 코드, 근거 필드, 트레이드오프 코드, 체크리스트 액션만 받습니다.
- 모델은 서버가 계산한 금액·기간을 변경하거나 새 수치, 수익률, 확률, 상품, 종목, 매매 시점을 만들 수 없습니다.
- 모델에는 월 가용액, 부채 비율, 가구 유형, 선호 경로, 비상자금과 정제된 추가 제약만 보냅니다. 월소득은 서버 검증에만 사용하고 모델 입력에서는 제외합니다. 브라우저의 익명 세션 UUID는 서버에서 SHA-256 해시해 `safety_identifier`로 사용합니다.
- `store: false`, `reasoning.effort: "medium"`, 최대 출력 토큰 제한을 적용합니다.
- 출력이 스키마 또는 의미 검증을 통과하지 못하면 규칙 기반 설명으로 자동 전환합니다.
- 추가 제약에서 이메일·전화번호·주민등록번호 형태를 감지하면 요청을 거절합니다. 상품·거래·세금·신용 판단 같은 실행성 금융 요청은 전문가 검토로, 실직·연체·소득 중단처럼 계획 전제가 무너진 요청은 추가 확인으로 전환하며 둘 다 GPT‑5.6에 보내거나 경로 복사를 허용하지 않습니다.
- API 요청 본문은 8KB로 제한합니다. 데모용 인메모리 rate limit은 IP당 분당 20회, 익명 세션당 분당 8회이며 초과 시 `429`와 규칙 기반 fallback을 반환합니다.

API 키가 없어도 제품 흐름은 끊기지 않습니다. 같은 규칙 엔진이 즉시 세 경로와 로컬 설명을 보여 주며, 화면 배지와 안내 문구로 `GPT‑5.6 분석`과 `규칙 기반 설명`을 구분합니다.

## Windows에서 실행

요구 사항:

- Node.js 24.x
- pnpm 11.x
- 실시간 AI 해석을 사용할 경우 GPT‑5.6에 접근 가능한 OpenAI API 키

PowerShell 실행 정책이 `.ps1` 래퍼를 차단할 수 있으므로 Windows에서는 `pnpm.cmd`를 권장합니다.

```powershell
cd C:\wealth_copy_openai_challenge
pnpm.cmd install
Copy-Item .env.example .env.local
```

`.env.local`에 서버 전용 키를 입력합니다. 키 없이 fallback 데모만 실행하려면 빈 값으로 두어도 됩니다.

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6
```

```powershell
pnpm.cmd dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. API 키는 절대 `NEXT_PUBLIC_` 변수에 넣지 마세요.

## 품질 명령

| 명령 | 용도 |
| --- | --- |
| `pnpm.cmd lint` | ESLint를 경고 0개 기준으로 실행 |
| `pnpm.cmd typecheck` | TypeScript 타입 검사 |
| `pnpm.cmd test` | Vitest 단위 테스트 실행 |
| `pnpm.cmd build` | Next.js 프로덕션 빌드 |
| `pnpm.cmd check` | 위 품질 게이트 전체 실행 |

## 구조

```text
src/app/page.tsx                         WealthCopy 앱 진입점
src/components/wealth/wealth-copy-app.tsx  3단계 사용자 경험과 로컬 상태
src/components/wealth/logo.tsx           코드 기반 브랜드 로고
src/components/wealth/path-icon.tsx      경로 유형 아이콘
src/lib/wealth/engine.ts                 입력 검증·대표 경로·결정적 매칭
src/lib/wealth/assessment.ts             GPT 출력 스키마·프롬프트·fallback
src/app/api/paths/compare/route.ts        서버 전용 GPT‑5.6 비교 API
src/lib/openai.ts                         OpenAI 클라이언트와 모델 설정
docs/DECISIONS.md                         제품·아키텍처 결정 기록
docs/DEMO_SCRIPT.md                       90초 시연 대본
```

`POST /api/paths/compare`는 다음 형태를 받습니다.

```json
{
  "profile": {
    "currentLevel": "L6",
    "targetLevel": "L7",
    "monthlyIncome": 6500000,
    "monthlySavings": 3100000,
    "debtRatio": 18,
    "householdType": "single",
    "riskPreference": "balanced",
    "emergencyFundMonths": 5
  },
  "constraintNote": "내년에 이사 가능성이 있어 현금 여유를 유지하고 싶어요.",
  "sessionId": "브라우저에서 생성한 UUID"
}
```

`currentLevel`과 `targetLevel`은 각각 `L6`, `L7`만 허용하며 다른 단계나 추가 필드는 거절합니다. 응답은 서버가 재계산한 `paths`, 검증된 `assessment`, `source`(`gpt-5.6` 또는 `fallback`), 모델 또는 경고 정보를 포함합니다. 클라이언트가 보낸 경로 수치나 모델이 만든 숫자는 신뢰하지 않습니다.

## 브라우저 데모 저장

경로 복사를 확인한 뒤에는 `wealthcopy-demo-plan-v1` 키에 검증된 프로필, 선택 경로 유형, 체크리스트 완료 상태, 리마인더 화면 상태와 저장 버전을 기록합니다. 다음 방문 시 같은 스키마와 현재 규칙 엔진으로 다시 검증해 유효한 계획만 복원하고, 손상되었거나 더 이상 감당할 수 없는 계획은 삭제합니다. 익명 API 세션 UUID는 별도 키에 저장합니다.

이 저장은 서버 계정 동기화가 아닌 현재 브라우저의 `localStorage` 데모입니다. 프로필에는 월소득·월 가용액·부채 비율·비상자금 같은 금융 계획 입력이 포함되므로 공용 기기에서는 브라우저 데이터를 지우세요. 리마인더 상태는 화면 표시만 저장하며 알림·캘린더·예약 작업을 만들지 않습니다.

## 금융 안전 경계

WealthCopy는 교육용 계획 시뮬레이션입니다.

- 투자·세무·법률·신용·보험 자문이 아닙니다.
- 수익을 보장하거나 최적·안전·검증된 경로라고 주장하지 않습니다.
- 금융상품·종목·가상자산·대출·레버리지·매수·매도·거래 시점을 추천하지 않습니다.
- 계좌 연결, 자동이체, 주문, 리밸런싱을 실행하지 않습니다.
- `경로 복사`는 체크리스트 생성일 뿐이며 모든 실제 결정은 사용자가 합니다.
- 교육용 안내 확인란을 선택하기 전에는 복사 버튼이 활성화되지 않습니다.
- 실제 금융 의사결정 전에는 자격 있는 전문가와 현재 상황을 검토해야 합니다.

현재 rate limit은 단일 프로세스 메모리에만 있는 데모 보호 장치입니다. 공개 서비스 전에는 인증과 분산 저장소를 이용한 사용자·IP 기반 rate limiting으로 강화하고, 모니터링, 접근성 점검, 로컬 금융정보 저장에 대한 명시적 동의·삭제 UX·개인정보 및 보존 정책, 금융 도메인 법률 검토를 추가해야 합니다.

## Build Week

제출 준비는 `docs/BUILD_WEEK.md`, 선택 근거는 `docs/DECISIONS.md`, 녹화 순서는 `docs/DEMO_SCRIPT.md`에서 관리합니다. 대표 Codex 작업의 `/feedback` 세션 ID와 공개 데모·영상 링크는 제출 전에 기록해야 합니다.

공식 참고 자료:

- [GPT‑5.6 모델 가이드](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6)
- [Structured Outputs 가이드](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI API 빠른 시작](https://developers.openai.com/api/docs/quickstart)
- [OpenAI Build Week](https://openai.com/build-week/)
