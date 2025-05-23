import * as path from "path";
import * as vscode from "vscode";
import { extractTestCases, TestCase } from "./testExtractor";
import * as testResultProcessor from "./testResultProcessor2";
import { onTestResultsUpdated, TestResultStatus } from "./testResultProcessor2";
import { isTestFile } from "./testUtils";

/**
 * TreeViewに表示するアイテムのタイプ
 */
export type TestItemType =
  | "file" // 通常のファイル
  | "describe" // describeブロック
  | "testCase" // 個別のテストケース
  | "packageAllTests"; // パッケージのすべてのテスト実行

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
 * TreeViewアイテムのクラス
 */
export class TestTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: TestItemType,
    public readonly filePath: string,
    public readonly isTestFileFlag: boolean,
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
        if (isTestFileFlag) {
          // テストファイルの場合、テスト結果に基づいてアイコンを設定
          const testStatus = this.checkFileTestStatus();
          if (testStatus === "success") {
            // すべてのテストが成功している場合は緑色のチェックマーク
            this.iconPath = new vscode.ThemeIcon(
              "check",
              new vscode.ThemeColor("testing.iconPassed")
            );
            this.tooltip = `ファイル: ${path.basename(
              filePath
            )} [すべてのテスト成功]`;
          } else if (testStatus === "failure") {
            // 失敗したテストがある場合は赤色のバツ印
            this.iconPath = new vscode.ThemeIcon(
              "error",
              new vscode.ThemeColor("testing.iconFailed")
            );
            this.tooltip = `ファイル: ${path.basename(
              filePath
            )} [テスト失敗あり]`;
          } else {
            // それ以外の場合は通常のファイルアイコン
            this.iconPath = new vscode.ThemeIcon("file");
            this.tooltip = `ファイル: ${path.basename(filePath)}`;
          }
        } else {
          // テストファイルでない場合は通常のフォルダアイコン
          this.iconPath = new vscode.ThemeIcon("folder");
          this.tooltip = `ファイル: ${path.basename(filePath)}`;
        }

        this.description = path.relative(
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "",
          filePath
        );

        // ファイルノードはテストファイルの場合、実行可能なコンテキスト値を設定
        if (isTestFileFlag) {
          this.contextValue = "runnableTestFile";
        } else {
          this.contextValue = "testFile";
        }
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

    // ファイルノードまたはdescribeノード（ファイルを表す場合）であり、
    // かつテストファイルの場合に実行用コンテキストを追加
    if ((type === "file" || type === "describe") && isTestFileFlag) {
      // 既存のコンテキスト値にスペース区切りで追加
      const runnableContext = "runnableTestFile";
      this.contextValue = this.contextValue
        ? `${this.contextValue} ${runnableContext}`
        : runnableContext;
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
    const testResult = testResultProcessor.getTestResult(
      this.filePath,
      this.testCase.fullName // testCase.fullName を使用
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
        // Pending状態の場合もデフォルトのアイコンを使用
        this.iconPath = new vscode.ThemeIcon("symbol-method");
        this.tooltip = `${this.tooltip}`;
        break;
      default:
        // その他の場合はデフォルトのアイコン
        this.iconPath = new vscode.ThemeIcon("symbol-method");
        break;
    }
  }

  /**
   * ファイル内のテスト結果のステータスをチェック
   * @returns "success" - すべてのテストが成功, "failure" - 失敗したテストあり, "unknown" - テスト結果なし
   */
  private checkFileTestStatus(): "success" | "failure" | "unknown" {
    try {
      // ファイルパスが有効であることを確認
      if (!this.filePath || !this.isTestFileFlag) {
        return "unknown";
      }

      // テスト結果を取得
      const allResults = testResultProcessor.getAllTestResults();
      const filePathIndex = testResultProcessor.getFilePathIndex();

      if (Object.keys(allResults).length === 0) {
        return "unknown"; // テスト結果がない場合
      }

      // このファイルに関連するテスト結果を抽出
      const normalizedPath = path.normalize(this.filePath);
      const baseNameOnly = path.basename(this.filePath);

      // インデックスからファイルに関連するキーを取得
      const relatedKeys = new Set<string>();

      // 正規化されたパスでインデックスから検索
      const pathKeys = filePathIndex.get(normalizedPath);
      if (pathKeys) {
        pathKeys.forEach((key) => relatedKeys.add(key));
      }

      // ファイル名のみでもインデックスから検索
      const baseNameKeys = filePathIndex.get(baseNameOnly);
      if (baseNameKeys) {
        baseNameKeys.forEach((key) => relatedKeys.add(key));
      }

      // 関連するキーが見つからない場合は未知の状態を返す
      if (relatedKeys.size === 0) {
        return "unknown";
      }

      // インデックスから取得したキーを使用してテスト結果をチェック
      let hasFailedTests = false;

      for (const key of relatedKeys) {
        const separatorIndex = key.lastIndexOf("#");
        if (separatorIndex !== -1) {
          const filePath = key.substring(0, separatorIndex);
          const testName = key.substring(separatorIndex + 1);
          const result = allResults[filePath]?.[testName];

          if (result && result.status === TestResultStatus.Failure) {
            hasFailedTests = true;
            break;
          }
        }
      }

      // 関連するテスト結果が見つかり、すべて成功していればsuccess
      return hasFailedTests ? "failure" : "success";
    } catch (error) {
      console.error("テスト結果チェック中にエラーが発生:", error);
      return "unknown";
    }
  }

  /**
   * ファイル内のすべてのテストが成功しているかをチェック
   * @returns すべてのテストが成功している場合はtrue、それ以外はfalse
   */
  private checkAllTestsSucceeded(): boolean {
    return this.checkFileTestStatus() === "success";
  }
}

