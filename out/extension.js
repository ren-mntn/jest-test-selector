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
const path = __importStar(require("path"));
const testExtractor_1 = require("./testExtractor");
const monorepoDetector_1 = require("./monorepoDetector");
const debugger_1 = require("./debugger");
const testTreeDataProvider_1 = require("./testTreeDataProvider");
const testResultView_1 = require("./testResultView");
// 拡張機能が有効化されたときに実行される関数
function activate(context) {
    console.log('拡張機能 "jest-test-selector" が有効化されました');
    console.log(`拡張機能ID: ${context.extension.id}`);
    // テストツリービューデータプロバイダーを作成
    const testTreeDataProvider = new testTreeDataProvider_1.TestTreeDataProvider();
    const testTreeView = vscode.window.createTreeView('jestTestSelector.testExplorer', {
        treeDataProvider: testTreeDataProvider,
        showCollapseAll: true
    });
    console.log('テストエクスプローラービューを登録しました');
    // テスト結果ビュープロバイダーを登録
    const testResultProvider = new testResultView_1.TestResultProvider(context.extensionUri);
    console.log('テスト結果ビュープロバイダーを作成しました');
    const testResultProviderDisposable = vscode.window.registerWebviewViewProvider('jestTestSelector.testResults', testResultProvider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    });
    console.log('テスト結果ビュープロバイダーを登録しました');
    // テスト出力イベントを購読
    const testOutputSubscription = (0, debugger_1.onTestOutput)((output) => {
        const resultView = testResultView_1.TestResultView.getInstance(context.extensionUri);
        const formattedOutput = resultView.formatTestResult(output);
        resultView.updateContent(formattedOutput);
    });
    // テストセッション終了イベントを購読
    const testSessionEndSubscription = (0, debugger_1.onTestSessionEnd)(() => {
        console.log('Test session end event received');
        // テストビューのローディング状態を終了
        const resultView = testResultView_1.TestResultView.getInstance(context.extensionUri);
        resultView.finishRunningState();
    });
    // テストリストを更新するコマンドを登録
    const refreshTestsDisposable = vscode.commands.registerCommand('jestTestSelector.refreshTests', async () => {
        await testTreeDataProvider.refresh();
        vscode.window.showInformationMessage('テストリストを更新しました');
    });
    // テストエクスプローラーからテストを実行するコマンドを登録
    const runSelectedTestDisposable = vscode.commands.registerCommand('jestTestSelector.runSelectedTest', async (item) => {
        if (!item) {
            vscode.window.showWarningMessage('テストが選択されていません');
            return;
        }
        // ファイルまたはdescribeブロックが選択された場合、そのすべてのテストを実行
        if (item.type === 'file') {
            await runTestFile(item.filePath);
        }
        else if (item.type === 'describe') {
            await runTestFile(item.filePath, item.label);
        }
        else if (item.type === 'testCase' && item.testCase) {
            await runSpecificTest(item.filePath, item.testCase);
        }
    });
    // すべてのテストを実行するコマンドを登録
    const runAllTestsDisposable = vscode.commands.registerCommand('jestTestSelector.runAllTests', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('ファイルが開かれていません');
            return;
        }
        const filePath = editor.document.uri.fsPath;
        if (!isTestFile(filePath)) {
            vscode.window.showWarningMessage('現在のファイルはJestのテストファイルではありません');
            return;
        }
        await runTestFile(filePath);
    });
    // クイックピックからテストを選択して実行するコマンドを登録
    const runTestDisposable = vscode.commands.registerCommand('jestTestSelector.runTest', async () => {
        try {
            // 現在開いているエディタを取得
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('ファイルが開かれていません');
                return;
            }
            const filePath = editor.document.uri.fsPath;
            // テストファイルかどうかをチェック
            if (!isTestFile(filePath)) {
                vscode.window.showWarningMessage('現在のファイルはJestのテストファイルではありません');
                return;
            }
            // ローディング表示を開始
            const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
            statusBar.text = '$(sync~spin) テストケースを検索中...';
            statusBar.show();
            try {
                // テストケースを抽出
                const testCases = await (0, testExtractor_1.extractTestCases)(filePath);
                if (testCases.length === 0) {
                    vscode.window.showInformationMessage('テストケースが見つかりませんでした');
                    return;
                }
                // テストケースの選択肢を作成
                const quickPickItems = [
                    // 「すべてのテストを実行」オプションを先頭に追加
                    {
                        label: '$(play) すべてのテストを実行',
                        description: 'ファイル内のすべてのテストケースを実行',
                        detail: `テスト数: ${testCases.length}個`
                    },
                    // 区切り線
                    {
                        label: '',
                        kind: vscode.QuickPickItemKind.Separator
                    },
                    // 個別のテストケース
                    ...testCases.map((testCase) => ({
                        label: testCase.name,
                        description: testCase.describePath.join(' > '),
                        detail: `行: ${testCase.lineNumber}`
                    }))
                ];
                // クイックピックでテストケースを選択
                const selected = await vscode.window.showQuickPick(quickPickItems, {
                    placeHolder: '実行するテストケースを選択',
                    matchOnDescription: true,
                    matchOnDetail: true
                });
                if (!selected) {
                    return;
                }
                // 選択されたのが「すべてのテストを実行」か個別のテストケースかを判定
                const isRunAll = selected.label === '$(play) すべてのテストを実行';
                let selectedTest = undefined;
                if (!isRunAll) {
                    // 個別のテストケースを実行する場合
                    selectedTest = testCases.find((test) => test.name === selected.label);
                    if (!selectedTest) {
                        vscode.window.showErrorMessage('テストケースの選択に問題が発生しました');
                        return;
                    }
                }
                statusBar.text = '$(sync~spin) パッケージ構造を検出中...';
                if (isRunAll) {
                    await runTestFile(filePath);
                }
                else if (selectedTest) {
                    await runSpecificTest(filePath, selectedTest);
                }
            }
            finally {
                // ステータスバーをクリア
                statusBar.dispose();
            }
        }
        catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`エラー: ${error.message}`);
            }
            else {
                vscode.window.showErrorMessage('予期しないエラーが発生しました');
            }
        }
    });
    // エディタ変更時にテストツリービューを更新
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (editor && isTestFile(editor.document.uri.fsPath)) {
            await testTreeDataProvider.refresh();
        }
    });
    // デバッグセッション開始時のイベントハンドラ
    const debugSessionStartDisposable = vscode.debug.onDidStartDebugSession((session) => {
        // Jestのデバッグセッションかどうかをチェック
        if (session.name.startsWith('Jest Debug: ')) {
            const testName = session.name.replace('Jest Debug: ', '');
            console.log(`Starting debug session: ${testName}`);
            // テスト実行状態を表示
            testResultView_1.TestResultView.getInstance(context.extensionUri).showRunningState(testName);
        }
    });
    // デバッグセッション終了時のイベントハンドラ
    const debugSessionTerminateDisposable = vscode.debug.onDidTerminateDebugSession(async (session) => {
        // Jestのデバッグセッションかどうかをチェック
        if (session.name.startsWith('Jest Debug: ')) {
            console.log(`Debug session terminated: ${session.name}`);
            // テスト結果の最終更新を少し待つ
            await new Promise((resolve) => setTimeout(resolve, 1000));
            // 明示的にテスト結果ビューのローディング状態を終了させる
            const resultView = testResultView_1.TestResultView.getInstance(context.extensionUri);
            resultView.finishRunningState();
        }
    });
    // 登録したコマンドを追加
    context.subscriptions.push(testTreeView, refreshTestsDisposable, runSelectedTestDisposable, runAllTestsDisposable, runTestDisposable, editorChangeDisposable, debugSessionStartDisposable, debugSessionTerminateDisposable, testResultProviderDisposable, testOutputSubscription, testSessionEndSubscription);
}
/**
 * テストファイル全体を実行する
 * @param filePath テストファイルのパス
 * @param describeBlock 実行するdescribeブロック名（オプション）
 */
