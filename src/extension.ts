import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('KnowYourDependencies.showDependencies', async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage('没有打开的工作区');
			return;
		}

		const packageJsonPath = path.join(workspaceFolders[0].uri.fsPath, 'package.json');

		fs.readFile(packageJsonPath, 'utf8', async (err, data) => {
			if (err) {
				vscode.window.showErrorMessage('无法读取 package.json 文件');
				return;
			}

			const packageJson = JSON.parse(data);
			const dependencies = { ...packageJson.dependencies };
			const devDependencies = { ...packageJson.devDependencies };

			// 创建 WebView 来显示依赖信息
			const panel = vscode.window.createWebviewPanel(
				'dependenciesView',
				'项目依赖',
				vscode.ViewColumn.One,
				{ enableScripts: true }
			);

			const initialHtml = await getInitialHtml(dependencies, devDependencies);
			panel.webview.html = initialHtml;
		});
	});

	context.subscriptions.push(disposable);
}

async function getInitialHtml(dependencies: { [key: string]: string }, devDependencies: { [key: string]: string }): Promise<string> {
	return `
		<!DOCTYPE html>
		<html lang="zh-CN">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>项目依赖</title>
			<style>
				.loading {
					display: inline-block;
					width: 20px;
					height: 20px;
					border: 3px solid rgba(0,0,0,.3);
					border-radius: 50%;
					border-top-color: #000;
					animation: spin 1s ease-in-out infinite;
				}
				@keyframes spin {
					to { transform: rotate(360deg); }
				}
			</style>
		</head>
		<body>
			<h1>项目依赖 <span class="loading" id="dep-loading"></span></h1>
			<ul id="dependencies"></ul>

			<h1>项目开发依赖 <span class="loading" id="dev-dep-loading"></span></h1>
			<ul id="devDependencies"></ul>

			<script>
				const vscode = acquireVsCodeApi();
				const dependencies = ${JSON.stringify(dependencies)};
				const devDependencies = ${JSON.stringify(devDependencies)};

				async function loadDependencies(deps, elementId, loadingId) {
					const ul = document.getElementById(elementId);
					for (const [name, version] of Object.entries(deps)) {
						const li = document.createElement('li');
						li.innerHTML = '<strong>' + name + '</strong> (' + version + ') <span class="loading"></span>';
						ul.appendChild(li);
						
						const description = await getPackageDescription(name);
						li.innerHTML = '<strong>' + name + '</strong> (' + version + ')' +
							'<p>' + description + '</p>' +
							'<a href="https://www.npmjs.com/package/' + name + '" target="_blank">NPM</a> ' +
							'<a href="https://github.com/search?q=' + name + '" target="_blank">GitHub</a>';
					}
					document.getElementById(loadingId).style.display = 'none';
				}

				async function getPackageDescription(name) {
					try {
						const response = await fetch('https://registry.npmjs.org/' + name);
						const data = await response.json();
						return data.description || '无描述';
					} catch (error) {
						console.error('获取 ' + name + ' 的描述时出错:', error);
						return '无法获取描述';
					}
				}

				loadDependencies(dependencies, 'dependencies', 'dep-loading');
				loadDependencies(devDependencies, 'devDependencies', 'dev-dep-loading');
			</script>
		</body>
		</html>
	`;
}

export function deactivate() { }
