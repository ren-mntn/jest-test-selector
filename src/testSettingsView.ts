import * as vscode from "vscode";

// 型定義
type JestOption = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly value: boolean;
};

type OptionCategory = {
  readonly title: string;
  readonly options: readonly string[];
};

type OptionsMap = Readonly<Record<string, boolean>>;

// 現在の設定からJestオプションを構築
const createJestOptions = (
  currentOptions: OptionsMap
): readonly JestOption[] => [
  {
    id: "--watch",
    label: "ウォッチモード",
    description: "ファイルの変更を監視し、関連するテストを自動で再実行します",
    value: !!currentOptions["--watch"],
  },
  {
    id: "--watchAll",
    label: "すべてをウォッチ",
    description: "ファイルの変更を監視し、すべてのテストを自動で再実行します",
    value: !!currentOptions["--watchAll"],
  },
  {
    id: "--coverage",
    label: "カバレッジ",
    description: "コードカバレッジレポートを生成します",
    value: !!currentOptions["--coverage"],
  },
  {
    id: "--verbose",
    label: "バーボース",
    description:
      "各テストごとの結果をテストスイートの階層構造とともに表示します。",
    value: currentOptions["--verbose"] !== false, // デフォルトでtrue
  },
  {
    id: "--colors",
    label: "カラー出力",
    description: "色付きの出力を使用します",
    value: currentOptions["--colors"] !== false, // デフォルトでtrue
  },
  {
    id: "--bail",
    label: "失敗時に停止",
    description: "テストが失敗したら実行を中止します",
    value: !!currentOptions["--bail"],
  },
  {
    id: "--updateSnapshot",
    label: "スナップショット更新 (-u)",
    description: "失敗したスナップショットテストを更新します",
    value: !!currentOptions["--updateSnapshot"],
  },
  {
    id: "--onlyChanged",
    label: "変更されたファイルのみ (-o)",
    description: "git/hgで変更されたファイルに関連するテストのみを実行します",
    value: !!currentOptions["--onlyChanged"],
  },
  {
    id: "--runInBand",
    label: "シリアル実行 (-i)",
    description: "テストを並列ではなく1つずつ実行します（デバッグに便利）",
    value: !!currentOptions["--runInBand"],
  },
  {
    id: "--detectOpenHandles",
    label: "オープンハンドル検出",
    description:
      "完了しないPromiseやタイマーなどの開いたままのハンドルを検出します",
    value: !!currentOptions["--detectOpenHandles"],
  },
  {
    id: "--ci",
    label: "CI環境モード",
    description: "CI環境に最適化された設定で実行します",
    value: !!currentOptions["--ci"],
  },
  {
    id: "--silent",
    label: "サイレントモード",
    description: "コンソールへの出力を最小限にします",
    value: !!currentOptions["--silent"],
  },
  {
    id: "--forceExit",
    label: "強制終了",
    description: "テスト完了後に強制的にJestを終了します",
    value: !!currentOptions["--forceExit"],
  },
  {
    id: "--noStackTrace",
    label: "スタックトレース無効",
    description: "エラー時のスタックトレースを非表示にします",
    value: !!currentOptions["--noStackTrace"],
  },
  {
    id: "--passWithNoTests",
    label: "テスト無しでもパス",
    description: "テストが見つからなくてもエラーにしません",
    value: !!currentOptions["--passWithNoTests"],
  },
  {
    id: "--runTestsByPath",
    label: "パスでテスト実行",
    description:
      "正規表現マッチングではなくファイルパスに基づいてテストを実行します",
    value: !!currentOptions["--runTestsByPath"],
  },
  {
    id: "--expand",
    label: "差分を展開",
    description: "テスト失敗時に差分を完全に展開して表示します",
    value: !!currentOptions["--expand"],
  },
  {
    id: "--useStderr",
    label: "標準エラー出力に出力",
    description: "全ての出力を標準エラー出力に出力します",
    value: !!currentOptions["--useStderr"],
  },
  {
    id: "--no-cache",
    label: "キャッシュを使用しない",
    description:
      "注意: キャッシュの無効化はキャッシュに関連した問題が発生した場合のみ行って下さい。 概して、キャッシュの無効化によりJestの実行時間は2倍になります。",
    value: !!currentOptions["--no-cache"],
  },
  {
    id: "--debug",
    label: "デバッグモード",
    description: "デバッグ情報を出力します",
    value: !!currentOptions["--debug"],
  },
  {
    id: "--errorOnDeprecated",
    label: "非推奨機能でエラー",
    description: "非推奨のAPIが使用された場合にエラーを発生させます",
    value: !!currentOptions["--errorOnDeprecated"],
  },
  {
    id: "--notify",
    label: "通知",
    description:
      "テスト完了時にOSの通知を表示します（要node-notifierパッケージ）",
    value: !!currentOptions["--notify"],
  },
  {
    id: "--watchman",
    label: "Watchmanを使用",
    description: "ファイル監視にWatchmanを使用します（デフォルトはtrue）",
    value: currentOptions["--watchman"] !== false, // デフォルトでtrue
  },
  {
    id: "--onlyFailures",
    label: "失敗したテストのみ (-f)",
    description: "前回失敗したテストのみを実行します",
    value: !!currentOptions["--onlyFailures"],
  },
];

