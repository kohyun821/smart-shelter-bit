# TODO

현장(강화군청 정류소 ST006) 배포본에서 확인된 문제와 후속 작업 목록.

## 배경

- `alwaysOnTop: true` 상태에서 원격 접속 시 BIT 창이 화면을 덮어 조작 불가, ESC 종료도 동작하지 않음
  - ESC 종료가 `webContents.on('before-input-event')` 기반이라 창에 키보드 포커스가 있을 때만 동작
- 와치독(작업 스케줄러 `SmartShelter-*`)이 앱을 즉시 재실행하고, `watchdog-pause.bat`은 관리자 권한(UAC)이 필요해 원격에서 실행 불가
  - 임시 조치: `resources/data/setting.json`에서 `alwaysOnTop`/`hideTaskbar`를 `false`로 변경 후 재시작
- 윈도우 부팅 시 자동 실행되면 화면이 약 0.56배로 작게 표시됨 (수동 실행 시 정상)
  - 원인 추정: 세로 회전 적용 전(가로 1920×1080)에 `screen.getPrimaryDisplay()`를 읽어 배율 `min(1920/1080, 1080/1920) = 0.5625`로 고정
  - 이후 디스플레이 변경 시 창 크기/`zoomFactor`를 재계산하지 않음 (`main.js` `createWindow()`)

## 작업 목록

### 1. 화면 배율 자동 재계산 (main.js)
- [ ] 창 크기·배율 계산을 `fitToDisplay(win, winSettings)` 함수로 분리
- [ ] `screen`의 `display-metrics-changed` / `display-added` / `display-removed` 이벤트에서 재계산
- [ ] `did-finish-load` 시점에도 재계산 (`webContents.setZoomFactor(scale)` 적용)
- [ ] 부팅 직후 자동 실행 → 세로 회전 지연 상황에서 꽉 차게 표시되는지 현장 확인

### 2. 원격 관리용 전역 단축키 (main.js)
- [ ] `globalShortcut`으로 포커스와 무관하게 동작하는 관리자 단축키 등록
  - [ ] 앱 종료 (예: `Ctrl+Shift+Alt+Q`)
  - [ ] 맨 위 고정 토글 (예: `Ctrl+Shift+Alt+T`)
- [ ] `will-quit`에서 `globalShortcut.unregisterAll()`
- [ ] ESC 단독 종료는 시민이 눌러 꺼질 수 있으므로 유지 여부 검토
- [ ] `app.requestSingleInstanceLock()`으로 중복 실행 방지

### 3. 시작 시 진단 로그
- [ ] 앱 시작 시 디스플레이 bounds / workArea / 회전 / 계산된 scale을 로그로 기록 (`server/logger.js` 활용)
- [ ] 디스플레이 변경 이벤트 발생 시에도 로그 기록

### 4. 부팅 직후 데이터 미수신 점검 (server/bridge.js 등)
- [ ] 현장 사진에서 미세먼지·초미세먼지·오존 "정보없음", CCTV "연결 중..." 상태로 멈춤 (버스 정보는 정상)
- [ ] 부팅 직후 네트워크/MediaMTX 준비 전 첫 요청 실패 후 재시도 여부·주기 확인
- [ ] 필요 시 실패 시 짧은 간격 재시도(backoff) 추가

### 5. 와치독 스크립트 개선 (배포 PC `C:\SmartShelter`)
- [ ] `watchdog-pause.bat`: 비활성화 후 `Stop-ScheduledTask`로 실행 중 인스턴스도 정지, 필요 시 앱 종료 포함
- [ ] `watchdog-resume.bat`: `Enable-ScheduledTask` 후 `Start-ScheduledTask`로 즉시 재개
- [ ] 작업 스케줄러 트리거에 지연 시간(30초~1분) 설정 검토
- [ ] 원격 점검 시 UAC 조작이 가능한 방식(RDP 또는 서비스 설치형 원격툴) 확보

### 6. 현장 설정 원복 확인
- [ ] 점검 후 `setting.json`의 `hideTaskbar` 값 결정 (현재 `false`)
- [ ] `alwaysOnTop`은 `false` 유지 권장 (원격 접속 차단 방지)
- [ ] 와치독 재개(`watchdog-resume.bat`) 및 `Smart-Shelter.exe.off` 이름 변경 여부 확인
