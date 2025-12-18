"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsCalculator = void 0;
class StatsCalculator {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    // 일일 통계 계산
    getDailyStats(data, date) {
        const targetDate = date || this.storage.getTodayKey();
        return data.dailyStats.get(targetDate) || null;
    }
    // 주간 통계 계산
    getWeeklyStats(data) {
        const today = new Date();
        const days = [];
        let totalCodingTime = 0;
        let totalKeystrokes = 0;
        const allFilesEdited = new Set();
        let totalLinesAdded = 0;
        let totalLinesDeleted = 0;
        let totalLinesModified = 0;
        const languageMap = new Map();
        // 최근 7일 데이터 수집
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const dayStats = data.dailyStats.get(dateKey);
            if (dayStats) {
                days.push(dayStats);
                totalCodingTime += dayStats.codingTime;
                totalKeystrokes += dayStats.keystrokes;
                dayStats.filesEdited.forEach((file) => allFilesEdited.add(file));
                totalLinesAdded += dayStats.linesAdded;
                totalLinesDeleted += dayStats.linesDeleted;
                totalLinesModified += dayStats.linesModified || 0;
                for (const [lang, count] of dayStats.languages.entries()) {
                    const current = languageMap.get(lang) || 0;
                    languageMap.set(lang, current + count);
                }
            }
        }
        // 오늘의 세션 데이터도 포함
        const todayStats = this.storage.getTodayStats(data);
        totalCodingTime += todayStats.codingTime;
        totalKeystrokes += todayStats.keystrokes + data.currentSession.keystrokes;
        data.currentSession.filesEdited.forEach((file) => allFilesEdited.add(file));
        totalLinesAdded += todayStats.linesAdded + data.currentSession.linesAdded;
        totalLinesDeleted += todayStats.linesDeleted + data.currentSession.linesDeleted;
        for (const [lang, count] of data.currentSession.languages.entries()) {
            const current = languageMap.get(lang) || 0;
            languageMap.set(lang, current + count);
        }
        // 언어별 통계 정렬 및 퍼센트 계산
        const languages = Array.from(languageMap.entries())
            .map(([language, count]) => ({
            language,
            count,
            percentage: totalKeystrokes > 0 ? (count / totalKeystrokes) * 100 : 0,
        }))
            .sort((a, b) => b.count - a.count);
        return {
            codingTime: totalCodingTime,
            keystrokes: totalKeystrokes,
            filesEdited: allFilesEdited.size,
            linesAdded: totalLinesAdded,
            linesDeleted: totalLinesDeleted,
            linesModified: totalLinesModified,
            languages,
            days: days.reverse(), // 오래된 날짜부터
        };
    }
    // 월간 통계 계산
    getMonthlyStats(data) {
        const today = new Date();
        const days = [];
        let totalCodingTime = 0;
        let totalKeystrokes = 0;
        const allFilesEdited = new Set();
        let totalLinesAdded = 0;
        let totalLinesDeleted = 0;
        let totalLinesModified = 0;
        const languageMap = new Map();
        // 이번 달 데이터 수집
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        for (let d = new Date(firstDayOfMonth); d <= lastDayOfMonth; d.setDate(d.getDate() + 1)) {
            const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dayStats = data.dailyStats.get(dateKey);
            if (dayStats) {
                days.push(dayStats);
                totalCodingTime += dayStats.codingTime;
                totalKeystrokes += dayStats.keystrokes;
                dayStats.filesEdited.forEach((file) => allFilesEdited.add(file));
                totalLinesAdded += dayStats.linesAdded;
                totalLinesDeleted += dayStats.linesDeleted;
                totalLinesModified += dayStats.linesModified || 0;
                for (const [lang, count] of dayStats.languages.entries()) {
                    const current = languageMap.get(lang) || 0;
                    languageMap.set(lang, current + count);
                }
            }
        }
        // 오늘의 세션 데이터도 포함
        const todayStats = this.storage.getTodayStats(data);
        totalCodingTime += todayStats.codingTime;
        totalKeystrokes += todayStats.keystrokes + data.currentSession.keystrokes;
        data.currentSession.filesEdited.forEach((file) => allFilesEdited.add(file));
        totalLinesAdded += todayStats.linesAdded + data.currentSession.linesAdded;
        totalLinesDeleted += todayStats.linesDeleted + data.currentSession.linesDeleted;
        totalLinesModified += (todayStats.linesModified || 0) + (data.currentSession.linesModified || 0);
        for (const [lang, count] of data.currentSession.languages.entries()) {
            const current = languageMap.get(lang) || 0;
            languageMap.set(lang, current + count);
        }
        // 언어별 통계 정렬 및 퍼센트 계산
        const languages = Array.from(languageMap.entries())
            .map(([language, count]) => ({
            language,
            count,
            percentage: totalKeystrokes > 0 ? (count / totalKeystrokes) * 100 : 0,
        }))
            .sort((a, b) => b.count - a.count);
        return {
            codingTime: totalCodingTime,
            keystrokes: totalKeystrokes,
            filesEdited: allFilesEdited.size,
            linesAdded: totalLinesAdded,
            linesDeleted: totalLinesDeleted,
            linesModified: totalLinesModified,
            languages,
            days,
        };
    }
    // 전체 통계 계산
    getAllTimeStats(data) {
        const days = [];
        let totalCodingTime = 0;
        let totalKeystrokes = 0;
        const allFilesEdited = new Set();
        let totalLinesAdded = 0;
        let totalLinesDeleted = 0;
        let totalLinesModified = 0;
        const languageMap = new Map();
        // 모든 일일 통계 수집
        for (const dayStats of data.dailyStats.values()) {
            days.push(dayStats);
            totalCodingTime += dayStats.codingTime;
            totalKeystrokes += dayStats.keystrokes;
            dayStats.filesEdited.forEach((file) => allFilesEdited.add(file));
            totalLinesAdded += dayStats.linesAdded;
            totalLinesDeleted += dayStats.linesDeleted;
            totalLinesModified += dayStats.linesModified || 0;
            for (const [lang, count] of dayStats.languages.entries()) {
                const current = languageMap.get(lang) || 0;
                languageMap.set(lang, current + count);
            }
        }
        // 오늘의 세션 데이터도 포함
        const todayStats = this.storage.getTodayStats(data);
        totalCodingTime += todayStats.codingTime;
        totalKeystrokes += todayStats.keystrokes + data.currentSession.keystrokes;
        data.currentSession.filesEdited.forEach((file) => allFilesEdited.add(file));
        totalLinesAdded += todayStats.linesAdded + data.currentSession.linesAdded;
        totalLinesDeleted += todayStats.linesDeleted + data.currentSession.linesDeleted;
        totalLinesModified += (todayStats.linesModified || 0) + (data.currentSession.linesModified || 0);
        for (const [lang, count] of data.currentSession.languages.entries()) {
            const current = languageMap.get(lang) || 0;
            languageMap.set(lang, current + count);
        }
        // 언어별 통계 정렬 및 퍼센트 계산
        const languages = Array.from(languageMap.entries())
            .map(([language, count]) => ({
            language,
            count,
            percentage: totalKeystrokes > 0 ? (count / totalKeystrokes) * 100 : 0,
        }))
            .sort((a, b) => b.count - a.count);
        return {
            codingTime: totalCodingTime,
            keystrokes: totalKeystrokes,
            filesEdited: allFilesEdited.size,
            linesAdded: totalLinesAdded,
            linesDeleted: totalLinesDeleted,
            linesModified: totalLinesModified,
            languages,
            days: days.sort((a, b) => a.date.localeCompare(b.date)),
        };
    }
    // 시간 포맷팅
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}시간 ${minutes}분`;
        }
        else if (minutes > 0) {
            return `${minutes}분 ${secs}초`;
        }
        else {
            return `${secs}초`;
        }
    }
}
exports.StatsCalculator = StatsCalculator;
//# sourceMappingURL=stats.js.map