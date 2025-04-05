"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestResultProvider = exports.TestResultView = void 0;
var vscode = require("vscode");
/**
 * テスト結果表示用のWebviewパネル管理クラス
 */
var TestResultView = /** @class */ (function () {
    function TestResultView(_extensionUri) {
        this._extensionUri = _extensionUri;
        this._lastOutput = "";
        this._isRunning = false;
    }
    /**
     * シングルトンインスタンスを取得
     */
    TestResultView.getInstance = function (extensionUri) {
        if (!TestResultView._instance) {
            TestResultView._instance = new TestResultView(extensionUri);
        }
        return TestResultView._instance;
    };
    /**
     * Webviewを登録
     */
    TestResultView.prototype.registerView = function (view) {
        this._view = view;
        this._view.webview.options = {
            enableScripts: true,
        };
        // 最後の出力があれば表示
        if (this._lastOutput) {
            this.updateContent(this._lastOutput);
        }
        else {
            this.showWelcomeContent();
        }
    };
    /**
     * ANSIカラーコードをHTMLに変換
     */
    TestResultView.prototype.convertAnsiToHtml = function (text) {
        // 基本的なANSIエスケープシーケンスをHTML/CSSに変換
        var ansiToHtml = text
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
    };
    /**
     * 実行結果を更新
     */
    TestResultView.prototype.updateContent = function (output) {
        this._lastOutput = output;
        if (this._view && !this._isRunning) {
            this._view.webview.html = this.getWebviewContent(this.convertAnsiToHtml(output));
            this._view.show(true);
        }
    };
    /**
     * 初期表示内容
     */
    TestResultView.prototype.showWelcomeContent = function () {
        var welcomeHtml = "\n      <div class=\"welcome\">\n        <h2>Jest Test Selector</h2>\n        <p>\u30C6\u30B9\u30C8\u5B9F\u884C\u7D50\u679C\u304C\u3053\u3053\u306B\u8868\u793A\u3055\u308C\u307E\u3059\u3002</p>\n        <p>\u30C6\u30B9\u30C8\u30A8\u30AF\u30B9\u30D7\u30ED\u30FC\u30E9\u30FC\u304B\u3089\u30C6\u30B9\u30C8\u3092\u9078\u629E\u3057\u3066\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002</p>\n      </div>\n    ";
        if (this._view) {
            this._view.webview.html = this.getWebviewContent(welcomeHtml);
        }
    };
    /**
     * テスト実行開始時に表示
     */
    TestResultView.prototype.showRunningState = function (testName) {
        var _this = this;
        this._isRunning = true;
        // 既存のタイムアウトをクリア
        if (this._runningTimeout) {
            clearTimeout(this._runningTimeout);
        }
        // 30秒後に自動的にローディング状態を終了するタイムアウト
        this._runningTimeout = setTimeout(function () {
            if (_this._isRunning) {
                console.log("Test running state timeout reached, forcing finish");
                _this.finishRunningState();
            }
        }, 30000);
        var runningHtml = "\n      <div class=\"running\">\n        <h3>\u30C6\u30B9\u30C8\u5B9F\u884C\u4E2D...</h3>\n        <p><span class=\"test-name\">".concat(testName, "</span></p>\n        <div class=\"spinner\"></div>\n      </div>\n    ");
        if (this._view) {
            this._view.webview.html = this.getWebviewContent(runningHtml);
            this._view.show(true);
        }
    };
    /**
     * テスト実行終了時に呼び出し、ローディング状態を終了
     */
    TestResultView.prototype.finishRunningState = function () {
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
                    this._view.webview.html = this.getWebviewContent(this.convertAnsiToHtml(this._lastOutput));
                }
                else {
                    this.showWelcomeContent();
                }
                this._view.show(true);
            }
        }
    };
    /**
     * テスト実行エラー時に表示
     */
    TestResultView.prototype.showErrorState = function (errorMessage) {
        var errorHtml = "\n      <div class=\"error\">\n        <h3>\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F</h3>\n        <pre class=\"error-message\">".concat(errorMessage, "</pre>\n      </div>\n    ");
        if (this._view) {
            this._view.webview.html = this.getWebviewContent(errorHtml);
            this._view.show(true);
        }
    };
    /**
     * テスト結果をパースしてHTML形式で整形
     */
    TestResultView.prototype.formatTestResult = function (output) {
        // この実装では標準出力の内容をそのまま表示
        // 後でJestの出力をパースして成功/失敗などを色分け表示するように改良可能
        // エスケープ処理
        var escaped = this.escapeHtml(output);
        // 基本的な色付け
        var formatted = escaped
            .replace(/PASS/g, '<span class="pass">PASS</span>')
            .replace(/FAIL/g, '<span class="fail">FAIL</span>')
            .replace(/Error:/g, '<span class="error">Error:</span>')
            .replace(/✓/g, '<span class="pass">✓</span>')
            .replace(/✕/g, '<span class="fail">✕</span>');
        return "<pre class=\"test-output\">".concat(formatted, "</pre>");
    };
    /**
     * HTMLコンテンツをエスケープ
     */
    TestResultView.prototype.escapeHtml = function (unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };
    /**
     * WebViewのHTMLを生成
     */
    TestResultView.prototype.getWebviewContent = function (content) {
        var _a, _b;
        // スタイルシートのリソースパスを取得
        var styleMainUri = (_a = this._view) === null || _a === void 0 ? void 0 : _a.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
        return "<!DOCTYPE html>\n    <html lang=\"ja\">\n    <head>\n      <meta charset=\"UTF-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n      <meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src ".concat((_b = this._view) === null || _b === void 0 ? void 0 : _b.webview.cspSource, " 'unsafe-inline';\">\n      <link href=\"").concat(styleMainUri, "\" rel=\"stylesheet\">\n      <style>\n        body {\n          font-family: var(--vscode-font-family);\n          font-size: var(--vscode-font-size);\n          color: var(--vscode-foreground);\n          padding: 10px;\n          line-height: 1.5;\n        }\n        pre {\n          white-space: pre-wrap;\n          word-wrap: break-word;\n          margin: 0;\n          font-family: var(--vscode-editor-font-family);\n        }\n        .running {\n          text-align: center;\n          padding: 20px;\n        }\n        .test-name {\n          font-weight: bold;\n        }\n        .spinner {\n          margin: 20px auto;\n          width: 50px;\n          height: 50px;\n          border: 5px solid rgba(255, 255, 255, 0.3);\n          border-radius: 50%;\n          border-top-color: var(--vscode-button-background);\n          animation: spin 1s ease-in-out infinite;\n        }\n        @keyframes spin {\n          to { transform: rotate(360deg); }\n        }\n        \n        /* ANSI\u30AB\u30E9\u30FC\u306E\u30B9\u30BF\u30A4\u30EB */\n        .ansi-red { color: #f44747; }\n        .ansi-green { color: #6a9955; }\n        .ansi-yellow { color: #d7ba7d; }\n        .ansi-blue { color: #569cd6; }\n        .ansi-magenta { color: #c586c0; }\n        .ansi-cyan { color: #4ec9b0; }\n        .ansi-white { color: #e0e0e0; }\n        .ansi-bold { font-weight: bold; }\n        \n        /* \u30C6\u30B9\u30C8\u7D50\u679C\u306E\u8868\u793A\u30B9\u30BF\u30A4\u30EB */\n        .pass { color: #6a9955; }\n        .fail { color: #f44747; }\n        .error { color: #f44747; }\n        .error-message { \n          background-color: rgba(244, 71, 71, 0.1); \n          padding: 10px;\n          border-radius: 4px;\n        }\n      </style>\n      <title>Jest \u30C6\u30B9\u30C8\u7D50\u679C</title>\n    </head>\n    <body>\n      ").concat(content, "\n    </body>\n    </html>");
    };
    return TestResultView;
}());
exports.TestResultView = TestResultView;
/**
 * テスト結果表示用のWebviewパネルプロバイダ
 */
var TestResultProvider = /** @class */ (function () {
    function TestResultProvider(extensionUri) {
        this.extensionUri = extensionUri;
    }
    TestResultProvider.prototype.resolveWebviewView = function (webviewView, _context, _token) {
        console.log("TestResultProvider.resolveWebviewView called");
        // Webviewの設定
        webviewView.webview.options = {
            enableScripts: false,
            localResourceRoots: [this.extensionUri],
        };
        // ビューをTestResultViewに登録
        TestResultView.getInstance(this.extensionUri).registerView(webviewView);
    };
    return TestResultProvider;
}());
exports.TestResultProvider = TestResultProvider;
