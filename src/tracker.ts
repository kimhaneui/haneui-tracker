import * as vscode from "vscode";
import { StorageManager } from "./storage";

const IDLE_THRESHOLD = 10 * 60 * 1000; // 10분 (밀리초)

export class ActivityTracker {
  private storage: StorageManager;
  private data: any;
  private statusBar: vscode.StatusBarItem | null = null;
  private updateTimer: NodeJS.Timeout | null = null;
  private lastActivityTime = Date.now();
  private isTracking = false;
  private fileLineCounts = new Map<string, number>(); // 파일별 마지막 라인 수
  private lastCheckedDate: string; // 마지막으로 확인한 날짜

  constructor(
    context: vscode.ExtensionContext,
    statusBar: vscode.StatusBarItem
  ) {
    this.storage = new StorageManager(context);
    this.data = this.storage.loadData();
    this.statusBar = statusBar;

    // 저장된 데이터에서 마지막 날짜 확인 (currentSession에 저장된 날짜 또는 dailyStats의 최신 날짜)
    // 없으면 오늘 날짜로 초기화
    const storedLastDate = (this.data as any).lastCheckedDate;
    const todayKey = this.storage.getTodayKey();

    // dailyStats에서 가장 최근 날짜 찾기
    let latestDate = storedLastDate;
    if (!latestDate && this.data.dailyStats.size > 0) {
      const dates = Array.from(this.data.dailyStats.keys()).sort();
      latestDate = dates[dates.length - 1];
    }

    this.lastCheckedDate = latestDate || todayKey;

    // 날짜 변경 확인 및 세션 초기화
    this.checkAndResetIfDateChanged();

    // 에디터 이벤트 리스너 등록
    this.setupEventListeners(context);

    // 주기적으로 코딩 시간 업데이트
    this.startUpdateTimer();

    // 세션 시작
    this.startSession();

    // 초기 상태바 업데이트
    this.updateStatusBar();
  }

