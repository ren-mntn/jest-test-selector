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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
var path = require("path");
var vscode = require("vscode");
var debugger_1 = require("./debugger");
var monorepoDetector_1 = require("./monorepoDetector");
var testExtractor_1 = require("./testExtractor");
var testResultView_1 = require("./testResultView");
var testSettingsView_1 = require("./testSettingsView");
var testTreeDataProvider_1 = require("./testTreeDataProvider");
// 拡張機能が有効化されたときに実行される関数
function activate(context) {
    var _a;
    var _this = this;
    console.log('拡張機能 "jest-test-selector" が有効化されました');
    console.log("\u62E1\u5F35\u6A5F\u80FDID: ".concat(context.extension.id));
    // 拡張機能が既に有効化されているかチェック
    try {
        // テスト結果ビュープロバイダーを登録
        var testResultProvider = new testResultView_1.TestResultProvider(context.extensionUri);
        var testResultProviderDisposable = void 0;
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
        var testSettingsProvider = testSettingsView_1.TestSettingsProvider.getInstance(context.extensionUri);
        var testSettingsProviderDisposable = void 0;
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
        var testTreeDataProvider_2 = new testTreeDataProvider_1.TestTreeDataProvider();
        var testTreeView = void 0;
        try {
            testTreeView = vscode.window.createTreeView("jestTestSelector.testExplorer", {
                treeDataProvider: testTreeDataProvider_2,
                showCollapseAll: true,
            });
            console.log("テストエクスプローラービューを登録しました");
        }
        catch (e) {
            console.log("テストエクスプローラービューは既に登録されています");
        }
        // テスト出力イベントを購読
        var testOutputSubscription = (0, debugger_1.onTestOutput)(function (output) {
            var resultView = testResultView_1.TestResultView.getInstance(context.extensionUri);
            var formattedOutput = resultView.formatTestResult(output);
            resultView.updateContent(formattedOutput);
        });
        // テストセッション終了イベントを購読
        var testSessionEndSubscription = (0, debugger_1.onTestSessionEnd)(function () {
            console.log("Test session end event received");
            // テストビューのローディング状態を終了
            var resultView = testResultView_1.TestResultView.getInstance(context.extensionUri);
            resultView.finishRunningState();
        });
        // Jest CLI オプションタブを開くコマンドを登録
        var selectJestOptionsDisposable = vscode.commands.registerCommand("jestTestSelector.selectOptions", function () { return __awaiter(_this, void 0, void 0, function () {
            var config, currentOptions, jestOptions, selected, newOptions, _loop_1, _i, jestOptions_1, option, error_1, error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 8]);
                        console.log("セレクトオプションコマンドが実行されました");
                        config = vscode.workspace.getConfiguration("jestTestSelector");
                        currentOptions = config.get("cliOptions") || {};
                        jestOptions = [
                            {
                                id: "--watch",
                                label: "$(eye) ウォッチモード",
                                description: "--watch",
                                detail: "ファイルの変更を監視し、関連するテストを再実行します",
                                picked: !!currentOptions["--watch"],
                                type: "boolean",
                            },
                            {
                                id: "--watchAll",
                                label: "$(eye-watch) すべてをウォッチ",
                                description: "--watchAll",
                                detail: "ファイルの変更を監視し、すべてのテストを再実行します",
                                picked: !!currentOptions["--watchAll"],
                                type: "boolean",
                            },
                            {
                                id: "--coverage",
                                label: "$(graph) カバレッジ",
                                description: "--coverage",
                                detail: "コードカバレッジレポートを生成します",
                                picked: !!currentOptions["--coverage"],
                                type: "boolean",
                            },
                            {
                                id: "--verbose",
                                label: "$(output) バーボース",
                                description: "--verbose",
                                detail: "テスト結果を詳細に表示します",
                                picked: currentOptions["--verbose"] !== false, // デフォルトでtrue
                                type: "boolean",
                            },
                            {
                                id: "--colors",
                                label: "$(symbol-color) カラー出力",
                                description: "--colors",
                                detail: "色付きの出力を使用します",
                                picked: currentOptions["--colors"] !== false, // デフォルトでtrue
                                type: "boolean",
                            },
                            {
                                id: "--bail",
                                label: "$(stop) 失敗時に停止",
                                description: "--bail",
                                detail: "テストが失敗したら実行を中止します",
                                picked: !!currentOptions["--bail"],
                                type: "boolean",
                            },
                        ];
                        return [4 /*yield*/, vscode.window.showQuickPick(jestOptions, {
                                placeHolder: "設定するJest CLIオプションを選択",
                                canPickMany: true,
                                matchOnDescription: true,
                                matchOnDetail: true,
                            })];
                    case 1:
                        selected = _a.sent();
                        if (!selected) {
                            return [2 /*return*/]; // ユーザーがキャンセルした場合
                        }
                        newOptions = {};
                        _loop_1 = function (option) {
                            var isSelected = selected.some(function (item) { return item.id === option.id; });
                            // verboseとcolorsはデフォルトでtrue、選択されていない場合はfalseを設定
                            if (option.id === "--verbose" || option.id === "--colors") {
                                newOptions[option.id] = isSelected;
                            }
                            // その他のオプションは選択された場合のみ設定
                            else if (isSelected) {
                                newOptions[option.id] = true;
                            }
                        };
                        for (_i = 0, jestOptions_1 = jestOptions; _i < jestOptions_1.length; _i++) {
                            option = jestOptions_1[_i];
                            _loop_1(option);
                        }
                        // 設定を保存
                        return [4 /*yield*/, config.update("cliOptions", newOptions, vscode.ConfigurationTarget.Global)];
                    case 2:
                        // 設定を保存
                        _a.sent();
                        vscode.window.showInformationMessage("Jest CLIオプションを保存しました");
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        // 通常のWebViewタブ表示も試行
                        return [4 /*yield*/, vscode.commands.executeCommand("workbench.view.extension.jest-test-selector")];
                    case 4:
                        // 通常のWebViewタブ表示も試行
                        _a.sent();
                        // 少し待機してからテスト設定タブに切り替え
                        setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                            var error_3;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, vscode.commands.executeCommand(testSettingsView_1.TestSettingsProvider.viewType + ".focus")];
                                    case 1:
                                        _a.sent();
                                        console.log("テスト設定タブのフォーカスコマンドを実行しました");
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_3 = _a.sent();
                                        console.error("テスト設定タブのフォーカスに失敗:", error_3);
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); }, 500);
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        console.error("WebViewタブ表示に失敗:", error_1);
                        return [3 /*break*/, 6];
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_2 = _a.sent();
                        console.error("コマンド実行エラー:", error_2);
                        vscode.window.showErrorMessage("\u30C6\u30B9\u30C8\u8A2D\u5B9A\u306E\u8868\u793A\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ".concat(error_2));
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        }); });
        // 登録したコマンドを追加
        var disposables = [
            testOutputSubscription,
            testSessionEndSubscription,
            selectJestOptionsDisposable,
        ];
        // 設定エディタを開くコマンドを登録
        var openSettingsDisposable = vscode.commands.registerCommand("jestTestSelector.openSettings", function () { return __awaiter(_this, void 0, void 0, function () {
            var error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        // 直接Jest Test Selectorの設定セクションを開く
                        return [4 /*yield*/, vscode.commands.executeCommand("workbench.action.openSettings", "jestTestSelector.cliOptions")];
                    case 1:
                        // 直接Jest Test Selectorの設定セクションを開く
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _a.sent();
                        console.error("設定を開く際にエラーが発生しました:", error_4);
                        vscode.window.showErrorMessage("\u8A2D\u5B9A\u30A8\u30C7\u30A3\u30BF\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F: ".concat(error_4));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        disposables.push(openSettingsDisposable);
        // テストリストを更新するコマンドを登録
        var refreshTestsDisposable = vscode.commands.registerCommand("jestTestSelector.refreshTests", function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, testTreeDataProvider_2.refresh()];
                    case 1:
                        _a.sent();
                        vscode.window.showInformationMessage("テストリストを更新しました");
                        return [2 /*return*/];
                }
            });
        }); });
        disposables.push(refreshTestsDisposable);
        // テストエクスプローラーからテストを実行するコマンドを登録
        var runSelectedTestDisposable = vscode.commands.registerCommand("jestTestSelector.runSelectedTest", function (item) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!item) {
                            vscode.window.showWarningMessage("テストが選択されていません");
                            return [2 /*return*/];
                        }
                        if (!(item.type === "file")) return [3 /*break*/, 2];
                        return [4 /*yield*/, runTestFile(item.filePath)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 2:
                        if (!(item.type === "describe")) return [3 /*break*/, 4];
                        return [4 /*yield*/, runTestFile(item.filePath, item.label)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 4:
                        if (!(item.type === "testCase" && item.testCase)) return [3 /*break*/, 6];
                        return [4 /*yield*/, runSpecificTest(item.filePath, item.testCase)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [2 /*return*/];
                }
            });
        }); });
        disposables.push(runSelectedTestDisposable);
        // すべてのテストを実行するコマンドを登録
        var runAllTestsDisposable = vscode.commands.registerCommand("jestTestSelector.runAllTests", function () { return __awaiter(_this, void 0, void 0, function () {
            var editor, filePath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        editor = vscode.window.activeTextEditor;
                        if (!editor) {
                            vscode.window.showWarningMessage("ファイルが開かれていません");
                            return [2 /*return*/];
                        }
                        filePath = editor.document.uri.fsPath;
                        if (!isTestFile(filePath)) {
                            vscode.window.showWarningMessage("現在のファイルはJestのテストファイルではありません");
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, runTestFile(filePath)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        disposables.push(runAllTestsDisposable);
        // クイックピックからテストを選択して実行するコマンドを登録
        var runTestDisposable = vscode.commands.registerCommand("jestTestSelector.runTest", function () { return __awaiter(_this, void 0, void 0, function () {
            var editor, filePath, statusBar, testCases, quickPickItems, selected_1, isRunAll, selectedTest, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 10, , 11]);
                        editor = vscode.window.activeTextEditor;
                        if (!editor) {
                            vscode.window.showWarningMessage("ファイルが開かれていません");
                            return [2 /*return*/];
                        }
                        filePath = editor.document.uri.fsPath;
                        // テストファイルかどうかをチェック
                        if (!isTestFile(filePath)) {
                            vscode.window.showWarningMessage("現在のファイルはJestのテストファイルではありません");
                            return [2 /*return*/];
                        }
                        statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
                        statusBar.text = "$(sync~spin) テストケースを検索中...";
                        statusBar.show();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 8, 9]);
                        return [4 /*yield*/, (0, testExtractor_1.extractTestCases)(filePath)];
                    case 2:
                        testCases = _a.sent();
                        if (testCases.length === 0) {
                            vscode.window.showInformationMessage("テストケースが見つかりませんでした");
                            return [2 /*return*/];
                        }
                        quickPickItems = __spreadArray([
                            // 「すべてのテストを実行」オプションを先頭に追加
                            {
                                label: "$(play) すべてのテストを実行",
                                description: "ファイル内のすべてのテストケースを実行",
                                detail: "\u30C6\u30B9\u30C8\u6570: ".concat(testCases.length, "\u500B"),
                            },
                            // 区切り線
                            {
                                label: "",
                                kind: vscode.QuickPickItemKind.Separator,
                            }
                        ], testCases.map(function (testCase) { return ({
                            label: testCase.name,
                            description: testCase.describePath.join(" > "),
                            detail: "\u884C: ".concat(testCase.lineNumber),
                        }); }), true);
                        return [4 /*yield*/, vscode.window.showQuickPick(quickPickItems, {
                                placeHolder: "実行するテストケースを選択",
                                matchOnDescription: true,
                                matchOnDetail: true,
                            })];
                    case 3:
                        selected_1 = _a.sent();
                        if (!selected_1) {
                            return [2 /*return*/];
                        }
                        isRunAll = selected_1.label === "$(play) すべてのテストを実行";
                        selectedTest = undefined;
                        if (!isRunAll) {
                            // 個別のテストケースを実行する場合
                            selectedTest = testCases.find(function (test) { return test.name === selected_1.label; });
                            if (!selectedTest) {
                                vscode.window.showErrorMessage("テストケースの選択に問題が発生しました");
                                return [2 /*return*/];
                            }
                        }
                        statusBar.text = "$(sync~spin) パッケージ構造を検出中...";
                        if (!isRunAll) return [3 /*break*/, 5];
                        return [4 /*yield*/, runTestFile(filePath)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 5:
                        if (!selectedTest) return [3 /*break*/, 7];
                        return [4 /*yield*/, runSpecificTest(filePath, selectedTest)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        // ステータスバーをクリア
                        statusBar.dispose();
                        return [7 /*endfinally*/];
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        error_5 = _a.sent();
                        if (error_5 instanceof Error) {
                            vscode.window.showErrorMessage("\u30A8\u30E9\u30FC: ".concat(error_5.message));
                        }
                        else {
                            vscode.window.showErrorMessage("予期しないエラーが発生しました");
                        }
                        return [3 /*break*/, 11];
                    case 11: return [2 /*return*/];
                }
            });
        }); });
        disposables.push(runTestDisposable);
        // エディタ変更時に自動的にテストツリーを更新
        var activeEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(function (editor) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(editor &&
                            testTreeDataProvider_2.isTestFile(editor.document.uri.fsPath))) return [3 /*break*/, 2];
                        return [4 /*yield*/, testTreeDataProvider_2.refresh()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        }); });
        disposables.push(activeEditorChangeDisposable);
        // 現在のエディタが存在し、テストファイルであれば初期表示を実行
        var currentEditor = vscode.window.activeTextEditor;
        if (currentEditor &&
            testTreeDataProvider_2.isTestFile(currentEditor.document.uri.fsPath)) {
            testTreeDataProvider_2.refresh();
        }
        // デバッグセッション開始時のイベントハンドラ
        var debugSessionStartDisposable = vscode.debug.onDidStartDebugSession(function (session) {
            // Jestのデバッグセッションかどうかをチェック
            if (session.name.startsWith("Jest Debug: ")) {
                var testName = session.name.replace("Jest Debug: ", "");
                console.log("Starting debug session: ".concat(testName));
                // テスト実行状態を表示
                testResultView_1.TestResultView.getInstance(context.extensionUri).showRunningState(testName);
            }
        });
        disposables.push(debugSessionStartDisposable);
        // デバッグセッション終了時のイベントハンドラ
        var debugSessionTerminateDisposable = vscode.debug.onDidTerminateDebugSession(function (session) { return __awaiter(_this, void 0, void 0, function () {
            var resultView;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!session.name.startsWith("Jest Debug: ")) return [3 /*break*/, 2];
                        console.log("Debug session terminated: ".concat(session.name));
                        // テスト結果の最終更新を少し待つ
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                    case 1:
                        // テスト結果の最終更新を少し待つ
                        _a.sent();
                        resultView = testResultView_1.TestResultView.getInstance(context.extensionUri);
                        resultView.finishRunningState();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        }); });
        disposables.push(debugSessionTerminateDisposable);
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
        (_a = context.subscriptions).push.apply(_a, disposables);
    }
    catch (error) {
        console.error("拡張機能の初期化エラー:", error);
        vscode.window.showErrorMessage("\u62E1\u5F35\u6A5F\u80FD\u306E\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ".concat(error));
    }
}
/**
 * テストファイル全体を実行する
 * @param filePath テストファイルのパス
 * @param describeBlock 実行するdescribeブロック名（オプション）
 */
