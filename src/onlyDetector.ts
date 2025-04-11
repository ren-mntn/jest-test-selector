import * as path from "path";
import * as vscode from "vscode";
import { TestCase } from "./testExtractor";

// 型定義
export type OnlyLocation = {
  filePath: string;
  testCase: TestCase;
};

/**
 * .only検出と状態管理を行うクラス
 */
export class OnlyDetector {
  // .onlyの検出を通知するためのイベント
  private _onDidDetectOnly = new vscode.EventEmitter<boolean>();
  readonly onDidDetectOnly: vscode.Event<boolean> = this._onDidDetectOnly.event;

  // .onlyの検出状態
  private _hasDetectedOnly: boolean = false;

  // .onlyを含むファイルとテスト情報のリスト
  private _onlyLocations: OnlyLocation[] = [];

  constructor() {}

  /**
   * .onlyが検出されているかを取得
   */
  public getHasDetectedOnly(): boolean {
    return this._hasDetectedOnly;
  }

  /**
   * .onlyを含むテストケースの位置情報を返す
   */
  public getOnlyLocations(): OnlyLocation[] {
    return this._onlyLocations;
  }

  /**
   * テストファイルでonlyが検出されたら状態を更新
   * @param filePath テストファイルのパス
   * @param testCases 検出されたテストケース配列
   */
  public updateOnlyState(filePath: string, testCases: TestCase[]): void {
    // このファイルの.only位置情報を削除
    this._onlyLocations = this._onlyLocations.filter(
      (loc) => loc.filePath !== filePath
    );

    // .onlyを含むテストケースがあるか確認
    const onlyTestCases = testCases.filter((testCase) => testCase.hasOnly);
    const hasOnlyInFile = onlyTestCases.length > 0;

    // 見つかった場合は追加
    if (hasOnlyInFile) {
      onlyTestCases.forEach((testCase) => {
        this._onlyLocations.push({ filePath, testCase });
      });
    }

    // 全体で.onlyがあるかどうかを更新
    const hasAnyOnly = this._onlyLocations.length > 0;

    // 状態が変化した場合のみイベント発行
    if (this._hasDetectedOnly !== hasAnyOnly) {
      this._hasDetectedOnly = hasAnyOnly;
      this._onDidDetectOnly.fire(hasAnyOnly);
    }
  }

  /**
   * .onlyの状態をリセット
   */
  public resetOnlyState(): void {
    const hadOnly = this._hasDetectedOnly;
    this._onlyLocations = [];
    this._hasDetectedOnly = false;

    // 以前に.onlyが検出されていた場合のみイベント発行
    if (hadOnly) {
      this._onDidDetectOnly.fire(false);
    }
  }
}

// test.onlyを含むテストケースを見つけて、UIで表示する

// グローバルインスタンス
export const onlyDetector = new OnlyDetector();

// デコレーションタイプの作成（純粋な値として定義）
export const createOnlyDecorationType = () =>
  vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("errorBackground"),
    borderColor: new vscode.ThemeColor("errorBorder"),
    borderWidth: "1px",
    borderStyle: "solid",
    overviewRulerColor: new vscode.ThemeColor("errorForeground"),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    light: {
      backgroundColor: "rgba(255, 150, 150, 0.3)",
    },
    dark: {
      backgroundColor: "rgba(255, 0, 0, 0.3)",
    },
  });

// ステータスバーアイテムの作成（純粋な関数）
export const createOnlyWarningStatusBar = () => {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    10
  );
  statusBarItem.command = "jestTestSelector.goToOnlyLocation";
  return statusBarItem;
};

// 設定から警告表示の有効/無効を取得（純粋な関数）
export const getShowOnlyWarningSetting = (): boolean => {
  const config = vscode.workspace.getConfiguration("jestTestSelector");
  return config.get<boolean>("showOnlyWarning", true);
};

