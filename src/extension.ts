import * as vscode from "vscode";
import { JestDebugger } from "./debugger";
import { registerOnlyDetectionFeatures } from "./onlyDetector";
import { extractTestCases } from "./testExtractor";
import { runTestsAtScope, TestScope } from "./testRunner";
import { TestSettingsProvider } from "./testSettingsView";
import { TestTreeDataProvider, TestTreeItem } from "./testTreeDataProvider";

// 拡張機能が有効化されたときに実行される関数
export function activate(context: vscode.ExtensionContext) {
  console.log('拡張機能 "jest-test-selector" が有効化されました');
  console.log(`拡張機能ID: ${context.extension.id}`);

  // 起動時に過去のテスト結果履歴を読み込む
  JestDebugger.loadHistoryFile();
  console.log("テスト結果履歴の読み込みが完了しました");

  // カバレッジステータス表示用のステータスバーアイテム
  const coverageStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  coverageStatusBarItem.text = "$(shield-lock) カバレッジ有効";
  coverageStatusBarItem.tooltip =
    "Jestのカバレッジ出力が有効になっています。クリックで無効化";
  coverageStatusBarItem.command = "jestTestSelector.toggleCoverage";
  coverageStatusBarItem.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.warningBackground"
  );
  coverageStatusBarItem.color = new vscode.ThemeColor(
    "statusBarItem.warningForeground"
  );
  context.subscriptions.push(coverageStatusBarItem);

  // カバレッジ設定の初期状態をチェックしてステータスバーを更新
  (async () => {
    const config = vscode.workspace.getConfiguration("jestTestSelector");
    const currentOptions = config.get<Record<string, any>>("cliOptions") || {};
    const isCoverageEnabled = !!currentOptions["--coverage"];

    // ステータスバーアイテムの表示/非表示を設定
    if (isCoverageEnabled) {
      coverageStatusBarItem.show();
    } else {
      coverageStatusBarItem.hide();
    }
  })();

  // 拡張機能が既に有効化されているかチェック
  try {
    // テスト設定ビュープロバイダーを登録
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
      console.log("テスト設定ビュープロバイダーを登録しました");
    } catch (e) {
      console.log("テスト設定ビュープロバイダーは既に登録されています");
    }

    // テストツリービューデータプロバイダーを作成
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

    // .only関連機能を登録（onlyDetector.tsを使用）
    registerOnlyDetectionFeatures(
      context,
      () => testTreeDataProvider.getOnlyLocations(),
      () => testTreeDataProvider.getHasDetectedOnly(),
      testTreeDataProvider.onDidDetectOnly,
      extractTestCases
    );

    // Jest CLI オプションタブを開くコマンドを登録
    const selectJestOptionsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.selectOptions",
      async () => {
        try {
          console.log("セレクトオプションコマンドが実行されました");

          // 設定ビューを表示
          const testSettingsProvider = TestSettingsProvider.getInstance(
            context.extensionUri
          );

          try {
            // Jest Test Selector拡張機能のビューを表示
            await vscode.commands.executeCommand(
              "workbench.view.extension.jest-test-selector"
            );

            // 少し待機してからテスト設定タブに切り替え
            setTimeout(async () => {
              try {
                await vscode.commands.executeCommand(
                  TestSettingsProvider.viewType + ".focus"
                );
                console.log("テスト設定タブのフォーカスコマンドを実行しました");
              } catch (error) {
                console.error("テスト設定タブのフォーカスに失敗:", error);
              }
            }, 500);
          } catch (error) {
            console.error("WebViewタブ表示に失敗:", error);
          }
        } catch (error) {
          console.error("コマンド実行エラー:", error);
          vscode.window.showErrorMessage(
            `テスト設定の表示に失敗しました: ${error}`
          );
        }
      }
    );

    // 登録したコマンドを追加
    const disposables: vscode.Disposable[] = [selectJestOptionsDisposable];

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

    // テストリストを更新するコマンドを登録
    const refreshTestsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.refreshTests",
      async () => {
        await testTreeDataProvider.refresh();
        vscode.window.showInformationMessage("テストリストを更新しました");
      }
    );
    disposables.push(refreshTestsDisposable);

    // ディレクトリ内のすべてのテストを実行するコマンド
    const runDirectoryAllTestsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.runDirectoryAllTests",
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
          false
        );
      }
    );
    disposables.push(runDirectoryAllTestsDisposable);

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
          true
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
          true
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
          false
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
          true
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
          true
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

        await runTestsAtScope("file" as TestScope, item.filePath);
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
            item.testCase
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
        if (
          editor &&
          testTreeDataProvider.isTestFile(editor.document.uri.fsPath)
        ) {
          await testTreeDataProvider.refresh();
        }
      });
    disposables.push(activeEditorChangeDisposable);

    // 現在のエディタが存在し、テストファイルであれば初期表示を実行
    const currentEditor = vscode.window.activeTextEditor;
    if (
      currentEditor &&
      testTreeDataProvider.isTestFile(currentEditor.document.uri.fsPath)
    ) {
      testTreeDataProvider.refresh();
    }

    // テキスト内容が変更されたときにデコレーションを更新
    const textChangeDisposable = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
          // updateOnlyDecorations(editor);
        }
      }
    );
    disposables.push(textChangeDisposable);

    // .only検出イベントが発生したときにデコレーションを更新
    const onlyDetectDisposable = testTreeDataProvider.onDidDetectOnly(() => {
      // updateOnlyDecorations();
    });
    disposables.push(onlyDetectDisposable);

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
}

// 拡張機能が無効化されたときに実行される関数
export function deactivate() {
  console.log('拡張機能 "jest-test-selector" が無効化されました');
}
