import * as path from "path";
import * as vscode from "vscode";
import { TestCase, extractTestCases } from "./testExtractor";

/**
 * TreeViewに表示するアイテムのタイプ
 */
export type TestItemType = "file" | "describe" | "testCase";

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
      case "file":
        this.iconPath = new vscode.ThemeIcon("file-text");
        this.tooltip = `ファイル: ${path.basename(filePath)}`;
        this.description = path.relative(
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "",
          filePath
        );
        this.contextValue = "testFile";
        break;
      case "describe":
        this.iconPath = new vscode.ThemeIcon("symbol-namespace");
        this.tooltip = `テストグループ: ${label}`;
        this.contextValue = "testDescribe";
        break;
      case "testCase":
        this.iconPath = new vscode.ThemeIcon("symbol-method");
        this.tooltip = testCase
          ? `テスト: ${testCase.name} (行: ${testCase.lineNumber})`
          : label;
        this.description = testCase ? `行: ${testCase.lineNumber}` : "";
        this.command = {
          command: "jestTestSelector.runSelectedTest",
          title: "テストを実行",
          arguments: [this],
        };
        this.contextValue = "testCase";
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
  private lastActiveFilePath: string | undefined;

  constructor() {
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
  public async refresh(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor && this.isTestFile(editor.document.uri.fsPath)) {
      try {
        const currentFilePath = editor.document.uri.fsPath;

        // 現在のファイルが前回と同じ場合は不要な更新をスキップ
        if (
          this.lastActiveFilePath === currentFilePath &&
          this.rootNodes.length > 0
        ) {
          return;
        }

        // テストファイルのパスを保存
        this.lastActiveFilePath = currentFilePath;

        // ツリーデータをリフレッシュ
        this.rootNodes = [];
        await this.buildTestTree(this.lastActiveFilePath);
        this._onDidChangeTreeData.fire();
      } catch (error) {
        vscode.window.showErrorMessage(
          `テストツリーの構築エラー: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`
        );
      }
    }
  }

  /**
   * テストファイルからツリー構造を構築
   */
  private async buildTestTree(filePath: string): Promise<void> {
    try {
      // テストケースを抽出
      const testCases = await extractTestCases(filePath);
      if (testCases.length === 0) {
        return;
      }

      // ファイルのルートノードを作成
      const fileName = path.basename(filePath);
      const fileNode: TestNode = {
        name: fileName,
        type: "file",
        filePath,
        children: [],
      };

      // rootNodesが別の非同期処理で変更される可能性があるため、追加前にクリアする
      this.rootNodes = [];
      this.rootNodes.push(fileNode);

      // 各テストケースをツリーに追加
      for (const testCase of testCases) {
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
   * ツリービューのルート要素を取得
   */
  public getChildren(element?: TestTreeItem): Thenable<TestTreeItem[]> {
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
        return Promise.resolve(
          this.rootNodes.map(
            (node) =>
              new TestTreeItem(
                node.name,
                vscode.TreeItemCollapsibleState.Expanded,
                node.type,
                node.filePath
              )
          )
        );
      }

      const filePath = editor.document.uri.fsPath;

      // 新しいファイルに切り替わった場合のみツリーを再構築
      if (this.lastActiveFilePath !== filePath) {
        this.lastActiveFilePath = filePath;
        this.rootNodes = []; // ルートノードをクリア
        return this.buildTestTree(filePath).then(() => {
          // ルートノードのツリーアイテムを返す
          return this.rootNodes.map(
            (node) =>
              new TestTreeItem(
                node.name,
                vscode.TreeItemCollapsibleState.Expanded,
                node.type,
                node.filePath
              )
          );
        });
      }

      // ルートノードのツリーアイテムを返す
      return Promise.resolve(
        this.rootNodes.map(
          (node) =>
            new TestTreeItem(
              node.name,
              vscode.TreeItemCollapsibleState.Expanded,
              node.type,
              node.filePath
            )
        )
      );
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
}