// ステータスバーの表示を更新（副作用を含む関数）
export const updateStatusBar = (
  statusBarItem: vscode.StatusBarItem,
  hasOnly: boolean
): void => {
  const showWarning = getShowOnlyWarningSetting();
  console.log(`showOnlyWarning: ${showWarning}, hasOnly: ${hasOnly}`);

  if (showWarning && hasOnly) {
    statusBarItem.text = `$(warning) test.only検出`;
    statusBarItem.tooltip =
      "テストファイル内に.onlyが検出されました。クリックで移動。コミット前に削除してください。";
    statusBarItem.backgroundColor = new vscode.ThemeColor("errorBackground");
    statusBarItem.color = new vscode.ThemeColor("errorForeground");
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
};

// デコレーションのレンジを作成（純粋な関数）
export const createDecorationRanges = (
  editor: vscode.TextEditor,
  onlyLocations: OnlyLocation[]
): vscode.Range[] => {
  return onlyLocations
    .filter((location) => location.filePath === editor.document.uri.fsPath)
    .map((location) => {
      const lineNumber = Math.max(0, location.testCase.lineNumber - 1);
      const line = editor.document.lineAt(lineNumber);

      const onlyPattern = /(test|it|describe)\.only/;
      const match = onlyPattern.exec(line.text);

      return match
        ? new vscode.Range(
            new vscode.Position(lineNumber, line.text.indexOf(match[0])),
            new vscode.Position(
              lineNumber,
              line.text.indexOf(match[0]) + match[0].length
            )
          )
        : new vscode.Range(line.range.start, line.range.end);
    });
};

// エディタのデコレーションを更新（副作用を含む関数）
export const updateDecorations = (
  editor: vscode.TextEditor | undefined,
  onlyDecorationType: vscode.TextEditorDecorationType,
  getOnlyLocations: () => OnlyLocation[]
): void => {
  if (!editor) return;

  const onlyLocations = getOnlyLocations();
  const decorations = createDecorationRanges(editor, onlyLocations);

  editor.setDecorations(onlyDecorationType, decorations);
};

// 重複のない.only位置情報を取得（純粋な関数）
export const getUniqueOnlyLocations = (
  onlyLocations: OnlyLocation[]
): OnlyLocation[] => {
  return onlyLocations.reduce<OnlyLocation[]>((acc, location) => {
    const exists = acc.some(
      (item) =>
        item.filePath === location.filePath &&
        item.testCase.lineNumber === location.testCase.lineNumber
    );

    if (!exists) {
      acc.push(location);
    }

    return acc;
  }, []);
};

// ファイルを開いて指定行に移動（副作用を含む関数）
export const openFileAtLocation = async (
  filePath: string,
  lineNumber: number
): Promise<void> => {
  try {
    const document = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(document);

    // 0-indexedに変換
    const zeroBasedLine = Math.max(0, lineNumber - 1);

    // その行にカーソルを移動
    const position = new vscode.Position(zeroBasedLine, 0);
    editor.selection = new vscode.Selection(position, position);

    // その行が見えるようにスクロール（中央に表示）
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenter
    );
  } catch (error) {
    vscode.window.showErrorMessage(`ファイルを開けませんでした: ${error}`);
  }
};

// ワークスペース全体から.onlyを検索（副作用を含む関数）
export const findOnlyLocationsInWorkspace = async (
  extractTestCases: (filePath: string) => Promise<TestCase[]>
): Promise<OnlyLocation[]> => {
  return await vscode.window.withProgress<OnlyLocation[]>(
    {
      location: vscode.ProgressLocation.Notification,
      title: "ワークスペース全体から.onlyを検索中...",
      cancellable: true,
    },
    async (progress, token) => {
      progress.report({ increment: 0 });

      try {
        // ワークスペースルートを取得
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage("ワークスペースが開かれていません");
          return [];
        }

        // テストファイルのパターン
        const testFilesPattern = new vscode.RelativePattern(
          workspaceFolder,
          "**/*.{test,spec}.{ts,js,tsx,jsx}"
        );

        progress.report({ increment: 10, message: "テストファイル検索中..." });

        if (token.isCancellationRequested) return [];

        // テストファイルを検索
        const testFiles = await vscode.workspace.findFiles(testFilesPattern);
        if (testFiles.length === 0) {
          vscode.window.showInformationMessage(
            "テストファイルが見つかりませんでした"
          );
          return [];
        }

        progress.report({
          increment: 20,
          message: `${testFiles.length}件のテストファイルを処理中...`,
        });

        // 結果格納用の配列
        const allOnlyLocations: OnlyLocation[] = [];
        const totalFiles = testFiles.length;

        // 各ファイルを処理
        for (let i = 0; i < totalFiles; i++) {
          if (token.isCancellationRequested) return [];

          const testFile = testFiles[i];
          const filePath = testFile.fsPath;

          // 進捗状況の更新
          const progressIncrement = 70 / totalFiles;
          progress.report({
            increment: progressIncrement,
            message: `ファイル処理中 (${i + 1}/${totalFiles}): ${path.basename(
              filePath
            )}`,
          });

          try {
            // テストケースを抽出
            const testCases = await extractTestCases(filePath);

            // .onlyを含むテストケースをフィルタリングして追加
            const onlyTestCases = testCases.filter(
              (testCase) => testCase.hasOnly
            );
            onlyTestCases.forEach((testCase) => {
              allOnlyLocations.push({ filePath, testCase });
            });
          } catch (error) {
            console.error(`ファイル処理エラー: ${filePath}`, error);
          }
        }

        progress.report({ increment: 100, message: "完了" });

        // 重複を除去
        return getUniqueOnlyLocations(allOnlyLocations);
      } catch (error) {
        vscode.window.showErrorMessage(
          `検索エラー: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`
        );
        return [];
      }
    }
  );
};

