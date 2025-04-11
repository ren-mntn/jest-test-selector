import * as path from "path"; // pathモジュールをインポート
import * as vscode from "vscode";
import { extractTestCases, TestCase } from "./testExtractor";
import * as testResultProcessor from "./testResultProcessor2";
import { TestResultStatus } from "./testResultProcessor2";

// ヘルパー関数: ANSIエスケープコードを除去
function stripAnsiCodes(str: string): string {
  // ANSIエスケープシーケンスをマッチする正規表現
  // CSI (Control Sequence Introducer) sequences: \x1b\[[0-?]*[ -/]*[@-~]
  // OSC (Operating System Command) sequences: \x1b\][^  ]*(\x07|\x1b\\)
  // More simplistic regex for common color codes should suffice here
  // This regex matches typical CSI color/style codes
  const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;
  return str.replace(ansiRegex, "");
}

/**
 * スタックトレースから失敗した行番号を抽出するヘルパー関数
 * @param message エラーメッセージ（スタックトレースを含む）
 * @param targetFilePath 検索対象のファイルパス (正規化済み)
 * @returns 抽出された行番号 (0-indexed) または null
 */
function extractFailureLineFromStack(
  message: string,
  targetFilePath: string
): number | null {
  // --- ★関数呼び出し確認ログ ---
  console.log("[Debug] extractFailureLineFromStack function CALLED.");
  // ---------------------------

  // 失敗メッセージを行ごとに分割
  const lines = message.split("\n");
  // スタックトレースの行を検索 (より堅牢な正規表現に調整)
  const stackTraceRegex = /\s+at .*\((.*?):(\d+):(\d+)\)/; // ()内のファイルパスを非貪欲にマッチ

  console.log(`[Debug] extractFailureLine: targetFilePath = ${targetFilePath}`);

  for (const line of lines) {
    const match = line.match(stackTraceRegex);
    if (match) {
      const filePathInStack = match[1];
      const lineNumber = parseInt(match[2], 10);

      console.log(`[Debug] extractFailureLine: Matched stack line: ${line}`);
      console.log(
        `[Debug] extractFailureLine: Extracted path: ${filePathInStack}, line: ${lineNumber}`
      );

      // ファイルパスが一致するか確認 (正規化して比較)
      const normalizedPathInStack = path.normalize(filePathInStack);
      console.log(
        `[Debug] extractFailureLine: Comparing '${normalizedPathInStack}' === '${targetFilePath}'`
      );

      if (normalizedPathInStack === targetFilePath) {
        console.log(
          `[Debug] extractFailureLine: Path matched! Returning line number ${
            lineNumber - 1
          }`
        );
        // lineNumberは1-indexedなので0-indexedに変換して返す
        if (!isNaN(lineNumber)) {
          return lineNumber - 1;
        }
      } else {
        console.log(`[Debug] extractFailureLine: Path mismatch.`);
      }
    }
  }
  console.log(
    `[Debug] extractFailureLine: No matching stack line found for target file.`
  );
  return null; // 見つからなければnullを返す
}

// 失敗したテストの行に表示するデコレーション
const failedTestDecorationType = vscode.window.createTextEditorDecorationType({
  after: {
    margin: "0 0 0 3em",
    color: new vscode.ThemeColor("errorForeground"),
  },
  isWholeLine: true,
});

// ファイルパスをキーとしてDecorationを管理
const activeDecorations = new Map<
  string,
  {
    decorationType: vscode.TextEditorDecorationType;
    ranges: vscode.DecorationOptions[];
  }
>();

/**
 * 指定されたエディタのDecorationを更新
 * @param editor Decorationを更新するテキストエディタ
 */
