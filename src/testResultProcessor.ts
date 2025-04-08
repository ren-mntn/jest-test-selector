import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

// テスト結果と終了のためのイベント
export const testSessionEndEventEmitter = new vscode.EventEmitter<void>();
export const onTestSessionEnd = testSessionEndEventEmitter.event;

// テスト結果の種類
export enum TestResultStatus {
  Success = "success",
  Failure = "failure",
  Unknown = "unknown",
  Running = "running",
  Skipped = "skipped",
  Pending = "pending",
}

// テスト結果の情報
export interface TestResultInfo {
  status: TestResultStatus;
  message?: string;
  timestamp: number;
}

// テスト履歴ファイルのデータ構造
export interface TestHistoryData {
  testResults: {
    [filePath: string]: {
      [testName: string]: TestResultInfo;
    };
  };
  lastUpdated: number;
}

// 履歴ファイルの定数
const HISTORY_DIR_NAME = "jest-test-selecter";
const HISTORY_FILE_NAME = "history.json";

// 初期状態
export type TestResultState = {
  testResults: Map<string, TestResultInfo>;
  historyDirPath: string | null;
  historyFilePath: string | null;
  jsonOutputFilePath: string | null;
};

/**
 * 新しいテスト結果の状態を初期化する
 */
export const initializeTestResultState = (): TestResultState => ({
  testResults: new Map<string, TestResultInfo>(),
  historyDirPath: null,
  historyFilePath: null,
  jsonOutputFilePath: null,
});

/**
 * 履歴ディレクトリと履歴ファイルパスを初期化する
 */
export const initHistoryFilePath = (
  state: TestResultState
): TestResultState => {
  if (state.historyFilePath) {
    return state;
  }

  try {
    // OSの一時ディレクトリを基準にする
    const tempDir = os.tmpdir();

    // .jest-test-selecterディレクトリを作成（存在しない場合）
    const historyDirPath = path.join(tempDir, HISTORY_DIR_NAME);

    // 履歴ディレクトリが存在しない場合は作成
    if (!fs.existsSync(historyDirPath)) {
      fs.mkdirSync(historyDirPath, { recursive: true });
    }

    // 履歴ファイルのパスを生成
    const historyFilePath = path.join(historyDirPath, HISTORY_FILE_NAME);
    console.log(`履歴ファイルのパス: ${historyFilePath}`);

    return {
      ...state,
      historyDirPath,
      historyFilePath,
    };
  } catch (error) {
    console.error(`履歴ディレクトリ作成エラー: ${error}`);
    return state;
  }
};

/**
 * 履歴ファイルからテスト結果を読み込む
 */
export const loadHistoryFile = (state: TestResultState): TestResultState => {
  try {
    // 履歴ファイルパスを初期化
    const updatedState = initHistoryFilePath(state);

    // 履歴ファイルパスが初期化されていない場合
    if (!updatedState.historyFilePath) return updatedState;

    // 履歴ファイルが存在しない場合
    if (!fs.existsSync(updatedState.historyFilePath)) return updatedState;

    const fileContent = fs.readFileSync(updatedState.historyFilePath, "utf8");

    // 履歴ファイルが空の場合
    if (!fileContent || fileContent.trim() === "") return updatedState;

    const historyData: TestHistoryData = JSON.parse(fileContent);

    // 履歴ファイルが空の場合
    if (!historyData.testResults) return updatedState;

    // 新しいMapを作成
    const newTestResults = new Map(updatedState.testResults);

    // マップに変換して保存
    let count = 0;
    for (const [filePath, testResults] of Object.entries(
      historyData.testResults
    )) {
      for (const [testName, resultInfo] of Object.entries(testResults)) {
        const key = `${filePath}#${testName}`;
        newTestResults.set(key, resultInfo);
        count++;
      }
    }

    // 30日以上経過したテスト結果を削除
    const cleanedState = {
      ...updatedState,
      testResults: newTestResults,
    };
    const finalState = cleanupOldResults(cleanedState, 30);

    // UI更新のためのイベント発火
    testSessionEndEventEmitter.fire();

    return finalState;
  } catch (error) {
    console.error(`履歴ファイル読み込みエラー: ${error}`);
    return state;
  }
};