async function runTestFile(filePath, describeBlock) {
    try {
        console.log(`Running test file: ${filePath}`);
        // 絶対パスに変換
        const absoluteFilePath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(vscode.workspace.workspaceFolders?.[0].uri.fsPath || '', filePath);
        console.log(`Absolute file path: ${absoluteFilePath}`);
        // ワークスペースフォルダを取得
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteFilePath));
        if (!workspaceFolder) {
            throw new Error(`ワークスペースフォルダが見つかりません (${absoluteFilePath})`);
        }
        console.log(`Workspace folder: ${workspaceFolder.uri.fsPath}`);
        // パッケージ構造を検出
        const packages = await (0, monorepoDetector_1.detectMonorepoPackages)(workspaceFolder.uri.fsPath);
        const targetPackage = findTargetPackage(absoluteFilePath, workspaceFolder, packages);
        if (!targetPackage) {
            vscode.window.showErrorMessage('テスト実行対象のパッケージが見つかりません');
            return;
        }
        console.log(`Target package: ${targetPackage.name}, ${targetPackage.path}`);
        // 実行内容の通知
        const fileName = path.basename(absoluteFilePath);
        const testName = describeBlock ? describeBlock : `${fileName} (All Tests)`;
        // テスト実行（絶対パスを使用）
        if (describeBlock) {
            // describeブロックを指定して実行
            const mockTestCase = {
                name: describeBlock,
                fullName: describeBlock,
                describePath: [],
                lineNumber: 0
            };
            await debugger_1.JestDebugger.startDebugging(absoluteFilePath, mockTestCase, targetPackage);
        }
        else {
            // ファイル全体を実行
            await debugger_1.JestDebugger.startDebuggingAllTests(absoluteFilePath, targetPackage);
        }
    }
    catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`エラー: ${error.message}`);
            console.error('Run test file error:', error);
            // extensionUriを取得
            const extension = vscode.extensions.all.find((e) => e.id.endsWith('jest-test-selector'));
            if (extension?.extensionUri) {
                testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState(error.message);
            }
        }
        else {
            vscode.window.showErrorMessage('予期しないエラーが発生しました');
            console.error('Unknown error in run test file:', error);
            const extension = vscode.extensions.all.find((e) => e.id.endsWith('jest-test-selector'));
            if (extension?.extensionUri) {
                testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState('予期しないエラーが発生しました');
            }
        }
    }
}
/**
 * 特定のテストケースを実行
 * @param filePath テストファイルのパス
 * @param testCase 実行するテストケース
 */
