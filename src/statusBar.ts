import * as vscode from 'vscode';

export class StatusBar {
	private statusBarItem: vscode.StatusBarItem;

	constructor(context: vscode.ExtensionContext) {
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.statusBarItem.command = 'haneui-yoman.showStats';
		this.statusBarItem.tooltip = '개발 활동 통계 보기';
		context.subscriptions.push(this.statusBarItem);
	}

	getItem(): vscode.StatusBarItem {
		return this.statusBarItem;
	}

	dispose(): void {
		this.statusBarItem.dispose();
	}
}

