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
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
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
            case "packageAllTests":
                this.iconPath = new vscode.ThemeIcon("package");
                this.contextValue = "packageAllTests";
                break;
            case "directoryAllTests":
                this.iconPath = new vscode.ThemeIcon("run-all");
                this.tooltip = "このディレクトリのすべてのテストを実行";
                this.contextValue = "directoryAllTests";
                break;
            case "directoryUnitTests":
                this.iconPath = new vscode.ThemeIcon("beaker");
                this.tooltip = "このディレクトリのすべてのユニットテストを実行";
                this.contextValue = "directoryUnitTests";
                break;
            case "directoryE2ETests":
                this.iconPath = new vscode.ThemeIcon("plug");
                this.tooltip = "このディレクトリのすべてのE2Eテストを実行";
                this.contextValue = "directoryE2ETests";
                break;
            case "fileAllTests":
                this.iconPath = new vscode.ThemeIcon("beaker");
                this.tooltip = "このファイルのすべてのテストを実行";
                this.contextValue = "fileAllTests";
                this.command = {
                    command: "vscode.open",
                    title: "ファイルを開く",
                    arguments: [vscode.Uri.file(filePath)],
                };
                break;
            case "file":
                this.iconPath = new vscode.ThemeIcon("folder"); // ディレクイトリのテスト
                this.tooltip = `ファイル: ${path.basename(filePath)}`;
                this.description = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "", filePath);
                this.contextValue = "testFile";
                this.command = {
                    command: "vscode.open",
                    title: "ファイルを開く",
                    arguments: [vscode.Uri.file(filePath)],
                };
                break;
            case "describe":
                this.iconPath = new vscode.ThemeIcon("beaker");
                this.tooltip = `テストグループ: ${label}`;
                this.contextValue = "testDescribe";
                this.command = {
                    command: "vscode.open",
                    title: "ファイルを開く",
                    arguments: [vscode.Uri.file(filePath)],
                };
                break;
            case "testCase":
                this.iconPath = new vscode.ThemeIcon("symbol-method");
                this.tooltip = testCase
                    ? `テスト: ${testCase.name} (行: ${testCase.lineNumber})`
                    : label;
                this.description = testCase ? `行: ${testCase.lineNumber}` : "";
                this.contextValue = "testCase";
                if (testCase) {
                    // テストケースにある行番号があればその行にカーソルを移動して開く
                    this.command = {
                        command: "vscode.open",
                        title: "ファイルを開いてテストにジャンプ",
                        arguments: [
                            vscode.Uri.file(filePath),
                            {
                                selection: new vscode.Range(new vscode.Position(Math.max(0, testCase.lineNumber - 1), 0), new vscode.Position(Math.max(0, testCase.lineNumber - 1), 0)),
                            },
                        ],
                    };
                }
                else {
                    this.command = {
                        command: "vscode.open",
                        title: "ファイルを開く",
                        arguments: [vscode.Uri.file(filePath)],
                    };
                }
                break;
        }
        // 現在アクティブなエディタのファイルパスを取得
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const activeFilePath = activeEditor.document.uri.fsPath;
            // 現在のアイテムが現在フォーカスしているファイルと同じファイルの項目かチェック
            if ((type === "file" ||
                type === "fileAllTests" ||
                type === "testCase" ||
                type === "describe") &&
                path.normalize(filePath) === path.normalize(activeFilePath)) {
                // 背景色を少し白くするためにハイライト用のアイコンを設定
                const themeIconId = this.iconPath instanceof vscode.ThemeIcon ? this.iconPath.id : "file";
                this.iconPath = new vscode.ThemeIcon(themeIconId, new vscode.ThemeColor("list.highlightForeground"));
                // 元のコンテキスト値を保持しつつ、ハイライト用のコンテキスト値も追加
                // スペースを含む形式だとVSCodeが正しく処理できないケースがあるので修正
                if (this.contextValue) {
                    this.contextValue = `${this.contextValue}-highlighted`;
                }
                else {
                    this.contextValue = "highlighted";
                }
                this.tooltip = `${this.tooltip || ""} [現在のファイル]`;
                // 重要: ハイライト適用時もコマンドプロパティは維持
                // 特定のタイプやコマンドがない場合のみファイルを開くコマンドを設定
                if (!this.command && filePath) {
                    if (testCase && testCase.lineNumber > 0) {
                        // テストケースの行番号がある場合は、その行にジャンプするコマンド
                        this.command = {
                            command: "vscode.open",
                            title: "ファイルを開いてテストにジャンプ",
                            arguments: [
                                vscode.Uri.file(filePath),
                                {
                                    selection: new vscode.Range(new vscode.Position(Math.max(0, testCase.lineNumber - 1), 0), new vscode.Position(Math.max(0, testCase.lineNumber - 1), 0)),
                                },
                            ],
                        };
                    }
                    else {
                        // それ以外は単にファイルを開くコマンド
                        this.command = {
                            command: "vscode.open",
                            title: "ファイルを開く",
                            arguments: [vscode.Uri.file(filePath)],
                        };
                    }
                }
            }
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
        // パッケージディレクトリのキャッシュ
        this.packageDirectoriesCache = {};
        // アクティブエディタの変更を監視
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && this.isTestFile(editor.document.uri.fsPath)) {
                this.refresh();
            }
        });
    }
    /**
     * ルートレベルのノードを構築
     * @returns ルートノードの配列
     */
    buildRootNodes() {
        // ルートノード配列を作成（空の配列）
        const rootNodes = [];
        return rootNodes;
    }
    /**
     * 実装ファイルに対応するテストファイルのパスを取得
     * @param filePath 実装ファイルのパス
     * @returns 対応するテストファイルのパス（存在する場合）、または null
     */
    async findCorrespondingTestFile(filePath) {
        // 既にテストファイルの場合はそのまま返す
        if (this.isTestFile(filePath)) {
            return filePath;
        }
        // ファイル名と拡張子を取得
        const ext = path.extname(filePath);
        const fileNameWithoutExt = path.basename(filePath, ext);
        const dir = path.dirname(filePath);
        // 想定されるテストファイル名を生成
        const testFileName = `${fileNameWithoutExt}.test${ext}`;
        const testFilePath = path.join(dir, testFileName);
        // ファイルが存在するか確認
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(testFilePath));
            return testFilePath;
        }
        catch {
            console.log(`対応するテストファイルが見つかりません: ${testFilePath}`);
            return null;
        }
    }
    /**
     * 指定されたディレクトリ内のすべてのテストファイルを検索
     * @param dirPath ディレクトリのパス
     * @returns テストファイルのパスの配列
     */
    async findAllTestFilesInDirectory(dirPath) {
        try {
            // ディレクトリ内のファイルを取得
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
            // テストファイルをフィルタリング
            const testFiles = entries
                .filter(([name, type]) => {
                return type === vscode.FileType.File && this.isTestFile(name);
            })
                .map(([name]) => path.join(dirPath, name));
            return testFiles;
        }
        catch (error) {
            console.error(`ディレクトリの読み取りエラー: ${dirPath}`, error);
            return [];
        }
    }
    /**
     * ディレクトリ内のすべてのテストファイルからテストツリーを構築
     * @param dirPath ディレクトリパス
     * @param testFiles テストファイルのパスの配列
     */
    async buildDirectoryTestTree(dirPath, testFiles) {
        try {
            const dirName = path.basename(dirPath);
            const directoryNode = {
                name: `${dirName}`,
                type: "file",
                filePath: dirPath,
                children: [],
            };
            // ディレクトリノードをルートノードとして設定
            this.rootNodes = [directoryNode];
            // // 「すべてのテストを実行」ノードをディレクトリノードの直下に追加
            // const allDirTestsNode: TestNode = {
            //   name: "すべてのテストを実行",
            //   type: "directoryAllTests",
            //   filePath: dirPath,
            //   children: [],
            //   testCase: {
            //     name: "すべてのテストを実行",
            //     fullName: "すべてのテストを実行",
            //     describePath: [],
            //     lineNumber: 0,
            //     isAllTests: true,
            //     isDirectoryAllTests: true,
            //   },
            // };
            // directoryNode.children.push(allDirTestsNode);
            // // 「ユニットテストのみ実行」ノードを追加
            // const unitTestsNode: TestNode = {
            //   name: "ユニットテストを実行",
            //   type: "directoryUnitTests",
            //   filePath: dirPath,
            //   children: [],
            //   testCase: {
            //     name: "ユニットテストを実行",
            //     fullName: "ユニットテストを実行",
            //     describePath: [],
            //     lineNumber: 0,
            //     isAllTests: true,
            //     isDirectoryAllTests: true,
            //   },
            // };
            // directoryNode.children.push(unitTestsNode);
            // // 「E2Eテストのみ実行」ノードを追加
            // const e2eTestsNode: TestNode = {
            //   name: "E2Eテストを実行",
            //   type: "directoryE2ETests",
            //   filePath: dirPath,
            //   children: [],
            //   testCase: {
            //     name: "E2Eテストを実行",
            //     fullName: "E2Eテストを実行",
            //     describePath: [],
            //     lineNumber: 0,
            //     isAllTests: true,
            //     isDirectoryAllTests: true,
            //   },
            // };
            // directoryNode.children.push(e2eTestsNode);
            // すべてのテストファイルからテストケースを抽出
            for (const testFile of testFiles) {
                const testCases = await (0, testExtractor_1.extractTestCases)(testFile);
                if (testCases.length === 0) {
                    continue;
                }
                // ファイル名を取得
                const fileName = path.basename(testFile);
                // extractParamsプレフィックスを持つファイルは特別扱い
                const isExtractParamsFile = fileName.startsWith("extractParams") && fileName.endsWith(".test.ts");
                // ファイルノードを作成
                const fileNode = {
                    name: fileName,
                    type: "describe",
                    filePath: testFile,
                    children: [],
                };
                directoryNode.children.push(fileNode);
                // すべてのテストを実行するノードを追加
                const allTestsNode = {
                    name: "All Tests",
                    type: "testCase",
                    filePath: testFile,
                    children: [],
                    testCase: {
                        name: "All Tests",
                        fullName: "All Tests",
                        describePath: [],
                        lineNumber: 0,
                        isAllTests: true,
                    },
                };
                fileNode.children.push(allTestsNode);
                // 各テストケースをツリーに追加
                for (const testCase of testCases) {
                    // extractParamsファイルの場合はフラットに表示
                    if (isExtractParamsFile) {
                        const testNode = {
                            name: testCase.name,
                            type: "testCase",
                            filePath: testFile,
                            children: [],
                            testCase,
                        };
                        fileNode.children.push(testNode);
                    }
                    else {
                        let currentNode = fileNode;
                        const describePath = [...testCase.describePath]; // コピーを作成
                        // describeブロックのパスに沿ってノードを構築
                        for (const descName of describePath) {
                            // 既存のノードを探す
                            let descNode = currentNode.children.find((child) => child.type === "describe" && child.name === descName);
                            // 存在しなければ新規作成
                            if (!descNode) {
                                descNode = {
                                    name: descName,
                                    type: "describe",
                                    filePath: testFile,
                                    children: [],
                                };
                                currentNode.children.push(descNode);
                            }
                            // 次のレベルへ
                            currentNode = descNode;
                        }
                        // テストケースノードを追加
                        const testNode = {
                            name: testCase.name,
                            type: "testCase",
                            filePath: testFile,
                            children: [],
                            testCase,
                        };
                        currentNode.children.push(testNode);
                    }
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`テストツリーの構築エラー: ${error instanceof Error ? error.message : "不明なエラー"}`);
        }
    }
    /**
     * テストツリーを更新
     */
    async refresh() {
        try {
            // ルートノードを初期化
            this.rootNodes = this.buildRootNodes();
            // 現在アクティブなエディタを取得
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                // エディタが開かれていない場合は空のツリーを表示
                this._onDidChangeTreeData.fire();
                return;
            }
            const filePath = editor.document.uri.fsPath;
            this.lastActiveFilePath = filePath;
            const currentDirPath = path.dirname(filePath);
            // Jest設定ファイルのあるパッケージディレクトリを検索
            const packageInfo = await this.findPackageDirectoryWithJestConfig(filePath);
            // ディレクトリ内のすべてのテストファイルを検索
            const testFiles = await this.findAllTestFilesInDirectory(currentDirPath);
            if (testFiles.length > 0) {
                // ディレクトリ内に複数のテストファイルがある場合はディレクトリモードで表示
                // 現在のディレクトリが前回と同じ場合は不要な更新をスキップ
                if (this.lastActiveFilePath === currentDirPath &&
                    this.rootNodes.length > 1 &&
                    this.rootNodes[1].name === `${path.basename(currentDirPath)}`) {
                    return;
                }
                // ディレクトリパスを保存（区別のため）
                this.lastActiveFilePath = currentDirPath;
                // ディレクトリベースのツリーを構築
                await this.buildDirectoryTestTree(currentDirPath, testFiles);
                // パッケージ情報が見つかった場合、パッケージノードを追加
                if (packageInfo) {
                    this.addPackageTestNode(packageInfo);
                }
                this._onDidChangeTreeData.fire();
                return;
            }
            // テストファイルを特定
            let testFilePath = null;
            if (this.isTestFile(filePath)) {
                // 現在のファイルがテストファイルの場合はそのまま使用
                testFilePath = filePath;
            }
            else {
                // 実装ファイルの場合は対応するテストファイルを探す
                testFilePath = await this.findCorrespondingTestFile(filePath);
            }
            // テストファイルが見つからない場合は何もしない
            if (!testFilePath) {
                return;
            }
            // 現在のファイルが前回と同じ場合は不要な更新をスキップ
            if (this.lastActiveFilePath === testFilePath &&
                this.rootNodes.length > 0 &&
                this.rootNodes[0].type === "file" &&
                this.rootNodes[0].name === path.basename(testFilePath)) {
                return;
            }
            // テストファイルのパスを保存
            this.lastActiveFilePath = testFilePath;
            // ツリーデータをリフレッシュ
            this.rootNodes = [];
            await this.buildTestTree(this.lastActiveFilePath);
            this._onDidChangeTreeData.fire();
        }
        catch (error) {
            console.error("テストツリーの更新に失敗しました:", error);
        }
    }
    /**
     * テストファイルからツリー構造を構築
     */
    async buildTestTree(filePath) {
        try {
            const testCases = await (0, testExtractor_1.extractTestCases)(filePath);
            const fileName = path.basename(filePath);
            // ファイルノードを作成
            const fileNode = {
                name: path.basename(filePath),
                type: "file",
                filePath,
                children: [],
            };
            // workspaceNodeを保持し、ファイルノードを追加
            const workspaceNode = this.rootNodes[0]; // ワークスペース全体のテストを実行ノード
            this.rootNodes = [workspaceNode, fileNode];
            // すべてのテストを実行するノード
            const allTestsNode = {
                name: "All Tests",
                type: "fileAllTests",
                filePath,
                children: [],
                testCase: {
                    name: "All Tests",
                    fullName: "All Tests",
                    describePath: [],
                    lineNumber: 0,
                    isAllTests: true,
                },
            };
            fileNode.children.push(allTestsNode);
            // extractParamsプレフィックスを持つファイルは特別扱い
            const isExtractParamsFile = fileName.startsWith("extractParams") && fileName.endsWith(".test.ts");
            // 各テストケースをツリーに追加
            for (const testCase of testCases) {
                // extractParamsファイルの場合はフラットに表示
                if (isExtractParamsFile) {
                    const testNode = {
                        name: testCase.name,
                        type: "testCase",
                        filePath,
                        children: [],
                        testCase,
                    };
                    fileNode.children.push(testNode);
                }
                else {
                    // 通常のファイルは従来通りdescribeネストを使用
                    let currentNode = fileNode;
                    const describePath = [...testCase.describePath]; // コピーを作成
                    // describeブロックのパスに沿ってノードを構築
                    for (const descName of describePath) {
                        // 既存のノードを探す
                        let descNode = currentNode.children.find((child) => child.type === "describe" && child.name === descName);
                        // 存在しなければ新規作成
                        if (!descNode) {
                            descNode = {
                                name: descName,
                                type: "describe",
                                filePath,
                                children: [],
                            };
                            currentNode.children.push(descNode);
                        }
                        // 次のレベルへ
                        currentNode = descNode;
                    }
                    // テストケースノードを追加
                    const testNode = {
                        name: testCase.name,
                        type: "testCase",
                        filePath,
                        children: [],
                        testCase,
                    };
                    currentNode.children.push(testNode);
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`テストツリーの構築中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`);
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
     * 指定された要素の子ノードを取得
     * @param element 親要素。未指定の場合はルートレベルの要素を返す
     */
    async getChildren(element) {
        if (!element) {
            // ルートレベルの要素
            return this.rootNodes.map((node) => {
                return new TestTreeItem(node.name, node.children.length > 0
                    ? vscode.TreeItemCollapsibleState.Expanded
                    : vscode.TreeItemCollapsibleState.None, node.type, node.filePath, node.testCase);
            });
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
    /**
     * 現在のファイルパスからJest設定ファイルがあるパッケージディレクトリを見つける
     * @param filePath ファイルパス
     * @returns パッケージディレクトリのパスと名前
     */
    async findPackageDirectoryWithJestConfig(filePath) {
        try {
            // キャッシュをチェック
            if (this.packageDirectoriesCache[filePath]) {
                return this.packageDirectoriesCache[filePath];
            }
            const fs = require("fs");
            const path = require("path");
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
            if (!workspaceFolder) {
                return null;
            }
            // ファイルパスからディレクトリを取得
            let currentDir = path.dirname(filePath);
            const workspacePath = workspaceFolder.uri.fsPath;
            // ルートパターン (apps/*/jest.config.js) に合致するまで親ディレクトリを遡る
            while (currentDir.startsWith(workspacePath)) {
                // Jest設定ファイルの存在をチェック
                const jestConfigPath = path.join(currentDir, "jest.config.js");
                if (fs.existsSync(jestConfigPath)) {
                    // 見つかったパッケージディレクトリ名を取得
                    const packageName = path.basename(currentDir);
                    // キャッシュに保存
                    const result = { path: currentDir, name: packageName };
                    this.packageDirectoriesCache[filePath] = result;
                    return result;
                }
                // 親ディレクトリへ
                const parentDir = path.dirname(currentDir);
                // ルートに到達したら終了
                if (parentDir === currentDir) {
                    break;
                }
                currentDir = parentDir;
            }
            return null;
        }
        catch (error) {
            console.error("パッケージディレクトリの検索中にエラーが発生しました:", error);
            return null;
        }
    }
    /**
     * パッケージのテスト実行ノードを追加
     * @param packageInfo パッケージ情報
     */
    addPackageTestNode(packageInfo) {
        // 同じ名前のパッケージノードが既に存在するかチェック
        const existingPackageNode = this.rootNodes.find((node) => node.type === "packageAllTests" && node.name === packageInfo.name);
        // 既存のノードがある場合は追加しない
        if (existingPackageNode) {
            return;
        }
        // ルートノードに「パッケージのすべてのテストを実行」ノードを追加
        const packageNode = {
            name: `${packageInfo.name}`,
            type: "packageAllTests",
            filePath: packageInfo.path,
            children: [],
            testCase: {
                name: `${packageInfo.name}`,
                fullName: `${packageInfo.name}`,
                describePath: [],
                lineNumber: 0,
                isAllTests: true,
            },
        };
        // ルートノードの先頭にパッケージノードを追加
        if (this.rootNodes.length === 0) {
            this.rootNodes.push(packageNode);
        }
        else {
            this.rootNodes.unshift(packageNode);
        }
    }
}
exports.TestTreeDataProvider = TestTreeDataProvider;
//# sourceMappingURL=testTreeDataProvider.js.map