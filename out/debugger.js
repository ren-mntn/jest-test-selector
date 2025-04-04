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
exports.JestDebugger = exports.onTestSessionEnd = exports.testSessionEndEventEmitter = exports.onTestOutput = exports.testOutputEventEmitter = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
// イベントエミッター
exports.testOutputEventEmitter = new vscode.EventEmitter();
exports.onTestOutput = exports.testOutputEventEmitter.event;
exports.testSessionEndEventEmitter = new vscode.EventEmitter();
exports.onTestSessionEnd = exports.testSessionEndEventEmitter.event;
/**
 * デバッグセッションの設定と実行を管理するクラス
 */
class JestDebugger {
    /**
     * テスト出力をクリア
     */
    static clearOutput() {
        this.testOutputContent = '';
    }
    /**
     * テスト出力を追加
     */
    static appendOutput(output) {
        this.testOutputContent += output;
        exports.testOutputEventEmitter.fire(this.testOutputContent);
    }
    /**
     * デバッグセッションを開始する共通処理
     */
    static async startDebuggingCommon(workspaceFolder, debugConfig) {
        // ターミナル出力をキャプチャするためのセットアップ
        this.setupTerminalOutputCapture();
        // デバッグセッションを開始（非同期で出力をモニタリング）
        this.monitorDebugOutput();
        return await vscode.debug.startDebugging(workspaceFolder, debugConfig);
    }
    /**
     * 選択されたテストケースでデバッグセッションを開始する
     * @param testFilePath テストファイルのパス（相対パスまたは絶対パス）
     * @param testCase 実行するテストケース
     * @param packageInfo 対象のパッケージ情報
     */
    static async startDebugging(testFilePath, testCase, packageInfo) {
        try {
            this.clearOutput();
            console.log(`Starting debugging with file path: ${testFilePath}, package path: ${packageInfo.path}`);
            // 絶対パスを構築
            const absoluteFilePath = path.isAbsolute(testFilePath)
                ? testFilePath
                : path.resolve(packageInfo.path, testFilePath);
            console.log(`Absolute file path: ${absoluteFilePath}`);
            // ワークスペースフォルダを取得
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteFilePath));
            if (!workspaceFolder) {
                throw new Error(`ワークスペースフォルダが見つかりません (${absoluteFilePath})`);
            }
            console.log(`Workspace folder: ${workspaceFolder.uri.fsPath}`);
            // 設定から実行オプションを取得
            const config = vscode.workspace.getConfiguration('jestTestSelector');
            const packageManager = packageInfo.packageManager ||
                config.get('packageManager') ||
                'pnpm';
            const testCommand = config.get('testCommand') || 'test';
            // ファイル名のみを取得
            const fileName = path.basename(testFilePath);
            // パッケージマネージャに応じて適切なコマンド引数を構築
            let runtimeArgs;
            if (packageManager === 'pnpm') {
                // pnpmの場合：`pnpm test ファイル名 -t テスト名` 形式を使用
                runtimeArgs = [
                    testCommand,
                    fileName, // ファイル名（拡張子あり）
                    '-t', // テスト名パターンのショートオプション
                    testCase.name, // 引用符なしでテスト名をそのまま渡す
                    '--color', // 色付き出力
                    '--verbose' // 詳細出力
                ];
            }
            else {
                // npmやyarnの場合
                runtimeArgs = [
                    testCommand,
                    '--',
                    fileName,
                    '-t',
                    testCase.name,
                    '--color',
                    '--verbose'
                ];
            }
            // デバッグ設定を構築
            const debugConfig = {
                type: 'node',
                request: 'launch',
                name: `Jest Debug: ${testCase.fullName}`,
                runtimeExecutable: packageManager,
                runtimeArgs,
                console: 'integratedTerminal', // ターミナルを使用
                cwd: packageInfo.path,
                skipFiles: ['<node_internals>/**'],
                outputCapture: 'std', // 標準出力とエラー出力をキャプチャ
                internalConsoleOptions: 'neverOpen' // デバッグコンソールは自動的に開かない
            };
            // 実行前に通知
            vscode.window.showInformationMessage(`テスト「${testCase.name}」を実行します`);
            return await this.startDebuggingCommon(workspaceFolder, debugConfig);
        }
        catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`デバッグ開始エラー: ${error.message}`);
                console.error('Debug start error:', error);
            }
            else {
                vscode.window.showErrorMessage('デバッグセッションの開始に失敗しました');
                console.error('Unknown debug start error:', error);
            }
            return false;
        }
    }
    /**
     * ファイル内のすべてのテストを実行する
     * @param testFilePath テストファイルのパス（相対パスまたは絶対パス）
     * @param packageInfo 対象のパッケージ情報
     */
    static async startDebuggingAllTests(testFilePath, packageInfo) {
        try {
            this.clearOutput();
            console.log(`Starting debugging all tests with file path: ${testFilePath}, package path: ${packageInfo.path}`);
            // 絶対パスを構築
            const absoluteFilePath = path.isAbsolute(testFilePath)
                ? testFilePath
                : path.resolve(packageInfo.path, testFilePath);
            console.log(`Absolute file path: ${absoluteFilePath}`);
            // ワークスペースフォルダを取得
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteFilePath));
            if (!workspaceFolder) {
                throw new Error(`ワークスペースフォルダが見つかりません (${absoluteFilePath})`);
            }
            console.log(`Workspace folder: ${workspaceFolder.uri.fsPath}`);
            // 設定から実行オプションを取得
            const config = vscode.workspace.getConfiguration('jestTestSelector');
            const packageManager = packageInfo.packageManager ||
                config.get('packageManager') ||
                'pnpm';
            const testCommand = config.get('testCommand') || 'test';
            // ファイル名のみを取得
            const fileName = path.basename(testFilePath);
            // パッケージマネージャに応じて適切なコマンド引数を構築
            let runtimeArgs;
            if (packageManager === 'pnpm') {
                // pnpmの場合：`pnpm test ファイル名` 形式を使用（テスト名フィルタなし）
                runtimeArgs = [
                    testCommand,
                    fileName, // ファイル名（拡張子あり）
                    '--color', // 色付き出力
                    '--verbose' // 詳細出力
                ];
            }
            else {
                // npmやyarnの場合
                runtimeArgs = [testCommand, '--', fileName, '--color', '--verbose'];
            }
            // デバッグ設定を構築
            const debugConfig = {
                type: 'node',
                request: 'launch',
                name: `Jest Debug: ${path.basename(testFilePath)} (All Tests)`,
                runtimeExecutable: packageManager,
                runtimeArgs,
                console: 'integratedTerminal', // ターミナルを使用
                cwd: packageInfo.path,
                skipFiles: ['<node_internals>/**'],
                outputCapture: 'std', // 標準出力とエラー出力をキャプチャ
                internalConsoleOptions: 'neverOpen' // デバッグコンソールは自動的に開かない
            };
            // 実行前に通知
            vscode.window.showInformationMessage(`ファイル「${fileName}」内のすべてのテストを実行します`);
            return await this.startDebuggingCommon(workspaceFolder, debugConfig);
        }
        catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`デバッグ開始エラー: ${error.message}`);
                console.error('Debug start error:', error);
            }
            else {
                vscode.window.showErrorMessage('デバッグセッションの開始に失敗しました');
                console.error('Unknown debug start error:', error);
            }
            return false;
        }
    }
    /**
     * ターミナル出力をキャプチャするためのセットアップ
     */
    static setupTerminalOutputCapture() {
        // デバッグに使用するターミナルを作成（既存のターミナルが存在する場合は閉じる）
        if (this.debugTerminal) {
            this.debugTerminal.dispose();
        }
        this.debugTerminal = vscode.window.createTerminal('Jest Debug Terminal');
        this.debugTerminal.show();
    }
    /**
     * デバッグ出力をモニタリング
     */
    static monitorDebugOutput() {
        this.isDebugSessionActive = true;
        // セッションが長時間終了しない場合のタイムアウト処理（30秒）
        this.debugSessionTimeout = setTimeout(() => {
            if (this.isDebugSessionActive) {
                console.log('Debug session timeout reached, forcing session end');
                this.isDebugSessionActive = false;
                exports.testSessionEndEventEmitter.fire();
                // リソース解放
                if (this.debugSessionDisposable) {
                    this.debugSessionDisposable.dispose();
                    this.debugSessionDisposable = undefined;
                }
            }
        }, 30000);
        // VSCodeのデバッグコンソールからの出力をキャプチャ
        const outputDisposable = vscode.debug.onDidReceiveDebugSessionCustomEvent((event) => {
            if (event.event === 'output' && event.body) {
                const outputEvent = event.body;
                if (outputEvent.category === 'stdout' ||
                    outputEvent.category === 'stderr') {
                    // 無限ループを防ぐため、ログ出力は最小限に抑える
                    this.appendOutput(outputEvent.output);
                }
            }
        });
        // デバッグセッション開始時に出力をキャプチャするための準備
        if (this.debugTerminal) {
            console.log('Debug terminal is ready for output capture');
            // バックグラウンドでデバッグセッションの実行を監視
            // 注：VSCodeのAPIにはターミナル出力を直接キャプチャする方法がないため、
            // デバッグイベントに依存して出力を取得します
        }
        // デバッグセッション終了時の処理
        const debugSessionTerminateDisposable = vscode.debug.onDidTerminateDebugSession((session) => {
            // Jestのデバッグセッションかどうかをチェック
            if (session.name.startsWith('Jest Debug: ') &&
                this.isDebugSessionActive) {
                // 少し待ってから終了処理を行う
                setTimeout(() => {
                    // タイムアウトをクリア
                    if (this.debugSessionTimeout) {
                        clearTimeout(this.debugSessionTimeout);
                        this.debugSessionTimeout = undefined;
                    }
                    this.isDebugSessionActive = false;
                    console.log('Debug session ended:', session.name);
                    // テスト実行が完了したことをユーザーに通知
                    // 出力がない場合は終了メッセージを追加
                    if (this.testOutputContent.trim() === '') {
                        this.appendOutput('\nテストの実行が完了しましたが、出力が取得できませんでした。\n');
                        this.appendOutput('詳細な結果はターミナルを確認してください。\n');
                    }
                    else {
                        this.appendOutput('\nテスト実行が完了しました。\n');
                    }
                    // セッション終了イベントを発火
                    exports.testSessionEndEventEmitter.fire();
                    // リソース解放
                    outputDisposable.dispose();
                    debugSessionTerminateDisposable.dispose();
                    if (this.debugSessionDisposable) {
                        this.debugSessionDisposable.dispose();
                        this.debugSessionDisposable = undefined;
                    }
                    // ターミナルをクリーンアップ
                    if (this.debugTerminal) {
                        // ターミナルは残しておく（ユーザーが出力を確認できるように）
                    }
                }, 1000); // 1秒に延長して確実に全ての出力を取得
            }
        });
        // リソース解放用のディスポーザブルを設定
        this.debugSessionDisposable = {
            dispose: () => {
                outputDisposable.dispose();
                debugSessionTerminateDisposable.dispose();
            }
        };
    }
    /**
     * 正規表現のために文字列をエスケープする
     * @param string エスケープする文字列
     * @returns エスケープされた文字列
     */
    static escapeRegExp(string) {
        // 基本的な正規表現の特殊文字をエスケープ
        const escapedString = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 完全一致のための^と$を追加し、引用符で囲む
        return `"^${escapedString}$"`;
    }
}
exports.JestDebugger = JestDebugger;
JestDebugger.testOutputContent = '';
JestDebugger.isDebugSessionActive = false;
//# sourceMappingURL=debugger.js.map