async function runSpecificTest(filePath, testCase) {
    try {
        console.log(`Running specific test: ${filePath}, test: ${testCase.name}`);
        // 絶対パスに変換
        const absoluteFilePath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(vscode.workspace.workspaceFolders?.[0].uri.fsPath || '', filePath);
        console.log(`Absolute file path: ${absoluteFilePath}`);
        // ワークスペースフォルダを取得
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteFilePath));
        if (!workspaceFolder) {
            throw new Error(`ワークスペースフォルダが見つかりません (${absoluteFilePath})`);
        }
        console.log(`Workspace folder: ${workspaceFolder.uri.fsPath}`);
        // パッケージ構造を検出
        const packages = await (0, monorepoDetector_1.detectMonorepoPackages)(workspaceFolder.uri.fsPath);
        const targetPackage = findTargetPackage(absoluteFilePath, workspaceFolder, packages);
        if (!targetPackage) {
            vscode.window.showErrorMessage('テスト実行対象のパッケージが見つかりません');
            return;
        }
        console.log(`Target package: ${targetPackage.name}, ${targetPackage.path}`);
        // テスト実行（絶対パスを使用）
        await debugger_1.JestDebugger.startDebugging(absoluteFilePath, testCase, targetPackage);
    }
    catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`エラー: ${error.message}`);
            console.error('Run specific test error:', error);
            // extensionUriを取得
            const extension = vscode.extensions.all.find((e) => e.id.endsWith('jest-test-selector'));
            if (extension?.extensionUri) {
                testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState(error.message);
            }
        }
        else {
            vscode.window.showErrorMessage('予期しないエラーが発生しました');
            console.error('Unknown error in run specific test:', error);
            const extension = vscode.extensions.all.find((e) => e.id.endsWith('jest-test-selector'));
            if (extension?.extensionUri) {
                testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState('予期しないエラーが発生しました');
            }
        }
    }
}
/**
 * テスト実行対象のパッケージを特定
 */
function findTargetPackage(filePath, workspaceFolder, packages) {
    let targetPackage;
    if (packages.length === 0) {
        // モノレポでない場合はワークスペースルートをパッケージとみなす
        const config = vscode.workspace.getConfiguration('jestTestSelector');
        const packageManager = config.get('packageManager') || 'pnpm';
        targetPackage = {
            name: path.basename(workspaceFolder.uri.fsPath),
            path: workspaceFolder.uri.fsPath,
            hasTestScript: true, // 仮定
            packageManager: packageManager
        };
    }
    else if (packages.length === 1) {
        // 単一パッケージの場合はそれを使用
        targetPackage = packages[0];
    }
    else {
        // ファイルパスにマッチするパッケージを特定
        const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
        targetPackage = packages.find((pkg) => {
            const pkgRelativePath = path.relative(workspaceFolder.uri.fsPath, pkg.path);
            return relativePath.startsWith(pkgRelativePath);
        });
    }
    return targetPackage;
}
/**
 * Jestのテストファイルかどうかを判定
 * @param filePath ファイルパス
 * @returns テストファイルならtrue
 */
function isTestFile(filePath) {
    const fileName = path.basename(filePath);
    return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(fileName);
}
// 拡張機能が無効化されたときに実行される関数
function deactivate() {
    console.log('拡張機能 "jest-test-selector" が無効化されました');
}
//# sourceMappingURL=extension.js.map