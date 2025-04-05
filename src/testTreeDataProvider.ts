import * as path from "path";
import * as vscode from "vscode";
import {
  JestDebugger,
  TestResultStatus,
  onTestOutput,
  onTestSessionEnd,
} from "./debugger";
import { TestCase, extractTestCases } from "./testExtractor";

/**
 * TreeViewに表示するアイテムのタイプ
 */
export type TestItemType =
  | "file" // 通常のファイル
  | "describe" // describeブロック
  | "testCase" // 個別のテストケース
  | "packageAllTests"; // パッケージのすべてのテスト実行

/**
 * TreeViewアイテムのクラス
 */
export class TestTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: TestItemType,
    public readonly filePath: string,
    public readonly testCase?: TestCase
  ) {
    super(label, collapsibleState);

    // アイテムタイプに応じたアイコンを設定
    switch (type) {
      case "packageAllTests":
        this.iconPath = new vscode.ThemeIcon("package");
        this.contextValue = "packageAllTests";
        break;
      case "file":
        this.iconPath = new vscode.ThemeIcon("folder"); // ディレクトリのテスト
        this.tooltip = `ファイル: ${path.basename(filePath)}`;
        this.description = path.relative(
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "",
          filePath
        );
        this.contextValue = "testFile";
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
        // テストケースの場合は、テスト結果に基づいてアイコンを設定
        this.setTestCaseIcon();
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
                selection: new vscode.Range(
                  new vscode.Position(Math.max(0, testCase.lineNumber - 1), 0),
                  new vscode.Position(Math.max(0, testCase.lineNumber - 1), 0)
                ),
              },
            ],
          };
        } else {
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
      if (
        (type === "file" || type === "testCase" || type === "describe") &&
        path.normalize(filePath) === path.normalize(activeFilePath)
      ) {
        // 背景色を少し白くするためにハイライト用のアイコンを設定
        const themeIconId =
          this.iconPath instanceof vscode.ThemeIcon ? this.iconPath.id : "file";
        this.iconPath = new vscode.ThemeIcon(
          themeIconId,
          new vscode.ThemeColor("list.highlightForeground")
        );

        // 元のコンテキスト値を保持しつつ、ハイライト用のコンテキスト値も追加
        // スペースを含む形式だとVSCodeが正しく処理できないケースがあるので修正
        if (this.contextValue) {
          this.contextValue = `${this.contextValue}-highlighted`;
        } else {
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
                  selection: new vscode.Range(
                    new vscode.Position(
                      Math.max(0, testCase.lineNumber - 1),
                      0
                    ),
                    new vscode.Position(Math.max(0, testCase.lineNumber - 1), 0)
                  ),
                },
              ],
            };
          } else {
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

  /**
   * テストケースのアイコンをテスト結果に基づいて設定
   */
  private setTestCaseIcon(): void {
    if (!this.testCase) {
      this.iconPath = new vscode.ThemeIcon("symbol-method");
      return;
    }

    // テスト結果を取得
    const testResult = JestDebugger.getTestResult(
      this.filePath,
      this.testCase.name
    );

    if (!testResult) {
      // テスト結果がない場合はデフォルトのアイコン
      this.iconPath = new vscode.ThemeIcon("symbol-method");
      return;
    }

    // テスト結果に基づいてアイコンを設定
    switch (testResult.status) {
      case TestResultStatus.Success:
        // 成功の場合は緑色のチェックマーク
        this.iconPath = new vscode.ThemeIcon(
          "check",
          new vscode.ThemeColor("testing.iconPassed")
        );
        this.tooltip = `${this.tooltip} [成功]`;
        break;
      case TestResultStatus.Failure:
        // 失敗の場合は赤色のバツ印
        this.iconPath = new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("testing.iconFailed")
        );
        this.tooltip = `${this.tooltip} [失敗]`;
        if (testResult.message) {
          this.tooltip += `\n${testResult.message}`;
        }
        break;
      case TestResultStatus.Running:
        // 実行中の場合は青色の再生アイコン
        this.iconPath = new vscode.ThemeIcon(
          "play",
          new vscode.ThemeColor("testing.iconQueued")
        );
        this.tooltip = `${this.tooltip} [実行中]`;
        break;
      case TestResultStatus.Pending:
        // 保留中の場合は黄色のクロックアイコン
        this.iconPath = new vscode.ThemeIcon(
          "history",
          new vscode.ThemeColor("testing.iconSkipped")
        );
        this.tooltip = `${this.tooltip} [保留中]`;
        break;
      default:
        // その他の場合はデフォルトのアイコン
        this.iconPath = new vscode.ThemeIcon("symbol-method");
        break;
    }
  }
}

