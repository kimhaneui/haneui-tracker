import * as vscode from 'vscode';
import { StatsCalculator } from './stats';

export class StatsTreeDataProvider implements vscode.TreeDataProvider<StatsTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<StatsTreeItem | undefined | null | void> = new vscode.EventEmitter<StatsTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<StatsTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private data: any = null;
	private calculator: StatsCalculator;
	private period = 'daily';

	constructor(calculator: StatsCalculator) {
		this.calculator = calculator;
	}

	updateData(data: any): void {
		this.data = data;
		this.refresh();
	}

	setPeriod(period: string): void {
		this.period = period;
		this.refresh();
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: StatsTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: StatsTreeItem): Thenable<StatsTreeItem[]> {
		if (!this.data) {
			return Promise.resolve([]);
		}

		if (!element) {
			// 루트 레벨 - 항상 "오늘"과 "전체 통계" 두 섹션 표시
			const todayStats = this.calculator.getDailyStats(this.data);
			const allTimeStats = this.calculator.getAllTimeStats(this.data);
			const items: StatsTreeItem[] = [];

			// 오늘 통계 섹션
			if (todayStats) {
				items.push(
					new StatsTreeItem(
						'$(calendar) 오늘',
						vscode.TreeItemCollapsibleState.Expanded,
						[
							new StatsTreeItem(`$(clock) 코딩 시간: ${this.calculator.formatTime(todayStats.codingTime)}`, vscode.TreeItemCollapsibleState.None, undefined, '오늘-코딩 시간'),
							new StatsTreeItem(`$(keyboard) 키스트로크: ${todayStats.keystrokes.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '오늘-키스트로크'),
							new StatsTreeItem(`$(file) 편집한 파일: ${todayStats.filesEdited.size}개`, vscode.TreeItemCollapsibleState.None, undefined, '오늘-편집한 파일'),
							new StatsTreeItem(`$(edit) 수정한 라인: ${(todayStats.linesModified || 0).toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '오늘-수정한 라인'),
							new StatsTreeItem(`$(arrow-down) 추가한 라인: ${todayStats.linesAdded.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '오늘-추가한 라인'),
							new StatsTreeItem(`$(arrow-up) 삭제한 라인: ${todayStats.linesDeleted.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '오늘-삭제한 라인'),
						],
						'오늘'
					)
				);
			}

			// 전체 통계 섹션
			items.push(
				new StatsTreeItem(
					'$(star-full) 전체 통계',
					vscode.TreeItemCollapsibleState.Expanded,
					[
						new StatsTreeItem(`$(clock) 총 코딩 시간: ${this.calculator.formatTime(allTimeStats.codingTime)}`, vscode.TreeItemCollapsibleState.None, undefined, '전체-코딩 시간'),
						new StatsTreeItem(`$(keyboard) 총 키스트로크: ${allTimeStats.keystrokes.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '전체-키스트로크'),
						new StatsTreeItem(`$(file) 총 편집한 파일: ${allTimeStats.filesEdited}개`, vscode.TreeItemCollapsibleState.None, undefined, '전체-편집한 파일'),
						new StatsTreeItem(`$(edit) 총 수정한 라인: ${(allTimeStats.linesModified || 0).toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '전체-수정한 라인'),
						new StatsTreeItem(`$(arrow-down) 총 추가한 라인: ${allTimeStats.linesAdded.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '전체-추가한 라인'),
						new StatsTreeItem(`$(arrow-up) 총 삭제한 라인: ${allTimeStats.linesDeleted.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '전체-삭제한 라인'),
						new StatsTreeItem('$(symbol-color) 언어별 통계', vscode.TreeItemCollapsibleState.Expanded, this.getLanguageItemsFromStats(allTimeStats.languages), '전체-언어별 통계'),
					],
					'전체'
				)
			);

			return Promise.resolve(items);
		} else if (element.id === '전체-언어별 통계' || element.id === '언어별 통계' || (element.label && element.label.includes('언어별 통계'))) {
			return Promise.resolve(element.children || []);
		}

		return Promise.resolve([]);
	}

	private getLanguageItems(languages: Map<string, number>): StatsTreeItem[] {
		const total = Array.from(languages.values()).reduce((a, b) => a + b, 0);
		return Array.from(languages.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([lang, count]) => {
				const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
				return new StatsTreeItem(`${lang}: ${count.toLocaleString()} (${percentage}%)`, vscode.TreeItemCollapsibleState.None);
			});
	}

	private getLanguageItemsFromStats(languages: any[]): StatsTreeItem[] {
		return languages.map((lang) => new StatsTreeItem(`${lang.language}: ${lang.count.toLocaleString()} (${lang.percentage.toFixed(1)}%)`, vscode.TreeItemCollapsibleState.None));
	}
}

class StatsTreeItem extends vscode.TreeItem {
	children?: StatsTreeItem[];

	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		children?: StatsTreeItem[],
		public readonly id?: string
	) {
		super(label, collapsibleState);
		this.label = label;
		this.collapsibleState = collapsibleState;
		this.children = children;
		if (id) {
			this.id = id;
		}
	}
}