// .only位置に移動するコマンド処理（副作用を含む関数）
export const handleGoToOnlyLocation = async (
  getOnlyLocations: () => OnlyLocation[],
  extractTestCases: (filePath: string) => Promise<TestCase[]>
): Promise<void> => {
  // 現在表示されている.only位置を取得
  const currentOnlyLocations = getOnlyLocations();

  // 現在表示中に.only箇所があればそこに移動
  if (currentOnlyLocations.length > 0) {
    const uniqueLocations = getUniqueOnlyLocations(currentOnlyLocations);

    if (uniqueLocations.length === 1) {
      await openFileAtLocation(
        uniqueLocations[0].filePath,
        uniqueLocations[0].testCase.lineNumber
      );
      return;
    }

    // 複数の.only箇所がある場合は選択肢を表示
    const items = uniqueLocations.map((location) => ({
      label: `${path.basename(location.filePath)}:${
        location.testCase.lineNumber
      }`,
      description: location.testCase.fullName,
      location,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: ".only箇所を選択してください",
    });

    if (selected) {
      await openFileAtLocation(
        selected.location.filePath,
        selected.location.testCase.lineNumber
      );
    }
    return;
  }

  // 見つからない場合は何もしない
};

// 拡張機能のアクティベート時に呼び出す初期化関数
export const registerOnlyDetectionFeatures = (
  context: vscode.ExtensionContext,
  extractTestCases: (filePath: string) => Promise<TestCase[]>
): void => {
  // デコレーションタイプを作成
  const onlyDecorationType = createOnlyDecorationType();

  // ステータスバーアイテムを作成
  const statusBarItem = createOnlyWarningStatusBar();

  // ステータスバーの初期状態を設定
  updateStatusBar(statusBarItem, onlyDetector.getHasDetectedOnly());

  // .only検出イベントのリスナー登録
  const onlyDetectionListener = onlyDetector.onDidDetectOnly((hasOnly) => {
    updateStatusBar(statusBarItem, hasOnly);
  });

  // エディタのアクティブ化時にデコレーションを更新
  const activeEditorChangeListener = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor) {
        updateDecorations(editor, onlyDecorationType, () =>
          onlyDetector.getOnlyLocations()
        );
      }
    }
  );

  // テキスト変更時にデコレーションを更新
  const textChangeListener = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        updateDecorations(editor, onlyDecorationType, () =>
          onlyDetector.getOnlyLocations()
        );
      }
    }
  );

  // 設定変更時にステータスバーを更新
  const configChangeListener = vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (event.affectsConfiguration("jestTestSelector.showOnlyWarning")) {
        updateStatusBar(statusBarItem, onlyDetector.getHasDetectedOnly());
      }
    }
  );

  // .only箇所に移動するコマンドを登録
  const goToOnlyLocationCommand = vscode.commands.registerCommand(
    "jestTestSelector.goToOnlyLocation",
    () =>
      handleGoToOnlyLocation(
        () => onlyDetector.getOnlyLocations(),
        extractTestCases
      )
  );

  // 現在のエディタにデコレーションを適用
  if (vscode.window.activeTextEditor) {
    updateDecorations(vscode.window.activeTextEditor, onlyDecorationType, () =>
      onlyDetector.getOnlyLocations()
    );
  }

  // すべてのリソースをコンテキストに登録
  context.subscriptions.push(
    statusBarItem,
    onlyDetectionListener,
    activeEditorChangeListener,
    textChangeListener,
    configChangeListener,
    goToOnlyLocationCommand
  );
};