function runTestFile(filePath, describeBlock) {
    return __awaiter(this, void 0, void 0, function () {
        var absoluteFilePath, workspaceFolder, packages, targetPackage, fileName, mockTestCase, error_6, extension, extension;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 6, , 7]);
                    console.log("Running test file: ".concat(filePath));
                    absoluteFilePath = path.isAbsolute(filePath)
                        ? filePath
                        : path.resolve(((_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0].uri.fsPath) || "", filePath);
                    console.log("Absolute file path: ".concat(absoluteFilePath));
                    workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteFilePath));
                    if (!workspaceFolder) {
                        throw new Error("\u30EF\u30FC\u30AF\u30B9\u30DA\u30FC\u30B9\u30D5\u30A9\u30EB\u30C0\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093 (".concat(absoluteFilePath, ")"));
                    }
                    console.log("Workspace folder: ".concat(workspaceFolder.uri.fsPath));
                    return [4 /*yield*/, (0, monorepoDetector_1.detectMonorepoPackages)(workspaceFolder.uri.fsPath)];
                case 1:
                    packages = _b.sent();
                    targetPackage = findTargetPackage(absoluteFilePath, workspaceFolder, packages);
                    if (!targetPackage) {
                        vscode.window.showErrorMessage("テスト実行対象のパッケージが見つかりません");
                        return [2 /*return*/];
                    }
                    console.log("Target package: ".concat(targetPackage.name, ", ").concat(targetPackage.path));
                    fileName = path.basename(absoluteFilePath);
                    console.log("File name: ".concat(fileName));
                    if (!describeBlock) return [3 /*break*/, 3];
                    mockTestCase = {
                        name: describeBlock,
                        fullName: describeBlock,
                        describePath: [],
                        lineNumber: 0,
                    };
                    console.log("\u6307\u5B9A\u306Edescribe\u30D6\u30ED\u30C3\u30AF\u3067\u5B9F\u884C: ".concat(describeBlock));
                    return [4 /*yield*/, debugger_1.JestDebugger.startDebugging(absoluteFilePath, mockTestCase, targetPackage)];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 5];
                case 3:
                    // ファイル全体を実行
                    console.log("\u30D5\u30A1\u30A4\u30EB\u5168\u4F53\u3092\u5B9F\u884C: ".concat(fileName));
                    return [4 /*yield*/, debugger_1.JestDebugger.startDebuggingAllTests(absoluteFilePath, targetPackage)];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_6 = _b.sent();
                    if (error_6 instanceof Error) {
                        vscode.window.showErrorMessage("\u30A8\u30E9\u30FC: ".concat(error_6.message));
                        console.error("Run test file error:", error_6);
                        extension = vscode.extensions.all.find(function (e) {
                            return e.id.endsWith("jest-test-selector");
                        });
                        if (extension === null || extension === void 0 ? void 0 : extension.extensionUri) {
                            testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState(error_6.message);
                        }
                    }
                    else {
                        vscode.window.showErrorMessage("予期しないエラーが発生しました");
                        console.error("Unknown error in run test file:", error_6);
                        extension = vscode.extensions.all.find(function (e) {
                            return e.id.endsWith("jest-test-selector");
                        });
                        if (extension === null || extension === void 0 ? void 0 : extension.extensionUri) {
                            testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState("予期しないエラーが発生しました");
                        }
                    }
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * 特定のテストケースを実行
 * @param filePath テストファイルのパス
 * @param testCase 実行するテストケース
 */
