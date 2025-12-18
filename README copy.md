# haneui-yoman

Cursor/VS Code에서 개발 활동을 추적하고 시각화하는 익스텐션입니다.

## Features

### 📊 개발 활동 추적
- **코딩 시간**: 실제 코딩 활동 시간을 추적합니다 (5분 이상 비활성 시 자동 중단)
- **키스트로크**: 타이핑한 키스트로크 수를 집계합니다
- **파일 편집**: 편집한 파일 수를 추적합니다
- **코드 라인**: 추가/삭제한 코드 라인 수를 계산합니다
- **언어 분포**: 사용한 프로그래밍 언어별 통계를 제공합니다

### 📈 시각화
- **상태바**: 실시간 코딩 시간과 키스트로크 수를 상태바에 표시
- **사이드바**: 탐색기 패널에 상세 통계를 트리뷰로 표시
- **대시보드**: 웹뷰를 통한 차트와 그래프로 시각화된 통계 제공
  - 언어별 키스트로크 분포 (도넛 차트)
  - 일별 코딩 시간 추이 (라인 차트)

### 📅 통계 기간
- 오늘
- 이번 주 (최근 7일)
- 이번 달
- 전체 기간

## 사용 방법

### 상태바
익스텐션이 활성화되면 상태바 오른쪽에 코딩 시간과 키스트로크 수가 표시됩니다. 클릭하면 대시보드를 열 수 있습니다.

### 사이드바 통계
1. 탐색기 패널에서 "개발 활동 통계" 섹션을 확인하세요
2. 명령 팔레트(`Cmd+Shift+P` / `Ctrl+Shift+P`)에서 "기간 변경" 명령으로 표시 기간을 변경할 수 있습니다

### 대시보드
1. 명령 팔레트에서 "개발 활동 통계 보기" 실행
2. 원하는 기간 선택 (오늘/이번 주/이번 달/전체)
3. 상세한 통계와 차트를 확인

### 통계 초기화
명령 팔레트에서 "통계 초기화" 명령을 실행하여 모든 데이터를 삭제할 수 있습니다.

## Requirements

- VS Code 1.106.1 이상
- Cursor 또는 VS Code

## Extension Settings

현재 설정 가능한 옵션은 없습니다. 모든 통계는 자동으로 수집됩니다.

## Known Issues

- Git 커밋 통계는 현재 미구현 상태입니다
- 네트워크 연결이 필요한 경우 Chart.js CDN을 사용합니다

## Release Notes

### 0.0.1

Initial release of haneui-yoman

**Features:**
- 코딩 시간 추적
- 키스트로크 수 집계
- 파일 편집 통계
- 코드 라인 추가/삭제 추적
- 언어별 통계
- 상태바 실시간 표시
- 사이드바 트리뷰
- 웹뷰 대시보드 (차트 포함)

---

## 개발

```bash
# 컴파일
npm run compile

# 감시 모드로 컴파일
npm run watch

# 린트
npm run lint

# 테스트
npm test
```

## For more information

* [VS Code Extension API](https://code.visualstudio.com/api)
* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

**Enjoy tracking your coding activity!** 🚀
