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
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
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
        this.testOutputContent = "";
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
        // 最終的な実行コマンドを表示
        const cmd = debugConfig.runtimeExecutable;
        const args = debugConfig.runtimeArgs || [];
        console.log(`実行コマンド全体: ${cmd} ${args.join(" ")}`);
        console.log(`実行ディレクトリ: ${debugConfig.cwd}`);
        // コマンドのエスケープ状況を確認するための詳細ログ
        for (let i = 0; i < args.length; i++) {
            console.log(`引数[${i}]: "${args[i]}"`);
        }
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
            console.log(`Is absolute: ${path.isAbsolute(absoluteFilePath)}`);
            // e2eテストかどうかを判定
            const isE2ETest = absoluteFilePath.endsWith(".e2e.test.ts");
            console.log(`Is E2E test: ${isE2ETest}`);
            // ワークスペースフォルダを取得
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteFilePath));
            if (!workspaceFolder) {
                throw new Error(`ワークスペースフォルダが見つかりません (${absoluteFilePath})`);
            }
            console.log(`Workspace folder: ${workspaceFolder.uri.fsPath}`);
            // 設定から実行オプションを取得
            const config = vscode.workspace.getConfiguration("jestTestSelector");
            const jestExecutableSetting = config.get("jestExecutable", "npx jest"); // 設定値を取得 (例: "npx jest")
            // 設定値を実行可能ファイルと引数に分割
            const [executable, ...initialArgs] = jestExecutableSetting.split(" ");
            if (!executable) {
                throw new Error(`Invalid jestExecutable setting: ${jestExecutableSetting}`);
            }
            // 保存されたCLIオプションを取得
            const savedOptions = config.get("cliOptions") || {};
            const cliArgs = this.getJestCliArgs(savedOptions);
            // 直接 Jest コマンドの引数を構築
            const runtimeArgs = [
                absoluteFilePath, // 常に絶対パスを使用
            ];
            // "All Tests"の場合は-tフラグを使わない
            if (!testCase.isAllTests) {
                // テスト名を完全一致させるための正規表現パターンを作成
                const exactMatchPattern = this.createExactMatchPattern(testCase.name);
                runtimeArgs.push("-t", `${exactMatchPattern}`);
            }
            // E2Eテストかどうかに基づいて設定ファイルを追加
            if (isE2ETest) {
                runtimeArgs.push("--config", "jest.config.e2e.js");
            }
            else {
                runtimeArgs.push("--config", "jest.config.js");
            }
            // カスタムCLIオプションを追加
            runtimeArgs.push(...cliArgs);
            // ★変更: 実行可能ファイル(npx)と引数(jest ...)を結合
            const finalRuntimeArgs = [...initialArgs, ...runtimeArgs];
            const commandString = `${executable} ${finalRuntimeArgs.join(" ")}`; // ★ executable と finalRuntimeArgs を使用
            console.log(`テスト実行コマンド: ${commandString}`);
            console.log(`実行引数の配列: ${JSON.stringify(finalRuntimeArgs)}`);
            // デバッグ設定を構築
            const debugConfig = {
                type: "node",
                request: "launch",
                name: `Jest Debug: ${testCase.fullName}`,
                runtimeExecutable: executable, // ★変更: npx など
                runtimeArgs: finalRuntimeArgs, // ★変更: jest + ファイルパス + オプション
                console: "integratedTerminal", // ターミナルを使用
                cwd: packageInfo.path,
                skipFiles: ["<node_internals>/**"],
                outputCapture: "std", // 標準出力とエラー出力をキャプチャ
                internalConsoleOptions: "neverOpen", // デバッグコンソールは自動的に開かない
                // 重要: jestExecutable が node_modules/.bin/jest のような相対パスの場合、
                // `program` を設定する必要があるかもしれない
                // program: path.resolve(workspaceFolder.uri.fsPath, executable), // 必要に応じて
            };
            console.log(`デバッグ設定: ${JSON.stringify(debugConfig, null, 2)}`);
            return await this.startDebuggingCommon(workspaceFolder, debugConfig);
        }
        catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`デバッグ開始エラー: ${error.message}`);
                console.error("Debug start error:", error);
            }
            else {
                vscode.window.showErrorMessage("デバッグセッションの開始に失敗しました");
                console.error("Unknown debug start error:", error);
            }
            return false;
        }
    }
    /**
     * テスト名を完全一致させるための正規表現パターンを作成
     */
    static createExactMatchPattern(testName) {
        // Jestのテスト名完全一致パターン（ドキュメント推奨の形式）
        // https://jestjs.io/docs/cli#--testnamepatternregex
        // 正規表現で完全一致させるために^と$を使用
        return this.escapeRegExp(testName);
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
            console.log(`Is absolute: ${path.isAbsolute(absoluteFilePath)}`);
            // e2eテストかどうかを判定
            const isE2ETest = absoluteFilePath.endsWith(".e2e.test.ts");
            console.log(`Is E2E test: ${isE2ETest}`);
            // ワークスペースフォルダを取得
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteFilePath));
            if (!workspaceFolder) {
                throw new Error(`ワークスペースフォルダが見つかりません (${absoluteFilePath})`);
            }
            console.log(`Workspace folder: ${workspaceFolder.uri.fsPath}`);
            // 設定から実行オプションを取得
            const config = vscode.workspace.getConfiguration("jestTestSelector");
            const jestExecutableSetting = config.get("jestExecutable", "npx jest"); // 設定値を取得 (例: "npx jest")
            // 設定値を実行可能ファイルと引数に分割
            const [executable, ...initialArgs] = jestExecutableSetting.split(" ");
            if (!executable) {
                throw new Error(`Invalid jestExecutable setting: ${jestExecutableSetting}`);
            }
            // 保存されたCLIオプションを取得
            const savedOptions = config.get("cliOptions") || {};
            const cliArgs = this.getJestCliArgs(savedOptions);
            // 直接 Jest コマンドの引数を構築
            const runtimeArgs = [
                absoluteFilePath, // 常に絶対パスを使用
            ];
            // E2Eテストかどうかに基づいて設定ファイルを追加
            if (isE2ETest) {
                runtimeArgs.push("--config", "jest.config.e2e.js");
            }
            else {
                runtimeArgs.push("--config", "jest.config.js");
            }
            // カスタムCLIオプションを追加
            runtimeArgs.push(...cliArgs);
            // ★変更: 実行可能ファイル(npx)と引数(jest ...)を結合
            const finalRuntimeArgs = [...initialArgs, ...runtimeArgs];
            const commandString = `${executable} ${finalRuntimeArgs.join(" ")}`; // ★ executable と finalRuntimeArgs を使用
            console.log(`テスト実行コマンド: ${commandString}`);
            console.log(`実行引数の配列: ${JSON.stringify(finalRuntimeArgs)}`);
            // デバッグ設定を構築
            const debugConfig = {
                type: "node",
                request: "launch",
                name: `Jest Debug All: ${path.basename(testFilePath)}`,
                runtimeExecutable: executable, // ★変更: npx など
                runtimeArgs: finalRuntimeArgs, // ★変更: jest + ファイルパス + オプション
                console: "integratedTerminal",
                cwd: packageInfo.path,
                skipFiles: ["<node_internals>/**"],
                outputCapture: "std",
                internalConsoleOptions: "neverOpen",
                // 重要: jestExecutable が node_modules/.bin/jest のような相対パスの場合、
                // `program` を設定する必要があるかもしれない
                // program: path.resolve(workspaceFolder.uri.fsPath, executable), // 必要に応じて
            };
            console.log(`デバッグ設定: ${JSON.stringify(debugConfig, null, 2)}`);
            return await this.startDebuggingCommon(workspaceFolder, debugConfig);
        }
        catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`デバッグ開始エラー: ${error.message}`);
                console.error("Debug start error:", error);
            }
            else {
                vscode.window.showErrorMessage("デバッグセッションの開始に失敗しました");
                console.error("Unknown debug start error:", error);
            }
            return false;
        }
    }
    /**
     * ディレクトリ内のすべてのテストを実行する
     * @param directoryPath テストを実行するディレクトリのパス
     * @param packageInfo 対象のパッケージ情報
     * @param isE2EOnly E2Eテストのみを実行するかどうか（trueの場合はE2Eテストのみ、falseの場合は通常のテストのみ、省略時は両方）
     */
    static async startDebuggingDirectoryTests(directoryPath, packageInfo, isE2EOnly) {
        try {
            this.clearOutput();
            console.log(`Starting debugging all tests in directory: ${directoryPath}, package path: ${packageInfo.path}, E2E only: ${isE2EOnly}`);
            // 絶対パスを構築
            const absoluteDirPath = path.isAbsolute(directoryPath)
                ? directoryPath
                : path.resolve(packageInfo.path, directoryPath);
            console.log(`Absolute directory path: ${absoluteDirPath}`);
            // ワークスペースフォルダを取得
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteDirPath));
            if (!workspaceFolder) {
                throw new Error(`ワークスペースフォルダが見つかりません (${absoluteDirPath})`);
            }
            console.log(`Workspace folder: ${workspaceFolder.uri.fsPath}`);
            // 設定から実行オプションを取得
            const config = vscode.workspace.getConfiguration("jestTestSelector");
            const jestExecutableSetting = config.get("jestExecutable", "npx jest"); // 設定値を取得 (例: "npx jest")
            // 設定値を実行可能ファイルと引数に分割
            const [executable, ...initialArgs] = jestExecutableSetting.split(" ");
            if (!executable) {
                throw new Error(`Invalid jestExecutable setting: ${jestExecutableSetting}`);
            }
            // 保存されたCLIオプションを取得
            const savedOptions = config.get("cliOptions") || {};
            const cliArgs = this.getJestCliArgs(savedOptions);
            // ディレクトリパスを指定し、サブディレクトリを除外するためのパターンを追加
            const runtimeArgs = [];
            // テストパターンを作成（E2Eテストか通常テストかで分ける）
            let testPattern;
            if (isE2EOnly === true) {
                // E2Eテストのみのパターン
                testPattern = `${this.escapeRegExpForPath(absoluteDirPath)}/[^/]+\.e2e\.test\.(ts|js)$`;
            }
            else {
                // 通常テストのみのパターン - 単純に.test.tsファイルを検出し、E2Eテストは後で除外
                testPattern = `${this.escapeRegExpForPath(absoluteDirPath)}/[^/]+\.test\.(ts|js)$`;
            }
            console.log(`生成されたテストパターン: ${testPattern}`);
            // テストパターンを引数に追加
            runtimeArgs.push("--testPathPattern", testPattern);
            // E2Eテストかどうかに基づいて設定ファイルを追加
            if (isE2EOnly === true) {
                // E2Eテストの場合は必ずE2E用の設定を使用
                runtimeArgs.push("--config", "jest.config.e2e.js");
            }
            else if (isE2EOnly === false) {
                // 通常テストの場合は通常設定を使用
                runtimeArgs.push("--config", "jest.config.js");
            }
            else {
                // 両方実行する場合（これは実際には使われない想定）
                const includesE2ETests = testPattern.includes(".e2e.test.");
                if (includesE2ETests) {
                    runtimeArgs.push("--config", "jest.config.e2e.js");
                }
                else {
                    runtimeArgs.push("--config", "jest.config.js");
                }
            }
            // カスタムCLIオプションを追加
            runtimeArgs.push(...cliArgs);
            // 実行可能ファイル(npx)と引数(jest ...)を結合
            const finalRuntimeArgs = [...initialArgs, ...runtimeArgs];
            const commandString = `${executable} ${finalRuntimeArgs.join(" ")}`;
            console.log(`ディレクトリテスト実行コマンド: ${commandString}`);
            console.log(`実行引数の配列: ${JSON.stringify(finalRuntimeArgs)}`);
            // デバッグ設定を構築
            const debugConfig = {
                type: "node",
                request: "launch",
                name: `Jest Debug Directory: ${path.basename(directoryPath)}`,
                runtimeExecutable: executable,
                runtimeArgs: finalRuntimeArgs,
                console: "integratedTerminal",
                cwd: packageInfo.path,
                skipFiles: ["<node_internals>/**"],
                outputCapture: "std",
                internalConsoleOptions: "neverOpen",
            };
            console.log(`デバッグ設定: ${JSON.stringify(debugConfig, null, 2)}`);
            return await this.startDebuggingCommon(workspaceFolder, debugConfig);
        }
        catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`デバッグ開始エラー: ${error.message}`);
                console.error("Debug start error:", error);
            }
            else {
                vscode.window.showErrorMessage("デバッグセッションの開始に失敗しました");
                console.error("Unknown debug start error:", error);
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
        this.debugTerminal = vscode.window.createTerminal("Jest Debug Terminal");
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
                console.log("Debug session timeout reached, forcing session end");
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
            if (event.event === "output" && event.body) {
                const outputEvent = event.body;
                if (outputEvent.category === "stdout" ||
                    outputEvent.category === "stderr") {
                    // 無限ループを防ぐため、ログ出力は最小限に抑える
                    this.appendOutput(outputEvent.output);
                }
            }
        });
        // デバッグセッション開始時に出力をキャプチャするための準備
        if (this.debugTerminal) {
            console.log("Debug terminal is ready for output capture");
            // バックグラウンドでデバッグセッションの実行を監視
            // 注：VSCodeのAPIにはターミナル出力を直接キャプチャする方法がないため、
            // デバッグイベントに依存して出力を取得します
        }
        // デバッグセッション終了時の処理
        const debugSessionTerminateDisposable = vscode.debug.onDidTerminateDebugSession((session) => {
            // Jestのデバッグセッションかどうかをチェック
            if (session.name.startsWith("Jest Debug: ") &&
                this.isDebugSessionActive) {
                // 少し待ってから終了処理を行う
                setTimeout(() => {
                    // タイムアウトをクリア
                    if (this.debugSessionTimeout) {
                        clearTimeout(this.debugSessionTimeout);
                        this.debugSessionTimeout = undefined;
                    }
                    this.isDebugSessionActive = false;
                    console.log("Debug session ended:", session.name);
                    // テスト実行が完了したことをユーザーに通知
                    // 出力がない場合は終了メッセージを追加
                    if (this.testOutputContent.trim() === "") {
                        this.appendOutput("\nテストの実行が完了しましたが、出力が取得できませんでした。\n");
                        this.appendOutput("詳細な結果はターミナルを確認してください。\n");
                    }
                    else {
                        this.appendOutput("\nテスト実行が完了しました。\n");
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
            },
        };
    }
    /**
     * 正規表現のために文字列をエスケープし、サフィックス一致パターンを生成する
     * @param string エスケープする文字列
     * @returns サフィックス一致の正規表現パターン文字列
     */
    static escapeRegExp(string) {
        // 基本的な正規表現の特殊文字をエスケープ
        const escapedString = string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // サフィックス一致のための$を追加（先頭の^は追加しない）
        return `${escapedString}$`;
    }
    /**
     * 保存されたオプションからJest CLI引数を生成
     */
    static getJestCliArgs(savedOptions) {
        const args = [];
        // オプションを文字列配列に変換
        Object.entries(savedOptions).forEach(([key, value]) => {
            // キーが有効なフラグ形式かチェック
            if (!key.startsWith("--")) {
                console.warn(`Invalid Jest CLI option key: ${key}`);
                return;
            }
            // 真偽値オプション
            if (typeof value === "boolean") {
                if (value) {
                    args.push(key);
                }
            }
            // 文字列オプション
            else if (typeof value === "string" && value.trim() !== "") {
                args.push(key, value);
            }
            // 数値オプション
            else if (typeof value === "number") {
                args.push(key, value.toString());
            }
        });
        console.log(`Jest CLI args: ${args.join(" ")}`);
        return args;
    }
    /**
     * パスをエスケープするための正規表現パターンを生成
     * @param path エスケープするパス
     * @returns エスケープされたパスの正規表現パターン文字列
     */
    static escapeRegExpForPath(path) {
        // パスの一部をエスケープするための正規表現パターンを作成
        return path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    /**
     * カスタムコマンドを使用してデバッグセッションを開始する
     */
    static async startDebuggingWithCustomCommand(directoryPath, packageInfo, customCommand, displayName) {
        try {
            this.clearOutput();
            console.log(`Starting debugging with custom command for: ${directoryPath}, command: ${customCommand}`);
            // 絶対パスを構築
            const absoluteDirPath = path.isAbsolute(directoryPath)
                ? directoryPath
                : path.resolve(packageInfo.path, directoryPath);
            // ワークスペースフォルダを取得
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteDirPath));
            if (!workspaceFolder) {
                throw new Error(`ワークスペースフォルダが見つかりません (${absoluteDirPath})`);
            }
            // VS Codeのデバッグに必要な環境変数
            const nodeOptions = "--require /Applications/Cursor.app/Contents/Resources/app/extensions/ms-vscode.js-debug/src/bootloader.js --inspect-publish-uid=http";
            // 一意のセッションIDを生成
            const sessionId = Math.floor(Math.random() * 100000);
            const inspectorOptions = `:::{"inspectorIpc":"/var/folders/nj/gsm1ftq52g757vhzttjntq_80000gn/T/node-cdp.${sessionId}-${Math.random()
                .toString(36)
                .substring(2)}.sock","deferredMode":false,"waitForDebugger":"","execPath":"${process.execPath}","onlyEntrypoint":false,"autoAttachMode":"always"}`;
            // シェルの種類を特定（Windows環境とそれ以外で分ける）
            const isWindows = process.platform === "win32";
            // 最終的なコマンドを構築（エスケープを最小限に抑えるためにenvコマンドを使用）
            let shellExecutable;
            let shellArgs;
            if (isWindows) {
                shellExecutable = "cmd.exe";
                shellArgs = ["/c", customCommand];
            }
            else {
                shellExecutable = "/usr/bin/env";
                // 実行コマンドとしてbashを直接使わず、環境変数とコマンドを渡す
                shellArgs = [
                    "NODE_OPTIONS=" + nodeOptions,
                    "VSCODE_INSPECTOR_OPTIONS=" + inspectorOptions,
                    "bash",
                    "-c",
                    customCommand,
                ];
            }
            // デバッグ設定を構築
            const debugConfig = {
                type: "node",
                request: "launch",
                name: `Jest Debug: ${displayName}`,
                runtimeExecutable: shellExecutable,
                runtimeArgs: shellArgs,
                console: "integratedTerminal",
                cwd: packageInfo.path,
                skipFiles: ["<node_internals>/**"],
                outputCapture: "std",
                internalConsoleOptions: "neverOpen",
            };
            console.log(`デバッグ設定: ${JSON.stringify(debugConfig, null, 2)}`);
            return await this.startDebuggingCommon(workspaceFolder, debugConfig);
        }
        catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`デバッグ開始エラー: ${error.message}`);
                console.error("Debug start error:", error);
            }
            else {
                vscode.window.showErrorMessage("デバッグセッションの開始に失敗しました");
                console.error("Unknown debug start error:", error);
            }
            return false;
        }
    }
    /**
     * ディレクトリテスト実行コマンドを準備する
     */
    static async prepareDirectoryTestCommand(dirPath, packageInfo, isE2EOnly) {
        // 実行設定を取得
        const config = vscode.workspace.getConfiguration("jestTestSelector");
        const jestExecutableSetting = config.get("jestExecutable", "npx jest");
        const [executable, ...executableArgs] = jestExecutableSetting.split(" ");
        // パッケージマネージャに応じてコマンドを構築
        // 絶対パスに変換
        const absoluteDirPath = path.isAbsolute(dirPath)
            ? dirPath
            : path.resolve(vscode.workspace.workspaceFolders?.[0].uri.fsPath || "", dirPath);
        // Jest CLIオプションを取得
        const savedOptions = config.get("cliOptions") || {};
        const cliArgs = this.getJestCliArgs(savedOptions);
        // E2Eテストかどうかでコンフィグファイルを変更
        const configFile = isE2EOnly ? "jest.config.e2e.js" : "jest.config.js";
        // テストパターンを構築
        // 相対パスを使ってtestMatchパターンを使用する
        // （絶対パスを使わないことでエスケープ問題を回避）
        const relativeTestDir = "src"; // 通常testsは srcディレクトリ内にある
        // コマンド構築
        // cd でパッケージのディレクトリに移動してから実行
        return `cd ${packageInfo.path} && ${executable} ${executableArgs.join(" ")} ${relativeTestDir} --config ${configFile} ${cliArgs.join(" ")}`;
    }
}
exports.JestDebugger = JestDebugger;
JestDebugger.testOutputContent = "";
JestDebugger.isDebugSessionActive = false;
//# sourceMappingURL=debugger.js.map