function runSpecificTest(filePath, testCase) {
    return __awaiter(this, void 0, void 0, function () {
        var absoluteFilePath, workspaceFolder, packages, targetPackage, error_7, extension, extension;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    console.log("Running specific test: ".concat(filePath, ", test: ").concat(testCase.name));
                    absoluteFilePath = path.isAbsolute(filePath)
                        ? filePath
                        : path.resolve(((_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0].uri.fsPath) || "", filePath);
                    console.log("Absolute file path: ".concat(absoluteFilePath));
                    workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteFilePath));
                    if (!workspaceFolder) {
                        throw new Error("\u30EF\u30FC\u30AF\u30B9\u30DA\u30FC\u30B9\u30D5\u30A9\u30EB\u30C0\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093 (".concat(absoluteFilePath, ")"));
                    }
                    console.log("Workspace folder: ".concat(workspaceFolder.uri.fsPath));
                    return [4 /*yield*/, (0, monorepoDetector_1.detectMonorepoPackages)(workspaceFolder.uri.fsPath)];
                case 1:
                    packages = _b.sent();
                    targetPackage = findTargetPackage(absoluteFilePath, workspaceFolder, packages);
                    if (!targetPackage) {
                        vscode.window.showErrorMessage("テスト実行対象のパッケージが見つかりません");
                        return [2 /*return*/];
                    }
                    console.log("Target package: ".concat(targetPackage.name, ", ").concat(targetPackage.path));
                    // テスト実行（常に絶対パスを使用）
                    return [4 /*yield*/, debugger_1.JestDebugger.startDebugging(absoluteFilePath, testCase, targetPackage)];
                case 2:
                    // テスト実行（常に絶対パスを使用）
                    _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_7 = _b.sent();
                    if (error_7 instanceof Error) {
                        vscode.window.showErrorMessage("\u30A8\u30E9\u30FC: ".concat(error_7.message));
                        console.error("Run specific test error:", error_7);
                        extension = vscode.extensions.all.find(function (e) {
                            return e.id.endsWith("jest-test-selector");
                        });
                        if (extension === null || extension === void 0 ? void 0 : extension.extensionUri) {
                            testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState(error_7.message);
                        }
                    }
                    else {
                        vscode.window.showErrorMessage("予期しないエラーが発生しました");
                        console.error("Unknown error in run specific test:", error_7);
                        extension = vscode.extensions.all.find(function (e) {
                            return e.id.endsWith("jest-test-selector");
                        });
                        if (extension === null || extension === void 0 ? void 0 : extension.extensionUri) {
                            testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState("予期しないエラーが発生しました");
                        }
                    }
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * テスト実行対象のパッケージを特定
 */
function findTargetPackage(filePath, workspaceFolder, packages) {
    var targetPackage;
    if (packages.length === 0) {
        // モノレポでない場合はワークスペースルートをパッケージとみなす
        var config = vscode.workspace.getConfiguration("jestTestSelector");
        var packageManager = config.get("packageManager") || "pnpm";
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
        var relativePath_1 = path.relative(workspaceFolder.uri.fsPath, filePath);
        targetPackage = packages.find(function (pkg) {
            var pkgRelativePath = path.relative(workspaceFolder.uri.fsPath, pkg.path);
            return relativePath_1.startsWith(pkgRelativePath);
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
    var fileName = path.basename(filePath);
    return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(fileName);
}
// 拡張機能が無効化されたときに実行される関数
function deactivate() {
    console.log('拡張機能 "jest-test-selector" が無効化されました');
}
