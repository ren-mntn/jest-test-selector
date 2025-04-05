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
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const debugger_1 = require("./debugger");
const monorepoDetector_1 = require("./monorepoDetector");
const testResultView_1 = require("./testResultView");
const testSettingsView_1 = require("./testSettingsView");
const testTreeDataProvider_1 = require("./testTreeDataProvider");
// 拡張機能が有効化されたときに実行される関数
function activate(context) {
    console.log('拡張機能 "jest-test-selector" が有効化されました');
    console.log(`拡張機能ID: ${context.extension.id}`);
    // 拡張機能が既に有効化されているかチェック
    try {
        // テスト結果ビュープロバイダーを登録
        const testResultProvider = new testResultView_1.TestResultProvider(context.extensionUri);
        let testResultProviderDisposable;
        try {
            testResultProviderDisposable = vscode.window.registerWebviewViewProvider("jestTestSelector.testResults", testResultProvider, {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
            });
            console.log("テスト結果ビュープロバイダーを登録しました");
        }
        catch (e) {
            console.log("テスト結果ビュープロバイダーは既に登録されています");
        }
        // テスト設定ビュープロバイダーを登録
        const testSettingsProvider = testSettingsView_1.TestSettingsProvider.getInstance(context.extensionUri);
        let testSettingsProviderDisposable;
        try {
            testSettingsProviderDisposable =
                vscode.window.registerWebviewViewProvider(testSettingsView_1.TestSettingsProvider.viewType, testSettingsProvider, {
                    webviewOptions: {
                        retainContextWhenHidden: true,
                    },
                });
            console.log("テスト設定ビュープロバイダーを登録しました");
        }
        catch (e) {
            console.log("テスト設定ビュープロバイダーは既に登録されています");
        }
        // テストツリービューデータプロバイダーを作成
        const testTreeDataProvider = new testTreeDataProvider_1.TestTreeDataProvider();
        let testTreeView;
        try {
            testTreeView = vscode.window.createTreeView("jestTestSelector.testExplorer", {
                treeDataProvider: testTreeDataProvider,
                showCollapseAll: true,
            });
            console.log("テストエクスプローラービューを登録しました");
        }
        catch (e) {
            console.log("テストエクスプローラービューは既に登録されています");
        }
        // テスト出力イベントを購読
        const testOutputSubscription = (0, debugger_1.onTestOutput)((output) => {
            const resultView = testResultView_1.TestResultView.getInstance(context.extensionUri);
            const formattedOutput = resultView.formatTestResult(output);
            resultView.updateContent(formattedOutput);
        });
        // テストセッション終了イベントを購読
        const testSessionEndSubscription = (0, debugger_1.onTestSessionEnd)(() => {
            console.log("Test session end event received");
            // テストビューのローディング状態を終了
            const resultView = testResultView_1.TestResultView.getInstance(context.extensionUri);
            resultView.finishRunningState();
        });
        // Jest CLI オプションタブを開くコマンドを登録
        const selectJestOptionsDisposable = vscode.commands.registerCommand("jestTestSelector.selectOptions", async () => {
            try {
                console.log("セレクトオプションコマンドが実行されました");
                // 設定ビューを表示
                const testSettingsProvider = testSettingsView_1.TestSettingsProvider.getInstance(context.extensionUri);
                try {
                    // Jest Test Selector拡張機能のビューを表示
                    await vscode.commands.executeCommand("workbench.view.extension.jest-test-selector");
                    // 少し待機してからテスト設定タブに切り替え
                    setTimeout(async () => {
                        try {
                            await vscode.commands.executeCommand(testSettingsView_1.TestSettingsProvider.viewType + ".focus");
                            console.log("テスト設定タブのフォーカスコマンドを実行しました");
                        }
                        catch (error) {
                            console.error("テスト設定タブのフォーカスに失敗:", error);
                        }
                    }, 500);
                }
                catch (error) {
                    console.error("WebViewタブ表示に失敗:", error);
                }
            }
            catch (error) {
                console.error("コマンド実行エラー:", error);
                vscode.window.showErrorMessage(`テスト設定の表示に失敗しました: ${error}`);
            }
        });
        // 登録したコマンドを追加
        const disposables = [
            testOutputSubscription,
            testSessionEndSubscription,
            selectJestOptionsDisposable,
        ];
        // 設定エディタを開くコマンドを登録
        const openSettingsDisposable = vscode.commands.registerCommand("jestTestSelector.openSettings", async () => {
            try {
                // 直接Jest Test Selectorの設定セクションを開く
                await vscode.commands.executeCommand("workbench.action.openSettings", "jestTestSelector.cliOptions");
            }
            catch (error) {
                console.error("設定を開く際にエラーが発生しました:", error);
                vscode.window.showErrorMessage(`設定エディタを開けませんでした: ${error}`);
            }
        });
        disposables.push(openSettingsDisposable);
        // テストリストを更新するコマンドを登録
        const refreshTestsDisposable = vscode.commands.registerCommand("jestTestSelector.refreshTests", async () => {
            await testTreeDataProvider.refresh();
            vscode.window.showInformationMessage("テストリストを更新しました");
        });
        disposables.push(refreshTestsDisposable);
        // テスト実行ヘルパー関数 - スコープに基づいてテストを実行
        async function runTestsAtScope(scope, targetPath, testCase, unitTestOnly, e2eTestOnly, runBoth) {
            try {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(targetPath));
                if (!workspaceFolder) {
                    vscode.window.showErrorMessage(`ワークスペースフォルダが見つかりません (${targetPath})`);
                    return;
                }
                // モノレポのパッケージを検出
                const packages = await (0, monorepoDetector_1.detectMonorepoPackages)(workspaceFolder.uri.fsPath);
                // 対象のパッケージを特定
                const targetPackage = findTargetPackage(targetPath, workspaceFolder, packages);
                if (!targetPackage) {
                    vscode.window.showErrorMessage("対象のパッケージが見つかりません。モノレポ設定を確認してください。");
                    return;
                }
                switch (scope) {
                    case "package":
                        if (unitTestOnly) {
                            // ユニットテストのみを実行
                            await debugger_1.JestDebugger.startDebuggingDirectoryTests(targetPath, targetPackage, false // Unit testsのみ実行
                            );
                        }
                        else if (e2eTestOnly) {
                            // E2Eテストのみを実行
                            await debugger_1.JestDebugger.startDebuggingDirectoryTests(targetPath, targetPackage, true // E2E testsのみ実行
                            );
                        }
                        else if (runBoth) {
                            // ユニットテスト後にE2Eテストを実行（両方順番に実行）
                            // カスタムコマンドを作成して通常テストとE2Eテストを順番に実行
                            const normalTestCmd = await debugger_1.JestDebugger.prepareDirectoryTestCommand(targetPath, targetPackage, false);
                            const e2eTestCmd = await debugger_1.JestDebugger.prepareDirectoryTestCommand(targetPath, targetPackage, true);
                            // 修正：コマンドを && で連結し、各コマンドをダブルクォートで囲まない
                            const combinedCommand = `${normalTestCmd} && ${e2eTestCmd}`;
                            console.log(`Combined test command: ${combinedCommand}`);
                            await debugger_1.JestDebugger.startDebuggingWithCustomCommand(targetPath, targetPackage, combinedCommand, `${path.basename(targetPath)}のユニットテスト+E2Eテスト`);
                        }
                        else {
                        }
                        break;
                    case "directory":
                        // ディレクトリ内のテスト実行
                        if (unitTestOnly) {
                            // ユニットテストのみを実行
                            await debugger_1.JestDebugger.startDebuggingDirectoryTests(targetPath, targetPackage, false // Unit testsのみ実行
                            );
                        }
                        else if (e2eTestOnly) {
                            // E2Eテストのみを実行
                            await debugger_1.JestDebugger.startDebuggingDirectoryTests(targetPath, targetPackage, true // E2E testsのみ実行
                            );
                        }
                        else {
                            // ディレクトリのテストのみを実行するように修正
                            const dirCommand = await debugger_1.JestDebugger.prepareDirectoryTestCommand(targetPath, targetPackage, false // 通常のテスト
                            );
                            const e2eDirCommand = await debugger_1.JestDebugger.prepareDirectoryTestCommand(targetPath, targetPackage, true // E2Eテスト
                            );
                            await debugger_1.JestDebugger.startDebuggingWithCustomCommand(targetPath, targetPackage, `${dirCommand} && ${e2eDirCommand}`, `${path.basename(targetPath)}`);
                        }
                        break;
                    case "file":
                        if (testCase) {
                            await debugger_1.JestDebugger.startDebugging(targetPath, testCase, targetPackage);
                        }
                        else {
                            // ファイル内のすべてのテスト
                            await debugger_1.JestDebugger.startDebuggingAllTests(targetPath, targetPackage);
                        }
                        break;
                    case "test":
                        if (testCase) {
                            await debugger_1.JestDebugger.startDebugging(targetPath, testCase, targetPackage);
                        }
                        break;
                }
            }
            catch (error) {
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(`テスト実行エラー: ${error.message}`);
                    console.error("Test run error:", error);
                }
                else {
                    vscode.window.showErrorMessage("テスト実行に失敗しました");
                    console.error("Unknown test run error:", error);
                }
            }
        }
        // ディレクトリ内のすべてのテストを実行するコマンド
        const runDirectoryAllTestsDisposable = vscode.commands.registerCommand("jestTestSelector.runDirectoryAllTests", async (item) => {
            if (!item || !item.filePath) {
                vscode.window.showErrorMessage("ディレクトリパスが取得できません");
                return;
            }
            await runTestsAtScope("directory", item.filePath);
        });
        disposables.push(runDirectoryAllTestsDisposable);
        // ディレクトリ内のユニットテストのみを実行するコマンド
        const runDirectoryUnitTestsDisposable = vscode.commands.registerCommand("jestTestSelector.runDirectoryUnitTests", async (item) => {
            if (!item || !item.filePath) {
                vscode.window.showErrorMessage("ディレクトリパスが取得できません");
                return;
            }
            await runTestsAtScope("directory", item.filePath, undefined, true);
        });
        disposables.push(runDirectoryUnitTestsDisposable);
        // ディレクトリ内のE2Eテストのみを実行するコマンド
        const runDirectoryE2ETestsDisposable = vscode.commands.registerCommand("jestTestSelector.runDirectoryE2ETests", async (item) => {
            if (!item || !item.filePath) {
                vscode.window.showErrorMessage("ディレクトリパスが取得できません");
                return;
            }
            await runTestsAtScope("directory", item.filePath, undefined, false, true);
        });
        disposables.push(runDirectoryE2ETestsDisposable);
        // ファイル内のすべてのテストを実行するコマンド
        const runFileAllTestsDisposable = vscode.commands.registerCommand("jestTestSelector.runFileAllTests", async (item) => {
            if (!item || !item.filePath) {
                vscode.window.showErrorMessage("ファイルパスが取得できません");
                return;
            }
            await runTestsAtScope("file", item.filePath);
        });
        disposables.push(runFileAllTestsDisposable);
        // 選択された個別のテストを実行するコマンド
        const runSelectedTestDisposable = vscode.commands.registerCommand("jestTestSelector.runSelectedTest", async (item) => {
            try {
                if (!item || !item.testCase || !item.filePath) {
                    vscode.window.showErrorMessage("テスト情報が取得できません");
                    return;
                }
                await runTestsAtScope("file", item.filePath, item.testCase);
            }
            catch (error) {
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(`テスト実行エラー: ${error.message}`);
                    console.error("Test run error:", error);
                }
                else {
                    vscode.window.showErrorMessage("テスト実行に失敗しました");
                    console.error("Unknown test run error:", error);
                }
            }
        });
        disposables.push(runSelectedTestDisposable);
        // エディタ変更時に自動的にテストツリーを更新
        const activeEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor &&
                testTreeDataProvider.isTestFile(editor.document.uri.fsPath)) {
                await testTreeDataProvider.refresh();
            }
        });
        disposables.push(activeEditorChangeDisposable);
        // 現在のエディタが存在し、テストファイルであれば初期表示を実行
        const currentEditor = vscode.window.activeTextEditor;
        if (currentEditor &&
            testTreeDataProvider.isTestFile(currentEditor.document.uri.fsPath)) {
            testTreeDataProvider.refresh();
        }
        // デバッグセッション開始時のイベントハンドラ
        const debugSessionStartDisposable = vscode.debug.onDidStartDebugSession((session) => {
            // Jestのデバッグセッションかどうかをチェック
            if (session.name.startsWith("Jest Debug: ")) {
                const testName = session.name.replace("Jest Debug: ", "");
                console.log(`Starting debug session: ${testName}`);
                // テスト実行状態を表示
                testResultView_1.TestResultView.getInstance(context.extensionUri).showRunningState(testName);
            }
        });
        disposables.push(debugSessionStartDisposable);
        // デバッグセッション終了時のイベントハンドラ
        const debugSessionTerminateDisposable = vscode.debug.onDidTerminateDebugSession(async (session) => {
            // Jestのデバッグセッションかどうかをチェック
            if (session.name.startsWith("Jest Debug: ")) {
                console.log(`Debug session terminated: ${session.name}`);
                // テスト結果の最終更新を少し待つ
                await new Promise((resolve) => setTimeout(resolve, 1000));
                // 明示的にテスト結果ビューのローディング状態を終了させる
                const resultView = testResultView_1.TestResultView.getInstance(context.extensionUri);
                resultView.finishRunningState();
            }
        });
        disposables.push(debugSessionTerminateDisposable);
        // パッケージのユニットテストのみを実行するコマンド
        const runPackageUnitTestsDisposable = vscode.commands.registerCommand("jestTestSelector.runPackageUnitTests", async (item) => {
            if (!item || !item.filePath) {
                vscode.window.showErrorMessage("パッケージパスが取得できません");
                return;
            }
            // パッケージのユニットテストのみを実行
            await runTestsAtScope("package", item.filePath, undefined, true);
        });
        disposables.push(runPackageUnitTestsDisposable);
        // パッケージのE2Eテストのみを実行するコマンド
        const runPackageE2ETestsDisposable = vscode.commands.registerCommand("jestTestSelector.runPackageE2ETests", async (item) => {
            if (!item || !item.filePath) {
                vscode.window.showErrorMessage("パッケージパスが取得できません");
                return;
            }
            // パッケージのE2Eテストのみを実行
            await runTestsAtScope("package", item.filePath, undefined, false, true);
        });
        disposables.push(runPackageE2ETestsDisposable);
        // パッケージのユニットテスト実行後E2Eテストを実行するコマンド
        const runPackageAllTestsDisposable = vscode.commands.registerCommand("jestTestSelector.runPackageAllTests", async (item) => {
            if (!item || !item.filePath) {
                vscode.window.showErrorMessage("パッケージパスが取得できません");
                return;
            }
            // パッケージのルートディレクトリでユニットテスト後E2Eテストを実行
            await runTestsAtScope("package", item.filePath, undefined, false, false, true);
        });
        disposables.push(runPackageAllTestsDisposable);
        // 正常に登録されたプロバイダーを追加
        if (testTreeView) {
            disposables.push(testTreeView);
        }
        if (testResultProviderDisposable) {
            disposables.push(testResultProviderDisposable);
        }
        if (testSettingsProviderDisposable) {
            disposables.push(testSettingsProviderDisposable);
        }
        context.subscriptions.push(...disposables);
    }
    catch (error) {
        console.error("拡張機能の初期化エラー:", error);
        vscode.window.showErrorMessage(`拡張機能の初期化に失敗しました: ${error}`);
    }
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
            : path.resolve(vscode.workspace.workspaceFolders?.[0].uri.fsPath || "", filePath);
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
            vscode.window.showErrorMessage("テスト実行対象のパッケージが見つかりません");
            return;
        }
        console.log(`Target package: ${targetPackage.name}, ${targetPackage.path}`);
        // ファイル名を取得（表示用）
        const fileName = path.basename(absoluteFilePath);
        console.log(`File name: ${fileName}`);
        // テスト実行（常に絶対パスを使用）
        if (describeBlock) {
            // describeブロックを指定して実行
            const mockTestCase = {
                name: describeBlock,
                fullName: describeBlock,
                describePath: [],
                lineNumber: 0,
            };
            console.log(`指定のdescribeブロックで実行: ${describeBlock}`);
            await debugger_1.JestDebugger.startDebugging(absoluteFilePath, mockTestCase, targetPackage);
        }
        else {
            // ファイル全体を実行
            console.log(`ファイル全体を実行: ${fileName}`);
            await debugger_1.JestDebugger.startDebuggingAllTests(absoluteFilePath, targetPackage);
        }
    }
    catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`エラー: ${error.message}`);
            console.error("Run test file error:", error);
            // extensionUriを取得
            const extension = vscode.extensions.all.find((e) => e.id.endsWith("jest-test-selector"));
            if (extension?.extensionUri) {
                testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState(error.message);
            }
        }
        else {
            vscode.window.showErrorMessage("予期しないエラーが発生しました");
            console.error("Unknown error in run test file:", error);
            const extension = vscode.extensions.all.find((e) => e.id.endsWith("jest-test-selector"));
            if (extension?.extensionUri) {
                testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState("予期しないエラーが発生しました");
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
            : path.resolve(vscode.workspace.workspaceFolders?.[0].uri.fsPath || "", filePath);
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
            vscode.window.showErrorMessage("テスト実行対象のパッケージが見つかりません");
            return;
        }
        console.log(`Target package: ${targetPackage.name}, ${targetPackage.path}`);
        // テスト実行（常に絶対パスを使用）
        await debugger_1.JestDebugger.startDebugging(absoluteFilePath, testCase, targetPackage);
    }
    catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`エラー: ${error.message}`);
            console.error("Run specific test error:", error);
            // extensionUriを取得
            const extension = vscode.extensions.all.find((e) => e.id.endsWith("jest-test-selector"));
            if (extension?.extensionUri) {
                testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState(error.message);
            }
        }
        else {
            vscode.window.showErrorMessage("予期しないエラーが発生しました");
            console.error("Unknown error in run specific test:", error);
            const extension = vscode.extensions.all.find((e) => e.id.endsWith("jest-test-selector"));
            if (extension?.extensionUri) {
                testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState("予期しないエラーが発生しました");
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
        const config = vscode.workspace.getConfiguration("jestTestSelector");
        const packageManager = config.get("packageManager") || "pnpm";
        targetPackage = {
            name: path.basename(workspaceFolder.uri.fsPath),
            path: workspaceFolder.uri.fsPath,
            hasTestScript: true, // 仮定
            packageManager: packageManager,
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
// 拡張機能が無効化されたときに実行される関数
function deactivate() {
    console.log('拡張機能 "jest-test-selector" が無効化されました');
}
//# sourceMappingURL=extension.js.map