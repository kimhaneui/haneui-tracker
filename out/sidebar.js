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
exports.StatsTreeDataProvider = void 0;
const vscode = __importStar(require("vscode"));
class StatsTreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    data = null;
    calculator;
    period = 'daily';
    constructor(calculator) {
        this.calculator = calculator;
    }
    updateData(data) {
        this.data = data;
        this.refresh();
    }
    setPeriod(period) {
        this.period = period;
        this.refresh();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this.data) {
            return Promise.resolve([]);
        }
        if (!element) {
            // 루트 레벨 - 항상 "오늘"과 "전체 통계" 두 섹션 표시
            const todayStats = this.calculator.getDailyStats(this.data);
            const allTimeStats = this.calculator.getAllTimeStats(this.data);
            const items = [];
            // 오늘 통계 섹션
            if (todayStats) {
                items.push(new StatsTreeItem('$(calendar) 오늘', vscode.TreeItemCollapsibleState.Expanded, [
                    new StatsTreeItem(`$(clock) 코딩 시간: ${this.calculator.formatTime(todayStats.codingTime)}`, vscode.TreeItemCollapsibleState.None, undefined, '오늘-코딩 시간'),
                    new StatsTreeItem(`$(keyboard) 키스트로크: ${todayStats.keystrokes.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '오늘-키스트로크'),
                    new StatsTreeItem(`$(file) 편집한 파일: ${todayStats.filesEdited.size}개`, vscode.TreeItemCollapsibleState.None, undefined, '오늘-편집한 파일'),
                    new StatsTreeItem(`$(edit) 수정한 라인: ${(todayStats.linesModified || 0).toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '오늘-수정한 라인'),
                    new StatsTreeItem(`$(arrow-down) 추가한 라인: ${todayStats.linesAdded.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '오늘-추가한 라인'),
                    new StatsTreeItem(`$(arrow-up) 삭제한 라인: ${todayStats.linesDeleted.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '오늘-삭제한 라인'),
                ], '오늘'));
            }
            // 전체 통계 섹션
            items.push(new StatsTreeItem('$(star-full) 전체 통계', vscode.TreeItemCollapsibleState.Expanded, [
                new StatsTreeItem(`$(clock) 총 코딩 시간: ${this.calculator.formatTime(allTimeStats.codingTime)}`, vscode.TreeItemCollapsibleState.None, undefined, '전체-코딩 시간'),
                new StatsTreeItem(`$(keyboard) 총 키스트로크: ${allTimeStats.keystrokes.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '전체-키스트로크'),
                new StatsTreeItem(`$(file) 총 편집한 파일: ${allTimeStats.filesEdited}개`, vscode.TreeItemCollapsibleState.None, undefined, '전체-편집한 파일'),
                new StatsTreeItem(`$(edit) 총 수정한 라인: ${(allTimeStats.linesModified || 0).toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '전체-수정한 라인'),
                new StatsTreeItem(`$(arrow-down) 총 추가한 라인: ${allTimeStats.linesAdded.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '전체-추가한 라인'),
                new StatsTreeItem(`$(arrow-up) 총 삭제한 라인: ${allTimeStats.linesDeleted.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, undefined, '전체-삭제한 라인'),
                new StatsTreeItem('$(symbol-color) 언어별 통계', vscode.TreeItemCollapsibleState.Expanded, this.getLanguageItemsFromStats(allTimeStats.languages), '전체-언어별 통계'),
            ], '전체'));
            return Promise.resolve(items);
        }
        else if (element.id === '전체-언어별 통계' || element.id === '언어별 통계' || (element.label && element.label.includes('언어별 통계'))) {
            return Promise.resolve(element.children || []);
        }
        return Promise.resolve([]);
    }
    getLanguageItems(languages) {
        const total = Array.from(languages.values()).reduce((a, b) => a + b, 0);
        return Array.from(languages.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([lang, count]) => {
            const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
            return new StatsTreeItem(`${lang}: ${count.toLocaleString()} (${percentage}%)`, vscode.TreeItemCollapsibleState.None);
        });
    }
    getLanguageItemsFromStats(languages) {
        return languages.map((lang) => new StatsTreeItem(`${lang.language}: ${lang.count.toLocaleString()} (${lang.percentage.toFixed(1)}%)`, vscode.TreeItemCollapsibleState.None));
    }
}
exports.StatsTreeDataProvider = StatsTreeDataProvider;
class StatsTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    id;
    children;
    constructor(label, collapsibleState, children, id) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.id = id;
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.children = children;
        if (id) {
            this.id = id;
        }
    }
}
//# sourceMappingURL=sidebar.js.map