/**
 * 現在のテスト結果を履歴ファイルに保存する
 */
export const saveTestResultsToHistory = (
  state: TestResultState
): TestResultState => {
  try {
    // 履歴ファイルパスを初期化
    const updatedState = initHistoryFilePath(state);

    // 履歴ファイルパスが初期化されていない場合はエラー
    if (!updatedState.historyFilePath) return updatedState;

    // 既存の履歴ファイルがあれば読み込む
    let historyData: TestHistoryData = {
      testResults: {},
      lastUpdated: Date.now(),
    };

    // 既存の履歴ファイルを読み込む
    if (fs.existsSync(updatedState.historyFilePath)) {
      try {
        const fileContent = fs.readFileSync(
          updatedState.historyFilePath,
          "utf8"
        );
        if (fileContent && fileContent.trim() !== "") {
          const existingData = JSON.parse(fileContent);
          if (existingData && existingData.testResults) {
            historyData = existingData;
          }
        }
      } catch (error) {
        console.error(`既存の履歴ファイル読み込みエラー: ${error}`);
        // 読み込みエラーの場合は新しい履歴データを作成
      }
    }

    // マージ中に追加または更新されたテスト結果の数をカウント
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // 現在のテスト結果をマージ
    for (const [key, value] of updatedState.testResults.entries()) {
      const [filePath, testName] = key.split("#");
      if (!filePath || !testName) {
        continue;
      }

      // スキップされたテストも含めて保存
      // 重要：Status が Pending/Skipped の場合はマージしない
      // これらは「実行されなかった」テストとして、前回の成功/失敗結果を維持する
      if (
        value.status === TestResultStatus.Pending ||
        value.status === TestResultStatus.Skipped ||
        value.status === TestResultStatus.Unknown
      ) {
        // 既存の結果があり、それがSuccess/Failureなら保持する
        if (historyData.testResults[filePath]?.[testName]) {
          const existingStatus =
            historyData.testResults[filePath][testName].status;
          if (
            existingStatus === TestResultStatus.Success ||
            existingStatus === TestResultStatus.Failure
          ) {
            skippedCount++;
            continue; // 既存の結果を優先して保持
          }
        }
      }

      // ファイルパスのエントリがなければ作成
      if (!historyData.testResults[filePath]) {
        historyData.testResults[filePath] = {};
      }

      // テスト結果を追加/更新
      const existingResult = historyData.testResults[filePath][testName];
      if (!existingResult) {
        addedCount++;
      } else {
        // 既存のテスト結果と現在のテスト結果を比較
        if (
          existingResult.status !== value.status ||
          existingResult.message !== value.message
        ) {
          updatedCount++;
        }
      }

      // 結果を更新
      historyData.testResults[filePath][testName] = value;
    }

    // 最終更新日時を更新
    historyData.lastUpdated = Date.now();

    // ファイルに保存
    fs.writeFileSync(
      updatedState.historyFilePath,
      JSON.stringify(historyData, null, 2),
      "utf8"
    );

    // 一時ファイルがあれば削除
    const cleanedState = cleanupTempFiles(updatedState);

    console.log(
      `履歴ファイル保存完了: 追加=${addedCount}, 更新=${updatedCount}, スキップ=${skippedCount}`
    );

    return cleanedState;
  } catch (error) {
    console.error(`履歴ファイル保存エラー: ${error}`);
    return state;
  }
};

/**
 * 古いテスト結果をクリーンアップする
 * @param state 現在のテスト結果状態
 * @param daysToKeep 保持する日数
 */