// オプションのカテゴリを定義
const getOptionCategories = (): readonly OptionCategory[] => [
  {
    title: "実行モード",
    options: [
      "--watch",
      "--watchAll",
      "--onlyChanged",
      "--runInBand",
      "--ci",
      "--passWithNoTests",
      "--runTestsByPath",
      "--onlyFailures",
    ],
  },
  {
    title: "出力設定",
    options: [
      "--verbose",
      "--colors",
      "--silent",
      "--noStackTrace",
      "--expand",
      "--json",
      "--useStderr",
    ],
  },
  {
    title: "テスト動作",
    options: [
      "--bail",
      "--coverage",
      "--updateSnapshot",
      "--detectOpenHandles",
      "--forceExit",
      "--debug",
      "--errorOnDeprecated",
    ],
  },
  {
    title: "その他",
    options: ["--no-cache", "--notify", "--watchman"],
  },
];

// オプションアイテムのHTMLを生成
const createOptionItemHtml = (option: JestOption): string => `
  <div class="option-item">
    <div class="option-header" title="${option.description}">
      <input type="checkbox" id="${option.id}" class="checkbox" ${
  option.value ? "checked" : ""
}>
      <label for="${option.id}" class="option-label">${option.label}</label>
    </div>
  </div>
`;

// カテゴリのHTMLを生成
const createCategoryHtml = (
  category: OptionCategory,
  jestOptions: readonly JestOption[]
): string => {
  const optionsHtml = category.options
    .map((optionId) => jestOptions.find((opt) => opt.id === optionId))
    .filter((option): option is JestOption => option !== undefined)
    .map(createOptionItemHtml)
    .join("");

  return `
    <div class="option-category">
      <h4 class="category-title">${category.title}</h4>
      <div class="category-items">
        ${optionsHtml}
      </div>
    </div>
  `;
};

// 純粋関数: 現在の設定を取得
const getCurrentOptions = (): OptionsMap => {
  const config = vscode.workspace.getConfiguration("jestTestSelector");
  return config.get<OptionsMap>("cliOptions") || {};
};

// 純粋関数: WebViewのHTMLコンテンツを生成
const generateWebviewContent = (
  extensionUri: vscode.Uri,
  webview: vscode.Webview | undefined,
  cspSource: string | undefined
): string => {
  // 現在の設定とJestオプションを取得
  const currentOptions = getCurrentOptions();
  const jestOptions = createJestOptions(currentOptions);
  const optionCategories = getOptionCategories();

  // カテゴリごとにHTMLを生成
  const categoriesHtml = optionCategories
    .map((category) => createCategoryHtml(category, jestOptions))
    .join("");

  // タイムスタンプを追加してキャッシュバスティング
  const timestamp = new Date().getTime();

  // スタイルシートURI
  const styleUri = webview
    ? webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "media", "settings.css")
      )
    : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jest オプション設定</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource}; script-src 'unsafe-inline';">
  <link href="${styleUri}?v=${timestamp}" rel="stylesheet">
