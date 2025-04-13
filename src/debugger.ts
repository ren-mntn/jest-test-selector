import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { TestCase } from "./testExtractor";
import * as testResultProcessor from "./testResultProcessor2";
/**
 * デバッガーの状態を表す型
 */
export type DebuggerState = {
  isDebugSessionActive: boolean;
  debugSessionDisposable?: vscode.Disposable;
  debugSessionTimeout?: NodeJS.Timeout;
  jsonOutputFilePath?: string;
  testStartTime?: number;
};

/**
 * デバッガーの初期状態
 */
export const initialDebuggerState: DebuggerState = {
  isDebugSessionActive: false,
};

// グローバル状態（関数型プログラミングの原則から外れるが、VSCode APIとの統合のために必要）
let currentState: DebuggerState = { ...initialDebuggerState };

// 定数
const DEBUG_TIMEOUT_MS = 120000; // 2分タイムアウト

/**
 * 現在の状態を取得する（純粋関数）
 */
export const getDebuggerState = (): DebuggerState => ({ ...currentState });

/**
 * 状態を更新する（副作用あり）
 */
export const updateDebuggerState = (
  newState: Partial<DebuggerState>
): DebuggerState => {
  currentState = { ...currentState, ...newState };
  return currentState;
};

/**
 * 正規表現の特殊文字をエスケープするヘルパーメソッド
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * デバッグセッションが終了した時の処理
 */
const endDebugSession = async () => {
  console.log("[debugger] デバッグセッションが終了しました");
  const { jsonOutputFilePath, testStartTime } = currentState;

  // 実行時間を記録（デバッグ用）
  if (testStartTime) {
    const executionTime = Date.now() - testStartTime;
    console.log(`[debugger] テスト実行時間: ${executionTime}ms`);
  }

  console.log(`[debugger] jsonOutputFilePath: ${jsonOutputFilePath}`);

  // テスト結果を処理
  if (jsonOutputFilePath) {
    try {
      console.log(`[debugger] テスト結果ファイルを処理: ${jsonOutputFilePath}`);

      // ファイルが実際に存在するか確認
      if (fs.existsSync(jsonOutputFilePath)) {
        await testResultProcessor.processTestResults(jsonOutputFilePath);
      } else {
        console.warn(
          `[debugger] 結果ファイルが存在しません: ${jsonOutputFilePath}`
        );
        testResultProcessor.notifyTestSessionEnd(); // 結果ファイルがなくてもテスト終了を通知
      }
    } catch (error) {
      console.error(`[debugger] テスト結果処理中にエラー: ${error}`);
      testResultProcessor.notifyTestSessionEnd(); // エラーが発生してもテスト終了を通知
    } finally {
      updateDebuggerState({ jsonOutputFilePath: null });
    }
  } else {
    console.log("[debugger] jsonOutputFilePathが指定されていません");
    testResultProcessor.notifyTestSessionEnd(); // 結果ファイルがなくてもテスト終了を通知
  }
};

/**
 * デバッグ出力をモニタリング（副作用あり）
 */
export const monitorDebugOutput = (): void => {
  console.log("[debugger] monitorDebugOutput 開始");

  // 状態更新 - テスト開始時間を記録
  updateDebuggerState({
    isDebugSessionActive: true,
    testStartTime: Date.now(),
  });

  // セッションが長時間終了しない場合のタイムアウト処理（タイムアウト延長）
  const debugSessionTimeout = setTimeout(() => {
    const currentState = getDebuggerState();
    if (currentState.isDebugSessionActive) {
      console.log(
        `[debugger] デバッグセッションがタイムアウトしました（${
          DEBUG_TIMEOUT_MS / 1000
        }秒）`
      );
      updateDebuggerState({ isDebugSessionActive: false });
      endDebugSession(); // 強制的にセッション終了処理を実行
    }
  }, DEBUG_TIMEOUT_MS);

  // VSCodeのデバッグセッション終了イベントをリッスン
  const debugSessionTerminateDisposable =
    vscode.debug.onDidTerminateDebugSession((session) => {
      console.log(`[debugger] デバッグセッション終了: ${session.name}`);

      // Jestのデバッグセッションかどうかをチェック
      const currentState = getDebuggerState();
      if (
        session.name.includes("Jest Debug") &&
        currentState.isDebugSessionActive
      ) {
        console.log(`[debugger] Jest デバッグセッション終了を検出`);

        // 状態を更新
        updateDebuggerState({ isDebugSessionActive: false });

        // タイムアウトハンドラーをクリア
        if (currentState.debugSessionTimeout) {
          clearTimeout(currentState.debugSessionTimeout);
        }

        // セッションを終了
        endDebugSession();
      }
    });

  // リソース解放用のディスポーザブルを設定
  const debugSessionDisposable = {
    dispose: function () {
      debugSessionTerminateDisposable.dispose();

      // タイムアウトもクリア
      if (currentState.debugSessionTimeout) {
        clearTimeout(currentState.debugSessionTimeout);
      }
    },
  };

  // 状態を更新
  updateDebuggerState({
    debugSessionTimeout,
    debugSessionDisposable,
  });
};

/**
 * デバッグ引数からテストファイルパスを抽出（純粋関数）
 */
export const extractTestFilePathFromArgs = (args: string[]): string | null => {
  // テストファイルパスは通常最初の引数
  return (
    args.find(
      (arg) =>
        arg &&
        (arg.endsWith(".test.ts") ||
          arg.endsWith(".test.js") ||
          arg.endsWith(".test.tsx") ||
          arg.endsWith(".test.jsx") ||
          arg.endsWith(".spec.ts") ||
          arg.endsWith(".spec.js"))
    ) || null
  );
};