// debounce関数の実装（関数型スタイル）
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>): void => {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
};

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
  private failedTestsNode: TestNode | null = null;
  private packageDirectoriesCache: {
    [key: string]: { path: string; name: string };
  } = {};

  // 前回のノード状態を保存する変数を追加
  private previousNodeState: Map<string, TestNode> = new Map();

  // イベントリスナーのディスポーザブル
  private disposables: vscode.Disposable[] = [];

  // debouncedRefresh関数を作成
  private debouncedRefresh = debounce(async () => {
    await this.refresh();
  }, 300); // 300ms以内の連続したイベントをまとめる

  // 変更されたノードを追跡するための変数を追加
  private changedNodes: Set<string> = new Set();
  private nodeItemCache: Map<string, TestTreeItem> = new Map();

  constructor() {
    // アクティブエディタの変更を監視 - debounce処理を追加
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && isTestFile(editor.document.uri.fsPath)) {
          this.debouncedRefresh();
        }
      })
    );

    // テスト結果が更新されたときにツリービューを更新 - debounce処理を追加
    this.disposables.push(
      onTestResultsUpdated(() => {
        console.log("テスト結果更新を検知、ツリービューを更新します");
        this.debouncedRefresh();
      })
    );

    // テキスト変更リスナーを追加 - debounce処理を追加
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const filePath = event.document.uri.fsPath;
        // テストファイルの変更を検出したら更新
        if (isTestFile(filePath)) {
          this.debouncedUpdateTestFile(filePath);
        }
      })
    );
  }

  // debouncedUpdateTestFile関数を作成
  private debouncedUpdateTestFile = debounce(
    (filePath: string) => this.updateTestFile(filePath),
    300
  );

  /**
   * リソースの破棄
   */
  public dispose(): void {
    // 全てのイベントリスナーを解放
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  /**
   * ノードキーからTreeItemを検索
   * @param nodeKey ノードキー
   * @returns 見つかったTreeItemまたはundefined
   */
  private findTreeItemByNodeKey(nodeKey: string): TestTreeItem | undefined {
    return this.nodeItemCache.get(nodeKey);
  }

  /**
   * ノードの変更を通知する
   * @param changedNodeKeys 変更されたノードのキーの配列
   */
  private notifyNodesChanged(changedNodeKeys: string[]): void {
    if (changedNodeKeys.length === 0) {
      // 変更がない場合は何もしない
      return;
    }

    if (changedNodeKeys.length > 10) {
      // 変更が多すぎる場合は全体更新
      this._onDidChangeTreeData.fire();
      return;
    }

    // 変更されたノードを特定し個別に更新
    const affectedItems = changedNodeKeys
      .map((key) => this.findTreeItemByNodeKey(key))
      .filter((item): item is TestTreeItem => item !== undefined);

    if (affectedItems.length === 0) {
      // 対応するアイテムが見つからない場合は全体更新
      this._onDidChangeTreeData.fire();
      return;
    }

    // 各ノードの更新を通知
    affectedItems.forEach((item) => {
      this._onDidChangeTreeData.fire(item);
    });
  }

  /**
   * 全てのツリーアイテムをキャッシュに保存
   */
  private cacheAllTreeItems(): void {
    // キャッシュをクリア
    this.nodeItemCache.clear();

    // ツリーアイテムを生成して保存する関数
    const createAndCacheTreeItems = (nodes: TestNode[]): TestTreeItem[] => {
      return nodes.map((node) => {
        // ノードのキーを生成
        const nodeKey = `${node.filePath}#${node.type}#${node.name}`;

        // ツリーアイテムを作成
        const treeItem = new TestTreeItem(
          node.name,
          node.children.length > 0
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None,
          node.type,
          node.filePath,
          isTestFile(node.filePath),
          node.testCase
        );

        // キャッシュに保存
        this.nodeItemCache.set(nodeKey, treeItem);

        // 子ノードも処理
        createAndCacheTreeItems(node.children);

        return treeItem;
      });
    };

    // ルートノードから処理開始
    createAndCacheTreeItems(this.rootNodes);
  }

  /**
   * ツリーアイテムを取得
   */
  public getTreeItem(element: TestTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * 指定された要素の子ノードを取得
   * @param element 親要素。未指定の場合はルートレベルの要素を返す
   */
  public async getChildren(element?: TestTreeItem): Promise<TestTreeItem[]> {
    if (!element) {
      // ルートレベルの要素を返す前にキャッシュを更新
      const rootItems = this.rootNodes.map((node) => {
        const nodeKey = `${node.filePath}#${node.type}#${node.name}`;
        const treeItem = new TestTreeItem(
          node.name,
          node.children.length > 0
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None,
          node.type,
          node.filePath,
          isTestFile(node.filePath),
          node.testCase
        );

        // キャッシュに保存
        this.nodeItemCache.set(nodeKey, treeItem);

        return treeItem;
      });

      return rootItems;
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
        const nodeKey = `${child.filePath}#${child.type}#${child.name}`;
        const collapsibleState =
          child.children.length > 0
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None;

        const treeItem = new TestTreeItem(
          child.name,
          collapsibleState,
          child.type,
          child.filePath,
          isTestFile(child.filePath),
          child.testCase
        );

        // キャッシュに保存
        this.nodeItemCache.set(nodeKey, treeItem);

        return treeItem;
      })
    );
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

      // 各テストファイルを処理
      for (const testFile of testFiles) {
        const testCases = await extractTestCases(testFile);
        if (testCases.length === 0) {
          continue;
        }

        // ファイルノードを作成
        const fileName = path.basename(testFile);
        const fileNode: TestNode = {
          name: fileName,
          type: "file",
          filePath: testFile,
          children: [],
        };
        directoryNode.children.push(fileNode);

        // 単一の describe ブロックを省略するかどうかの判定
        let omitSingleDescribe = false;
        if (testCases.length > 0) {
          const firstDescribePath = testCases[0].describePath;
          if (firstDescribePath.length === 1) {
            // describe のネストが1階層のみ
            omitSingleDescribe = testCases.every(
              (tc) =>
                tc.describePath.length === 1 &&
                tc.describePath[0] === firstDescribePath[0]
            );
          }
        }

        // extractParamsファイルは特別扱い (omitSingleDescribeより優先)
        const isExtractParamsFile =
          fileName.startsWith("extractParams") && fileName.endsWith(".test.ts");

        // 各テストケースをツリーに追加
        for (const testCase of testCases) {
          let parentNode = fileNode; // デフォルトはファイルノード

          // describeネストを構築するかどうか
          if (!isExtractParamsFile && !omitSingleDescribe) {
            // 通常通り describe ネストを構築
            const describePath = [...testCase.describePath];
            for (const descName of describePath) {
              let descNode = parentNode.children.find(
                (child) => child.type === "describe" && child.name === descName
              );
              if (!descNode) {
                descNode = {
                  name: descName,
                  type: "describe",
                  filePath: testFile,
                  children: [],
                };
                parentNode.children.push(descNode);
              }
              parentNode = descNode;
            }
          }
          // else: parentNode は fileNode のまま (ファイル直下にテストケースを追加)

          // テストケースノードを追加
          const testNode: TestNode = {
            name: testCase.name,
            type: "testCase",
            filePath: testFile,
            children: [],
            testCase,
          };
          parentNode.children.push(testNode);
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
   * テストファイルからツリー構造を構築
   */
  private async buildTestTree(filePath: string): Promise<void> {
    try {
      const testCases = await extractTestCases(filePath);
      const fileName = path.basename(filePath);

      // ファイルノードを作成
      const fileNode: TestNode = {
        name: fileName,
        type: "file",
        filePath,
        children: [],
      };

      // 単一の describe ブロックを省略するかどうかの判定
      let omitSingleDescribe = false;
      if (testCases.length > 0) {
        const firstDescribePath = testCases[0].describePath;
        if (firstDescribePath.length === 1) {
          // describe のネストが1階層のみ
          // すべてのテストケースが同じ describePath を持つか確認
          omitSingleDescribe = testCases.every(
            (tc) =>
              tc.describePath.length === 1 &&
              tc.describePath[0] === firstDescribePath[0]
          );
        }
      }

      // extractParamsプレフィックスを持つファイルは特別扱い (omitSingleDescribeより優先)
      const isExtractParamsFile =
        fileName.startsWith("extractParams") && fileName.endsWith(".test.ts");

      // 各テストケースをツリーに追加
      for (const testCase of testCases) {
        let parentNode = fileNode;

        // describeネストを構築するか、ファイル直下に追加するか
        if (!isExtractParamsFile && !omitSingleDescribe) {
          // 通常通り describe ネストを構築
          const describePath = [...testCase.describePath];
          for (const descName of describePath) {
            let descNode = parentNode.children.find(
              (child) => child.type === "describe" && child.name === descName
            );
            if (!descNode) {
              descNode = {
                name: descName,
                type: "describe",
                filePath,
                children: [],
              };
              parentNode.children.push(descNode);
            }
            parentNode = descNode; // 次のレベルへ
          }
        }
        // else: isExtractParamsFile または omitSingleDescribe が true の場合
        // parentNode は fileNode のまま (ファイル直下にテストケースを追加)

        // テストケースノードを追加
        const testNode: TestNode = {
          name: testCase.name,
          type: "testCase",
          filePath,
          children: [],
          testCase,
        };
        parentNode.children.push(testNode);
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
   * 実装ファイルに対応するテストファイルのパスを取得
   * @param filePath 実装ファイルのパス
   * @returns 対応するテストファイルのパス（存在する場合）、または null
   */
  private async findCorrespondingTestFile(
    filePath: string
  ): Promise<string | null> {
    // 既にテストファイルの場合はそのまま返す
    if (isTestFile(filePath)) {
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
          return type === vscode.FileType.File && isTestFile(name);
        })
        .map(([name]) => path.join(dirPath, name));

      return testFiles;
    } catch (error) {
      console.error(`ディレクトリの読み取りエラー: ${dirPath}`, error);
      return [];
    }
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

  /**
   * テストツリーを更新
   */
  public async refresh(): Promise<void> {
    try {
      // 現在アクティブなエディタを取得
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        // エディタが開かれていない場合は空のツリーを表示
        this.rootNodes = this.buildRootNodes();
        this._onDidChangeTreeData.fire();
        return;
      }

      const filePath = editor.document.uri.fsPath;
      const currentDirPath = path.dirname(filePath);

      // 差分更新: 同じファイルの場合はスキップ
      if (this.lastActiveFilePath === filePath && this.rootNodes.length > 0) {
        // テスト結果のみが変わった可能性があるので、部分更新を行う
        const changedNodeKeys = this.updateNodeStatus();
        this.notifyNodesChanged(changedNodeKeys);
        return;
      }

      // キャッシュキーの作成
      const cacheKey = isTestFile(filePath) ? filePath : currentDirPath;

      // 前回と同じディレクトリ/ファイルかつツリーが構築済みの場合
      if (this.lastActiveFilePath === cacheKey && this.rootNodes.length > 0) {
        // 差分更新のために部分的に更新
        const changedNodeKeys = this.updateNodeStatus();
        this.notifyNodesChanged(changedNodeKeys);
        return;
      }

      // 新しいファイル/ディレクトリの場合は前回のパスを更新
      this.lastActiveFilePath = filePath;

      // 新しいツリーを構築するための準備
      // ルートノードを初期化
      const newRootNodes = this.buildRootNodes();

      // パッケージディレクトリ情報を取得
      const packageInfo = await this.findPackageDirectoryWithJestConfig(
        filePath
      );

      // ディレクトリ内のすべてのテストファイルを検索
      const testFiles = await this.findAllTestFilesInDirectory(currentDirPath);

      if (testFiles.length > 0) {
        // ディレクトリモードでの表示処理
        this.lastActiveFilePath = currentDirPath;

        // 新しいディレクトリツリーを構築
        await this.buildDirectoryTestTree(currentDirPath, testFiles);

        // パッケージ情報が見つかった場合、パッケージノードを追加
        if (packageInfo) {
          this.addPackageTestNode(packageInfo);
        }

        // 現在のノード状態を保存
        this.saveNodeState();

        // ツリーアイテムをキャッシュ
        this.cacheAllTreeItems();

        // 全体を更新
        this._onDidChangeTreeData.fire();
        return;
      }

      // テストファイルを特定
      const testFilePath = isTestFile(filePath)
        ? filePath
        : await this.findCorrespondingTestFile(filePath);

      // テストファイルが見つからない場合は何もしない
      if (!testFilePath) {
        return;
      }

      // テストファイルのパスを保存
      this.lastActiveFilePath = testFilePath;

      // ツリーデータをリフレッシュ
      this.rootNodes = [];
      await this.buildTestTree(this.lastActiveFilePath);

      // 現在のノード状態を保存
      this.saveNodeState();

      // ツリーアイテムをキャッシュ
      this.cacheAllTreeItems();

      // 変更を通知（全体更新）
      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error("テストツリーの更新に失敗しました:", error);
    }
  }

  /**
   * 現在のノード状態を保存
   */
  private saveNodeState(): void {
    // 変更されたノードのキーをクリア
    this.changedNodes.clear();

    // 新しいMapを作成
    const newState = new Map<string, TestNode>();

    // 各ノードを再帰的に処理するヘルパー関数（再帰ではなく反復処理）
    const processNodes = (nodes: TestNode[]): void => {
      // スタックベースの処理でスタックオーバーフローを避ける
      const stack: TestNode[] = [...nodes];

      while (stack.length > 0) {
        const node = stack.pop()!;

        // ノードのキーを作成（ファイルパス + 名前 + タイプで一意に識別）
        const nodeKey = `${node.filePath}#${node.type}#${node.name}`;

        // 前回の状態と比較して変更を検出
        const previousNode = this.previousNodeState.get(nodeKey);
        const hasChanged =
          !previousNode ||
          JSON.stringify(previousNode) !==
            JSON.stringify({ ...node, children: [] });

        if (hasChanged) {
          // 変更があった場合は変更リストに追加
          this.changedNodes.add(nodeKey);
        }

        // ノードの状態を保存
        newState.set(nodeKey, { ...node, children: [] });

        // 子ノードをスタックに追加
        node.children.forEach((child) => stack.push(child));
      }
    };

    // ルートノードから処理を開始
    processNodes(this.rootNodes);

    // 前回の状態を更新
    this.previousNodeState = newState;
  }

  /**
   * ノードのステータスを更新
   * @returns 変更されたノードキーの配列
   */
  private updateNodeStatus(): string[] {
    // 変更されたノードのキーを格納する配列
    const changedNodeKeys: string[] = [];

    // ノードのステータスのみを更新する処理
    const updateNodeStatusRecursively = (nodes: TestNode[]): void => {
      // 各ノードを処理
      nodes.forEach((node) => {
        // ノードのキーを作成
        const nodeKey = `${node.filePath}#${node.type}#${node.name}`;

        // 前回のノード状態から現在のノードのキーを検索
        const previousNode = this.previousNodeState.get(nodeKey);

        // テスト結果の変化を確認
        if (node.type === "testCase" && node.testCase) {
          const testResult = testResultProcessor.getTestResult(
            node.filePath,
            node.testCase.fullName
          );

          // 結果が変わっていれば変更としてマーク
          if (testResult) {
            changedNodeKeys.push(nodeKey);
          }
        } else if (node.type === "file" && isTestFile(node.filePath)) {
          // ファイルのテスト結果ステータスをチェック
          const fileStatus = this.checkFileTestStatus(node.filePath);
          if (fileStatus !== "unknown") {
            changedNodeKeys.push(nodeKey);
          }
        }

        // 子ノードも再帰的に処理
        updateNodeStatusRecursively(node.children);
      });
    };

    // ルートノードから更新処理を開始
    updateNodeStatusRecursively(this.rootNodes);

    return changedNodeKeys;
  }

  /**
   * 指定されたファイルのテスト結果のステータスをチェック
   * @param filePath ファイルパス
   * @returns "success" - すべてのテストが成功, "failure" - 失敗したテストあり, "unknown" - テスト結果なし
   */
  private checkFileTestStatus(
    filePath: string
  ): "success" | "failure" | "unknown" {
    try {
      // ファイルパスが有効であることを確認
      if (!filePath || !isTestFile(filePath)) {
        return "unknown";
      }

      // テスト結果を取得
      const allResults = testResultProcessor.getAllTestResults();
      const filePathIndex = testResultProcessor.getFilePathIndex();

      if (Object.keys(allResults).length === 0) {
        return "unknown"; // テスト結果がない場合
      }

      // このファイルに関連するテスト結果を抽出
      const normalizedPath = path.normalize(filePath);
      const baseNameOnly = path.basename(filePath);

      // インデックスからファイルに関連するキーを取得
      const relatedKeys = new Set<string>();

      // 正規化されたパスでインデックスから検索
      const pathKeys = filePathIndex.get(normalizedPath);
      if (pathKeys) {
        pathKeys.forEach((key) => relatedKeys.add(key));
      }

      // ファイル名のみでもインデックスから検索
      const baseNameKeys = filePathIndex.get(baseNameOnly);
      if (baseNameKeys) {
        baseNameKeys.forEach((key) => relatedKeys.add(key));
      }

      // 関連するキーが見つからない場合は未知の状態を返す
      if (relatedKeys.size === 0) {
        return "unknown";
      }

      // インデックスから取得したキーを使用してテスト結果をチェック
      let hasFailedTests = false;

      for (const key of relatedKeys) {
        const separatorIndex = key.lastIndexOf("#");
        if (separatorIndex !== -1) {
          const filePath = key.substring(0, separatorIndex);
          const testName = key.substring(separatorIndex + 1);
          const result = allResults[filePath]?.[testName];

          if (result && result.status === TestResultStatus.Failure) {
            hasFailedTests = true;
            break;
          }
        }
      }

      // 関連するテスト結果が見つかり、すべて成功していればsuccess
      return hasFailedTests ? "failure" : "success";
    } catch (error) {
      console.error("テスト結果チェック中にエラーが発生:", error);
      return "unknown";
    }
  }

  /**
   * ファイルからテストツリーを更新
   */
  private async updateTestFile(filePath: string): Promise<void> {
    try {
      // テストツリーを更新（現在のファイルがこのファイルの場合のみ）
      if (this.lastActiveFilePath === filePath) {
        await this.buildTestTree(filePath);

        // 現在のノード状態を保存
        this.saveNodeState();

        // ツリーアイテムをキャッシュ
        this.cacheAllTreeItems();

        // 変更があったノードのみを更新
        const changedNodeKeys = Array.from(this.changedNodes);
        this.notifyNodesChanged(changedNodeKeys);
      }
    } catch (error) {
      console.error(`テストファイル更新エラー: ${filePath}`, error);
    }
  }
}
