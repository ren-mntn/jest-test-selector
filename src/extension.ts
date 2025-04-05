import * as path from "path";
import * as vscode from "vscode";
import { JestDebugger } from "./debugger";
import { detectMonorepoPackages, PackageInfo } from "./monorepoDetector";
import { TestCase } from "./testExtractor";
import { TestSettingsProvider } from "./testSettingsView";
import { TestTreeDataProvider, TestTreeItem } from "./testTreeDataProvider";

// 拡張機能が有効化されたときに実行される関数
export function activate(context: vscode.ExtensionContext) {
  console.log('拡張機能 "jest-test-selector" が有効化されました');
  console.log(`拡張機能ID: ${context.extension.id}`);

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
    let testTreeView: vscode.TreeView<TestTreeItem> | undefined;

    try {
      testTreeView = vscode.window.createTreeView(
        "jestTestSelector.testExplorer",
        {
          treeDataProvider: testTreeDataProvider,
          showCollapseAll: true,
        }
      );
      console.log("テストエクスプローラービューを登録しました");
    } catch (e) {
      console.log("テストエクスプローラービューは既に登録されています");
    }

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

    // カバレッジ出力切り替えコマンドを登録
    const toggleCoverageDisposable = vscode.commands.registerCommand(
      "jestTestSelector.toggleCoverage",
      async () => {
        try {
          console.log("カバレッジ切り替えコマンドがトリガーされました。");

          // 現在の設定を取得
          const config = vscode.workspace.getConfiguration("jestTestSelector");
          const currentOptions =
            config.get<Record<string, any>>("cliOptions") || {};

          // --coverage の値を反転させる
          const currentCoverageValue = !!currentOptions["--coverage"]; // 未定義の場合は false として扱う
          const newCoverageValue = !currentCoverageValue;

          // 新しいオプションオブジェクトを作成
          const newOptions = {
            ...currentOptions,
            "--coverage": newCoverageValue,
          };

          // 設定を更新 (ワークスペース設定を更新)
          await config.update(
            "cliOptions",
            newOptions,
            vscode.ConfigurationTarget.Workspace
          );

          // コンテキスト変数を更新してアイコン表示を切り替え
          console.log(
            `カバレッジ設定を ${
              newCoverageValue ? "有効" : "無効"
            } に変更します`
          );

          // ステータスバーアイテムの表示/非表示を更新
          if (newCoverageValue) {
            coverageStatusBarItem.show();
          } else {
            coverageStatusBarItem.hide();
          }

          // 設定ビューに更新を通知
          TestSettingsProvider.getInstance(context.extensionUri).updateView(); // updateViewを呼び出す

          // ユーザーに通知
          vscode.window
            .showInformationMessage(
              `カバレッジ出力を ${
                newCoverageValue ? "有効" : "無効"
              } にしました。${
                newCoverageValue
                  ? "テスト実行時にカバレッジレポートが出力されます"
                  : "カバレッジレポートは出力されません"
              }`,
              "OK"
            )
            .then(() => {
              // なにもしない（確認のみ）
            });
        } catch (error) {
          console.error("カバレッジ設定の更新エラー:", error);
          vscode.window.showErrorMessage(
            `カバレッジ設定の更新に失敗しました: ${error}`
          );
        }
      }
    );
    disposables.push(toggleCoverageDisposable);

    // テスト実行ヘルパー関数 - スコープに基づいてテストを実行
    async function runTestsAtScope(
      scope: "global" | "directory" | "file" | "test" | "package",
      targetPath: string,
      testCase?: TestCase,
      unitTestOnly?: boolean,
      e2eTestOnly?: boolean,
      runBoth?: boolean
    ): Promise<void> {
      try {
        // 現在のワークスペースフォルダを取得
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(
          vscode.Uri.file(targetPath)
        );
        if (!workspaceFolder) {
          throw new Error(
            `ワークスペースフォルダが見つかりません: ${targetPath}`
          );
        }

        // モノレポパッケージを検出
        const packages = await detectMonorepoPackages(
          workspaceFolder.uri.fsPath
        );
        if (packages.length === 0) {
          throw new Error("モノレポパッケージが検出できませんでした");
        }

        // ターゲットパスが所属するパッケージを特定
        const targetPackage = findTargetPackage(
          targetPath,
          workspaceFolder,
          packages
        );
        if (!targetPackage) {
          throw new Error(`パッケージが見つかりません: ${targetPath}`);
        }

        console.log(`スコープ: ${scope}, パッケージ: ${targetPackage.name}`);

        // 適切なデバッグコマンドを実行
        let success = false;

        if (scope === "package") {
          // パッケージ全体のテストを実行するケース
          if (runBoth) {
            // 両方（Unit + E2E）実行する場合
            vscode.window.showInformationMessage(
              `パッケージ ${targetPackage.name} のユニットテストとE2Eテストを実行します`
            );

            // カスタムコマンドを構築
            let testCmd: string;

            // ユニットテストのコマンド
            testCmd = await JestDebugger.prepareDirectoryTestCommand(
              path.join(targetPackage.path, "src"),
              targetPackage,
              false
            );

            // 実行
            success = await JestDebugger.startDebuggingWithCustomCommand(
              targetPackage.path,
              targetPackage,
              testCmd,
              `全てのテスト: ${targetPackage.name}`
            );
          } else if (unitTestOnly) {
            // ユニットテストのみ実行
            vscode.window.showInformationMessage(
              `パッケージ ${targetPackage.name} のユニットテストを実行します`
            );

            // カスタムコマンドを構築
            let testCmd: string;

            // ユニットテストのコマンド
            testCmd = await JestDebugger.prepareDirectoryTestCommand(
              path.join(targetPackage.path, "src"),
              targetPackage,
              false
            );

            // 実行
            success = await JestDebugger.startDebuggingWithCustomCommand(
              targetPackage.path,
              targetPackage,
              testCmd,
              `ユニットテスト: ${targetPackage.name}`
            );
          } else if (e2eTestOnly) {
            // E2Eテストのみ実行
            vscode.window.showInformationMessage(
              `パッケージ ${targetPackage.name} のE2Eテストを実行します`
            );

            // カスタムコマンドを構築
            let testCmd: string;

            // E2Eテストのコマンド
            testCmd = await JestDebugger.prepareDirectoryTestCommand(
              path.join(targetPackage.path, "src"),
              targetPackage,
              true
            );

            // 実行
            success = await JestDebugger.startDebuggingWithCustomCommand(
              targetPackage.path,
              targetPackage,
              testCmd,
              `E2Eテスト: ${targetPackage.name}`
            );
          } else {
            // デフォルト挙動（ユニットテスト）
            vscode.window.showInformationMessage(
              `パッケージ ${targetPackage.name} のテストを実行します`
            );

            // カスタムコマンドを構築
            let testCmd: string;

            // デフォルトテストのコマンド
            testCmd = await JestDebugger.prepareDirectoryTestCommand(
              path.join(targetPackage.path, "src"),
              targetPackage,
              false
            );

            // 実行
            success = await JestDebugger.startDebuggingWithCustomCommand(
              targetPackage.path,
              targetPackage,
              testCmd,
              `テスト: ${targetPackage.name}`
            );
          }
        } else if (scope === "directory") {
          // ディレクトリに対するテスト実行
          if (e2eTestOnly) {
            vscode.window.showInformationMessage(
              `ディレクトリ ${path.basename(
                targetPath
              )} の E2E テストを実行します`
            );
            success = await JestDebugger.startDebuggingDirectoryTests(
              targetPath,
              targetPackage,
              true
            );
          } else if (unitTestOnly) {
            vscode.window.showInformationMessage(
              `ディレクトリ ${path.basename(
                targetPath
              )} のユニットテストを実行します`
            );
            success = await JestDebugger.startDebuggingDirectoryTests(
              targetPath,
              targetPackage,
              false
            );
          } else {
            vscode.window.showInformationMessage(
              `ディレクトリ ${path.basename(targetPath)} のテストを実行します`
            );
            success = await JestDebugger.startDebuggingDirectoryTests(
              targetPath,
              targetPackage
            );
          }
        } else if (scope === "file") {
          // ファイルに対するテスト実行
          if (testCase) {
            vscode.window.showInformationMessage(
              `テスト '${testCase.name}' を実行します`
            );
            success = await JestDebugger.startDebugging(
              targetPath,
              testCase,
              targetPackage
            );
          } else {
            vscode.window.showInformationMessage(
              `ファイル ${path.basename(
                targetPath
              )} のすべてのテストを実行します`
            );
            success = await JestDebugger.startDebuggingAllTests(
              targetPath,
              targetPackage
            );
          }
        } else if (scope === "test") {
          // 個別のテストケース実行
          if (!testCase) {
            throw new Error("テストケースが指定されていません");
          }
          vscode.window.showInformationMessage(
            `テスト '${testCase.name}' を実行します`
          );
          success = await JestDebugger.startDebugging(
            targetPath,
            testCase,
            targetPackage
          );
        }

        if (!success) {
          vscode.window.showErrorMessage("テスト実行の開始に失敗しました");
        }
      } catch (error) {
        if (error instanceof Error) {
          vscode.window.showErrorMessage(`テスト実行エラー: ${error.message}`);
        } else {
          vscode.window.showErrorMessage(
            "テスト実行中に不明なエラーが発生しました"
          );
        }
      }
    }

    // ディレクトリ内のすべてのテストを実行するコマンド
    const runDirectoryAllTestsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.runDirectoryAllTests",
      async (item: TestTreeItem) => {
        if (!item || !item.filePath) {
          vscode.window.showErrorMessage("ディレクトリパスが取得できません");
          return;
        }

        await runTestsAtScope("directory", item.filePath);
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

        await runTestsAtScope("directory", item.filePath, undefined, true);
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
          "directory",
          item.filePath,
          undefined,
          false,
          true
        );
      }
    );
    disposables.push(runDirectoryE2ETestsDisposable);

    // ファイル内のすべてのテストを実行するコマンド
    const runFileAllTestsDisposable = vscode.commands.registerCommand(
      "jestTestSelector.runFileAllTests",
      async (item: TestTreeItem) => {
        if (!item || !item.filePath) {
          vscode.window.showErrorMessage("ファイルパスが取得できません");
          return;
        }

        await runTestsAtScope("file", item.filePath);
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

          await runTestsAtScope("file", item.filePath, item.testCase);
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

/**
 * テストファイル全体を実行する
 * @param filePath テストファイルのパス
 * @param describeBlock 実行するdescribeブロック名（オプション）
 */
async function runTestFile(
  filePath: string,
  describeBlock?: string
): Promise<void> {
  try {
    console.log(`Running test file: ${filePath}`);
    // 絶対パスに変換
    const absoluteFilePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(
          vscode.workspace.workspaceFolders?.[0].uri.fsPath || "",
          filePath
        );
    console.log(`Absolute file path: ${absoluteFilePath}`);

    // ワークスペースフォルダを取得
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      vscode.Uri.file(absoluteFilePath)
    );
    if (!workspaceFolder) {
      throw new Error(
        `ワークスペースフォルダが見つかりません (${absoluteFilePath})`
      );
    }
    console.log(`Workspace folder: ${workspaceFolder.uri.fsPath}`);

    // パッケージ構造を検出
    const packages = await detectMonorepoPackages(workspaceFolder.uri.fsPath);
    const targetPackage = findTargetPackage(
      absoluteFilePath,
      workspaceFolder,
      packages
    );

    if (!targetPackage) {
      vscode.window.showErrorMessage(
        "テスト実行対象のパッケージが見つかりません"
      );
      return;
    }
    console.log(`Target package: ${targetPackage.name}, ${targetPackage.path}`);

    // ファイル名を取得（表示用）
    const fileName = path.basename(absoluteFilePath);
    console.log(`File name: ${fileName}`);

    // テスト実行（常に絶対パスを使用）
    if (describeBlock) {
      // describeブロックを指定して実行
      const mockTestCase: TestCase = {
        name: describeBlock,
        fullName: describeBlock,
        describePath: [],
        lineNumber: 0,
      };
      console.log(`指定のdescribeブロックで実行: ${describeBlock}`);
      await JestDebugger.startDebugging(
        absoluteFilePath,
        mockTestCase,
        targetPackage
      );
    } else {
      // ファイル全体を実行
      console.log(`ファイル全体を実行: ${fileName}`);
      await JestDebugger.startDebuggingAllTests(
        absoluteFilePath,
        targetPackage
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      vscode.window.showErrorMessage(`エラー: ${error.message}`);
      console.error("Run test file error:", error);
    } else {
      vscode.window.showErrorMessage("予期しないエラーが発生しました");
      console.error("Unknown error in run test file:", error);
    }
  }
}

/**
 * 特定のテストケースを実行
 * @param filePath テストファイルのパス
 * @param testCase 実行するテストケース
 */
async function runSpecificTest(
  filePath: string,
  testCase: TestCase
): Promise<void> {
  try {
    console.log(`Running specific test: ${filePath}, test: ${testCase.name}`);
    // 絶対パスに変換
    const absoluteFilePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(
          vscode.workspace.workspaceFolders?.[0].uri.fsPath || "",
          filePath
        );
    console.log(`Absolute file path: ${absoluteFilePath}`);

    // ワークスペースフォルダを取得
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      vscode.Uri.file(absoluteFilePath)
    );
    if (!workspaceFolder) {
      throw new Error(
        `ワークスペースフォルダが見つかりません (${absoluteFilePath})`
      );
    }
    console.log(`Workspace folder: ${workspaceFolder.uri.fsPath}`);

    // パッケージ構造を検出
    const packages = await detectMonorepoPackages(workspaceFolder.uri.fsPath);
    const targetPackage = findTargetPackage(
      absoluteFilePath,
      workspaceFolder,
      packages
    );

    if (!targetPackage) {
      vscode.window.showErrorMessage(
        "テスト実行対象のパッケージが見つかりません"
      );
      return;
    }
    console.log(`Target package: ${targetPackage.name}, ${targetPackage.path}`);

    // テスト実行（常に絶対パスを使用）
    await JestDebugger.startDebugging(
      absoluteFilePath,
      testCase,
      targetPackage
    );
  } catch (error) {
    if (error instanceof Error) {
      vscode.window.showErrorMessage(`エラー: ${error.message}`);
      console.error("Run specific test error:", error);
    } else {
      vscode.window.showErrorMessage("予期しないエラーが発生しました");
      console.error("Unknown error in run specific test:", error);
    }
  }
}

/**
 * テスト実行対象のパッケージを特定
 */
function findTargetPackage(
  filePath: string,
  workspaceFolder: vscode.WorkspaceFolder,
  packages: PackageInfo[]
): PackageInfo | undefined {
  let targetPackage: PackageInfo | undefined;

  if (packages.length === 0) {
    // モノレポでない場合はワークスペースルートをパッケージとみなす
    const config = vscode.workspace.getConfiguration("jestTestSelector");
    const packageManager = config.get<string>("packageManager") || "pnpm";

    targetPackage = {
      name: path.basename(workspaceFolder.uri.fsPath),
      path: workspaceFolder.uri.fsPath,
      hasTestScript: true, // 仮定
      packageManager: packageManager as "npm" | "yarn" | "pnpm",
    };
  } else if (packages.length === 1) {
    // 単一パッケージの場合はそれを使用
    targetPackage = packages[0];
  } else {
    // ファイルパスにマッチするパッケージを特定
    const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
    targetPackage = packages.find((pkg) => {
      const pkgRelativePath = path.relative(
        workspaceFolder.uri.fsPath,
        pkg.path
      );
      return relativePath.startsWith(pkgRelativePath);
    });
  }

  return targetPackage;
}

// 拡張機能が無効化されたときに実行される関数
export function deactivate() {
  console.log('拡張機能 "jest-test-selector" が無効化されました');
}
