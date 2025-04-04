"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JestDebugger = exports.onTestSessionEnd = exports.testSessionEndEventEmitter = exports.onTestOutput = exports.testOutputEventEmitter = void 0;
var vscode = require("vscode");
var path = require("path");
// イベントエミッター
exports.testOutputEventEmitter = new vscode.EventEmitter();
exports.onTestOutput = exports.testOutputEventEmitter.event;
exports.testSessionEndEventEmitter = new vscode.EventEmitter();
exports.onTestSessionEnd = exports.testSessionEndEventEmitter.event;
/**
 * デバッグセッションの設定と実行を管理するクラス
 */
var JestDebugger = /** @class */ (function () {
    function JestDebugger() {
    }
    /**
     * テスト出力をクリア
     */
    JestDebugger.clearOutput = function () {
        this.testOutputContent = '';
    };
    /**
     * テスト出力を追加
     */
    JestDebugger.appendOutput = function (output) {
        this.testOutputContent += output;
        exports.testOutputEventEmitter.fire(this.testOutputContent);
    };
    /**
     * デバッグセッションを開始する共通処理
     */
    JestDebugger.startDebuggingCommon = function (workspaceFolder, debugConfig) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // ターミナル出力をキャプチャするためのセットアップ
                        this.setupTerminalOutputCapture();
                        // デバッグセッションを開始（非同期で出力をモニタリング）
                        this.monitorDebugOutput();
                        return [4 /*yield*/, vscode.debug.startDebugging(workspaceFolder, debugConfig)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * 選択されたテストケースでデバッグセッションを開始する
     * @param testFilePath テストファイルのパス（相対パスまたは絶対パス）
     * @param testCase 実行するテストケース
     * @param packageInfo 対象のパッケージ情報
     */
    JestDebugger.startDebugging = function (testFilePath, testCase, packageInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var absoluteFilePath, workspaceFolder, config, packageManager, testCommand, fileName, runtimeArgs, debugConfig, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        this.clearOutput();
                        console.log("Starting debugging with file path: ".concat(testFilePath, ", package path: ").concat(packageInfo.path));
                        absoluteFilePath = path.isAbsolute(testFilePath)
                            ? testFilePath
                            : path.resolve(packageInfo.path, testFilePath);
                        console.log("Absolute file path: ".concat(absoluteFilePath));
                        workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteFilePath));
                        if (!workspaceFolder) {
                            throw new Error("\u30EF\u30FC\u30AF\u30B9\u30DA\u30FC\u30B9\u30D5\u30A9\u30EB\u30C0\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093 (".concat(absoluteFilePath, ")"));
                        }
                        console.log("Workspace folder: ".concat(workspaceFolder.uri.fsPath));
                        config = vscode.workspace.getConfiguration('jestTestSelector');
                        packageManager = packageInfo.packageManager ||
                            config.get('packageManager') ||
                            'pnpm';
                        testCommand = config.get('testCommand') || 'test';
                        fileName = path.basename(testFilePath);
                        runtimeArgs = void 0;
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
                        debugConfig = {
                            type: 'node',
                            request: 'launch',
                            name: "Jest Debug: ".concat(testCase.fullName),
                            runtimeExecutable: packageManager,
                            runtimeArgs: runtimeArgs,
                            console: 'integratedTerminal', // ターミナルを使用
                            cwd: packageInfo.path,
                            skipFiles: ['<node_internals>/**'],
                            outputCapture: 'std', // 標準出力とエラー出力をキャプチャ
                            internalConsoleOptions: 'neverOpen' // デバッグコンソールは自動的に開かない
                        };
                        // 実行前に通知
                        vscode.window.showInformationMessage("\u30C6\u30B9\u30C8\u300C".concat(testCase.name, "\u300D\u3092\u5B9F\u884C\u3057\u307E\u3059"));
                        return [4 /*yield*/, this.startDebuggingCommon(workspaceFolder, debugConfig)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_1 = _a.sent();
                        if (error_1 instanceof Error) {
                            vscode.window.showErrorMessage("\u30C7\u30D0\u30C3\u30B0\u958B\u59CB\u30A8\u30E9\u30FC: ".concat(error_1.message));
                            console.error('Debug start error:', error_1);
                        }
                        else {
                            vscode.window.showErrorMessage('デバッグセッションの開始に失敗しました');
                            console.error('Unknown debug start error:', error_1);
                        }
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * ファイル内のすべてのテストを実行する
     * @param testFilePath テストファイルのパス（相対パスまたは絶対パス）
     * @param packageInfo 対象のパッケージ情報
     */
    JestDebugger.startDebuggingAllTests = function (testFilePath, packageInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var absoluteFilePath, workspaceFolder, config, packageManager, testCommand, fileName, runtimeArgs, debugConfig, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        this.clearOutput();
                        console.log("Starting debugging all tests with file path: ".concat(testFilePath, ", package path: ").concat(packageInfo.path));
                        absoluteFilePath = path.isAbsolute(testFilePath)
                            ? testFilePath
                            : path.resolve(packageInfo.path, testFilePath);
                        console.log("Absolute file path: ".concat(absoluteFilePath));
                        workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteFilePath));
                        if (!workspaceFolder) {
                            throw new Error("\u30EF\u30FC\u30AF\u30B9\u30DA\u30FC\u30B9\u30D5\u30A9\u30EB\u30C0\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093 (".concat(absoluteFilePath, ")"));
                        }
                        console.log("Workspace folder: ".concat(workspaceFolder.uri.fsPath));
                        config = vscode.workspace.getConfiguration('jestTestSelector');
                        packageManager = packageInfo.packageManager ||
                            config.get('packageManager') ||
                            'pnpm';
                        testCommand = config.get('testCommand') || 'test';
                        fileName = path.basename(testFilePath);
                        runtimeArgs = void 0;
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
                        debugConfig = {
                            type: 'node',
                            request: 'launch',
                            name: "Jest Debug: ".concat(path.basename(testFilePath), " (All Tests)"),
                            runtimeExecutable: packageManager,
                            runtimeArgs: runtimeArgs,
                            console: 'integratedTerminal', // ターミナルを使用
                            cwd: packageInfo.path,
                            skipFiles: ['<node_internals>/**'],
                            outputCapture: 'std', // 標準出力とエラー出力をキャプチャ
                            internalConsoleOptions: 'neverOpen' // デバッグコンソールは自動的に開かない
                        };
                        // 実行前に通知
                        vscode.window.showInformationMessage("\u30D5\u30A1\u30A4\u30EB\u300C".concat(fileName, "\u300D\u5185\u306E\u3059\u3079\u3066\u306E\u30C6\u30B9\u30C8\u3092\u5B9F\u884C\u3057\u307E\u3059"));
                        return [4 /*yield*/, this.startDebuggingCommon(workspaceFolder, debugConfig)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_2 = _a.sent();
                        if (error_2 instanceof Error) {
                            vscode.window.showErrorMessage("\u30C7\u30D0\u30C3\u30B0\u958B\u59CB\u30A8\u30E9\u30FC: ".concat(error_2.message));
                            console.error('Debug start error:', error_2);
                        }
                        else {
                            vscode.window.showErrorMessage('デバッグセッションの開始に失敗しました');
                            console.error('Unknown debug start error:', error_2);
                        }
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * ターミナル出力をキャプチャするためのセットアップ
     */
    JestDebugger.setupTerminalOutputCapture = function () {
        // デバッグに使用するターミナルを作成（既存のターミナルが存在する場合は閉じる）
        if (this.debugTerminal) {
            this.debugTerminal.dispose();
        }
        this.debugTerminal = vscode.window.createTerminal('Jest Debug Terminal');
        this.debugTerminal.show();
    };
    /**
     * デバッグ出力をモニタリング
     */
    JestDebugger.monitorDebugOutput = function () {
        var _this = this;
        this.isDebugSessionActive = true;
        // セッションが長時間終了しない場合のタイムアウト処理（30秒）
        this.debugSessionTimeout = setTimeout(function () {
            if (_this.isDebugSessionActive) {
                console.log('Debug session timeout reached, forcing session end');
                _this.isDebugSessionActive = false;
                exports.testSessionEndEventEmitter.fire();
                // リソース解放
                if (_this.debugSessionDisposable) {
                    _this.debugSessionDisposable.dispose();
                    _this.debugSessionDisposable = undefined;
                }
            }
        }, 30000);
        // VSCodeのデバッグコンソールからの出力をキャプチャ
        var outputDisposable = vscode.debug.onDidReceiveDebugSessionCustomEvent(function (event) {
            if (event.event === 'output' && event.body) {
                var outputEvent = event.body;
                if (outputEvent.category === 'stdout' ||
                    outputEvent.category === 'stderr') {
                    // 無限ループを防ぐため、ログ出力は最小限に抑える
                    _this.appendOutput(outputEvent.output);
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
        var debugSessionTerminateDisposable = vscode.debug.onDidTerminateDebugSession(function (session) {
            // Jestのデバッグセッションかどうかをチェック
            if (session.name.startsWith('Jest Debug: ') &&
                _this.isDebugSessionActive) {
                // 少し待ってから終了処理を行う
                setTimeout(function () {
                    // タイムアウトをクリア
                    if (_this.debugSessionTimeout) {
                        clearTimeout(_this.debugSessionTimeout);
                        _this.debugSessionTimeout = undefined;
                    }
                    _this.isDebugSessionActive = false;
                    console.log('Debug session ended:', session.name);
                    // テスト実行が完了したことをユーザーに通知
                    // 出力がない場合は終了メッセージを追加
                    if (_this.testOutputContent.trim() === '') {
                        _this.appendOutput('\nテストの実行が完了しましたが、出力が取得できませんでした。\n');
                        _this.appendOutput('詳細な結果はターミナルを確認してください。\n');
                    }
                    else {
                        _this.appendOutput('\nテスト実行が完了しました。\n');
                    }
                    // セッション終了イベントを発火
                    exports.testSessionEndEventEmitter.fire();
                    // リソース解放
                    outputDisposable.dispose();
                    debugSessionTerminateDisposable.dispose();
                    if (_this.debugSessionDisposable) {
                        _this.debugSessionDisposable.dispose();
                        _this.debugSessionDisposable = undefined;
                    }
                    // ターミナルをクリーンアップ
                    if (_this.debugTerminal) {
                        // ターミナルは残しておく（ユーザーが出力を確認できるように）
                    }
                }, 1000); // 1秒に延長して確実に全ての出力を取得
            }
        });
        // リソース解放用のディスポーザブルを設定
        this.debugSessionDisposable = {
            dispose: function () {
                outputDisposable.dispose();
                debugSessionTerminateDisposable.dispose();
            }
        };
    };
    /**
     * 正規表現のために文字列をエスケープする
     * @param string エスケープする文字列
     * @returns エスケープされた文字列
     */
    JestDebugger.escapeRegExp = function (string) {
        // 基本的な正規表現の特殊文字をエスケープ
        var escapedString = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 完全一致のための^と$を追加し、引用符で囲む
        return "\"^".concat(escapedString, "$\"");
    };
    JestDebugger.testOutputContent = '';
    JestDebugger.isDebugSessionActive = false;
    return JestDebugger;
}());
exports.JestDebugger = JestDebugger;
