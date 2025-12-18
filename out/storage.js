"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageManager = void 0;
const STORAGE_KEY = 'haneui-yoman.stats';
class StorageManager {
    context;
    constructor(context) {
        this.context = context;
    }
    // 데이터 로드
    loadData() {
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
        const storedAny = stored;
        if (storedAny.dailyStats) {
            for (const [date, stats] of Object.entries(storedAny.dailyStats)) {
                const statsAny = stats;
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
                ...stored.currentSession,
                filesEdited: new Set(stored.currentSession?.filesEdited || []),
                languages: new Map(Object.entries(stored.currentSession?.languages || {})),
            },
        };
    }
    // 데이터 저장
    async saveData(data) {
        // Map과 Set을 직렬화 가능한 형태로 변환
        const serializable = {
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
                filesEdited: Array.from(stats.filesEdited),
                languages: Object.fromEntries(stats.languages),
            };
        }
        await this.context.globalState.update(STORAGE_KEY, serializable);
    }
    // 오늘 날짜 키 가져오기
    getTodayKey() {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    // 오늘의 통계 가져오기 또는 생성
    getTodayStats(data) {
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
    async resetStats() {
        await this.context.globalState.update(STORAGE_KEY, undefined);
    }
}
exports.StorageManager = StorageManager;
//# sourceMappingURL=storage.js.map