/**
 * テストデータノード
 */
interface TestNode {
  name: string;
  type: TestItemType;
  filePath: string;
  children: TestNode[];
  testCase?: TestCase;
}

/**
 * テストツリーデータプロバイダ
 * VSCodeのTreeDataProviderインターフェースを実装
 */
export class TestTreeDataProvider
  implements vscode.TreeDataProvider<TestTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    TestTreeItem | undefined | null | void
  > = new vscode.EventEmitter<TestTreeItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<
    TestTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private rootNodes: TestNode[] = [];
  private lastActiveFilePath?: string;

  // パッケージディレクトリのキャッシュ
  private packageDirectoriesCache: {
    [key: string]: { path: string; name: string };
  } = {};

  // イベントリスナーのディスポーザブル
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // アクティブエディタの変更を監視
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && this.isTestFile(editor.document.uri.fsPath)) {
          this.refresh();
        }
      })
    );

    // テスト出力イベントを監視
    this.disposables.push(
      onTestOutput(() => {
        // テスト出力が更新されたらツリービューを更新
        this._onDidChangeTreeData.fire();
      })
    );

    // テストセッション終了イベントを監視
    this.disposables.push(
      onTestSessionEnd(() => {
        // テストセッションが終了したらツリービューを更新
        this._onDidChangeTreeData.fire();
      })
    );
  }

  /**
   * リソースの破棄
   */
  public dispose(): void {
    // 全てのイベントリスナーを解放
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  /**
   * ルートレベルのノードを構築
   * @returns ルートノードの配列
   */
  private buildRootNodes(): TestNode[] {
    // ルートノード配列を作成（空の配列）
    const rootNodes: TestNode[] = [];
    return rootNodes;
  }

  /**
   * 実装ファイルに対応するテストファイルのパスを取得
   * @param filePath 実装ファイルのパス
   * @returns 対応するテストファイルのパス（存在する場合）、または null
   */
  private async findCorrespondingTestFile(
    filePath: string
  ): Promise<string | null> {
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
    } catch {
      console.log(`対応するテストファイルが見つかりません: ${testFilePath}`);
      return null;
    }
  }

  /**
   * 指定されたディレクトリ内のすべてのテストファイルを検索
   * @param dirPath ディレクトリのパス
   * @returns テストファイルのパスの配列
   */
  private async findAllTestFilesInDirectory(
    dirPath: string
  ): Promise<string[]> {
    try {
      // ディレクトリ内のファイルを取得
      const entries = await vscode.workspace.fs.readDirectory(
        vscode.Uri.file(dirPath)
      );

      // テストファイルをフィルタリング
      const testFiles = entries
        .filter(([name, type]) => {
          return type === vscode.FileType.File && this.isTestFile(name);
        })
        .map(([name]) => path.join(dirPath, name));

      return testFiles;
    } catch (error) {
      console.error(`ディレクトリの読み取りエラー: ${dirPath}`, error);
      return [];
    }
  }

  /**
   * ディレクトリ内のすべてのテストファイルからテストツリーを構築
   * @param dirPath ディレクトリパス
   * @param testFiles テストファイルのパスの配列
   */
  private async buildDirectoryTestTree(
    dirPath: string,
    testFiles: string[]
  ): Promise<void> {
    try {
      const dirName = path.basename(dirPath);
      const directoryNode: TestNode = {
        name: `${dirName}`,
        type: "file",
        filePath: dirPath,
        children: [],
      };

      // ディレクトリノードをルートノードとして設定
      this.rootNodes = [directoryNode];

      // すべてのテストファイルからテストケースを抽出
      for (const testFile of testFiles) {
        const testCases = await extractTestCases(testFile);
        if (testCases.length === 0) {
          continue;
        }

        // ファイル名を取得
        const fileName = path.basename(testFile);
        // extractParamsプレフィックスを持つファイルは特別扱い
        const isExtractParamsFile =
          fileName.startsWith("extractParams") && fileName.endsWith(".test.ts");

        // ファイルノードを作成
        const fileNode: TestNode = {
          name: fileName,
          type: "describe",
          filePath: testFile,
          children: [],
        };
        directoryNode.children.push(fileNode);

        // すべてのテストを実行するノードを追加
        const allTestsNode: TestNode = {
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
            const testNode: TestNode = {
              name: testCase.name,
              type: "testCase",
              filePath: testFile,
              children: [],
              testCase,
            };
            fileNode.children.push(testNode);
          } else {
            let currentNode = fileNode;
            const describePath = [...testCase.describePath]; // コピーを作成

            // describeブロックのパスに沿ってノードを構築
            for (const descName of describePath) {
              // 既存のノードを探す
              let descNode = currentNode.children.find(
                (child) => child.type === "describe" && child.name === descName
              );

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
            const testNode: TestNode = {
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
    } catch (error) {
      vscode.window.showErrorMessage(
        `テストツリーの構築エラー: ${
          error instanceof Error ? error.message : "不明なエラー"
        }`
      );
    }
  }

  /**
   * テストツリーを更新
   */
  public async refresh(): Promise<void> {
    try {
      console.log("テストツリーデータの更新を開始");
      // ルートノードを初期化
      this.rootNodes = this.buildRootNodes();

      // 現在アクティブなエディタを取得
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        // エディタが開かれていない場合は空のツリーを表示
        console.log("アクティブなエディタがありません、空のツリーを表示します");
        this._onDidChangeTreeData.fire();
        return;
      }

      const filePath = editor.document.uri.fsPath;
      this.lastActiveFilePath = filePath;

      console.log(`アクティブファイル: ${filePath}`);
      const currentDirPath = path.dirname(filePath);

      // Jest設定ファイルのあるパッケージディレクトリを検索
      const packageInfo = await this.findPackageDirectoryWithJestConfig(
        filePath
      );
      console.log(
        `検出されたパッケージ: ${packageInfo ? packageInfo.name : "なし"}`
      );

      // ディレクトリ内のすべてのテストファイルを検索
      const testFiles = await this.findAllTestFilesInDirectory(currentDirPath);
      console.log(`ディレクトリ内のテストファイル数: ${testFiles.length}`);

      if (testFiles.length > 0) {
        // ディレクトリ内に複数のテストファイルがある場合はディレクトリモードで表示
        // 現在のディレクトリが前回と同じ場合は不要な更新をスキップ
        if (
          this.lastActiveFilePath === currentDirPath &&
          this.rootNodes.length > 1 &&
          this.rootNodes[1].name === `${path.basename(currentDirPath)}`
        ) {
          console.log("ディレクトリが前回と同じため更新をスキップします");
          return;
        }

        // ディレクトリパスを保存（区別のため）
        this.lastActiveFilePath = currentDirPath;

        // ディレクトリベースのツリーを構築
        console.log(`ディレクトリベースのツリーを構築: ${currentDirPath}`);
        await this.buildDirectoryTestTree(currentDirPath, testFiles);

        // パッケージ情報が見つかった場合、パッケージノードを追加
        if (packageInfo) {
          this.addPackageTestNode(packageInfo);
        }

        console.log("ツリービューを更新します");
        this._onDidChangeTreeData.fire();
        return;
      }

      // テストファイルを特定
      let testFilePath: string | null = null;

      if (this.isTestFile(filePath)) {
        // 現在のファイルがテストファイルの場合はそのまま使用
        testFilePath = filePath;
        console.log(`現在のファイルはテストファイルです: ${testFilePath}`);
      } else {
        // 実装ファイルの場合は対応するテストファイルを探す
        testFilePath = await this.findCorrespondingTestFile(filePath);
        console.log(
          `対応するテストファイル: ${testFilePath || "見つかりません"}`
        );
      }

      // テストファイルが見つからない場合は何もしない
      if (!testFilePath) {
        console.log("テストファイルが見つからないため更新を中止します");
        return;
      }

      // 現在のファイルが前回と同じ場合は不要な更新をスキップ
      if (
        this.lastActiveFilePath === testFilePath &&
        this.rootNodes.length > 0 &&
        this.rootNodes[0].type === "file" &&
        this.rootNodes[0].name === path.basename(testFilePath)
      ) {
        console.log("ファイルが前回と同じため更新をスキップします");
        return;
      }

      // テストファイルのパスを保存
      this.lastActiveFilePath = testFilePath;

      // ツリーデータをリフレッシュ
      console.log(`テストファイルからツリーを構築: ${testFilePath}`);
      this.rootNodes = [];
      await this.buildTestTree(this.lastActiveFilePath);

      console.log("ツリービューを更新します");
      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error("テストツリーの更新に失敗しました:", error);
    }
  }

  /**
   * テストファイルからツリー構造を構築
   */
  private async buildTestTree(filePath: string): Promise<void> {
    try {
      const testCases = await extractTestCases(filePath);
      const fileName = path.basename(filePath);

      // ファイルノードを作成
      const fileNode: TestNode = {
        name: path.basename(filePath),
        type: "file",
        filePath,
        children: [],
      };

      // workspaceNodeを保持し、ファイルノードを追加
      const workspaceNode = this.rootNodes[0]; // ワークスペース全体のテストを実行ノード
      this.rootNodes = [workspaceNode, fileNode];

      // すべてのテストを実行するノード
      const allTestsNode: TestNode = {
        name: "All Tests",
        type: "testCase",
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
      const isExtractParamsFile =
        fileName.startsWith("extractParams") && fileName.endsWith(".test.ts");

      // 各テストケースをツリーに追加
      for (const testCase of testCases) {
        // extractParamsファイルの場合はフラットに表示
        if (isExtractParamsFile) {
          const testNode: TestNode = {
            name: testCase.name,
            type: "testCase",
            filePath,
            children: [],
            testCase,
          };
          fileNode.children.push(testNode);
        } else {
          // 通常のファイルは従来通りdescribeネストを使用
          let currentNode = fileNode;
          const describePath = [...testCase.describePath]; // コピーを作成

          // describeブロックのパスに沿ってノードを構築
          for (const descName of describePath) {
            // 既存のノードを探す
            let descNode = currentNode.children.find(
              (child) => child.type === "describe" && child.name === descName
            );

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
          const testNode: TestNode = {
            name: testCase.name,
            type: "testCase",
            filePath,
            children: [],
            testCase,
          };
          currentNode.children.push(testNode);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `テストツリーの構築中にエラーが発生しました: ${
          error instanceof Error ? error.message : "不明なエラー"
        }`
      );
    }
  }

  /**
   * テストファイルかどうかを判定
   */
  public isTestFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(fileName);
  }

  /**
   * 指定された要素の子ノードを取得
   * @param element 親要素。未指定の場合はルートレベルの要素を返す
   */
  public async getChildren(element?: TestTreeItem): Promise<TestTreeItem[]> {
    if (!element) {
      // ルートレベルの要素
      return this.rootNodes.map((node) => {
        return new TestTreeItem(
          node.name,
          node.children.length > 0
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None,
          node.type,
          node.filePath,
          node.testCase
        );
      });
    }

    // 子要素を取得
    const filePath = element.filePath;

    // elementに対応するノードを検索
    const findNode = (
      nodes: TestNode[],
      label: string,
      type: TestItemType
    ): TestNode | undefined => {
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
    return Promise.resolve(
      node.children.map((child) => {
        const collapsibleState =
          child.children.length > 0
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None;

        return new TestTreeItem(
          child.name,
          collapsibleState,
          child.type,
          child.filePath,
          child.testCase
        );
      })
    );
  }

  /**
   * ツリーアイテムを取得
   */
  public getTreeItem(element: TestTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * 現在のファイルパスからJest設定ファイルがあるパッケージディレクトリを見つける
   * @param filePath ファイルパス
   * @returns パッケージディレクトリのパスと名前
   */
  private async findPackageDirectoryWithJestConfig(
    filePath: string
  ): Promise<{ path: string; name: string } | null> {
    try {
      // キャッシュをチェック
      if (this.packageDirectoriesCache[filePath]) {
        return this.packageDirectoriesCache[filePath];
      }

      const fs = require("fs");
      const path = require("path");
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(
        vscode.Uri.file(filePath)
      );

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
    } catch (error) {
      console.error(
        "パッケージディレクトリの検索中にエラーが発生しました:",
        error
      );
      return null;
    }
  }

  /**
   * パッケージのテスト実行ノードを追加
   * @param packageInfo パッケージ情報
   */
  private addPackageTestNode(packageInfo: {
    path: string;
    name: string;
  }): void {
    // 同じ名前のパッケージノードが既に存在するかチェック
    const existingPackageNode = this.rootNodes.find(
      (node) =>
        node.type === "packageAllTests" && node.name === packageInfo.name
    );

    // 既存のノードがある場合は追加しない
    if (existingPackageNode) {
      return;
    }

    // ルートノードに「パッケージのすべてのテストを実行」ノードを追加
    const packageNode: TestNode = {
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
    } else {
      this.rootNodes.unshift(packageNode);
    }
  }
}
