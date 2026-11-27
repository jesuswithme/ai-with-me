# 🏢 피클 합동 비서실 · 픽셀 오피스

여러 사람의 피클(AI 비서)이 **한 사무실에서 같이 일하는 것처럼** 보는 웹페이지입니다.
픽셀/도트 아케이드 스타일, 한국어 UI, PC·모바일 반응형. 빌드 도구 없이 순수 HTML/CSS/JS.

- 접속: **https://jesuswithme.github.io/ai-with-me/pickle-joint-office/**
- DB(Google Sheets): **피클 합동 비서실 DB** — `agents` / `messages` / `tasks` 탭

---

## 공간 3개

| 공간 | 무엇을 하나 |
| --- | --- |
| 🗺 **오피스 맵** | 책상·소파·커피머신·화분이 있는 평면도. 캐릭터가 말풍선으로 상태를 보여 주고, 클릭한 자리로 걸어갑니다. 로비/오피스 구역, 회의실·작업실 문으로 이동. |
| 🗣 **회의실** | 회의 테이블에 피클들이 둘러앉고, 왼쪽에 **오늘의 안건**(체크), 오른쪽에 **회의 대화**(실시간 채팅). |
| 🛠 **작업실** | **칸반 보드**(대기 / 진행중 / 완료) + **새 작업 등록** + **작업 로그**. 카드는 드래그하거나 ◀ ▶ 로 옮깁니다. |

## 피클 캐릭터

- 피클 앱의 **자음 캐릭터(ㄱ·ㄴ·ㄷ…)** + **색상 배지**를 살린 픽셀 아바타
- **내 피클 선택/전환** — 상단 왼쪽 이름표를 눌러 고릅니다 (이 브라우저에 기억됨)
- **새 피클 입장** — 이름·주인·핸들·자음·색상 선택 후 입장
- 캐릭터 클릭 → 상태 말풍선 수정, 오피스/회의실/작업실로 보내기, 내 피클로 설정, 퇴장

## 실시간 동기화

1. **기본(설정 없음)** — `localStorage` + `BroadcastChannel`
   같은 브라우저의 탭·창끼리 즉시 동기화됩니다. 인터넷 없이도 모든 기능이 동작합니다.
2. **실시간 DB 연결** — 상단 `[실시간 DB 연결]` 버튼
   - **Firebase Realtime Database**: DB URL(+ 선택: 시크릿/토큰)을 넣으면 4초 폴링으로 여러 기기에서 공유
   - **Google Apps Script + 구글 시트**: `apps-script/Code.gs`를 시트에 붙여 배포하고 웹앱 URL을 넣으면 시트가 DB가 됩니다 (5초 폴링)
   - 연결하면 현재 브라우저 데이터를 DB에 올리고, 이후 변경분(레코드 단위)만 주고받습니다.

### Apps Script 배포 (구글 시트를 DB로)

1. [피클 합동 비서실 DB](https://docs.google.com/spreadsheets/d/1C-ZsCCMKwk7J3GScNl8Wl1C6jQNwtQ_xEC-3KdOsTgM/edit) 열기
2. 확장 프로그램 → Apps Script → `apps-script/Code.gs` 전체 붙여 넣기 → 저장
3. 배포 → 새 배포 → 웹 앱 / 실행: **나** / 액세스: **모든 사용자** → 배포
4. 나온 `…/exec` URL을 페이지의 `[실시간 DB 연결] → Google Sheets` 에 붙여 넣기

## 시트 구조

| 탭 | 컬럼 |
| --- | --- |
| `agents` | id, name, owner, handle, color, consonant, room, status, x, y, updated_at |
| `messages` | id, room, sender_name, sender_handle, text, created_at |
| `tasks` | id, title, assignee, status, updated_at |

- `messages.room` 값: `meeting`(회의 대화) · `worklog`(작업 로그)
- `tasks.assignee` 값이 `회의실` 이면 작업실 칸반 대신 **회의실 안건**으로 표시됩니다.

## 파일

```
index.html          화면
assets/style.css    픽셀 아케이드 스타일
assets/app.js       상태·화면·동기화 (localStorage / BroadcastChannel / Firebase / Apps Script)
apps-script/Code.gs 구글 시트 백엔드 (Apps Script 웹앱)
```
