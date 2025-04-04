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
exports.TestTreeDataProvider = exports.TestTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const testExtractor_1 = require("./testExtractor");
/**
 * TreeViewアイテムのクラス
 */
class TestTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, type, filePath, testCase) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.type = type;
        this.filePath = filePath;
        this.testCase = testCase;
        // アイテムタイプに応じたアイコンを設定
        switch (type) {
            case 'file':
                this.iconPath = new vscode.ThemeIcon('file-text');
                this.tooltip = `ファイル: ${path.basename(filePath)}`;
                this.description = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);
                this.contextValue = 'testFile';
                break;
            case 'describe':
                this.iconPath = new vscode.ThemeIcon('symbol-namespace');
                this.tooltip = `テストグループ: ${label}`;
                this.contextValue = 'testDescribe';
                break;
            case 'testCase':
                this.iconPath = new vscode.ThemeIcon('symbol-method');
                this.tooltip = testCase
                    ? `テスト: ${testCase.name} (行: ${testCase.lineNumber})`
                    : label;
                this.description = testCase ? `行: ${testCase.lineNumber}` : '';
                this.command = {
                    command: 'jestTestSelector.runSelectedTest',
                    title: 'テストを実行',
                    arguments: [this]
                };
                this.contextValue = 'testCase';
                break;
        }
    }
}
exports.TestTreeItem = TestTreeItem;
/**
 * テストツリーデータプロバイダ
 * VSCodeのTreeDataProviderインターフェースを実装
 */
class TestTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.rootNodes = [];
        // アクティブエディタの変更を監視
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && this.isTestFile(editor.document.uri.fsPath)) {
                this.refresh();
            }
        });
    }
    /**
     * ツリービューを更新
     */
    async refresh() {
        const editor = vscode.window.activeTextEditor;
        if (editor && this.isTestFile(editor.document.uri.fsPath)) {
            try {
                // テストファイルのパスを保存
                this.lastActiveFilePath = editor.document.uri.fsPath;
                // ツリーデータをリフレッシュ
                this.rootNodes = [];
                await this.buildTestTree(this.lastActiveFilePath);
                this._onDidChangeTreeData.fire();
            }
            catch (error) {
                vscode.window.showErrorMessage(`テストツリーの構築エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
            }
        }
    }
    /**
     * テストファイルからツリー構造を構築
     */
    async buildTestTree(filePath) {
        try {
            // テストケースを抽出
            const testCases = await (0, testExtractor_1.extractTestCases)(filePath);
            if (testCases.length === 0) {
                return;
            }
            // ファイルのルートノードを作成
            const fileName = path.basename(filePath);
            const fileNode = {
                name: fileName,
                type: 'file',
                filePath,
                children: []
            };
            this.rootNodes.push(fileNode);
            // 各テストケースをツリーに追加
            for (const testCase of testCases) {
                let currentNode = fileNode;
                const describePath = [...testCase.describePath]; // コピーを作成
                // describeブロックのパスに沿ってノードを構築
                for (const descName of describePath) {
                    // 既存のノードを探す
                    let descNode = currentNode.children.find((child) => child.type === 'describe' && child.name === descName);
                    // 存在しなければ新規作成
                    if (!descNode) {
                        descNode = {
                            name: descName,
                            type: 'describe',
                            filePath,
                            children: []
                        };
                        currentNode.children.push(descNode);
                    }
                    // 次のレベルへ
                    currentNode = descNode;
                }
                // テストケースノードを追加
                const testNode = {
                    name: testCase.name,
                    type: 'testCase',
                    filePath,
                    children: [],
                    testCase
                };
                currentNode.children.push(testNode);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`テストツリーの構築中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
        }
    }
    /**
     * テストファイルかどうかを判定
     */
    isTestFile(filePath) {
        const fileName = path.basename(filePath);
        return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(fileName);
    }
    /**
     * ツリービューのルート要素を取得
     */
    getChildren(element) {
        // アクティブなエディタがテストファイルでない場合、空のリストを返す
        if (!element) {
            const editor = vscode.window.activeTextEditor;
            if (!editor || !this.isTestFile(editor.document.uri.fsPath)) {
                // 前回のファイルがあれば、それを使用
                if (this.lastActiveFilePath && this.rootNodes.length === 0) {
                    this.buildTestTree(this.lastActiveFilePath).then(() => {
                        this._onDidChangeTreeData.fire();
                    });
                }
                return Promise.resolve(this.rootNodes.map((node) => new TestTreeItem(node.name, vscode.TreeItemCollapsibleState.Expanded, node.type, node.filePath)));
            }
            const filePath = editor.document.uri.fsPath;
            // 新しいファイルに切り替わった場合、ツリーを再構築
            if (this.lastActiveFilePath !== filePath) {
                this.lastActiveFilePath = filePath;
                this.rootNodes = [];
                this.buildTestTree(filePath).then(() => {
                    this._onDidChangeTreeData.fire();
                });
            }
            // ルートノードのツリーアイテムを返す
            return Promise.resolve(this.rootNodes.map((node) => new TestTreeItem(node.name, vscode.TreeItemCollapsibleState.Expanded, node.type, node.filePath)));
        }
        // 子要素を取得
        const filePath = element.filePath;
        // elementに対応するノードを検索
        const findNode = (nodes, label, type) => {
            for (const node of nodes) {
                if (node.name === label && node.type === type) {
                    return node;
                }
                const found = findNode(node.children, label, type);
                if (found) {
                    return found;
                }
            }
            return undefined;
        };
        const node = findNode(this.rootNodes, element.label, element.type);
        if (!node) {
            return Promise.resolve([]);
        }
        // 子ノードをツリーアイテムに変換して返す
        return Promise.resolve(node.children.map((child) => {
            const collapsibleState = child.children.length > 0
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.None;
            return new TestTreeItem(child.name, collapsibleState, child.type, child.filePath, child.testCase);
        }));
    }
    /**
     * ツリーアイテムを取得
     */
    getTreeItem(element) {
        return element;
    }
}
exports.TestTreeDataProvider = TestTreeDataProvider;
//# sourceMappingURL=testTreeDataProvider.js.map