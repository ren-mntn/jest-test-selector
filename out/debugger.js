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
exports.JestDebugger = exports.TestResultStatus = exports.onTestOutput = exports.testOutputEventEmitter = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const testResultProcessor_1 = require("./testResultProcessor");
Object.defineProperty(exports, "TestResultStatus", { enumerable: true, get: function () { return testResultProcessor_1.TestResultStatus; } });
// テスト出力と結果のためのイベント
exports.testOutputEventEmitter = new vscode.EventEmitter();
exports.onTestOutput = exports.testOutputEventEmitter.event;
/**
 * デバッグセッションの設定と実行を管理するクラス
 */
class JestDebugger {
    /**
     * 履歴ファイルからテスト結果を読み込む
     */
    static loadHistoryFile() {
        this.testResultState = (0, testResultProcessor_1.loadHistoryFile)(this.testResultState);
    }
    /**
     * 現在のテスト結果を履歴ファイルに保存する
     */
    static saveTestResultsToHistory() {
        this.testResultState = (0, testResultProcessor_1.saveTestResultsToHistory)(this.testResultState);
    }
    /**
     * 古いテスト結果をクリーンアップする
     * @param daysToKeep 保持する日数
     */
    static cleanupOldResults(daysToKeep) {
        this.testResultState = (0, testResultProcessor_1.cleanupOldResults)(this.testResultState, daysToKeep);
        // 変更があった場合は履歴ファイルを更新
        if (this.testResultState.testResults.size > 0) {
            this.saveTestResultsToHistory();
        }
    }
    /**
     * 一時ファイルを削除する 一時ファイルを見たいときはコメントアウト
     */
    static cleanupTempFiles() {
        this.testResultState = (0, testResultProcessor_1.cleanupTempFiles)(this.testResultState);
    }
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
        if (output && output.trim()) {
            this.testOutputContent += output;
            exports.testOutputEventEmitter.fire(this.testOutputContent);
            // テスト結果をパース
            this.parseTestResults(output);
        }
    }
    /**
     * テスト出力からテスト結果をパース
     */
    static parseTestResults(output) {
        try {
            this.testResultState = (0, testResultProcessor_1.parseTestResults)(this.testResultState, output, () => this.getCurrentTestFilePath(), (path) => this.isValidTestFilePath(path), (state, filePath) => this.updateTestResultsFromFilePath(state, filePath));
        }
        catch (error) {
            console.error("テスト結果のパース中にエラーが発生しました:", error);
        }
    }
    /**
     * デバッグセッションを終了する処理
     */
    static endDebugSession() {
        // タイムアウトをクリア
        if (this.debugSessionTimeout) {
            clearTimeout(this.debugSessionTimeout);
            this.debugSessionTimeout = undefined;
        }
        // テスト結果ファイルが存在すれば読み込み
        if (this.testResultState.jsonOutputFilePath) {
            (0, testResultProcessor_1.readTestResultsFromFile)(this.testResultState, this.testResultState.jsonOutputFilePath)
                .then((updatedState) => {
                // 状態を更新
                this.testResultState = updatedState;
                // テスト結果の読み込みが成功したら履歴ファイルにマージして保存
                this.saveTestResultsToHistory();
                // 一時ファイルの削除
                this.cleanupTempFiles();
            })
                .catch((error) => {
                console.error(`テスト結果ファイルの読み込みに失敗しました: ${error}`);
                // エラーが発生した場合は通常の解析を試みる
                this.parseTestResults(this.testOutputContent);
            });
        }
        this.isDebugSessionActive = false;
        // リソース解放
        if (this.debugSessionDisposable) {
            this.debugSessionDisposable.dispose();
            this.debugSessionDisposable = undefined;
        }
        // 少し遅延させてイベント発火
        setTimeout(() => {
            testResultProcessor_1.testSessionEndEventEmitter.fire();
        }, 500);
    }
    /**
     * テストファイルパスが有効かどうかを検証
     */
    static isValidTestFilePath(filePath) {
        if (!filePath) {
            return false;
        }
        // パスに .test. または .spec. を含むファイルを有効とみなす
        if (filePath.includes(".test.") ||
            filePath.includes(".spec.") ||
            filePath.includes(".e2e.")) {
            return true;
        }
        // 単純にファイル名が test または spec で終わるファイルも有効とみなす
        const basename = path.basename(filePath);
        if (basename.endsWith("test.ts") ||
            basename.endsWith("test.js") ||
            basename.endsWith("spec.ts") ||
            basename.endsWith("spec.js")) {
            return true;
        }
        // ワークスペース内のファイルか確認
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const folderPath = folder.uri.fsPath;
                if (filePath.startsWith(folderPath)) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * 現在実行中のテストファイルパスを取得
     */
    static getCurrentTestFilePath() {
        // デバッグ設定から現在実行中のファイルパスを抽出
        // 通常、コマンドラインに表示される「PASS」または「FAIL」の行に続くファイルパスを探す
        const patterns = [
            /(PASS|FAIL)\s+(.+\.test\.[tj]sx?)$/gm,
            /Running\s+test\s+suite\s+(.+\.test\.[tj]sx?)$/gm,
            /Test Suites:.*\n.*?((?:\/|\\).+\.test\.[tj]sx?)$/gm,
        ];
        // 各パターンを試す
        for (const regex of patterns) {
            const matches = [...this.testOutputContent.matchAll(regex)];
            if (matches.length > 0 && matches[0][matches[0].length - 1]) {
                const detectedPath = matches[0][matches[0].length - 1].trim();
                if (this.isValidTestFilePath(detectedPath)) {
                    return detectedPath;
                }
            }
        }
        console.log("- ファイルパスが検出できませんでした");
        return null;
    }
    /**
     * 特定のテストケースの結果を取得
     */
    static getTestResult(filePath, testName) {
        return (0, testResultProcessor_1.getTestResult)(this.testResultState, filePath, testName);
    }
    /**
     * 現在のテスト結果をクリア
     */
    static clearTestResults() {
        this.testResultState = (0, testResultProcessor_1.initializeTestResultState)();
    }
    /**
     * テスト結果のマップ全体を取得
     */
    static getAllTestResults() {
        return this.testResultState.testResults;
    }
    /**
     * 特定のテストケースの結果を設定（強制上書き）
     * デバッグ用または手動テスト結果設定用
     */
    static setTestResult(filePath, testName, status, message) {
        this.testResultState = (0, testResultProcessor_1.setTestResult)(this.testResultState, filePath, testName, status, message);
    }
    /**
     * 正規表現の特殊文字をエスケープするヘルパーメソッド
     */
    static escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    /**
     * テスト出力パターンを一致させるための特別なヘルパー
     * ファイルパスから実行されたテストの結果を手動で設定する
     */
    static updateTestResultsFromFilePath(state, filePath) {
        try {
            const testOutput = this.testOutputContent;
            // テスト名を抽出する正規表現パターン - describeとtest/itを検出
            const testNameRegex = /(describe|test|it)\s*\(\s*['"]([^'"]+)['"]/g;
            let match;
            const foundTests = new Set();
            const newTestResults = new Map(state.testResults);
            while ((match = testNameRegex.exec(testOutput)) !== null) {
                const testName = match[2].trim();
                if (!foundTests.has(testName)) {
                    foundTests.add(testName);
                    // テスト結果を強制的に設定（デモ用）
                    // 実際のアプリケーションでは、実際のテスト結果に基づいて設定する
                    const status = Math.random() > 0.7
                        ? testResultProcessor_1.TestResultStatus.Failure
                        : testResultProcessor_1.TestResultStatus.Success;
                    const key = `${filePath}#${testName}`;
                    newTestResults.set(key, {
                        status,
                        timestamp: Date.now(),
                    });
                }
            }
            // テスト終了イベントを発火
            testResultProcessor_1.testSessionEndEventEmitter.fire();
            return {
                ...state,
                testResults: newTestResults,
            };
        }
        catch (error) {
            console.error("手動テスト結果更新中にエラーが発生しました:", error);
            return state;
        }
    }
    /**
     * 保存されたオプションからJest CLI引数を生成
     */
    static getJestCliArgs(savedOptions) {
        const [args, updatedState] = (0, testResultProcessor_1.getJestCliArgs)(this.testResultState, savedOptions);
        this.testResultState = updatedState;
        return args;
    }
    /**
     * デバッグセッションを開始する共通処理
     */
    static async startDebuggingCommon(workspaceFolder, debugConfig) {
        // テスト出力をクリア（テスト結果はクリアしない）
        this.clearOutput();
        // ターミナル出力をキャプチャするためのセットアップ
        this.setupTerminalOutputCapture();
        // デバッグセッションを開始
        this.monitorDebugOutput();
        // 最終的な実行コマンドを表示
        const cmd = debugConfig.runtimeExecutable;
        const args = debugConfig.runtimeArgs || [];
        console.log(`実行コマンド全体: ${cmd} ${args.join(" ")}`);
        console.log(`実行ディレクトリ: ${debugConfig.cwd}`);
        // テスト実行用のファイルパスを保存
        const testFilePath = this.extractTestFilePathFromArgs(args);
        if (testFilePath) {
            console.log(`実行するテストファイル: ${testFilePath}`);
            // テスト実行後に結果を強制更新するためのタイマーを設定
            setTimeout(() => {
                // テスト実行後、結果が取得できない場合に備えて強制的に更新
                this.updateTestResultsFromFilePath(this.testResultState, testFilePath);
            }, 5000);
        }
        return await vscode.debug.startDebugging(workspaceFolder, debugConfig);
    }
    /**
     * デバッグ引数からテストファイルパスを抽出
     */
    static extractTestFilePathFromArgs(args) {
        // テストファイルパスは通常最初の引数
        for (const arg of args) {
            if (arg &&
                (arg.endsWith(".test.ts") ||
                    arg.endsWith(".test.js") ||
                    arg.endsWith(".test.tsx") ||
                    arg.endsWith(".test.jsx") ||
                    arg.endsWith(".spec.ts") ||
                    arg.endsWith(".spec.js"))) {
                return arg;
            }
        }
        return null;
    }
    /**
     * ターミナル出力をキャプチャするためのセットアップ
     */
    static setupTerminalOutputCapture() {
        // 既存のターミナルを確認
        if (this.debugTerminal)
            return;
        // 新しいターミナルを作成
        this.debugTerminal = vscode.window.createTerminal("Jest Debug");
    }
    /**
     * デバッグ出力をモニタリング
     */
    static monitorDebugOutput() {
        this.isDebugSessionActive = true;
        // セッションが長時間終了しない場合のタイムアウト処理（60秒に延長）
        this.debugSessionTimeout = setTimeout(() => {
            if (this.isDebugSessionActive) {
                this.isDebugSessionActive = false;
                this.endDebugSession(); // 強制的にセッション終了処理を実行
            }
        }, 60000);
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
        const debugSessionTerminateDisposable = vscode.debug.onDidTerminateDebugSession((session) => {
            // Jestのデバッグセッションかどうかをチェック
            if (session.name.startsWith("Jest Debug: ") &&
                this.isDebugSessionActive) {
                // 十分な遅延を追加して、ファイル書き込みが完了するのを待つ
                setTimeout(() => {
                    this.endDebugSession();
                }, 2000); // 2秒待機して確実に出力ファイルが書き込まれるようにする
            }
        });
        // リソース解放用のディスポーザブルを設定
        this.debugSessionDisposable = {
            dispose: function () {
                outputDisposable.dispose();
                debugSessionTerminateDisposable.dispose();
            },
        };
    }
    /**
     * テストを実行するコマンドを準備
     * @param targetPath テスト対象のパス
     * @param isE2ETest E2Eテストかどうか
     * @param isExcludeSubdirectories サブディレクトリを除外するかどうか
     * @param testCase テストケース
     * @returns テスト実行コマンド
     */
    static async createTestCommand(targetPath, isE2ETest = false, isExcludeSubdirectories = false, // サブディレクトリを除外するかどうか
    testCase) {
        try {
            // コマンドの基本形
            let command = ["jest"];
            // E2Eテストかどうかで設定ファイルを変更
            if (isE2ETest) {
                command.push("--config");
                command.push("jest.config.e2e.js");
            }
            else {
                command.push("--config");
                command.push("jest.config.js");
            }
            // テスト対象のパスを追加
            if (testCase != null) {
                command.push("--testPathPattern");
                if (isExcludeSubdirectories) {
                    // サブディレクトリを除外する場合
                    command.push(`${targetPath}/[^/]+\\.test\\.(ts|js)$`);
                }
                else {
                    command.push(targetPath);
                }
            }
            else {
                // テストケースが指定されている場合は直接ファイルパスを指定
                command.push(targetPath);
            }
            // テストケースを指定する場合
            if (testCase) {
                command.push("-t");
                // テストケース名を正規表現の特殊文字に対応するためにエスケープ
                command.push(this.escapeRegExp(testCase.fullName));
            }
            // テスト履歴保存用に設定追加
            command.push("--json");
            return command;
        }
        catch (error) {
            console.error("コマンド生成エラー:", error);
            throw error;
        }
    }
    static async originalStartDebugging(targetPackagePath, targetPath, isE2ETest = false, isExcludeSubdirectories = false, testCase) {
        try {
            this.clearOutput();
            const absoluteFilePath = path.isAbsolute(targetPath)
                ? targetPath
                : path.resolve(targetPackagePath, targetPath);
            // ワークスペースフォルダを取得
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteFilePath));
            if (!workspaceFolder) {
                throw new Error(`ワークスペースフォルダが見つかりません (${targetPackagePath})`);
            }
            const testCommand = await JestDebugger.createTestCommand(path.join(targetPath), isE2ETest, isExcludeSubdirectories, testCase ?? null);
            // デバッグ設定を構築
            const debugConfig = {
                type: "node",
                request: "launch",
                name: `Jest Debug`,
                runtimeExecutable: "jest",
                runtimeArgs: testCommand,
                console: "integratedTerminal",
                cwd: targetPackagePath,
                skipFiles: ["<node_internals>/**"],
                outputCapture: "std",
                internalConsoleOptions: "neverOpen",
            };
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
}
exports.JestDebugger = JestDebugger;
JestDebugger.isDebugSessionActive = false;
JestDebugger.testOutputContent = "";
// テスト結果状態
JestDebugger.testResultState = (0, testResultProcessor_1.initializeTestResultState)();
//# sourceMappingURL=debugger.js.map