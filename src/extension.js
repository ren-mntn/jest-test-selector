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
var testTreeDataProvider_1 = require("./testTreeDataProvider");
// 拡張機能が有効化されたときに実行される関数
function activate(context) {
    var _this = this;
    console.log('拡張機能 "jest-test-selector" が有効化されました');
    console.log("\u62E1\u5F35\u6A5F\u80FDID: ".concat(context.extension.id));
    // テストツリービューデータプロバイダーを作成
    var testTreeDataProvider = new testTreeDataProvider_1.TestTreeDataProvider();
    var testTreeView = vscode.window.createTreeView("jestTestSelector.testExplorer", {
        treeDataProvider: testTreeDataProvider,
        showCollapseAll: true,
    });
    console.log("テストエクスプローラービューを登録しました");
    // テスト結果ビュープロバイダーを登録
    var testResultProvider = new testResultView_1.TestResultProvider(context.extensionUri);
    console.log("テスト結果ビュープロバイダーを作成しました");
    var testResultProviderDisposable = vscode.window.registerWebviewViewProvider("jestTestSelector.testResults", testResultProvider, {
        webviewOptions: {
            retainContextWhenHidden: true,
        },
    });
    console.log("テスト結果ビュープロバイダーを登録しました");
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
    // テストリストを更新するコマンドを登録
    var refreshTestsDisposable = vscode.commands.registerCommand("jestTestSelector.refreshTests", function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testTreeDataProvider.refresh()];
                case 1:
                    _a.sent();
                    vscode.window.showInformationMessage("テストリストを更新しました");
                    return [2 /*return*/];
            }
        });
    }); });
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
    // クイックピックからテストを選択して実行するコマンドを登録
    var runTestDisposable = vscode.commands.registerCommand("jestTestSelector.runTest", function () { return __awaiter(_this, void 0, void 0, function () {
        var editor, filePath, statusBar, testCases, quickPickItems, selected_1, isRunAll, selectedTest, error_1;
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
                    error_1 = _a.sent();
                    if (error_1 instanceof Error) {
                        vscode.window.showErrorMessage("\u30A8\u30E9\u30FC: ".concat(error_1.message));
                    }
                    else {
                        vscode.window.showErrorMessage("予期しないエラーが発生しました");
                    }
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    }); });
    // エディタ変更時に自動的にテストツリーを更新
    var activeEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(function (editor) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(editor &&
                        testTreeDataProvider.isTestFile(editor.document.uri.fsPath))) return [3 /*break*/, 2];
                    return [4 /*yield*/, testTreeDataProvider.refresh()];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); });
    // 現在のエディタが存在し、テストファイルであれば初期表示を実行
    var currentEditor = vscode.window.activeTextEditor;
    if (currentEditor &&
        testTreeDataProvider.isTestFile(currentEditor.document.uri.fsPath)) {
        testTreeDataProvider.refresh();
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
    // 登録したコマンドを追加
    context.subscriptions.push(testTreeView, refreshTestsDisposable, runSelectedTestDisposable, runAllTestsDisposable, runTestDisposable, activeEditorChangeDisposable, debugSessionStartDisposable, debugSessionTerminateDisposable, testResultProviderDisposable, testOutputSubscription, testSessionEndSubscription);
}
/**
 * テストファイル全体を実行する
 * @param filePath テストファイルのパス
 * @param describeBlock 実行するdescribeブロック名（オプション）
 */
function runTestFile(filePath, describeBlock) {
    return __awaiter(this, void 0, void 0, function () {
        var absoluteFilePath, workspaceFolder, packages, targetPackage, fileName, testName, mockTestCase, error_2, extension, extension;
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
                    testName = describeBlock ? describeBlock : "".concat(fileName, " (All Tests)");
                    if (!describeBlock) return [3 /*break*/, 3];
                    mockTestCase = {
                        name: describeBlock,
                        fullName: describeBlock,
                        describePath: [],
                        lineNumber: 0,
                    };
                    return [4 /*yield*/, debugger_1.JestDebugger.startDebugging(absoluteFilePath, mockTestCase, targetPackage)];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 5];
                case 3: 
                // ファイル全体を実行
                return [4 /*yield*/, debugger_1.JestDebugger.startDebuggingAllTests(absoluteFilePath, targetPackage)];
                case 4:
                    // ファイル全体を実行
                    _b.sent();
                    _b.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_2 = _b.sent();
                    if (error_2 instanceof Error) {
                        vscode.window.showErrorMessage("\u30A8\u30E9\u30FC: ".concat(error_2.message));
                        console.error("Run test file error:", error_2);
                        extension = vscode.extensions.all.find(function (e) {
                            return e.id.endsWith("jest-test-selector");
                        });
                        if (extension === null || extension === void 0 ? void 0 : extension.extensionUri) {
                            testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState(error_2.message);
                        }
                    }
                    else {
                        vscode.window.showErrorMessage("予期しないエラーが発生しました");
                        console.error("Unknown error in run test file:", error_2);
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
        var absoluteFilePath, workspaceFolder, packages, targetPackage, error_3, extension, extension;
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
                    // テスト実行（絶対パスを使用）
                    return [4 /*yield*/, debugger_1.JestDebugger.startDebugging(absoluteFilePath, testCase, targetPackage)];
                case 2:
                    // テスト実行（絶対パスを使用）
                    _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _b.sent();
                    if (error_3 instanceof Error) {
                        vscode.window.showErrorMessage("\u30A8\u30E9\u30FC: ".concat(error_3.message));
                        console.error("Run specific test error:", error_3);
                        extension = vscode.extensions.all.find(function (e) {
                            return e.id.endsWith("jest-test-selector");
                        });
                        if (extension === null || extension === void 0 ? void 0 : extension.extensionUri) {
                            testResultView_1.TestResultView.getInstance(extension.extensionUri).showErrorState(error_3.message);
                        }
                    }
                    else {
                        vscode.window.showErrorMessage("予期しないエラーが発生しました");
                        console.error("Unknown error in run specific test:", error_3);
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