export const cleanupOldResults = (
  state: TestResultState,
  daysToKeep: number
): TestResultState => {
  // 現在時刻から指定日数前のタイムスタンプを計算
  const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

  let removedCount = 0;
  const newTestResults = new Map(state.testResults);

  // テスト結果マップをループして古い結果を削除
  for (const [key, value] of state.testResults.entries()) {
    if (value.timestamp < cutoffTime) {
      newTestResults.delete(key);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    // 履歴ファイルを更新するためのステートを返す
    return {
      ...state,
      testResults: newTestResults,
    };
  }

  return state;
};

/**
 * 一時ファイルを削除する
 */
export const cleanupTempFiles = (state: TestResultState): TestResultState => {
  if (state.jsonOutputFilePath && fs.existsSync(state.jsonOutputFilePath)) {
    try {
      fs.unlinkSync(state.jsonOutputFilePath);
      return {
        ...state,
        jsonOutputFilePath: null,
      };
    } catch (error) {
      console.log(`一時ファイル削除エラー: ${error}`);
    }
  }
  return state;
};

/**
 * テスト出力からテスト結果をパース
 */
export const parseTestResults = (
  state: TestResultState,
  output: string,
  getCurrentTestFilePath: () => string | null,
  isValidTestFilePath: (path: string) => boolean,
  updateTestResultsFromFilePath: (
    state: TestResultState,
    filePath: string
  ) => TestResultState
): TestResultState => {
  try {
    // JSON形式のテスト結果を探す（--jsonフラグ使用時）
    const jsonRegex =
      /\{[\s\S]*"numFailedTestSuites"[\s\S]*"testResults"[\s\S]*\}/g;
    const jsonMatches = [...output.matchAll(jsonRegex)];
    if (jsonMatches.length > 0) {
      try {
        const jsonStr = jsonMatches[0][0];
        const jsonData = JSON.parse(jsonStr);
        if (jsonData.testResults && jsonData.testResults.length > 0) {
          // JSONデータからテスト結果を処理
          const processedState = processJsonResults(state, jsonData);
          // セッション終了イベントを発火してUIを更新
          testSessionEndEventEmitter.fire();
          return processedState;
        }
      } catch (error) {
        console.error("JSON解析エラー:", error);
        // 解析エラーの場合は従来の方法で継続
      }
    }

    // テストファイルパスを先に解析
    let filePathRegexPatterns = [
      /(PASS|FAIL)\s+(.+\.test\.[tj]sx?)$/gm, // 標準的なJest出力形式
      /Test Suites:.*\n.*?((?:\/|\\).+\.test\.[tj]sx?)$/gm, // テストサマリー内のパス
      /Running\s+test\s+suite\s+(.+\.test\.[tj]sx?)$/gm, // "Running test suite"の形式
      /node_modules\/jest\/bin\/jest\.js\s+(.+\.test\.[tj]sx?)$/gm, // Jest実行コマンド内のパス
      /RUN\s+(.+\.test\.[tj]sx?)$/gm, // Jest Runner出力形式
    ];

    let currentFilePath: string | null = null;

    // 複数のパターンを試して最初に一致したものを使用
    for (const regexPattern of filePathRegexPatterns) {
      const matches = [...output.matchAll(regexPattern)];
      if (matches.length > 0) {
        for (const match of matches) {
          const extractedPath = match[match.length - 1].trim(); // 最後のキャプチャグループがパス
          if (extractedPath && isValidTestFilePath(extractedPath)) {
            currentFilePath = extractedPath;
            break;
          }
        }
        if (currentFilePath) break;
      }
    }

    // ファイルパスが見つからなかった場合は別の方法で再試行
    if (!currentFilePath) {
      currentFilePath = getCurrentTestFilePath();
    }

    if (!currentFilePath) {
      return state;
    }

    // 検出したファイルパスを正規化
    currentFilePath = path.normalize(currentFilePath);

    const newTestResults = new Map(state.testResults);

    // 複数の成功パターン・失敗パターンを試す
    const successPatterns = [
      /[✓✅]\s+([^\n]+?)(?:\s+\([0-9]+\s*m?s\))?$/gm, // ✓または✅マークつき
      /PASS\s+([^\n]+?)(?:\s+\([0-9]+\s*m?s\))?$/gm, // PASSマーク
      /passed\s+([^\n]+?)(?:\s+\([0-9]+\s*m?s\))?$/gim, // passed文字列
    ];

    // 複数パターンを試して成功テストを検出
    for (const pattern of successPatterns) {
      let successMatch;
      while ((successMatch = pattern.exec(output)) !== null) {
        const testName = successMatch[1].trim();
        const key = `${currentFilePath}#${testName}`;
        newTestResults.set(key, {
          status: TestResultStatus.Success,
          timestamp: Date.now(),
        });
      }
    }

    // Jest 29/30 形式に対応した失敗テスト検出パターン
    const failurePatterns = [
      /[✕✗]\s+([^\n]+?)(?:\s+\([0-9]+\s*m?s\))?$/gm, // ✕または✗マークつき
      /FAIL\s+([^\n]+?)(?:\s+\([0-9]+\s*m?s\))?$/gm, // FAILマーク
      /failed\s+([^\n]+?)(?:\s+\([0-9]+\s*m?s\))?$/gim, // failed文字列
    ];

    // 複数パターンを試して失敗テストを検出
    for (const pattern of failurePatterns) {
      let failureMatch;
      while ((failureMatch = pattern.exec(output)) !== null) {
        const testName = failureMatch[1].trim();
        const key = `${currentFilePath}#${testName}`;
        newTestResults.set(key, {
          status: TestResultStatus.Failure,
          timestamp: Date.now(),
        });
      }
    }

    // スキップされたテスト検出パターン
    const skipPatterns = [
      /[⚠]\s+([^\n]+?)(?:\s+\([0-9]+\s*m?s\))?$/gm, // ⚠マークつき
      /SKIP\s+([^\n]+?)(?:\s+\([0-9]+\s*m?s\))?$/gm, // SKIPマーク
      /skipped\s+([^\n]+?)(?:\s+\([0-9]+\s*m?s\))?$/gim, // skipped文字列
      /pending\s+([^\n]+?)(?:\s+\([0-9]+\s*m?s\))?$/gim, // pending文字列
      /disabled\s+([^\n]+?)(?:\s+\([0-9]+\s*m?s\))?$/gim, // disabled文字列
    ];

    // 複数パターンを試してスキップテストを検出
    for (const pattern of skipPatterns) {
      let skipMatch;
      while ((skipMatch = pattern.exec(output)) !== null) {
        const testName = skipMatch[1].trim();
        const key = `${currentFilePath}#${testName}`;
        newTestResults.set(key, {
          status: TestResultStatus.Skipped,
          timestamp: Date.now(),
        });
      }
    }

    // 新しい状態を作成
    const newState = { ...state, testResults: newTestResults };

    // テスト結果が見つからない場合は、ファイルから結果を更新
    if (newTestResults.size === 0 && currentFilePath) {
      return updateTestResultsFromFilePath(newState, currentFilePath);
    }

    return newState;
  } catch (error) {
    console.error("テスト結果のパース中にエラーが発生しました:", error);
    return state;
  }
};

/**
 * JSONテスト結果から結果を処理
 */
export const processJsonResults = (
  state: TestResultState,
  jsonData: any
): TestResultState => {
  if (
    !jsonData ||
    !jsonData.testResults ||
    !Array.isArray(jsonData.testResults)
  ) {
    return state;
  }

  // ワークスペースルートを取得
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

  let totalResults = 0;
  // 新しいテスト結果マップを作成
  const newTestResults = new Map(state.testResults);

  for (const result of jsonData.testResults) {
    const testFilePath = result.name;

    // ファイルパスの正規化（Windowsパスの考慮）
    let normalizedPath = testFilePath.replace(/\\/g, "/");

    // 絶対パスを相対パスに変換
    let relativePath = normalizedPath;
    if (normalizedPath.startsWith(workspaceRoot)) {
      relativePath = path.relative(workspaceRoot, normalizedPath);
    }

    // パスの正規化（ファイルシステムの違いを吸収）
    relativePath = relativePath.replace(/\\/g, "/");

    // このファイルのベース名
    const baseNameOnly = path.basename(testFilePath);

    // テスト結果が使用可能かどうか確認
    if (!result.assertionResults || !Array.isArray(result.assertionResults)) {
      continue;
    }

    // 各テストのアサーション結果を処理
    for (const assertion of result.assertionResults) {
      // テスト名を取得
      const testName = assertion.fullName || assertion.title;

      // テスト結果のステータスを判定
      let status =
        assertion.status === "passed"
          ? TestResultStatus.Success
          : assertion.status === "failed"
          ? TestResultStatus.Failure
          : assertion.status === "pending"
          ? TestResultStatus.Pending
          : assertion.status === "skipped"
          ? TestResultStatus.Skipped
          : TestResultStatus.Unknown;

      // 重要: pendingとして報告されたテストは、実際には実行されなかったテスト
      // 前回の実行結果を保持するために、既存の結果がある場合は上書きしない
      if (
        status === TestResultStatus.Pending ||
        status === TestResultStatus.Skipped
      ) {
        // 現在のキーに対応する既存の結果を確認
        const existingResult = findExistingTestResult(
          state,
          relativePath,
          testName
        );
        if (
          existingResult &&
          (existingResult.status === TestResultStatus.Success ||
            existingResult.status === TestResultStatus.Failure)
        ) {
          // Success または Failure の状態を保持
          status = existingResult.status;
          console.log(`${testName} のpending状態を保持: ${status}`);
        }
      }

      // 複数のキーパターンでテスト結果を保存（検索のマッチングを改善するため）
      // 1. 標準の相対パス形式
      const standardKey = `${relativePath}#${testName}`;
      newTestResults.set(standardKey, {
        status,
        message: assertion.failureMessages?.join("\n"),
        timestamp: Date.now(),
      });

      // 2. ファイル名のみのパターン
      const baseNameKey = `${baseNameOnly}#${testName}`;
      newTestResults.set(baseNameKey, {
        status,
        message: assertion.failureMessages?.join("\n"),
        timestamp: Date.now(),
      });

      // 3. 元の絶対パス形式
      const absoluteKey = `${normalizedPath}#${testName}`;
      newTestResults.set(absoluteKey, {
        status,
        message: assertion.failureMessages?.join("\n"),
        timestamp: Date.now(),
      });

      totalResults++;
    }
  }

  console.log(`処理されたテスト結果数: ${totalResults}`);
  return {
    ...state,
    testResults: newTestResults,
  };
};

/**
 * 既存のテスト結果を探す（相対パスとテスト名から）
 */
export const findExistingTestResult = (
  state: TestResultState,
  relativePath: string,
  testName: string
): TestResultInfo | undefined => {
  // 標準パターン
  const standardKey = `${relativePath}#${testName}`;
  let result = state.testResults.get(standardKey);
  if (result) {
    return result;
  }

  // ファイル名のみのパターン
  const baseNameOnly = path.basename(relativePath);
  const baseNameKey = `${baseNameOnly}#${testName}`;
  result = state.testResults.get(baseNameKey);
  if (result) {
    return result;
  }

  return undefined;
};

/**
 * 特定のテストケースの結果を取得
 */
export const getTestResult = (
  state: TestResultState,
  filePath: string,
  testName: string
): TestResultInfo | undefined => {
  // パスの正規化（Windowsパスの考慮）
  filePath = filePath.replace(/\\/g, "/");

  // 絶対パスから相対パスへの変換を試みる
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

  let relativeFilePath = filePath;
  if (filePath.startsWith(workspaceRoot)) {
    relativeFilePath = path.relative(workspaceRoot, filePath);
  }

  // 以下のパターンでテスト結果を検索
  // 1. 標準パターン - 相対パス
  const standardKey = `${relativeFilePath}#${testName}`;
  let result = state.testResults.get(standardKey);
  if (result) {
    return result;
  }

  // 2. ファイル名のみのパターン
  const baseNameOnly = path.basename(filePath);
  const baseNameKey = `${baseNameOnly}#${testName}`;
  result = state.testResults.get(baseNameKey);
  if (result) {
    return result;
  }

  // 3. 絶対パスパターン
  const absoluteKey = `${filePath}#${testName}`;
  result = state.testResults.get(absoluteKey);
  if (result) {
    return result;
  }

  // 4. testNameの前に"getCouponsFromFitshop "があるケースで検索
  // (JSONデータのフォーマットに合わせるため)
  const prefixedKey1 = `${relativeFilePath}#getCouponsFromFitshop ${testName}`;
  result = state.testResults.get(prefixedKey1);
  if (result) {
    return result;
  }

  // 5. ファイル名のみ + プレフィックス付きテスト名
  const prefixedKey2 = `${baseNameOnly}#getCouponsFromFitshop ${testName}`;
  result = state.testResults.get(prefixedKey2);
  if (result) {
    return result;
  }

  // 6. 部分一致検索（ファイル名を含むキーとテスト名を含むキーを探す）
  const fileBaseName = path.basename(filePath, path.extname(filePath));

  for (const [mapKey, mapResult] of state.testResults.entries()) {
    // テスト名の部分一致ロジックを改善
    if (
      mapKey.includes(testName) ||
      mapKey.includes(`getCouponsFromFitshop ${testName}`)
    ) {
      // ファイル名も一致するか確認
      if (mapKey.includes(fileBaseName) || mapKey.includes(baseNameOnly)) {
        return mapResult;
      }
    }
  }

  return undefined;
};

/**
 * 特定のテストケースの結果を設定（強制上書き）
 */
export const setTestResult = (
  state: TestResultState,
  filePath: string,
  testName: string,
  status: TestResultStatus,
  message?: string
): TestResultState => {
  const key = `${filePath}#${testName}`;
  console.log(`テスト結果を強制設定: ${key} -> ${status}`);

  const newTestResults = new Map(state.testResults);
  newTestResults.set(key, {
    status,
    message,
    timestamp: Date.now(),
  });

  // 結果が変更されたことを通知
  testSessionEndEventEmitter.fire();

  return {
    ...state,
    testResults: newTestResults,
  };
};

/**
 * JSON形式のテスト結果ファイルを読み込む
 */
export const readTestResultsFromFile = async (
  state: TestResultState,
  filePath: string
): Promise<TestResultState> => {
  try {
    // ファイルが存在しない場合は処理を中断
    if (!fs.existsSync(filePath)) return state;

    const fileContent = fs.readFileSync(filePath, "utf8");

    // ファイルが空の場合は処理を中断
    if (!fileContent || fileContent.trim() === "") return state;

    const jsonData = JSON.parse(fileContent);
    const updatedState = processJsonResults(state, jsonData);
    console.log("テスト結果ファイルの読み込みに成功しました");
    return updatedState;
  } catch (error) {
    console.error(`テスト結果ファイル読み込みエラー: ${error}`);
    throw error;
  }
};

/**
 * テスト結果の一時ファイルパスを生成
 */
export const generateJsonOutputFilePath = (
  state: TestResultState
): [string, TestResultState] => {
  // 履歴ディレクトリを初期化（同じディレクトリを使用する）
  const updatedState = initHistoryFilePath(state);

  if (!updatedState.historyDirPath) {
    // 何らかの理由でhistoryDirPathが設定されていない場合、一時的なフォールバック
    const timestamp = Date.now();
    const tempDir = os.tmpdir();
    const outputFileName = `jest-results-${timestamp}.json`;
    const outputFilePath = path.join(tempDir, outputFileName);
    return [
      outputFilePath,
      {
        ...updatedState,
        jsonOutputFilePath: outputFilePath,
      },
    ];
  }

  // 履歴ディレクトリと同じディレクトリに一時ファイルを生成
  const timestamp = Date.now();
  const outputFileName = `jest-results-${timestamp}.json`;
  const outputFilePath = path.join(updatedState.historyDirPath, outputFileName);

  return [
    outputFilePath,
    {
      ...updatedState,
      jsonOutputFilePath: outputFilePath,
    },
  ];
};

/**
 * 保存されたオプションからJest CLI引数を生成
 */
export const getJestCliArgs = (
  state: TestResultState,
  savedOptions: { [key: string]: any }
): [string[], TestResultState] => {
  const args: string[] = [];

  // テスト結果出力のための一時ファイルパスを生成
  const [outputFilePath, updatedState] = generateJsonOutputFilePath(state);

  // 常に追加する必須オプション
  // ただし、ユーザーが明示的に指定している場合はそちらを優先するためにここでは追加しない
  const hasOutputFile = Object.keys(savedOptions).some(
    (key) => key === "--outputFile"
  );
  if (!hasOutputFile) {
    args.push("--outputFile", outputFilePath);
  }

  // オプションを文字列配列に変換
  Object.entries(savedOptions).forEach(([key, value]) => {
    // キーが有効なフラグ形式かチェック
    if (!key.startsWith("--")) return;

    // 真偽値オプション
    if (typeof value === "boolean") {
      if (value) {
        args.push(key);
      }
    }
    // 文字列オプション
    else if (typeof value === "string" && value.trim() !== "") {
      args.push(key, value);
    }
    // 数値オプション
    else if (typeof value === "number") {
      args.push(key, value.toString());
    }
  });

  return [args, updatedState];
};
