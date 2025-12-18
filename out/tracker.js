"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityTracker = void 0;
const vscode = __importStar(require("vscode"));
const storage_1 = require("./storage");
const IDLE_THRESHOLD = 5 * 60 * 1000; // 5분 (밀리초)
class ActivityTracker {
    storage;
    data;
    statusBar = null;
    updateTimer = null;
    lastActivityTime = Date.now();
    isTracking = false;
    fileLineCounts = new Map(); // 파일별 마지막 라인 수
    constructor(context, statusBar) {
        this.storage = new storage_1.StorageManager(context);
        this.data = this.storage.loadData();
        this.statusBar = statusBar;
        // 에디터 이벤트 리스너 등록
        this.setupEventListeners(context);
        // 주기적으로 코딩 시간 업데이트
        this.startUpdateTimer();
        // 세션 시작
        this.startSession();
        // 초기 상태바 업데이트
        this.updateStatusBar();
    }
    setupEventListeners(context) {
        // 텍스트 변경 감지 (키스트로크 및 라인 변경)
        const textChangeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
            this.handleTextChange(e);
        });
        context.subscriptions.push(textChangeDisposable);
        // 활성 에디터 변경 감지
        const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
            this.handleEditorChange();
        });
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
            }
            else {
                this.handleWindowBlur();
            }
        });
        context.subscriptions.push(focusDisposable);
    }
    handleTextChange(e) {
        if (e.document.uri.scheme !== 'file') {
            return;
        }
        const now = Date.now();
        this.lastActivityTime = now;
        this.isTracking = true;
        // 키스트로크 수 증가 (한 줄 = 1 카운트)
        let totalLinesTyped = 0;
        for (const change of e.contentChanges) {
            if (change.text.length > 0) {
                // 입력된 텍스트의 줄 수 계산
                const linesInChange = change.text.split('\n').length;
                totalLinesTyped += linesInChange;
            }
        }
        this.data.currentSession.keystrokes += totalLinesTyped;
        // 파일 추가
        const filePath = e.document.uri.fsPath;
        this.data.currentSession.filesEdited.add(filePath);
        // 언어별 통계 (한 줄 = 1 카운트)
        const language = e.document.languageId;
        const currentLangCount = this.data.currentSession.languages.get(language) || 0;
        this.data.currentSession.languages.set(language, currentLangCount + totalLinesTyped);
        // 라인 변경 계산 - 문서의 실제 라인 수 변화를 기준으로 계산
        const beforeLineCount = this.fileLineCounts.get(filePath) ?? e.document.lineCount;
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
                if (change.range.end.character === 0 && change.range.end.line > change.range.start.line) {
                    totalDeletedLines += 1;
                }
            }
            // 추가된 라인 수 계산
            if (change.text.length > 0) {
                const addedLines = change.text.split('\n').length;
                totalAddedLines += addedLines;
            }
        }
        // 변경 후 문서의 실제 라인 수 (변경 이벤트 후 문서가 업데이트됨)
        // 다음 이벤트를 위해 현재 라인 수 저장
        const afterLineCount = beforeLineCount - totalDeletedLines + totalAddedLines;
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
    handleEditorChange() {
        const now = Date.now();
        this.lastActivityTime = now;
        this.isTracking = true;
        // 현재 에디터의 라인 수 저장
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.scheme === 'file') {
            const filePath = activeEditor.document.uri.fsPath;
            this.fileLineCounts.set(filePath, activeEditor.document.lineCount);
        }
        if (!this.data.currentSession.startTime) {
            this.data.currentSession.startTime = now;
        }
        this.data.currentSession.lastActivityTime = now;
    }
    handleFileSave(doc) {
        if (doc.uri.scheme !== 'file') {
            return;
        }
        this.data.currentSession.filesEdited.add(doc.uri.fsPath);
        this.saveData();
    }
    handleWindowFocus() {
        this.isTracking = true;
        this.lastActivityTime = Date.now();
    }
    handleWindowBlur() {
        // 윈도우가 포커스를 잃으면 코딩 시간 업데이트
        this.updateCodingTime();
    }
    startSession() {
        const now = Date.now();
        if (!this.data.currentSession.startTime) {
            this.data.currentSession.startTime = now;
        }
        this.data.currentSession.lastActivityTime = now;
        this.isTracking = true;
    }
    updateCodingTime() {
        if (!this.isTracking || !this.data.currentSession.startTime) {
            return;
        }
        const now = Date.now();
        const timeSinceLastActivity = now - this.lastActivityTime;
        // 5분 이상 비활성 상태면 코딩 시간 계산 중단
        if (timeSinceLastActivity > IDLE_THRESHOLD) {
            if (this.data.currentSession.lastActivityTime) {
                const activeTime = Math.min(this.data.currentSession.lastActivityTime - this.data.currentSession.startTime, IDLE_THRESHOLD);
                this.addCodingTime(activeTime);
            }
            this.isTracking = false;
            return;
        }
        // 활성 코딩 시간 추가
        if (this.data.currentSession.lastActivityTime) {
            const activeTime = Math.min(now - this.data.currentSession.startTime, IDLE_THRESHOLD);
            this.addCodingTime(activeTime);
        }
        this.data.currentSession.startTime = now;
        this.data.currentSession.lastActivityTime = now;
    }
    addCodingTime(ms) {
        const todayStats = this.storage.getTodayStats(this.data);
        todayStats.codingTime += Math.floor(ms / 1000); // 초 단위로 변환
    }
    startUpdateTimer() {
        // 1분마다 코딩 시간 업데이트 및 상태바 갱신
        this.updateTimer = setInterval(() => {
            this.updateCodingTime();
            this.updateStatusBar();
            this.saveData();
        }, 60 * 1000);
    }
    updateStatusBar() {
        if (!this.statusBar) {
            return;
        }
        const todayStats = this.storage.getTodayStats(this.data);
        const codingTime = this.formatTime(todayStats.codingTime + this.getCurrentSessionTime());
        const keystrokes = todayStats.keystrokes + this.data.currentSession.keystrokes;
        this.statusBar.text = `$(pulse) ${codingTime} | $(keyboard) ${keystrokes.toLocaleString()}`;
        this.statusBar.tooltip = `코딩 시간: ${codingTime}\n키스트로크: ${keystrokes.toLocaleString()}`;
        this.statusBar.show();
    }
    getCurrentSessionTime() {
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
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        else {
            return `${secs}s`;
        }
    }
    async saveData() {
        // 코딩 시간만 저장 (다른 데이터는 getData()에서 실시간으로 병합)
        await this.storage.saveData(this.data);
    }
    // 통계 데이터 가져오기
    getData() {
        // 최신 데이터로 업데이트
        this.updateCodingTime();
        // 오늘의 통계에 현재 세션 데이터를 병합한 복사본 반환
        const todayStats = this.storage.getTodayStats(this.data);
        const mergedTodayStats = {
            ...todayStats,
            keystrokes: todayStats.keystrokes + this.data.currentSession.keystrokes,
            linesAdded: todayStats.linesAdded + this.data.currentSession.linesAdded,
            linesDeleted: todayStats.linesDeleted + this.data.currentSession.linesDeleted,
            linesModified: todayStats.linesModified + this.data.currentSession.linesModified,
            filesEdited: new Set([...todayStats.filesEdited, ...this.data.currentSession.filesEdited]),
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
    async resetStats() {
        await this.storage.resetStats();
        this.data = this.storage.loadData();
        this.updateStatusBar();
    }
    // 정리
    dispose() {
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
            console.error('Failed to save data on dispose:', err);
        });
    }
}
exports.ActivityTracker = ActivityTracker;
//# sourceMappingURL=tracker.js.map