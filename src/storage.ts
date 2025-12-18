import * as vscode from 'vscode';

const STORAGE_KEY = 'haneui-yoman.stats';

export class StorageManager {
	private context: vscode.ExtensionContext;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	// 데이터 로드
	loadData(): any {
		const stored = this.context.globalState.get(STORAGE_KEY);
		if (!stored) {
			return {
				dailyStats: new Map(),
				currentSession: {
					keystrokes: 0,
					filesEdited: new Set(),
					linesAdded: 0,
					linesDeleted: 0,
					linesModified: 0,
					languages: new Map(),
				},
			};
		}

		// Map과 Set을 복원
		const dailyStats = new Map();
		const storedAny = stored as any;
		if (storedAny.dailyStats) {
			for (const [date, stats] of Object.entries(storedAny.dailyStats)) {
				const statsAny = stats as any;
				dailyStats.set(date, {
					...statsAny,
					filesEdited: new Set(statsAny.filesEdited || []),
					languages: new Map(Object.entries(statsAny.languages || {})),
				});
			}
		}

		return {
			dailyStats,
			currentSession: {
				...(stored as any).currentSession,
				filesEdited: new Set((stored as any).currentSession?.filesEdited || []),
				languages: new Map(Object.entries((stored as any).currentSession?.languages || {})),
			},
		};
	}

	// 데이터 저장
	async saveData(data: any): Promise<void> {
		// Map과 Set을 직렬화 가능한 형태로 변환
		const serializable: any = {
			dailyStats: {},
			currentSession: {
				...data.currentSession,
				filesEdited: Array.from(data.currentSession.filesEdited),
				languages: Object.fromEntries(data.currentSession.languages),
			},
		};

		for (const [date, stats] of data.dailyStats.entries()) {
			serializable.dailyStats[date] = {
				...stats,
				filesEdited: Array.from((stats as any).filesEdited),
				languages: Object.fromEntries((stats as any).languages),
			};
		}

		await this.context.globalState.update(STORAGE_KEY, serializable);
	}

	// 오늘 날짜 키 가져오기
	getTodayKey(): string {
		const today = new Date();
		return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	}

	// 오늘의 통계 가져오기 또는 생성
	getTodayStats(data: any): any {
		const todayKey = this.getTodayKey();
		let todayStats = data.dailyStats.get(todayKey);
		if (!todayStats) {
			todayStats = {
				date: todayKey,
				codingTime: 0,
				keystrokes: 0,
				filesEdited: new Set(),
				linesAdded: 0,
				linesDeleted: 0,
				linesModified: 0,
				languages: new Map(),
			};
			data.dailyStats.set(todayKey, todayStats);
		}
		return todayStats;
	}

	// 통계 초기화
	async resetStats(): Promise<void> {
		await this.context.globalState.update(STORAGE_KEY, undefined);
	}
}

