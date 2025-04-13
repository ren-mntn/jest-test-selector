import * as vscode from "vscode";
import * as decorationProvider from "./decorationProvider";
import * as testResultProcessor from "./testResultProcessor2";
import { onTestResultsUpdated } from "./testResultProcessor2";
import { runTestsAtScope, TestScope } from "./testRunner";
import { TestSettingsProvider } from "./testSettingsView";
import { TestTreeDataProvider, TestTreeItem } from "./testTreeDataProvider";
import { isTestFile } from "./testUtils";

// 拡張機能が有効化されたときに実行される関数
export async function activate(context: vscode.ExtensionContext) {
  const activationStartTime = Date.now();
  console.log("Jest Test Selector 拡張機能を有効化開始...");

  console.log("Jest Test Selector 拡張機能を有効化: V2");

  // テスト結果プロセッサを初期化
  const initStartTime = Date.now();
  testResultProcessor
    .initialize(context)
    .then(() => {
      const initEndTime = Date.now();
      console.log(
        `TestResultProcessor2 の初期化が完了しました (${
          initEndTime - initStartTime
        }ms)`
      );
    })
    .catch((error) => {
      console.error("TestResultProcessor2 の初期化に失敗:", error);
    });

  // ターミナル実行モード用のステータスバーアイテム
  const terminalModeStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    101
  );
  terminalModeStatusBarItem.text = "$(terminal) ターミナル実行";
  terminalModeStatusBarItem.tooltip =
    "ターミナルでテストを実行します。クリックで切り替え";
  terminalModeStatusBarItem.command = "jestTestSelector.toggleTerminalMode";
  context.subscriptions.push(terminalModeStatusBarItem);

  // デフォルトでは非表示に設定
  terminalModeStatusBarItem.hide();

  // ターミナル実行フラグを管理するグローバル変数
  let useTerminalMode = false;

  // ターミナルモード切り替えコマンドを登録
  const toggleTerminalModeDisposable = vscode.commands.registerCommand(
    "jestTestSelector.toggleTerminalMode",
    async () => {
      useTerminalMode = !useTerminalMode;
      if (useTerminalMode) {
        terminalModeStatusBarItem.text = "$(terminal) ターミナル実行: 有効";
        terminalModeStatusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground"
        );
        vscode.window.showInformationMessage(
          "ターミナルでのテスト実行モードが有効になりました"
        );
      } else {
        terminalModeStatusBarItem.text = "$(terminal) ターミナル実行";
        terminalModeStatusBarItem.backgroundColor = undefined;
        vscode.window.showInformationMessage(
          "通常のデバッグモードでのテスト実行に戻りました"
        );
      }
      terminalModeStatusBarItem.show();
    }
  );
  context.subscriptions.push(toggleTerminalModeDisposable);

  // ターミナル実行モード表示コマンドを登録
  const showTerminalModeDisposable = vscode.commands.registerCommand(
    "jestTestSelector.showTerminalMode",
    async () => {
      terminalModeStatusBarItem.show();
    }
  );
  context.subscriptions.push(showTerminalModeDisposable);

  // ステータスバーにJest設定ボタンを追加
  const jestSettingsStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    99 // coverageStatusBarItemより1小さい値にして左側に表示
  );
  jestSettingsStatusBarItem.text = "$(gear) Jest設定";
  jestSettingsStatusBarItem.tooltip = "Jestの設定オプションを開く";
  jestSettingsStatusBarItem.command = "jestTestSelector.showJestSettings";
  context.subscriptions.push(jestSettingsStatusBarItem);
  jestSettingsStatusBarItem.show();

  // 拡張機能が既に有効化されているかチェック
  try {
    // テスト設定ビュープロバイダーを登録
    const settingsViewStartTime = Date.now();
    const testSettingsProvider = TestSettingsProvider.getInstance(
      context.extensionUri
    );
    let testSettingsProviderDisposable: vscode.Disposable | undefined;

    try {
      testSettingsProviderDisposable =
        vscode.window.registerWebviewViewProvider(
          TestSettingsProvider.viewType,
          testSettingsProvider,
          {
            webviewOptions: {
              retainContextWhenHidden: true,
            },
          }
        );
      const settingsViewEndTime = Date.now();
      console.log(
        `テスト設定ビュープロバイダーを登録しました (${
          settingsViewEndTime - settingsViewStartTime
        }ms)`
      );
    } catch (e) {
      console.log("テスト設定ビュープロバイダーは既に登録されています");
    }

    // テストツリービューデータプロバイダーを作成
    const treeViewStartTime = Date.now();
    const testTreeDataProvider = new TestTreeDataProvider();
    const testTreeView = vscode.window.createTreeView(
      "jestTestSelector.testExplorer",
      {
        treeDataProvider: testTreeDataProvider,
        showCollapseAll: true,
      }
    );
    context.subscriptions.push(testTreeView);
    context.subscriptions.push(testTreeDataProvider);
    const treeViewEndTime = Date.now();
    console.log(
      `テストツリービューデータプロバイダーを作成しました (${
        treeViewEndTime - treeViewStartTime
      }ms)`
    );

    // 登録したコマンドを追加
    const disposables: vscode.Disposable[] = [];

    // 設定エディタを開くコマンドを登録
    const openSettingsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.openSettings",
      async () => {
        try {
          // 直接Jest Test Selectorの設定セクションを開く
          await vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "jestTestSelector.cliOptions"
          );
        } catch (error) {
          console.error("設定を開く際にエラーが発生しました:", error);
          vscode.window.showErrorMessage(
            `設定エディタを開けませんでした: ${error}`
          );
        }
      }
    );
    disposables.push(openSettingsDisposable);

    // Jest設定パネルを表示するコマンドを登録
    const showJestSettingsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.showJestSettings",
      () => {
        // WebviewPanelとして表示
        testSettingsProvider.showWebviewPanel();
      }
    );
    disposables.push(showJestSettingsDisposable);

    // テスト設定プロバイダーを追加
    if (testSettingsProviderDisposable) {
      disposables.push(testSettingsProviderDisposable);
      context.subscriptions.push(testSettingsProviderDisposable);
    }

    // テストリストを更新するコマンドを登録
    const refreshTestsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.refreshTests",
      async () => {
        await testTreeDataProvider.refresh();
      }
    );
    disposables.push(refreshTestsDisposable);

    // ディレクトリ内のユニットテストのみを実行するコマンド
    const runDirectoryUnitTestsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.runDirectoryUnitTests",
      async (item: TestTreeItem) => {
        if (!item || !item.filePath) {
          vscode.window.showErrorMessage("ディレクトリパスが取得できません");
          return;
        }

        await runTestsAtScope(
          "directory" as TestScope,
          item.filePath,
          undefined,
          true,
          false,
          false,
          useTerminalMode
        );
      }
    );
    disposables.push(runDirectoryUnitTestsDisposable);

    // ディレクトリ内のE2Eテストのみを実行するコマンド
    const runDirectoryE2ETestsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.runDirectoryE2ETests",
      async (item: TestTreeItem) => {
        if (!item || !item.filePath) {
          vscode.window.showErrorMessage("ディレクトリパスが取得できません");
          return;
        }

        await runTestsAtScope(
          "directory" as TestScope,
          item.filePath,
          undefined,
          false,
          true,
          false,
          useTerminalMode
        );
      }
    );
    disposables.push(runDirectoryE2ETestsDisposable);

    // パッケージのユニットテストを実行するコマンド
    const runPackageUnitTestsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.runPackageUnitTests",
      async (item: TestTreeItem) => {
        if (!item || !item.filePath) {
          vscode.window.showErrorMessage("パッケージパスが取得できません");
          return;
        }

        await runTestsAtScope(
          "package" as TestScope,
          item.filePath,
          undefined,
          true,
          false,
          false,
          useTerminalMode
        );
      }
    );
    disposables.push(runPackageUnitTestsDisposable);

    // パッケージのE2Eテストを実行するコマンド
    const runPackageE2ETestsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.runPackageE2ETests",
      async (item: TestTreeItem) => {
        if (!item || !item.filePath) {
          vscode.window.showErrorMessage("パッケージパスが取得できません");
          return;
        }

        await runTestsAtScope(
          "package" as TestScope,
          item.filePath,
          undefined,
          false,
          true,
          false,
          useTerminalMode
        );
      }
    );
    disposables.push(runPackageE2ETestsDisposable);

    // パッケージの全てのテストを実行するコマンド
    const runPackageAllTestsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.runPackageAllTests",
      async (item: TestTreeItem) => {
        if (!item || !item.filePath) {
          vscode.window.showErrorMessage("パッケージパスが取得できません");
          return;
        }

        await runTestsAtScope(
          "package" as TestScope,
          item.filePath,
          undefined,
          false,
          false,
          true,
          useTerminalMode
        );
      }
    );
    disposables.push(runPackageAllTestsDisposable);

    // ファイル内のすべてのテストを実行するコマンド
    const runFileAllTestsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.runFileAllTests",
      async (item: TestTreeItem) => {
        if (!item || !item.filePath) {
          vscode.window.showErrorMessage("ファイルパスが取得できません");
          return;
        }

        await runTestsAtScope(
          "file" as TestScope,
          item.filePath,
          undefined,
          false,
          false,
          false,
          useTerminalMode
        );
      }
    );
    disposables.push(runFileAllTestsDisposable);

    // 選択された個別のテストを実行するコマンド
    const runSelectedTestDisposable = vscode.commands.registerCommand(
      "jestTestSelector.runSelectedTest",
      async (item: TestTreeItem) => {
        try {
          if (!item || !item.testCase || !item.filePath) {
            vscode.window.showErrorMessage("テスト情報が取得できません");
            return;
          }

          await runTestsAtScope(
            "file" as TestScope,
            item.filePath,
            item.testCase,
            false,
            false,
            false,
            useTerminalMode
          );
        } catch (error) {
          if (error instanceof Error) {
            vscode.window.showErrorMessage(
              `テスト実行エラー: ${error.message}`
            );
          } else {
            vscode.window.showErrorMessage("テスト実行に失敗しました");
          }
        }
      }
    );
    disposables.push(runSelectedTestDisposable);

    // エディタ変更時に自動的にテストツリーを更新
    const activeEditorChangeDisposable =
      vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (editor && isTestFile(editor.document.uri.fsPath)) {
          await testTreeDataProvider.refresh();
        }
      });
    disposables.push(activeEditorChangeDisposable);

    // 現在のエディタが存在し、テストファイルであれば初期表示を実行
    const currentEditor = vscode.window.activeTextEditor;
    if (currentEditor && isTestFile(currentEditor.document.uri.fsPath)) {
      testTreeDataProvider.refresh();
    }

    // テキスト内容が変更されたときにデコレーションを更新
    const textChangeDisposable = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
          // デコレーションの更新処理を行う可能性がある場所
        }
      }
    );
    disposables.push(textChangeDisposable);

    // テスト結果更新リスナーを登録
    console.log("テスト結果更新リスナーを登録しています...");
    context.subscriptions.push(
      onTestResultsUpdated(() => {
        // 現在アクティブなエディタのDecorationを更新
        decorationProvider.updateDecorations(vscode.window.activeTextEditor);
      })
    );

    // 現在のエディタにデコレーションを適用
    decorationProvider.updateDecorations(vscode.window.activeTextEditor);

    // Decoration Providerのリソース破棄登録
    context.subscriptions.push({ dispose: () => decorationProvider.dispose() });

    // アクティブなテキストエディタが変更されたとき
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        // 新しいエディタに対してDecorationを更新
        decorationProvider.updateDecorations(editor);
      })
    );

    // テキストドキュメントが保存されたとき
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        // 保存されたドキュメントが現在アクティブなエディタのものであればDecorationを更新
        if (
          vscode.window.activeTextEditor &&
          vscode.window.activeTextEditor.document === document
        ) {
          decorationProvider.updateDecorations(vscode.window.activeTextEditor);
        }
      })
    );

    // 拡張機能有効化時に、すでにアクティブなエディタがあればDecorationを適用
    if (vscode.window.activeTextEditor) {
      decorationProvider.updateDecorations(vscode.window.activeTextEditor);
    }

    // 全てのディスポーザブルをコンテキストに追加
    disposables.forEach((disposable) => {
      context.subscriptions.push(disposable);
    });

    // テストエクスプローラーを初期化（最初のファイル読み込み）
    testTreeDataProvider.refresh();
  } catch (error) {
    console.error("Jest Test Selector拡張機能の初期化エラー:", error);
    vscode.window.showErrorMessage(
      `Jest Test Selector拡張機能の初期化に失敗しました: ${error}`
    );
  }

  const activationEndTime = Date.now();
  console.log(
    `Jest Test Selector 拡張機能の有効化が完了しました (${
      activationEndTime - activationStartTime
    }ms)`
  );
}

// 拡張機能が無効化されたときに実行される関数
export function deactivate() {
  console.log("Jest Test Selector 拡張機能を無効化");
  // 拡張機能が無効化されるときにすべてのDecorationをクリア
  decorationProvider.clearAllDecorations();
}
