import * as vscode from "vscode";

/**
 * テスト結果表示用のWebviewパネル管理クラス
 */
export class TestResultView {
  private static _instance: TestResultView | undefined;
  private _view?: vscode.WebviewView;
  private _lastOutput: string = "";
  private _isRunning: boolean = false;
  private _runningTimeout: NodeJS.Timeout | undefined;

  private constructor(private readonly _extensionUri: vscode.Uri) {}

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(extensionUri: vscode.Uri): TestResultView {
    if (!TestResultView._instance) {
      TestResultView._instance = new TestResultView(extensionUri);
    }
    return TestResultView._instance;
  }

  /**
   * Webviewを登録
   */
  public registerView(view: vscode.WebviewView): void {
    this._view = view;
    this._view.webview.options = {
      enableScripts: true,
    };

    // 最後の出力があれば表示
    if (this._lastOutput) {
      this.updateContent(this._lastOutput);
    } else {
      this.showWelcomeContent();
    }
  }

  /**
   * ANSIカラーコードをHTMLに変換
   */
  private convertAnsiToHtml(text: string): string {
    // 基本的なANSIエスケープシーケンスをHTML/CSSに変換
    const ansiToHtml = text
      // リセット
      .replace(/\u001b\[0m/g, "</span>")
      // 赤色（エラー）
      .replace(/\u001b\[31m/g, '<span class="ansi-red">')
      // 緑色（成功）
      .replace(/\u001b\[32m/g, '<span class="ansi-green">')
      // 黄色（警告）
      .replace(/\u001b\[33m/g, '<span class="ansi-yellow">')
      // 青色
      .replace(/\u001b\[34m/g, '<span class="ansi-blue">')
      // マゼンタ
      .replace(/\u001b\[35m/g, '<span class="ansi-magenta">')
      // シアン
      .replace(/\u001b\[36m/g, '<span class="ansi-cyan">')
      // 白色
      .replace(/\u001b\[37m/g, '<span class="ansi-white">')
      // 太字
      .replace(/\u001b\[1m/g, '<span class="ansi-bold">')
      // その他のエスケープシーケンスを除去
      .replace(/\u001b\[\d+(;\d+)*m/g, "");

    return ansiToHtml;
  }

  /**
   * 実行結果を更新
   */
  public updateContent(output: string): void {
    this._lastOutput = output;
    if (this._view && !this._isRunning) {
      this._view.webview.html = this.getWebviewContent(
        this.convertAnsiToHtml(output)
      );
      this._view.show(true);
    }
  }

  /**
   * 初期表示内容
   */
  private showWelcomeContent(): void {
    const welcomeHtml = `
      <div class="welcome">
        <h2>Jest Test Selector</h2>
        <p>テスト実行結果がここに表示されます。</p>
        <p>テストエクスプローラーからテストを選択して実行してください。</p>
      </div>
    `;

    if (this._view) {
      this._view.webview.html = this.getWebviewContent(welcomeHtml);
    }
  }

  /**
   * テスト実行開始時に表示
   */
  public showRunningState(testName: string): void {
    this._isRunning = true;

    // 既存のタイムアウトをクリア
    if (this._runningTimeout) {
      clearTimeout(this._runningTimeout);
    }

    // 30秒後に自動的にローディング状態を終了するタイムアウト
    this._runningTimeout = setTimeout(() => {
      if (this._isRunning) {
        console.log("Test running state timeout reached, forcing finish");
        this.finishRunningState();
      }
    }, 30000);

    const runningHtml = `
      <div class="running">
        <h3>テスト実行中...</h3>
        <p><span class="test-name">${testName}</span></p>
        <div class="spinner"></div>
      </div>
    `;

    if (this._view) {
      this._view.webview.html = this.getWebviewContent(runningHtml);
      this._view.show(true);
    }
  }

  /**
   * テスト実行終了時に呼び出し、ローディング状態を終了
   */
  public finishRunningState(): void {
    // タイムアウトをクリア
    if (this._runningTimeout) {
      clearTimeout(this._runningTimeout);
      this._runningTimeout = undefined;
    }

    if (this._isRunning) {
      console.log("Finishing running state, was running:", this._isRunning);
      this._isRunning = false;

      // 最後の出力内容を再表示（ローディングインジケータなし）
      if (this._view) {
        if (this._lastOutput) {
          this._view.webview.html = this.getWebviewContent(
            this.convertAnsiToHtml(this._lastOutput)
          );
        } else {
          this.showWelcomeContent();
        }
        this._view.show(true);
      }
    }
  }

  /**
   * テスト実行エラー時に表示
   */
  public showErrorState(errorMessage: string): void {
    const errorHtml = `
      <div class="error">
        <h3>エラーが発生しました</h3>
        <pre class="error-message">${errorMessage}</pre>
      </div>
    `;

    if (this._view) {
      this._view.webview.html = this.getWebviewContent(errorHtml);
      this._view.show(true);
    }
  }

  /**
   * テスト結果をパースしてHTML形式で整形
   */
  public formatTestResult(output: string): string {
    // この実装では標準出力の内容をそのまま表示
    // 後でJestの出力をパースして成功/失敗などを色分け表示するように改良可能

    // エスケープ処理
    const escaped = this.escapeHtml(output);

    // 基本的な色付け
    let formatted = escaped
      .replace(/PASS/g, '<span class="pass">PASS</span>')
      .replace(/FAIL/g, '<span class="fail">FAIL</span>')
      .replace(/Error:/g, '<span class="error">Error:</span>')
      .replace(/✓/g, '<span class="pass">✓</span>')
      .replace(/✕/g, '<span class="fail">✕</span>');

    return `<pre class="test-output">${formatted}</pre>`;
  }

  /**
   * HTMLコンテンツをエスケープ
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * WebViewのHTMLを生成
   */
  private getWebviewContent(content: string): string {
    // スタイルシートのリソースパスを取得
    const styleMainUri = this._view?.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "main.css")
    );

    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._view?.webview.cspSource} 'unsafe-inline';">
      <link href="${styleMainUri}" rel="stylesheet">
      <style>
        body {
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
          padding: 10px;
          line-height: 1.5;
        }
        pre {
          white-space: pre-wrap;
          word-wrap: break-word;
          margin: 0;
          font-family: var(--vscode-editor-font-family);
        }
        .running {
          text-align: center;
          padding: 20px;
        }
        .test-name {
          font-weight: bold;
        }
        .spinner {
          margin: 20px auto;
          width: 50px;
          height: 50px;
          border: 5px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: var(--vscode-button-background);
          animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* ANSIカラーのスタイル */
        .ansi-red { color: #f44747; }
        .ansi-green { color: #6a9955; }
        .ansi-yellow { color: #d7ba7d; }
        .ansi-blue { color: #569cd6; }
        .ansi-magenta { color: #c586c0; }
        .ansi-cyan { color: #4ec9b0; }
        .ansi-white { color: #e0e0e0; }
        .ansi-bold { font-weight: bold; }
        
        /* テスト結果の表示スタイル */
        .pass { color: #6a9955; }
        .fail { color: #f44747; }
        .error { color: #f44747; }
        .error-message { 
          background-color: rgba(244, 71, 71, 0.1); 
          padding: 10px;
          border-radius: 4px;
        }
      </style>
      <title>Jest テスト結果</title>
    </head>
    <body>
      ${content}
    </body>
    </html>`;
  }
}

/**
 * テスト結果表示用のWebviewパネルプロバイダ
 */
export class TestResultProvider implements vscode.WebviewViewProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    console.log("TestResultProvider.resolveWebviewView called");

    // Webviewの設定
    webviewView.webview.options = {
      enableScripts: false,
      localResourceRoots: [this.extensionUri],
    };

    // ビューをTestResultViewに登録
    TestResultView.getInstance(this.extensionUri).registerView(webviewView);
  }
}
