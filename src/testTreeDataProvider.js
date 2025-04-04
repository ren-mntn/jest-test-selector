"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.TestTreeDataProvider = exports.TestTreeItem = void 0;
var path = require("path");
var vscode = require("vscode");
var testExtractor_1 = require("./testExtractor");
/**
 * TreeViewアイテムのクラス
 */
var TestTreeItem = /** @class */ (function (_super) {
    __extends(TestTreeItem, _super);
    function TestTreeItem(label, collapsibleState, type, filePath, testCase) {
        var _a, _b;
        var _this = _super.call(this, label, collapsibleState) || this;
        _this.label = label;
        _this.collapsibleState = collapsibleState;
        _this.type = type;
        _this.filePath = filePath;
        _this.testCase = testCase;
        // アイテムタイプに応じたアイコンを設定
        switch (type) {
            case "file":
                _this.iconPath = new vscode.ThemeIcon("file-text");
                _this.tooltip = "\u30D5\u30A1\u30A4\u30EB: ".concat(path.basename(filePath));
                _this.description = path.relative(((_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath) || "", filePath);
                _this.contextValue = "testFile";
                break;
            case "describe":
                _this.iconPath = new vscode.ThemeIcon("symbol-namespace");
                _this.tooltip = "\u30C6\u30B9\u30C8\u30B0\u30EB\u30FC\u30D7: ".concat(label);
                _this.contextValue = "testDescribe";
                break;
            case "testCase":
                _this.iconPath = new vscode.ThemeIcon("symbol-method");
                _this.tooltip = testCase
                    ? "\u30C6\u30B9\u30C8: ".concat(testCase.name, " (\u884C: ").concat(testCase.lineNumber, ")")
                    : label;
                _this.description = testCase ? "\u884C: ".concat(testCase.lineNumber) : "";
                _this.command = {
                    command: "jestTestSelector.runSelectedTest",
                    title: "テストを実行",
                    arguments: [_this],
                };
                _this.contextValue = "testCase";
                break;
        }
        return _this;
    }
    return TestTreeItem;
}(vscode.TreeItem));
exports.TestTreeItem = TestTreeItem;
/**
 * テストツリーデータプロバイダ
 * VSCodeのTreeDataProviderインターフェースを実装
 */
var TestTreeDataProvider = /** @class */ (function () {
    function TestTreeDataProvider() {
        var _this = this;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.rootNodes = [];
        // アクティブエディタの変更を監視
        vscode.window.onDidChangeActiveTextEditor(function (editor) {
            if (editor && _this.isTestFile(editor.document.uri.fsPath)) {
                _this.refresh();
            }
        });
    }
    /**
     * ツリービューを更新
     */
    TestTreeDataProvider.prototype.refresh = function () {
        return __awaiter(this, void 0, void 0, function () {
            var editor, currentFilePath, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        editor = vscode.window.activeTextEditor;
                        if (!(editor && this.isTestFile(editor.document.uri.fsPath))) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        currentFilePath = editor.document.uri.fsPath;
                        // 現在のファイルが前回と同じ場合は不要な更新をスキップ
                        if (this.lastActiveFilePath === currentFilePath &&
                            this.rootNodes.length > 0) {
                            return [2 /*return*/];
                        }
                        // テストファイルのパスを保存
                        this.lastActiveFilePath = currentFilePath;
                        // ツリーデータをリフレッシュ
                        this.rootNodes = [];
                        return [4 /*yield*/, this.buildTestTree(this.lastActiveFilePath)];
                    case 2:
                        _a.sent();
                        this._onDidChangeTreeData.fire();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        vscode.window.showErrorMessage("\u30C6\u30B9\u30C8\u30C4\u30EA\u30FC\u306E\u69CB\u7BC9\u30A8\u30E9\u30FC: ".concat(error_1 instanceof Error ? error_1.message : "不明なエラー"));
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * テストファイルからツリー構造を構築
     */
    TestTreeDataProvider.prototype.buildTestTree = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var testCases, fileName, fileNode, _i, testCases_1, testCase, currentNode, describePath, _loop_1, _a, describePath_1, descName, testNode, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, testExtractor_1.extractTestCases)(filePath)];
                    case 1:
                        testCases = _b.sent();
                        if (testCases.length === 0) {
                            return [2 /*return*/];
                        }
                        fileName = path.basename(filePath);
                        fileNode = {
                            name: fileName,
                            type: "file",
                            filePath: filePath,
                            children: [],
                        };
                        // rootNodesが別の非同期処理で変更される可能性があるため、追加前にクリアする
                        this.rootNodes = [];
                        this.rootNodes.push(fileNode);
                        // 各テストケースをツリーに追加
                        for (_i = 0, testCases_1 = testCases; _i < testCases_1.length; _i++) {
                            testCase = testCases_1[_i];
                            currentNode = fileNode;
                            describePath = __spreadArray([], testCase.describePath, true);
                            _loop_1 = function (descName) {
                                // 既存のノードを探す
                                var descNode = currentNode.children.find(function (child) { return child.type === "describe" && child.name === descName; });
                                // 存在しなければ新規作成
                                if (!descNode) {
                                    descNode = {
                                        name: descName,
                                        type: "describe",
                                        filePath: filePath,
                                        children: [],
                                    };
                                    currentNode.children.push(descNode);
                                }
                                // 次のレベルへ
                                currentNode = descNode;
                            };
                            // describeブロックのパスに沿ってノードを構築
                            for (_a = 0, describePath_1 = describePath; _a < describePath_1.length; _a++) {
                                descName = describePath_1[_a];
                                _loop_1(descName);
                            }
                            testNode = {
                                name: testCase.name,
                                type: "testCase",
                                filePath: filePath,
                                children: [],
                                testCase: testCase,
                            };
                            currentNode.children.push(testNode);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _b.sent();
                        vscode.window.showErrorMessage("\u30C6\u30B9\u30C8\u30C4\u30EA\u30FC\u306E\u69CB\u7BC9\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F: ".concat(error_2 instanceof Error ? error_2.message : "不明なエラー"));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * テストファイルかどうかを判定
     */
    TestTreeDataProvider.prototype.isTestFile = function (filePath) {
        var fileName = path.basename(filePath);
        return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(fileName);
    };
    /**
     * ツリービューのルート要素を取得
     */
    TestTreeDataProvider.prototype.getChildren = function (element) {
        var _this = this;
        // アクティブなエディタがテストファイルでない場合、空のリストを返す
        if (!element) {
            var editor = vscode.window.activeTextEditor;
            if (!editor || !this.isTestFile(editor.document.uri.fsPath)) {
                // 前回のファイルがあれば、それを使用
                if (this.lastActiveFilePath && this.rootNodes.length === 0) {
                    this.buildTestTree(this.lastActiveFilePath).then(function () {
                        _this._onDidChangeTreeData.fire();
                    });
                }
                return Promise.resolve(this.rootNodes.map(function (node) {
                    return new TestTreeItem(node.name, vscode.TreeItemCollapsibleState.Expanded, node.type, node.filePath);
                }));
            }
            var filePath_1 = editor.document.uri.fsPath;
            // 新しいファイルに切り替わった場合のみツリーを再構築
            if (this.lastActiveFilePath !== filePath_1) {
                this.lastActiveFilePath = filePath_1;
                this.rootNodes = []; // ルートノードをクリア
                return this.buildTestTree(filePath_1).then(function () {
                    // ルートノードのツリーアイテムを返す
                    return _this.rootNodes.map(function (node) {
                        return new TestTreeItem(node.name, vscode.TreeItemCollapsibleState.Expanded, node.type, node.filePath);
                    });
                });
            }
            // ルートノードのツリーアイテムを返す
            return Promise.resolve(this.rootNodes.map(function (node) {
                return new TestTreeItem(node.name, vscode.TreeItemCollapsibleState.Expanded, node.type, node.filePath);
            }));
        }
        // 子要素を取得
        var filePath = element.filePath;
        // elementに対応するノードを検索
        var findNode = function (nodes, label, type) {
            for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
                var node_1 = nodes_1[_i];
                if (node_1.name === label && node_1.type === type) {
                    return node_1;
                }
                var found = findNode(node_1.children, label, type);
                if (found) {
                    return found;
                }
            }
            return undefined;
        };
        var node = findNode(this.rootNodes, element.label, element.type);
        if (!node) {
            return Promise.resolve([]);
        }
        // 子ノードをツリーアイテムに変換して返す
        return Promise.resolve(node.children.map(function (child) {
            var collapsibleState = child.children.length > 0
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.None;
            return new TestTreeItem(child.name, collapsibleState, child.type, child.filePath, child.testCase);
        }));
    };
    /**
     * ツリーアイテムを取得
     */
    TestTreeDataProvider.prototype.getTreeItem = function (element) {
        return element;
    };
    return TestTreeDataProvider;
}());
exports.TestTreeDataProvider = TestTreeDataProvider;