export async function updateDecorations(
  editor: vscode.TextEditor | undefined
): Promise<void> {
  if (!editor) {
    console.log("[DecorationProvider] No active editor.");
    return;
  }

  // --- ★最初に必ずクリア処理を呼び出す ---
  console.log(
    `[DecorationProvider] Force clearing decorations before update for: ${editor.document.uri.fsPath}`
  );
  clearDecorationsForEditor(editor);
  // -------------------------------------

  const documentUri = editor.document.uri;
  const rawFilePath = documentUri.fsPath;
  console.log(
    `[DecorationProvider] Updating decorations for raw path: ${rawFilePath}`
  );

  if (!testResultProcessor.isValidTestFilePath(rawFilePath)) {
    console.log(
      `[DecorationProvider] Not a valid test file: ${rawFilePath}. Clearing decorations.`
    );
    // 上でクリア済みなので、ここでは何もしない
    // clearDecorationsForEditor(editor);
    return;
  }

  const filePath = testResultProcessor.normalizePath(rawFilePath);
  console.log(`[DecorationProvider] Normalized path: ${filePath}`);
  const decorations: vscode.DecorationOptions[] = [];

  try {
    const allResults = testResultProcessor.getAllTestResults();
    console.log(
      `[DecorationProvider] All test results count: ${
        Object.keys(allResults).length
      }`
    );

    const fileResults = allResults[filePath];
    if (!fileResults) {
      console.log(
        `[DecorationProvider] No results found for file: ${filePath}. Clearing decorations.`
      );
      clearDecorationsForEditor(editor);
      return;
    }
    console.log(
      `[DecorationProvider] Found ${
        Object.keys(fileResults).length
      } results for file: ${filePath}`
    );

    const testCases = await extractTestCases(filePath);
    if (!testCases || testCases.length === 0) {
      console.warn(
        `[DecorationProvider] No test cases extracted from: ${filePath}`
      );
      clearDecorationsForEditor(editor);
      return;
    }
    console.log(
      `[DecorationProvider] Extracted ${testCases.length} test cases from: ${filePath}`
    );
    const testCaseMap = new Map<string, TestCase>(
      testCases.map((tc) => [tc.fullName, tc])
    );

    let failureCount = 0;
    for (const [testName, result] of Object.entries(fileResults)) {
      if (result.status === TestResultStatus.Failure && result.message) {
        failureCount++;
        console.log(`[DecorationProvider] Found failure for test: ${testName}`);
        const testCase = testCaseMap.get(testName);
        const cleanMessage = stripAnsiCodes(result.message);

        // --- Decoration表示行の決定ロジック ---
        let targetLine: number | null = null;

        // 1. スタックトレースから行番号を試みる
        targetLine = extractFailureLineFromStack(cleanMessage, filePath);
        console.log(
          `[DecorationProvider] Extracted line from stack: ${
            targetLine !== null ? targetLine + 1 : "null"
          }`
        );

        // 2. スタックトレースから取れなければテストケース開始行を使用
        if (targetLine === null && testCase && testCase.lineNumber > 0) {
          console.log(
            `[DecorationProvider] Falling back to test case line: ${testCase.lineNumber}`
          );
          targetLine = testCase.lineNumber - 1;
        }

        if (targetLine !== null) {
          // 取得した行番号が有効か確認 (エディタの最終行を超えていないか)
          if (targetLine < editor.document.lineCount) {
            console.log(
              `[DecorationProvider] Using target line ${
                targetLine + 1
              } for decoration.`
            );
            const range = new vscode.Range(targetLine, 0, targetLine, 0);

            // 表示するメッセージを整形
            // スタックトレースを除いたエラーの主要部分を取得する試み
            let messageSummary = cleanMessage.split("\n")[0].trim(); // まず最初の行
            if (messageSummary.includes("expect(")) {
              // Jestのdiffを含む行を優先
              const diffLines = cleanMessage
                .split("\n")
                .filter(
                  (l) => l.trim().startsWith("+") || l.trim().startsWith("-")
                );
              if (diffLines.length > 0) {
                // Diffの最初の数行を要約とする
                messageSummary = diffLines.slice(0, 2).join(" ");
              }
            }
            messageSummary = messageSummary.substring(0, 100); // 最大100文字

            const decoration: vscode.DecorationOptions = {
              range: range,
              renderOptions: {
                after: {
                  contentText: `❌ ${messageSummary}`,
                },
              },
              hoverMessage: new vscode.MarkdownString(
                `**テスト失敗:**\n\`\`\`\n${cleanMessage}\n\`\`\``
              ),
            };
            decorations.push(decoration);
          } else {
            console.warn(
              `[DecorationProvider] Target line ${
                targetLine + 1
              } is out of bounds for document with ${
                editor.document.lineCount
              } lines. Falling back to test case line.`
            );
            // 行番号が無効な場合はテストケース開始行を使用するフォールバック
            if (
              testCase &&
              testCase.lineNumber > 0 &&
              testCase.lineNumber <= editor.document.lineCount
            ) {
              targetLine = testCase.lineNumber - 1;
              const range = new vscode.Range(targetLine, 0, targetLine, 0);
              // メッセージ要約は再利用
              let messageSummary = cleanMessage.split("\n")[0].trim();
              if (messageSummary.includes("expect(")) {
                const diffLines = cleanMessage
                  .split("\n")
                  .filter(
                    (l) => l.trim().startsWith("+") || l.trim().startsWith("-")
                  );
                if (diffLines.length > 0) {
                  messageSummary = diffLines.slice(0, 2).join(" ");
                }
              }
              messageSummary = messageSummary.substring(0, 100);

              const decoration: vscode.DecorationOptions = {
                range: range,
                renderOptions: {
                  after: { contentText: `❌ ${messageSummary}` },
                },
                hoverMessage: new vscode.MarkdownString(
                  `**テスト失敗:**\n\`\`\`\n${cleanMessage}\n\`\`\``
                ),
              };
              decorations.push(decoration);
            } else {
              console.warn(
                `[DecorationProvider] Fallback test case line ${testCase?.lineNumber} is also invalid or unavailable.`
              );
            }
          }
        } else {
          console.warn(
            `[DecorationProvider] Could not determine target line for failed test: ${testName}`
          );
        }
      }
    }
    console.log(
      `[DecorationProvider] Processed ${failureCount} failures for decoration.`
    );

    // 失敗が見つかった場合にのみ Decoration を適用
    if (failureCount > 0 && decorations.length > 0) {
      console.log(
        `[DecorationProvider] Applying ${decorations.length} decorations to ${filePath}`
      );
      editor.setDecorations(failedTestDecorationType, decorations);
      // 適用したDecoration情報を保存
      activeDecorations.set(filePath, {
        decorationType: failedTestDecorationType,
        ranges: decorations,
      });
    } else {
      console.log(
        `[DecorationProvider] No failure decorations to apply for ${filePath}. Clearing existing ones.`
      );
      clearDecorationsForEditor(editor); // 失敗がない、または適用するDecorationがない場合はクリア
    }
  } catch (error) {
    console.error(
      `[DecorationProvider] デコレーション更新エラー ${filePath}:`,
      error
    );
    clearDecorationsForEditor(editor); // エラー時もクリア
  }
}

