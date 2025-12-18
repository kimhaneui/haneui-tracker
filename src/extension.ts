import * as vscode from 'vscode';
import { ActivityTracker } from './tracker';
import { StatusBar } from './statusBar';
import { StorageManager } from './storage';
import { StatsCalculator } from './stats';
import { StatsTreeDataProvider } from './sidebar';
import { Dashboard } from './dashboard';

let tracker: ActivityTracker | null = null;

export function activate(context: vscode.ExtensionContext) {
	console.log('개발 활동 측정 익스텐션 "haneui-yoman"이 활성화되었습니다!');

	// 상태바 생성
	const statusBar = new StatusBar(context);

	// 스토리지 및 통계 계산기 초기화
	const storage = new StorageManager(context);
	const calculator = new StatsCalculator(storage);

	// 활동 추적기 시작
	tracker = new ActivityTracker(context, statusBar.getItem());

	// 사이드바 트리뷰 생성
	const treeDataProvider = new StatsTreeDataProvider(calculator);
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
	const dashboard = new Dashboard(context, calculator);

	// 통계 보기 명령어
	const showStatsCommand = vscode.commands.registerCommand('haneui-yoman.showStats', async () => {
		if (!tracker) {
			return;
		}
		const period = await vscode.window.showQuickPick(
			[
				{ label: '오늘', value: 'daily' },
				{ label: '이번 주', value: 'weekly' },
				{ label: '이번 달', value: 'monthly' },
				{ label: '전체', value: 'alltime' },
			],
			{ placeHolder: '통계 기간을 선택하세요' }
		);
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
		const period = await vscode.window.showQuickPick(
			[
				{ label: '오늘', value: 'daily' },
				{ label: '이번 주', value: 'weekly' },
				{ label: '이번 달', value: 'monthly' },
				{ label: '전체', value: 'alltime' },
			],
			{ placeHolder: '사이드바에 표시할 기간을 선택하세요' }
		);
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
			.then(
				() => {},
				() => {
					// 뷰가 없으면 무시
				}
			);
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
				} else if (selection === '사이드바 열기') {
					vscode.commands.executeCommand('workbench.view.extension.haneui-yoman');
				}
			});
		context.globalState.update('haneui-yoman.firstRun', false);
	}
}

export function deactivate() {
	if (tracker) {
		tracker.dispose();
		tracker = null;
	}
}

