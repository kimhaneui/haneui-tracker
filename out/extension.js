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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const tracker_1 = require("./tracker");
const statusBar_1 = require("./statusBar");
const storage_1 = require("./storage");
const stats_1 = require("./stats");
const sidebar_1 = require("./sidebar");
const dashboard_1 = require("./dashboard");
let tracker = null;
function activate(context) {
    console.log('개발 활동 측정 익스텐션 "haneui-yoman"이 활성화되었습니다!');
    // Git 커밋 메시지 입력란 제어
    setupGitCommitMessageControl(context);
    // 상태바 생성
    const statusBar = new statusBar_1.StatusBar(context);
    // 스토리지 및 통계 계산기 초기화
    const storage = new storage_1.StorageManager(context);
    const calculator = new stats_1.StatsCalculator(storage);
    // 활동 추적기 시작
    tracker = new tracker_1.ActivityTracker(context, statusBar.getItem());
    // 사이드바 트리뷰 생성
    const treeDataProvider = new sidebar_1.StatsTreeDataProvider(calculator);
    const treeView = vscode.window.createTreeView('haneuiYomanStats', {
        treeDataProvider,
        showCollapseAll: false,
    });
    context.subscriptions.push(treeView);
    // 주기적으로 트리뷰 업데이트 (10초마다)
    const updateInterval = setInterval(() => {
        if (tracker) {
            const data = tracker.getData();
            treeDataProvider.updateData(data);
        }
    }, 10000); // 10초마다
    context.subscriptions.push({ dispose: () => clearInterval(updateInterval) });
    // 대시보드 인스턴스
    const dashboard = new dashboard_1.Dashboard(context, calculator);
    // 통계 보기 명령어
    const showStatsCommand = vscode.commands.registerCommand('haneui-yoman.showStats', async () => {
        if (!tracker) {
            return;
        }
        const period = await vscode.window.showQuickPick([
            { label: '오늘', value: 'daily' },
            { label: '이번 주', value: 'weekly' },
            { label: '이번 달', value: 'monthly' },
            { label: '전체', value: 'alltime' },
        ], { placeHolder: '통계 기간을 선택하세요' });
        if (period) {
            const data = tracker.getData();
            dashboard.show(data, period.value);
        }
    });
    context.subscriptions.push(showStatsCommand);
    // 통계 초기화 명령어
    const resetStatsCommand = vscode.commands.registerCommand('haneui-yoman.resetStats', async () => {
        const confirmed = await vscode.window.showWarningMessage('모든 통계 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.', { modal: true }, '삭제');
        if (confirmed === '삭제' && tracker) {
            await tracker.resetStats();
            treeDataProvider.updateData(tracker.getData());
            vscode.window.showInformationMessage('통계가 초기화되었습니다.');
        }
    });
    context.subscriptions.push(resetStatsCommand);
    // 기간 변경 명령어
    const changePeriodCommand = vscode.commands.registerCommand('haneui-yoman.changePeriod', async () => {
        const period = await vscode.window.showQuickPick([
            { label: '오늘', value: 'daily' },
            { label: '이번 주', value: 'weekly' },
            { label: '이번 달', value: 'monthly' },
            { label: '전체', value: 'alltime' },
        ], { placeHolder: '사이드바에 표시할 기간을 선택하세요' });
        if (period) {
            treeDataProvider.setPeriod(period.value);
        }
    });
    context.subscriptions.push(changePeriodCommand);
    // 초기 데이터 로드
    if (tracker) {
        const data = tracker.getData();
        treeDataProvider.updateData(data);
    }
    // 사이드바 뷰가 보이도록 설정
    vscode.commands.executeCommand('setContext', 'haneui-yoman.active', true);
    // 사이드바 뷰를 자동으로 보이도록 시도
    setTimeout(() => {
        vscode.commands
            .executeCommand('workbench.view.extension.haneui-yoman')
            .then(() => { }, () => {
            // 뷰가 없으면 무시
        });
    }, 1000);
    // 환영 메시지 (첫 실행 시)
    const isFirstRun = context.globalState.get('haneui-yoman.firstRun', true);
    if (isFirstRun) {
        vscode.window
            .showInformationMessage('개발 활동 측정 익스텐션이 활성화되었습니다! 사이드바 왼쪽의 "개발 활동" 아이콘(심박 아이콘)을 클릭하세요.', '대시보드 열기', '사이드바 열기')
            .then((selection) => {
            if (selection === '대시보드 열기' && tracker) {
                const data = tracker.getData();
                dashboard.show(data, 'daily');
            }
            else if (selection === '사이드바 열기') {
                vscode.commands.executeCommand('workbench.view.extension.haneui-yoman');
            }
        });
        context.globalState.update('haneui-yoman.firstRun', false);
    }
}
function setupGitCommitMessageControl(context) {
    // Git Extension API를 통한 커밋 메시지 제어
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension) {
        console.log('Git Extension이 없습니다.');
        return;
    }
    // Git Extension 활성화 대기
    gitExtension.activate().then(() => {
        const git = gitExtension.exports.getAPI(1);
        if (!git) {
            console.log('Git API를 가져올 수 없습니다.');
            return;
        }
        // 모든 리포지토리에 대해 커밋 메시지 제어 설정
        const repositories = git.repositories;
        if (repositories.length === 0) {
            // 리포지토리가 없으면 나중에 추가될 때를 대비해 이벤트 리스너 등록
            const onDidOpenRepository = git.onDidOpenRepository((repository) => {
                setupRepositoryCommitMessage(repository);
            });
            context.subscriptions.push({ dispose: () => onDidOpenRepository.dispose() });
        }
        else {
            repositories.forEach((repository) => {
                setupRepositoryCommitMessage(repository);
            });
        }
        // 새 리포지토리가 열릴 때마다 설정
        const onDidOpenRepository = git.onDidOpenRepository((repository) => {
            setupRepositoryCommitMessage(repository);
        });
        context.subscriptions.push({ dispose: () => onDidOpenRepository.dispose() });
    });
}
function setupRepositoryCommitMessage(repository) {
    // Source Control의 inputBox에 접근
    const sourceControl = repository.sourceControl;
    if (!sourceControl || !sourceControl.inputBox) {
        return;
    }
    const inputBox = sourceControl.inputBox;
    // 코드 변경 내용 분석하여 적절한 템플릿 선택
    const analyzeChangesAndGetTemplate = () => {
        const changes = repository.state.workingTreeChanges;
        if (!changes || changes.length === 0) {
            return 'Feat: ';
        }
        // 기본값은 Feat:
        let template = 'Feat: ';
        let addedFiles = 0;
        let deletedFiles = 0;
        let modifiedFiles = 0;
        const fileNames = [];
        let totalAdditions = 0;
        let totalDeletions = 0;
        for (const change of changes) {
            const fileName = change.uri.fsPath.toLowerCase();
            fileNames.push(fileName);
            // 파일 상태 확인 (Git API의 상태 사용)
            const status = change.status;
            // Git API의 상태는 숫자로 표현됨 (1: 추가, 2: 수정, 3: 삭제 등)
            if (status === 1 || status === 5) { // INDEX_ADDED or UNTRACKED
                addedFiles++;
            }
            else if (status === 3) { // DELETED
                deletedFiles++;
            }
            else {
                modifiedFiles++;
            }
            // 변경 내용 분석 (간단한 휴리스틱)
            // 실제로는 diff를 분석해야 하지만, 파일명과 상태로 추정
            if (status === 2) { // MODIFIED
                totalAdditions += 10; // 예상값
                totalDeletions += 5; // 예상값
            }
        }
        // 파일명 기반 분석
        const allFileNames = fileNames.join(' ');
        // Fix 관련 키워드
        if (allFileNames.includes('fix') ||
            allFileNames.includes('bug') ||
            allFileNames.includes('error') ||
            allFileNames.includes('issue') ||
            allFileNames.includes('patch') ||
            allFileNames.includes('hotfix')) {
            template = 'Fix: ';
        }
        // Test 관련
        else if (allFileNames.includes('test') ||
            allFileNames.includes('spec') ||
            allFileNames.includes('__tests__')) {
            template = 'Test: ';
        }
        // 문서 관련
        else if (allFileNames.includes('readme') ||
            allFileNames.includes('doc') ||
            allFileNames.includes('changelog') ||
            allFileNames.includes('license') ||
            allFileNames.includes('.md')) {
            template = 'Docs: ';
        }
        // 스타일/디자인 관련
        else if (allFileNames.includes('style') ||
            allFileNames.includes('css') ||
            allFileNames.includes('scss') ||
            allFileNames.includes('ui') ||
            allFileNames.includes('design')) {
            template = 'Style: ';
        }
        // 리팩토링 관련 (삭제가 많거나 변경이 큰 경우)
        else if (deletedFiles > 0 ||
            (totalDeletions > totalAdditions && totalDeletions > 50) ||
            allFileNames.includes('refactor') ||
            allFileNames.includes('cleanup')) {
            template = 'Refactor: ';
        }
        // 성능 관련
        else if (allFileNames.includes('perf') ||
            allFileNames.includes('performance') ||
            allFileNames.includes('optimize')) {
            template = 'Perf: ';
        }
        // 빌드/설정 관련
        else if (allFileNames.includes('config') ||
            allFileNames.includes('build') ||
            allFileNames.includes('package.json') ||
            allFileNames.includes('tsconfig') ||
            allFileNames.includes('webpack') ||
            allFileNames.includes('.gitignore')) {
            template = 'Chore: ';
        }
        // 기본값은 Feat: (이미 설정됨)
        return template;
    };
    // 커밋 메시지가 비어있을 때 템플릿 제공
    const applyCommitTemplate = () => {
        if (inputBox.value.trim().length === 0) {
            // 코드 변경 내용 분석하여 적절한 템플릿 선택
            const template = analyzeChangesAndGetTemplate();
            inputBox.value = template;
        }
    };
    // Source Control 상태 변경 감지
    const onDidChangeState = repository.state.onDidChange(() => {
        // 변경사항이 있을 때만 템플릿 적용
        if (inputBox.value.trim().length === 0) {
            setTimeout(() => {
                applyCommitTemplate();
            }, 100);
        }
    });
    // 초기 템플릿 적용
    setTimeout(() => {
        applyCommitTemplate();
    }, 500);
    // 커밋 메시지 변경 감지
    const onDidChange = inputBox.onDidChange((value) => {
        // 커밋 메시지가 비어있으면 템플릿 다시 적용
        if (value.trim().length === 0) {
            setTimeout(() => {
                applyCommitTemplate();
            }, 100);
        }
    });
}
function deactivate() {
    if (tracker) {
        tracker.dispose();
        tracker = null;
    }
}
//# sourceMappingURL=extension.js.map