/**
 * 指定されたエディタに関連付けられているDecorationをクリア
 * @param editor Decorationをクリアするテキストエディタ
 */
export function clearDecorationsForEditor(
  editor: vscode.TextEditor | undefined
): void {
  if (!editor) {
    console.warn(
      "[DecorationProvider] clearDecorationsForEditor called without an editor."
    );
    return; // エディタがなければ何もしない
  }

  const filePath = testResultProcessor.normalizePath(
    editor.document.uri.fsPath
  );
  console.log(
    `[DecorationProvider] Clearing decorations for editor: ${filePath}`
  );

  if (activeDecorations.has(filePath)) {
    console.log(
      `[DecorationProvider] Found active decorations for ${filePath}. Clearing.`
    );
    const { decorationType } = activeDecorations.get(filePath)!;
    editor.setDecorations(decorationType, []);
    activeDecorations.delete(filePath);
  } else {
    // 管理情報がない場合も、念のためエディタのDecorationをクリア (重要！)
    console.log(
      `[DecorationProvider] No active decorations found for ${filePath}, but attempting to clear anyway.`
    );
    editor.setDecorations(failedTestDecorationType, []);
  }
}

/**
 * すべてのエディタからDecorationをクリア
 */
export function clearAllDecorations(): void {
  console.log(
    "[DecorationProvider] Clearing all decorations from visible editors."
  );
  vscode.window.visibleTextEditors.forEach((editor) => {
    clearDecorationsForEditor(editor);
  });
  activeDecorations.clear();
}

/**
 * リソースの破棄
 */
export function dispose(): void {
  console.log("[DecorationProvider] Disposing resources.");
  clearAllDecorations();
  failedTestDecorationType.dispose();
}