</head>
<body>
  <div class="options-container">
    ${categoriesHtml}
  </div>
  <div id="saveStatus" class="save-status"></div>

  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      
      // チェックボックスの変更イベントを監視
      document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          saveOptions();
        });
      });
      
      // 設定を保存する関数
      function saveOptions() {
        // 現在の設定値を取得
        const options = {};
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
          const id = checkbox.id;
          // 特定のオプションはデフォルトがtrueなので、falseの場合も設定
          if (id === '--verbose' || id === '--colors' || id === '--watchman') {
            options[id] = checkbox.checked;
          } else if (checkbox.checked) {
            options[id] = true;
          }
        });
        
        // 設定を保存するメッセージを送信
        vscode.postMessage({
          command: 'saveOptions',
          options: options
        });
        
        // 保存中表示
        const saveStatus = document.getElementById('saveStatus');
        saveStatus.textContent = '保存中...';
        saveStatus.className = 'save-status';
        saveStatus.style.visibility = 'visible';
      }
      
      // メッセージ受信ハンドラ
      window.addEventListener('message', event => {
        const message = event.data;
        
        if (message.command === 'saveComplete') {
          const saveStatus = document.getElementById('saveStatus');
          if (message.success) {
            saveStatus.textContent = '保存しました！';
            saveStatus.className = 'save-status success';
          } else {
            saveStatus.textContent = message.message || 'エラーが発生しました';
            saveStatus.className = 'save-status error';
          }
          
          saveStatus.style.visibility = 'visible';
          
          // 2秒後にメッセージを非表示
          setTimeout(() => {
            saveStatus.style.visibility = 'hidden';
          }, 2000);
        }
      });
    })();
  </script>
</body>
</html>`;
};

// 純粋関数: 設定保存処理
const saveOptions = async (
  options: OptionsMap
): Promise<{ success: boolean; message?: string }> => {
  try {
    // 設定を更新
    const config = vscode.workspace.getConfiguration("jestTestSelector");
    await config.update(
      "cliOptions",
      options,
      vscode.ConfigurationTarget.Global
    );
    return { success: true };
  } catch (error) {
    console.error("設定保存エラー:", error);
    return {
      success: false,
      message: `設定の保存に失敗しました: ${error}`,
    };
  }
};

/**
 * テスト設定ビューのプロバイダークラス
 * VSCode APIとの統合のみを担当
 */
export class TestSettingsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "jestTestSelector.testSettings";
  private _view?: vscode.WebviewView;
  private static _instance: TestSettingsProvider;
  private _fileWatcher?: vscode.FileSystemWatcher;

  // シングルトンインスタンスを取得
  public static getInstance(extensionUri: vscode.Uri): TestSettingsProvider {
    if (!TestSettingsProvider._instance) {
      TestSettingsProvider._instance = new TestSettingsProvider(extensionUri);
    }
    return TestSettingsProvider._instance;
  }

  constructor(private readonly _extensionUri: vscode.Uri) {}

  /**
   * 設定を更新する
   */
  public updateView(): void {
    if (this._view) {
      const html = generateWebviewContent(
        this._extensionUri,
        this._view.webview,
        this._view.webview.cspSource
      );
      this._view.webview.html = html;
    }
  }

  /**
   * WebViewを解決
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    console.log("TestSettingsProvider.resolveWebviewView called");

    this._view = webviewView;

    // Webviewの設定
    webviewView.webview.options = {
      enableScripts: true, // スクリプト有効化
      localResourceRoots: [this._extensionUri],
    };

    // HTMLコンテンツを設定
    webviewView.webview.html = generateWebviewContent(
      this._extensionUri,
      webviewView.webview,
      webviewView.webview.cspSource
    );

    // メッセージ受信ハンドラを設定
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === "saveOptions") {
        const result = await saveOptions(message.options);

        // 結果をWebViewに送信
        this._view?.webview.postMessage({
          command: "saveComplete",
          ...result,
        });

        // エラーの場合のみVS Code通知を表示
        if (!result.success && result.message) {
          vscode.window.showErrorMessage(result.message);
        }
      }
    });

    // ビューが破棄されたときのクリーンアップ
    webviewView.onDidDispose(() => {
      this.disposeFileWatcher();
    });

    console.log("テスト設定WebViewの初期化が完了しました");
  }

  /**
   * ファイルウォッチャーを破棄する
   */
  private disposeFileWatcher(): void {
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
      this._fileWatcher = undefined;
    }
  }
}
