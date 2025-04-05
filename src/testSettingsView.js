"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestSettingsProvider = void 0;
/**
 * テスト設定ビューのプロバイダークラス
 */
var TestSettingsProvider = /** @class */ (function () {
    function TestSettingsProvider(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    // シングルトンインスタンスを取得
    TestSettingsProvider.getInstance = function (extensionUri) {
        if (!TestSettingsProvider._instance) {
            TestSettingsProvider._instance = new TestSettingsProvider(extensionUri);
        }
        return TestSettingsProvider._instance;
    };
    /**
     * WebViewを解決
     */
    TestSettingsProvider.prototype.resolveWebviewView = function (webviewView, context, _token) {
        console.log("TestSettingsProvider.resolveWebviewView called");
        this._view = webviewView;
        // 最も基本的なWebView設定
        webviewView.webview.options = {
            enableScripts: false,
        };
        // 最もシンプルなHTML
        webviewView.webview.html = "<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Jest \u30AA\u30D7\u30B7\u30E7\u30F3</title>\n</head>\n<body>\n  <h3>Jest CLI\u30AA\u30D7\u30B7\u30E7\u30F3</h3>\n  <p>\u30C6\u30B9\u30C8\u5B9F\u884C\u6642\u306B\u9069\u7528\u3067\u304D\u308B\u30AA\u30D7\u30B7\u30E7\u30F3\uFF1A</p>\n  <ul>\n    <li>--watch: \u30D5\u30A1\u30A4\u30EB\u306E\u5909\u66F4\u3092\u76E3\u8996\u3057\u3001\u95A2\u9023\u3059\u308B\u30C6\u30B9\u30C8\u3092\u518D\u5B9F\u884C</li>\n    <li>--watchAll: \u30D5\u30A1\u30A4\u30EB\u306E\u5909\u66F4\u3092\u76E3\u8996\u3057\u3001\u3059\u3079\u3066\u306E\u30C6\u30B9\u30C8\u3092\u518D\u5B9F\u884C</li>\n    <li>--coverage: \u30B3\u30FC\u30C9\u30AB\u30D0\u30EC\u30C3\u30B8\u30EC\u30DD\u30FC\u30C8\u3092\u751F\u6210</li>\n    <li>--verbose: \u30C6\u30B9\u30C8\u7D50\u679C\u3092\u8A73\u7D30\u306B\u8868\u793A</li>\n    <li>--colors: \u8272\u4ED8\u304D\u306E\u51FA\u529B\u3092\u4F7F\u7528</li>\n    <li>--bail: \u30C6\u30B9\u30C8\u304C\u5931\u6557\u3057\u305F\u3089\u5B9F\u884C\u3092\u4E2D\u6B62</li>\n  </ul>\n  <p>\n    \u30A4\u30F3\u30BF\u30E9\u30AF\u30C6\u30A3\u30D6\u306A\u30AA\u30D7\u30B7\u30E7\u30F3\u9078\u629E\u6A5F\u80FD\u306F\u958B\u767A\u4E2D\u3067\u3059\u3002<br>\n    \u73FE\u5728\u306E\u8A2D\u5B9A\u306F package.json\u306EjestTestSelector.cliOptions \u3067\u5909\u66F4\u3067\u304D\u307E\u3059\u3002\n  </p>\n</body>\n</html>";
        console.log("Simplest WebView content set");
    };
    TestSettingsProvider.viewType = "jestTestSelector.testSettings";
    return TestSettingsProvider;
}());
exports.TestSettingsProvider = TestSettingsProvider;