/**
 * デバッグセッションを開始する共通処理（副作用あり）
 */
export const startDebuggingCommon = async (
  workspaceFolder: vscode.WorkspaceFolder,
  debugConfig: vscode.DebugConfiguration
): Promise<boolean> => {
  console.log("[debugger] startDebuggingCommon 開始");

  // デバッグセッションを開始
  monitorDebugOutput();

  // 最終的な実行コマンドを表示
  const cmd = debugConfig.runtimeExecutable;
  const args = debugConfig.runtimeArgs || [];
  console.log(`[debugger] 実行コマンド全体: ${cmd} ${args.join(" ")}`);
  console.log(`[debugger] 実行ディレクトリ: ${debugConfig.cwd}`);

  // テスト実行用のファイルパスを保存（引数から直接取得）
  const testFilePath = extractTestFilePathFromArgs(args);
  if (testFilePath) {
    console.log(`[debugger] 実行するテストファイル: ${testFilePath}`);
  }

  return await vscode.debug.startDebugging(workspaceFolder, debugConfig);
};

/**
 * テストを実行するコマンドを生成
 */
export const createTestCommand = async (
  targetPath: string,
  isE2ETest: boolean = false,
  isExcludeSubdirectories: boolean = false,
  testCase?: TestCase,
  jsonOutputFilePath?: string
): Promise<string[]> => {
  try {
    // コマンドの基本形
    const command: string[] = ["jest"];
    command.push("--config");

    // E2Eテストかどうかで設定ファイルを変更
    if (isE2ETest) {
      command.push("jest.config.e2e.js");
    } else {
      command.push("jest.config.js");
    }

    // テスト結果をJSON形式で出力 履歴保存のため
    command.push("--json");

    command.push("--outputFile", jsonOutputFilePath);

    // テスト対象のパスを追加
    if (testCase == null) {
      command.push("--testPathPattern");
      if (isExcludeSubdirectories) {
        // サブディレクトリを除外する場合
        command.push(`${targetPath}/[^/]+\\.test\\.(ts|js)$`);
      } else {
        command.push(targetPath);
      }
    } else {
      // テストケースが指定されている場合は直接ファイルパスを指定
      command.push(targetPath);
    }

    // テストケースを指定する場合
    if (testCase) {
      command.push("-t");
      // テストケース名を正規表現の特殊文字に対応するためにエスケープ
      command.push(escapeRegExp(testCase.fullName));
    }

    // Jestの設定オプションを追加
    const config = vscode.workspace.getConfiguration("jestTestSelector");
    const cliOptions = config.get<Record<string, boolean>>("cliOptions") || {};

    // 有効なオプションをコマンドに追加
    Object.entries(cliOptions).forEach(([option, enabled]) => {
      if (enabled) {
        command.push(option);
      }
    });

    // CLIオプションが追加されたログを出力
    console.log(
      `[debugger] Jest CLI オプション適用: ${Object.entries(cliOptions)
        .filter(([_, enabled]) => enabled)
        .map(([option]) => option)
        .join(", ")}`
    );

    return command;
  } catch (error) {
    console.error("[debugger] コマンド生成エラー:", error);
    throw error;
  }
};

/**
 * デバッグを開始する（副作用あり）
 */
export const startDebugging = async (
  targetPackagePath: string,
  targetPath: string,
  isE2ETest: boolean = false,
  isExcludeSubdirectories: boolean = false,
  testCase?: TestCase | null
): Promise<boolean> => {
  try {
    console.log(
      `[debugger] startDebugging 開始: ${targetPath}, isE2E=${isE2ETest}`
    );

    const absoluteFilePath = path.isAbsolute(targetPath)
      ? targetPath
      : path.resolve(targetPackagePath, targetPath);

    // ワークスペースフォルダを取得
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      vscode.Uri.file(absoluteFilePath)
    );
    if (!workspaceFolder) {
      throw new Error(
        `ワークスペースフォルダが見つかりません (${targetPackagePath})`
      );
    }

    // テスト結果出力用のファイルパスを取得
    const jsonOutputFilePath = testResultProcessor.generateJsonOutputFilePath();

    // デバッガーの状態にもパスを保存
    updateDebuggerState({ jsonOutputFilePath });

    const testCommand = await createTestCommand(
      path.join(targetPath),
      isE2ETest,
      isExcludeSubdirectories,
      testCase ?? null,
      jsonOutputFilePath
    );

    // デバッグ設定を構築（純粋オブジェクト作成）
    const debugConfig: vscode.DebugConfiguration = {
      type: "node",
      request: "launch",
      name: `Jest Debug`,
      runtimeExecutable: "jest",
      runtimeArgs: testCommand,
      console: "integratedTerminal",
      cwd: targetPackagePath,
      skipFiles: ["<node_internals>/**"],
      outputCapture: "std",
      internalConsoleOptions: "neverOpen",
    };
    return await startDebuggingCommon(workspaceFolder, debugConfig);
  } catch (error) {
    if (error instanceof Error) {
      vscode.window.showErrorMessage(`デバッグ開始エラー: ${error.message}`);
      console.error("[debugger] Debug start error:", error);
    } else {
      vscode.window.showErrorMessage("デバッグセッションの開始に失敗しました");
      console.error("[debugger] Unknown debug start error:", error);
    }
    return false;
  }
};
