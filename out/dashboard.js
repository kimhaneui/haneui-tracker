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
exports.Dashboard = void 0;
const vscode = __importStar(require("vscode"));
class Dashboard {
    panel;
    context;
    calculator;
    constructor(context, calculator) {
        this.context = context;
        this.calculator = calculator;
    }
    show(data, period = 'daily') {
        if (this.panel) {
            this.panel.reveal();
        }
        else {
            this.panel = vscode.window.createWebviewPanel('haneuiYomanDashboard', '개발 활동 대시보드', vscode.ViewColumn.One, {
                enableScripts: true,
                retainContextWhenHidden: true,
            });
            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        }
        let stats;
        switch (period) {
            case 'daily':
                const todayStats = this.calculator.getDailyStats(data);
                if (!todayStats) {
                    stats = {
                        codingTime: 0,
                        keystrokes: 0,
                        filesEdited: 0,
                        linesAdded: 0,
                        linesDeleted: 0,
                        linesModified: 0,
                        languages: [],
                        days: [],
                    };
                }
                else {
                    stats = {
                        codingTime: todayStats.codingTime,
                        keystrokes: todayStats.keystrokes,
                        filesEdited: todayStats.filesEdited.size,
                        linesAdded: todayStats.linesAdded,
                        linesDeleted: todayStats.linesDeleted,
                        linesModified: todayStats.linesModified || 0,
                        languages: Array.from(todayStats.languages.entries())
                            .map(([lang, count]) => ({
                            language: lang,
                            count,
                            percentage: todayStats.keystrokes > 0 ? (count / todayStats.keystrokes) * 100 : 0,
                        }))
                            .sort((a, b) => b.count - a.count),
                        days: [todayStats],
                    };
                }
                break;
            case 'weekly':
                stats = this.calculator.getWeeklyStats(data);
                break;
            case 'monthly':
                stats = this.calculator.getMonthlyStats(data);
                break;
            case 'alltime':
                stats = this.calculator.getAllTimeStats(data);
                break;
        }
        this.panel.webview.html = this.getWebviewContent(stats, period);
    }
    getWebviewContent(stats, period) {
        const periodLabels = {
            daily: '오늘',
            weekly: '이번 주',
            monthly: '이번 달',
            alltime: '전체',
        };
        // 차트 데이터 준비
        const languageLabels = stats.languages.slice(0, 10).map((l) => l.language);
        const languageData = stats.languages.slice(0, 10).map((l) => l.count);
        const languageColors = this.generateColors(stats.languages.length);
        // 일별 코딩 시간 데이터
        const dayLabels = stats.days.map((d) => {
            const date = new Date(d.date);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });
        const dayCodingTime = stats.days.map((d) => d.codingTime / 3600); // 시간 단위로 변환
        return `<!DOCTYPE html>
<html lang="ko">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>개발 활동 대시보드</title>
	<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
			margin: 0;
			padding: 20px;
			background-color: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
		}
		.header {
			margin-bottom: 30px;
		}
		.header h1 {
			margin: 0 0 10px 0;
			font-size: 24px;
		}
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 20px;
			margin-bottom: 30px;
		}
		.stat-card {
			background-color: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 8px;
			padding: 20px;
			text-align: center;
		}
		.stat-value {
			font-size: 32px;
			font-weight: bold;
			margin-bottom: 5px;
			color: var(--vscode-textLink-foreground);
		}
		.stat-label {
			font-size: 14px;
			color: var(--vscode-descriptionForeground);
		}
		.chart-container {
			background-color: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 8px;
			padding: 20px;
			margin-bottom: 20px;
		}
		.chart-title {
			font-size: 18px;
			font-weight: bold;
			margin-bottom: 15px;
		}
		canvas {
			max-height: 400px;
		}
	</style>
</head>
<body>
	<div class="header">
		<h1>📊 개발 활동 대시보드</h1>
		<p>${periodLabels[period] || period} 통계</p>
	</div>

	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-value">${this.calculator.formatTime(stats.codingTime)}</div>
			<div class="stat-label">코딩 시간</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">${stats.keystrokes.toLocaleString()}</div>
			<div class="stat-label">키스트로크</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">${stats.filesEdited}</div>
			<div class="stat-label">편집한 파일</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">${(stats.linesModified || 0).toLocaleString()}</div>
			<div class="stat-label">수정한 라인</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">${stats.linesAdded.toLocaleString()}</div>
			<div class="stat-label">추가한 라인</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">${stats.linesDeleted.toLocaleString()}</div>
			<div class="stat-label">삭제한 라인</div>
		</div>
	</div>

	${languageLabels.length > 0 ? `
	<div class="chart-container">
		<div class="chart-title">언어별 키스트로크 분포</div>
		<canvas id="languageChart"></canvas>
	</div>
	` : ''}

	${dayLabels.length > 0 ? `
	<div class="chart-container">
		<div class="chart-title">일별 코딩 시간</div>
		<canvas id="timeChart"></canvas>
	</div>
	` : ''}

	<script>
		const vscode = acquireVsCodeApi();
		
		${languageLabels.length > 0 ? `
		// 언어별 차트
		const languageCtx = document.getElementById('languageChart').getContext('2d');
		new Chart(languageCtx, {
			type: 'doughnut',
			data: {
				labels: ${JSON.stringify(languageLabels)},
				datasets: [{
					data: ${JSON.stringify(languageData)},
					backgroundColor: ${JSON.stringify(languageColors.slice(0, languageLabels.length))}
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				plugins: {
					legend: {
						position: 'right'
					}
				}
			}
		});
		` : ''}

		${dayLabels.length > 0 ? `
		// 일별 코딩 시간 차트
		const timeCtx = document.getElementById('timeChart').getContext('2d');
		new Chart(timeCtx, {
			type: 'line',
			data: {
				labels: ${JSON.stringify(dayLabels)},
				datasets: [{
					label: '코딩 시간 (시간)',
					data: ${JSON.stringify(dayCodingTime)},
					borderColor: 'rgb(75, 192, 192)',
					backgroundColor: 'rgba(75, 192, 192, 0.2)',
					tension: 0.1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				scales: {
					y: {
						beginAtZero: true
					}
				}
			}
		});
		` : ''}
	</script>
</body>
</html>`;
    }
    generateColors(count) {
        const colors = [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)',
            'rgba(199, 199, 199, 0.8)',
            'rgba(83, 102, 255, 0.8)',
            'rgba(255, 99, 255, 0.8)',
            'rgba(99, 255, 255, 0.8)',
        ];
        // 색상이 부족하면 반복
        const result = [];
        for (let i = 0; i < count; i++) {
            result.push(colors[i % colors.length]);
        }
        return result;
    }
}
exports.Dashboard = Dashboard;
//# sourceMappingURL=dashboard.js.map