  private setupEventListeners(context: vscode.ExtensionContext): void {
    // 텍스트 변경 감지 (키스트로크 및 라인 변경)
    const textChangeDisposable = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        this.handleTextChange(e);
      }
    );
    context.subscriptions.push(textChangeDisposable);

    // 활성 에디터 변경 감지
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
      () => {
        this.handleEditorChange();
      }
    );
    context.subscriptions.push(editorChangeDisposable);

    // 파일 저장 감지
    const saveDisposable = vscode.workspace.onDidSaveTextDocument((doc) => {
      this.handleFileSave(doc);
    });
    context.subscriptions.push(saveDisposable);

    // 윈도우 포커스 변경 감지
    const focusDisposable = vscode.window.onDidChangeWindowState((e) => {
      if (e.focused) {
        this.handleWindowFocus();
      } else {
        this.handleWindowBlur();
      }
    });
    context.subscriptions.push(focusDisposable);
  }

  private handleTextChange(e: vscode.TextDocumentChangeEvent): void {
    if (e.document.uri.scheme !== "file") {
      return;
    }

    // 날짜 변경 확인
    this.checkAndResetIfDateChanged();

    const now = Date.now();
    this.lastActivityTime = now;
    this.isTracking = true;

    // 키스트로크 수 증가 (한 줄 = 1 카운트)
    let totalLinesTyped = 0;
    for (const change of e.contentChanges) {
      if (change.text.length > 0) {
        // 입력된 텍스트의 줄 수 계산
        const linesInChange = change.text.split("\n").length;
        totalLinesTyped += linesInChange;
      }
    }
    this.data.currentSession.keystrokes += totalLinesTyped;

    // 파일 추가
    const filePath = e.document.uri.fsPath;
    this.data.currentSession.filesEdited.add(filePath);

    // 언어별 통계 (한 줄 = 1 카운트)
    const language = e.document.languageId;
    const currentLangCount =
      this.data.currentSession.languages.get(language) || 0;
    this.data.currentSession.languages.set(
      language,
      currentLangCount + totalLinesTyped
    );

    // 라인 변경 계산 - 문서의 실제 라인 수 변화를 기준으로 계산
    // 파일 라인 수가 추적되지 않았으면 현재 문서의 라인 수로 초기화
    if (!this.fileLineCounts.has(filePath)) {
      // 변경 전 라인 수는 변경사항을 고려하여 계산
      let beforeCount = e.document.lineCount;
      for (const change of e.contentChanges) {
        // 삭제된 라인 수 계산
        if (change.range.start.line < change.range.end.line) {
          beforeCount += change.range.end.line - change.range.start.line;
          if (
            change.range.end.character === 0 &&
            change.range.end.line > change.range.start.line
          ) {
            beforeCount += 1;
          }
        }
        // 추가된 라인 수 빼기
        if (change.text.length > 0) {
          beforeCount -= change.text.split("\n").length - 1;
        }
      }
      this.fileLineCounts.set(filePath, beforeCount);
    }
    const beforeLineCount = this.fileLineCounts.get(filePath)!;

    // 모든 변경사항을 적용한 후의 예상 라인 수 계산
    let totalDeletedLines = 0;
    let totalAddedLines = 0;

    for (const change of e.contentChanges) {
      // 삭제된 라인 수 계산
      // Range는 start 포함, end 제외 (exclusive)
      if (change.range.start.line < change.range.end.line) {
        // 여러 라인에 걸쳐 삭제
        totalDeletedLines += change.range.end.line - change.range.start.line;
        // end.character가 0이고 start.line과 다르면 마지막 라인도 완전히 삭제됨
        if (
          change.range.end.character === 0 &&
          change.range.end.line > change.range.start.line
        ) {
          totalDeletedLines += 1;
        }
      }

      // 추가된 라인 수 계산
      if (change.text.length > 0) {
        const addedLines = change.text.split("\n").length;
        totalAddedLines += addedLines;
      }
    }

    // 변경 후 문서의 실제 라인 수 (변경 이벤트 후 문서가 업데이트됨)
    // 다음 이벤트를 위해 현재 라인 수 저장
    const afterLineCount =
      beforeLineCount - totalDeletedLines + totalAddedLines;
    this.fileLineCounts.set(filePath, afterLineCount);

    // 추가, 삭제, 수정을 각각 별도로 기록
    // 수정: 삭제된 라인 수와 추가된 라인 수가 같고 둘 다 0보다 큰 경우
    const modifiedLines = Math.min(totalDeletedLines, totalAddedLines);
    const netAddedLines = Math.max(0, totalAddedLines - totalDeletedLines);
    const netDeletedLines = Math.max(0, totalDeletedLines - totalAddedLines);

    if (modifiedLines > 0) {
      this.data.currentSession.linesModified += modifiedLines;
    }
    if (netAddedLines > 0) {
      this.data.currentSession.linesAdded += netAddedLines;
    }
    if (netDeletedLines > 0) {
      this.data.currentSession.linesDeleted += netDeletedLines;
    }

    // 세션 시작 시간 설정
    if (!this.data.currentSession.startTime) {
      this.data.currentSession.startTime = now;
    }
    this.data.currentSession.lastActivityTime = now;

    // 주기적으로 저장
    this.saveData();
  }

  private handleEditorChange(): void {
    // 날짜 변경 확인
    this.checkAndResetIfDateChanged();

    const now = Date.now();
    this.lastActivityTime = now;
    this.isTracking = true;

    // 현재 에디터의 라인 수 저장
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.scheme === "file") {
      const filePath = activeEditor.document.uri.fsPath;
      this.fileLineCounts.set(filePath, activeEditor.document.lineCount);
    }

    if (!this.data.currentSession.startTime) {
      this.data.currentSession.startTime = now;
    }
    this.data.currentSession.lastActivityTime = now;
  }

  private handleFileSave(doc: vscode.TextDocument): void {
    if (doc.uri.scheme !== "file") {
      return;
    }
    this.data.currentSession.filesEdited.add(doc.uri.fsPath);
    this.saveData();
  }

  private handleWindowFocus(): void {
    this.isTracking = true;
    this.lastActivityTime = Date.now();
  }

  private handleWindowBlur(): void {
    // 윈도우가 포커스를 잃으면 코딩 시간 업데이트
    this.updateCodingTime();
  }

  private startSession(): void {
    const now = Date.now();
    if (!this.data.currentSession.startTime) {
      this.data.currentSession.startTime = now;
    }
    this.data.currentSession.lastActivityTime = now;
    this.isTracking = true;
  }

  private updateCodingTime(): void {
    // 날짜 변경 확인
    this.checkAndResetIfDateChanged();

    if (!this.isTracking || !this.data.currentSession.startTime) {
      return;
    }

    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTime;

    // 5분 이상 비활성 상태면 코딩 시간 계산 중단
    if (timeSinceLastActivity > IDLE_THRESHOLD) {
      if (this.data.currentSession.lastActivityTime) {
        const activeTime = Math.min(
          this.data.currentSession.lastActivityTime -
            this.data.currentSession.startTime,
          IDLE_THRESHOLD
        );
        this.addCodingTime(activeTime);
      }
      this.isTracking = false;
      return;
    }

    // 활성 코딩 시간 추가
    if (this.data.currentSession.lastActivityTime) {
      const activeTime = Math.min(
        now - this.data.currentSession.startTime,
        IDLE_THRESHOLD
      );
      this.addCodingTime(activeTime);
    }

    this.data.currentSession.startTime = now;
    this.data.currentSession.lastActivityTime = now;
  }

  private addCodingTime(ms: number): void {
    const todayStats = this.storage.getTodayStats(this.data);
    todayStats.codingTime += Math.floor(ms / 1000); // 초 단위로 변환
  }

  private startUpdateTimer(): void {
    // 1분마다 코딩 시간 업데이트 및 상태바 갱신
    this.updateTimer = setInterval(() => {
      this.updateCodingTime();
      this.updateStatusBar();
      this.saveData();
    }, 60 * 1000);
  }

  // 날짜가 바뀌었는지 확인하고, 바뀌었으면 이전 날짜의 세션 데이터를 저장하고 초기화
  private checkAndResetIfDateChanged(): void {
    const todayKey = this.storage.getTodayKey();

    // 날짜가 바뀌지 않았으면 아무것도 하지 않음
    if (todayKey === this.lastCheckedDate) {
      return;
    }

    // 날짜가 바뀌었음 - 이전 날짜의 세션 데이터를 dailyStats에 저장
    const previousDateKey = this.lastCheckedDate;
    if (previousDateKey && this.data.currentSession) {
      // 이전 날짜의 통계 가져오기 또는 생성
      let previousDayStats = this.data.dailyStats.get(previousDateKey);
      if (!previousDayStats) {
        previousDayStats = {
          date: previousDateKey,
          codingTime: 0,
          keystrokes: 0,
          filesEdited: new Set(),
          linesAdded: 0,
          linesDeleted: 0,
          linesModified: 0,
          languages: new Map(),
        };
      }

      // 코딩 시간 계산 및 추가 (날짜 변경 전 마지막 활동 시간까지)
      if (
        this.isTracking &&
        this.data.currentSession.startTime &&
        this.data.currentSession.lastActivityTime
      ) {
        const now = Date.now();
        const timeSinceLastActivity = now - this.lastActivityTime;
        if (timeSinceLastActivity <= IDLE_THRESHOLD) {
          const activeTime = Math.min(
            this.data.currentSession.lastActivityTime -
              this.data.currentSession.startTime,
            IDLE_THRESHOLD
          );
          previousDayStats.codingTime += Math.floor(activeTime / 1000);
        }
      }

      // 이전 날짜의 통계에 현재 세션 데이터 병합
      const sessionData = this.data.currentSession;
      if (
        sessionData.keystrokes > 0 ||
        sessionData.linesAdded > 0 ||
        sessionData.linesDeleted > 0 ||
        sessionData.linesModified > 0 ||
        previousDayStats.codingTime > 0
      ) {
        previousDayStats.keystrokes += sessionData.keystrokes;
        previousDayStats.linesAdded += sessionData.linesAdded;
        previousDayStats.linesDeleted += sessionData.linesDeleted;
        previousDayStats.linesModified =
          (previousDayStats.linesModified || 0) +
          (sessionData.linesModified || 0);

        for (const file of sessionData.filesEdited) {
          previousDayStats.filesEdited.add(file);
        }

        for (const [lang, count] of sessionData.languages.entries()) {
          const currentCount = previousDayStats.languages.get(lang) || 0;
          previousDayStats.languages.set(lang, currentCount + count);
        }

        // 이전 날짜의 통계를 저장
        this.data.dailyStats.set(previousDateKey, previousDayStats);
      }
    }

    // 오늘 날짜의 dailyStats 초기화 (코딩 시간과 수정한 라인만 유지)
    // 기존 오늘 날짜의 통계가 있다면 코딩 시간과 수정한 라인만 보존
    const existingTodayStats = this.data.dailyStats.get(todayKey);
    const preservedCodingTime = existingTodayStats?.codingTime || 0;
    const preservedLinesModified = existingTodayStats?.linesModified || 0;

    // 오늘 날짜의 통계를 코딩 시간과 수정한 라인만 남기고 완전히 초기화
    const resetTodayStats = {
      date: todayKey,
      codingTime: preservedCodingTime,
      keystrokes: 0,
      filesEdited: new Set(),
      linesAdded: 0,
      linesDeleted: 0,
      linesModified: preservedLinesModified,
      languages: new Map(),
    };
    // 명시적으로 Map에 설정하여 기존 값을 덮어씀
    this.data.dailyStats.set(todayKey, resetTodayStats);

    // 현재 세션 초기화
    this.data.currentSession = {
      keystrokes: 0,
      filesEdited: new Set(),
      linesAdded: 0,
      linesDeleted: 0,
      linesModified: 0,
      languages: new Map(),
      startTime: undefined,
      lastActivityTime: undefined,
    };

    // 파일 라인 수 추적도 초기화 (새 날짜이므로)
    this.fileLineCounts.clear();

    // 날짜 업데이트
    this.lastCheckedDate = todayKey;

    // 마지막 확인 날짜를 데이터에 저장
    (this.data as any).lastCheckedDate = todayKey;

    // 데이터 저장
    this.saveData();
  }

  private updateStatusBar(): void {
    if (!this.statusBar) {
      return;
    }

    const todayStats = this.storage.getTodayStats(this.data);
    const codingTime = this.formatTime(
      todayStats.codingTime + this.getCurrentSessionTime()
    );
    const keystrokes =
      todayStats.keystrokes + this.data.currentSession.keystrokes;

    this.statusBar.text = `$(pulse) ${codingTime} | $(keyboard) ${keystrokes.toLocaleString()}`;
    this.statusBar.tooltip = `코딩 시간: ${codingTime}\n키스트로크: ${keystrokes.toLocaleString()}`;
    this.statusBar.show();
  }

  private getCurrentSessionTime(): number {
    if (!this.isTracking || !this.data.currentSession.startTime) {
      return 0;
    }

    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTime;

    if (timeSinceLastActivity > IDLE_THRESHOLD) {
      return 0;
    }

    return Math.floor((now - this.data.currentSession.startTime) / 1000);
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  private async saveData(): Promise<void> {
    // 코딩 시간만 저장 (다른 데이터는 getData()에서 실시간으로 병합)
    await this.storage.saveData(this.data);
  }

  // 통계 데이터 가져오기
  getData(): any {
    // 최신 데이터로 업데이트
    this.updateCodingTime();

    // 오늘의 통계에 현재 세션 데이터를 병합한 복사본 반환
    const todayStats = this.storage.getTodayStats(this.data);
    const mergedTodayStats = {
      ...todayStats,
      keystrokes: todayStats.keystrokes + this.data.currentSession.keystrokes,
      linesAdded: todayStats.linesAdded + this.data.currentSession.linesAdded,
      linesDeleted:
        todayStats.linesDeleted + this.data.currentSession.linesDeleted,
      linesModified:
        (todayStats.linesModified || 0) +
        this.data.currentSession.linesModified,
      filesEdited: new Set([
        ...todayStats.filesEdited,
        ...this.data.currentSession.filesEdited,
      ]),
      languages: new Map(todayStats.languages),
    };

    // 언어 병합
    for (const [lang, count] of this.data.currentSession.languages.entries()) {
      const currentCount = mergedTodayStats.languages.get(lang) || 0;
      mergedTodayStats.languages.set(lang, currentCount + count);
    }

    // 병합된 데이터로 임시 맵 생성
    const mergedDailyStats = new Map(this.data.dailyStats);
    mergedDailyStats.set(this.storage.getTodayKey(), mergedTodayStats);

    return {
      dailyStats: mergedDailyStats,
      currentSession: this.data.currentSession,
    };
  }

  // 통계 초기화
  async resetStats(): Promise<void> {
    await this.storage.resetStats();
    this.data = this.storage.loadData();
    this.lastCheckedDate = this.storage.getTodayKey();
    this.fileLineCounts.clear();
    this.updateStatusBar();
  }

  // 정리
  dispose(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.updateCodingTime();

    // 마지막으로 오늘의 통계에 현재 세션 데이터 저장 (비동기로 실행하되 기다리지 않음)
    const todayStats = this.storage.getTodayStats(this.data);
    todayStats.keystrokes += this.data.currentSession.keystrokes;
    todayStats.linesAdded += this.data.currentSession.linesAdded;
    todayStats.linesDeleted += this.data.currentSession.linesDeleted;
    todayStats.linesModified += this.data.currentSession.linesModified;

    for (const file of this.data.currentSession.filesEdited) {
      todayStats.filesEdited.add(file);
    }

    for (const [lang, count] of this.data.currentSession.languages.entries()) {
      const currentCount = todayStats.languages.get(lang) || 0;
      todayStats.languages.set(lang, currentCount + count);
    }

    // 세션 데이터 초기화
    this.data.currentSession = {
      keystrokes: 0,
      filesEdited: new Set(),
      linesAdded: 0,
      linesDeleted: 0,
      linesModified: 0,
      languages: new Map(),
    };

    // 비동기 저장 (완료를 기다리지 않음)
    this.storage.saveData(this.data).catch((err) => {
      console.error("Failed to save data on dispose:", err);
    });
  }
}
