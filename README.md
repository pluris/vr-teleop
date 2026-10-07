# vr-teleop

## Petty

Claude Code 상태줄(status line)에 사는 다마고치.

```
( OO )~~~ NOODLE  어른  ████████  기쁨
elephantfish · elephantfish · Opus 4.6 · ctx 34% · ⏱ 47m · $0.83
```

- 5초마다 갱신되며 눈을 깜빡입니다 (`refreshInterval`)
- 자식은 실세션 시간과 관계없이 **태어난 뒤 흐른 시간**으로 자랍니다:
  알 → 아기(10분) → 어린이(2시간) → 청소년(12시간) → 어른(3일)
- 배고픔은 마지막 먹이로부터 6시간에 걸쳐 차오릅니다. 안 먹으면 눈이 반쯤 감깁니다
- 컨텍스트가 80%를 넘으면 **과부하** 상태로 붉어집니다
- 23시~7시는 자고 있습니다
- 상태는 `~/.claude/petty/state.json` 에 남으므로 세션이 끝나도 살아있습니다

### 설치

```bash
node petty/install.js
```

이미 `statusLine` 을 쓰고 있다면 (예: Orca 에이전트 훅) 그 명령을
`petty/orca-chain.sh` 로 보존하고 매 렌더마다 함께 실행합니다 — 기존 기능이 죽지 않습니다.
`settings.json` 은 설치 전에 자동 백업됩니다.

상태줄은 다음 프롬프트에서 리로드됩니다.

### 명령

| 명령 | 하는 일 |
| --- | --- |
| `/pet` | 전체 화면 — 아트, 기분, 배고픔, 먹이/방문 횟수 |
| `/feed` | 먹이 주기 (45분간 기분 회복) |
| `/pet-reset` | 다시 태우기 (성장 초기화, 이름 유지) |

### 되돌리기

```bash
cp ~/.claude/settings.json.bak-<timestamp> ~/.claude/settings.json
```

또는 `settings.json` 에서 `statusLine` 키를 지우면 됩니다. `petty/` 디렉터리와
`~/.claude/petty/` 를 지우면 흔적도 없습니다.

### 요구 사항

- `node` (status line 스크립트를 직접 실행합니다)
- Claude Code의 `statusLine` 설정 지원

> 컨텍스트 사용량은 `context_window.used_percentage` 로 읽습니다.
> 스크립트는 출력 없이 종료하거나 0이 아닌 코드로 끝나면 **상태줄 전체가 사라지므로**
> 항상 0으로 종료합니다.
