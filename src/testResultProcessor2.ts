import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { isTestFile } from "./testUtils";

// MessagePackライブラリを読み込み
const msgpack = require("msgpack5");

// MessagePackインスタンスを作成
const codec = msgpack();

// テスト結果と終了のためのイベント
export const testSessionEndEventEmitter = new vscode.EventEmitter<void>();
export const onTestSessionEnd = testSessionEndEventEmitter.event;

// テスト結果更新イベント
export const testResultsUpdatedEventEmitter = new vscode.EventEmitter<void>();
export const onTestResultsUpdated = testResultsUpdatedEventEmitter.event;

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
}

// テスト履歴ファイルのデータ構造
interface TestHistoryData {
  testResults: Record<string, Record<string, TestResultInfo>>;
}

// 履歴ファイルの定数
const HISTORY_DIR_NAME = "jest-test-selecter";
const HISTORY_FILE_NAME = "history2.mpack"; // 区別のため名前を変更

// パフォーマンス用定数
const SAVE_DEBOUNCE_TIME = 2000; // 保存のデバウンス時間（ミリ秒）
const MAX_LOG_RETRY_COUNT = 3; // ログ再試行の最大回数

// --- キャッシュとパフォーマンス最適化 ---

// ディレクトリパスのキャッシュ（パス -> 親ディレクトリのリスト）
const directoryPathCache = new Map<string, string[]>();

// 保存操作のデバウンスタイマー
let saveDebounceTimer: NodeJS.Timeout | null = null;
let pendingSave = false;
let logRetryCount = 0;

// --- 状態管理 ---

// 状態の型定義
export interface TestResultState {
  testResults: Record<string, Record<string, TestResultInfo>>;
  historyDirPath: string | null;
  historyFilePath: string | null;
  jsonOutputFilePath: string | null;
  filePathIndex: Map<string, Set<string>>; // ファイルパスによる検索インデックス
  directoryPathIndex: Map<string, Set<string>>; // ディレクトリパスによる検索インデックス
  isInitialized: boolean;
  context: vscode.ExtensionContext | null;
}

// モジュールレベルの状態 (初期化前)
let currentState: TestResultState = {
  testResults: {},
  historyDirPath: null,
  historyFilePath: null,
  jsonOutputFilePath: null,
  filePathIndex: new Map<string, Set<string>>(),
  directoryPathIndex: new Map<string, Set<string>>(),
  isInitialized: false,
  context: null,
};

// 状態取得関数 (読み取り専用アクセス)
export const getState = (): Readonly<TestResultState> => {
  return currentState;
};

// 状態更新関数 (主に内部使用)
const updateState = (newState: Partial<TestResultState>): void => {
  currentState = { ...currentState, ...newState };
};

// 状態が初期化されているか確認
const ensureInitialized = (): boolean => {
  if (!currentState.isInitialized || !currentState.context) {
    console.error(
      "[testResultProcessor2] 初期化されていません。まずinitialize()を呼び出してください。"
    );
    return false;
  }
  return true;
};

/**
 * パスを正規化する関数 (クロスプラットフォーム対応)
 */
export const normalizePath = (filePath: string): string => {
  return filePath.replace(/\\/g, "/");
};

/**
 * 内部ヘルパー: ファイルパスインデックスを更新
 */
const addToFilePathIndex = (
  index: Map<string, Set<string>>,
  normalizedFilePath: string,
  key: string
): void => {
  // 完全に正規化されたパスでインデックス化
  if (!index.has(normalizedFilePath)) {
    index.set(normalizedFilePath, new Set<string>());
  }
  index.get(normalizedFilePath)!.add(key);

  // ベース名のみでインデックス化（完全パスと異なる場合）
  const baseName = path.basename(normalizedFilePath);
  if (baseName !== normalizedFilePath) {
    if (!index.has(baseName)) {
      index.set(baseName, new Set<string>());
    }
    index.get(baseName)!.add(key);
  }
};

/**
 * 内部ヘルパー: パスから親ディレクトリのリストを取得（キャッシュ付き）
 */
const getParentDirectories = (normalizedFilePath: string): string[] => {
  // ファイルパスからディレクトリを取得
  let dirPath = path.dirname(normalizedFilePath);
  dirPath = normalizePath(dirPath);

  // キャッシュをチェック
  if (directoryPathCache.has(dirPath)) {
    return directoryPathCache.get(dirPath)!;
  }

  // 親ディレクトリのリストを構築
  const parentDirs: string[] = [];
  let currentDir = dirPath;

  while (currentDir && currentDir !== "." && currentDir !== "/") {
    parentDirs.push(currentDir);
    currentDir = normalizePath(path.dirname(currentDir));
  }

  // キャッシュに保存
  directoryPathCache.set(dirPath, parentDirs);
  return parentDirs;
};

/**
 * 内部ヘルパー: ディレクトリパスインデックスを更新（最適化版）
 */
const addToDirectoryPathIndex = (
  index: Map<string, Set<string>>,
  normalizedFilePath: string,
  key: string
): void => {
  // 親ディレクトリのリストを取得（キャッシュ対応）
  const parentDirs = getParentDirectories(normalizedFilePath);

  // 各親ディレクトリにキーを追加
  for (const dir of parentDirs) {
    if (!index.has(dir)) {
      index.set(dir, new Set<string>());
    }
    index.get(dir)!.add(key);
  }
};

/**
 * 内部ヘルパー: インデックスからキーを削除
 */
const removeFromIndices = (normalizedFilePath: string, key: string): void => {
  // ファイルパスインデックスから削除
  const filePathIndex = currentState.filePathIndex;
  const baseName = path.basename(normalizedFilePath);

  // 正規化されたパスからキーを削除
  if (filePathIndex.has(normalizedFilePath)) {
    filePathIndex.get(normalizedFilePath)!.delete(key);
    // セットが空になったら削除
    if (filePathIndex.get(normalizedFilePath)!.size === 0) {
      filePathIndex.delete(normalizedFilePath);
    }
  }

  // ベース名からキーを削除
  if (baseName !== normalizedFilePath && filePathIndex.has(baseName)) {
    filePathIndex.get(baseName)!.delete(key);
    if (filePathIndex.get(baseName)!.size === 0) {
      filePathIndex.delete(baseName);
    }
  }

  // ディレクトリパスインデックスから削除
  const directoryPathIndex = currentState.directoryPathIndex;
  const parentDirs = getParentDirectories(normalizedFilePath);

  for (const dir of parentDirs) {
    if (directoryPathIndex.has(dir)) {
      directoryPathIndex.get(dir)!.delete(key);
      if (directoryPathIndex.get(dir)!.size === 0) {
        directoryPathIndex.delete(dir);
      }
    }
  }
};

/**
 * 差分更新: 特定のファイルパスのテスト結果とインデックスを更新
 */
const updateTestResultsForFile = (
  filePath: string,
  newTests: Record<string, TestResultInfo>
): void => {
  const normalizedPath = normalizePath(filePath);
  const oldTests = currentState.testResults[normalizedPath] || {};

  // 古い結果とのキーの差分を計算
  const oldKeys = new Set(Object.keys(oldTests));
  const newKeys = new Set(Object.keys(newTests));

  // 削除されたテスト
  for (const testName of oldKeys) {
    if (!newKeys.has(testName)) {
      const key = `${normalizedPath}#${testName}`;
      removeFromIndices(normalizedPath, key);
    }
  }

  // 追加/更新されたテスト
  for (const testName of newKeys) {
    const key = `${normalizedPath}#${testName}`;

    // インデックスに追加（新規または更新）
    addToFilePathIndex(currentState.filePathIndex, normalizedPath, key);
    addToDirectoryPathIndex(
      currentState.directoryPathIndex,
      normalizedPath,
      key
    );
  }

  // テスト結果を更新
  if (Object.keys(newTests).length === 0) {
    // テストが空なら削除
    if (normalizedPath in currentState.testResults) {
      delete currentState.testResults[normalizedPath];
    }
  } else {
    // テスト結果を更新
    currentState.testResults[normalizedPath] = { ...newTests };
  }
};

/**
 * 内部ヘルパー：テスト結果からインデックスを構築する共通関数
 */
const buildIndicesFromResults = (
  testResults: Record<string, Record<string, TestResultInfo>>
): {
  filePathIndex: Map<string, Set<string>>;
  directoryPathIndex: Map<string, Set<string>>;
} => {
  const newFilePathIndex = new Map<string, Set<string>>();
  const newDirectoryPathIndex = new Map<string, Set<string>>();

  for (const [filePath, tests] of Object.entries(testResults)) {
    const normalizedPath = normalizePath(filePath);
    for (const testName of Object.keys(tests)) {
      const key = `${normalizedPath}#${testName}`;
      addToFilePathIndex(newFilePathIndex, normalizedPath, key);
      addToDirectoryPathIndex(newDirectoryPathIndex, normalizedPath, key);
    }
  }

  return {
    filePathIndex: newFilePathIndex,
    directoryPathIndex: newDirectoryPathIndex,
  };
};

// --- Initialization and Setup ---

/**
 * TestResultProcessorを初期化
 * @param context VSCode Extension Context
 */
export const initialize = async (
  context: vscode.ExtensionContext
): Promise<void> => {
  if (currentState.isInitialized) {
    console.warn("[testResultProcessor2] すでに初期化されています");
    return;
  }

  // まず最初にコンテキストを設定し、初期化中のフラグを立てる
  updateState({ context, isInitialized: false });

  // 1. 履歴ディレクトリとファイルパスを初期化
  try {
    // セッション間で永続的なストレージのためにglobalStorageUriを使用
    const historyDirPath = context.globalStorageUri.fsPath;
    await fsp.mkdir(historyDirPath, { recursive: true }); // ディレクトリが存在することを確認

    // MessagePack形式の履歴ファイルパス
    const historyFilePath = path.join(historyDirPath, HISTORY_FILE_NAME);

    updateState({ historyDirPath, historyFilePath });
  } catch (error) {
    console.error(
      `[testResultProcessor2] 履歴ディレクトリの初期化に失敗: ${error}`
    );
    // ディレクトリの作成が失敗した場合も、履歴の永続化なしで続行する
    updateState({ historyDirPath: null, historyFilePath: null });
  }

  // 2. 既存の履歴を読み込む
  await loadHistoryFile();

  // 3. 自動保存リスナーを登録（登録解除のためにDisposableを返す）
  const disposable = registerAutoSaveListener();
  // コンテキストのsubscriptionsに追加
  if (context && context.subscriptions) {
    context.subscriptions.push(disposable);
  }

  // 4. 終了時の保存処理を登録
  context.subscriptions.push(
    vscode.Disposable.from({
      dispose: () => {
        // 保留中の保存があれば実行
        if (pendingSave && saveDebounceTimer) {
          clearTimeout(saveDebounceTimer);
          saveTestResultsToHistory().catch(console.error);
        }
      },
    })
  );

  // 初期化完了としてマーク
  updateState({ isInitialized: true });
};

/**
 * テスト結果の自動保存リスナーを登録
 */
const registerAutoSaveListener = (): vscode.Disposable => {
  // テストセッション終了時に自動保存を行うリスナーを登録
  const disposable = onTestSessionEnd(() => {
    scheduleHistorySave();
  });

  return disposable;
};

/**
 * 履歴保存をスケジュール（デバウンス処理）
 */
const scheduleHistorySave = (): void => {
  pendingSave = true;

  // 既存のタイマーをクリア
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  // 新しいタイマーをセット
  saveDebounceTimer = setTimeout(() => {
    saveTestResultsToHistory().catch((error) => {
      console.error(
        `[testResultProcessor2] テスト結果の保存中にエラーが発生: ${error}`
      );
    });
    pendingSave = false;
    saveDebounceTimer = null;
  }, SAVE_DEBOUNCE_TIME);
};

// --- History File Operations (Async) ---

/**
 * 履歴ファイルからテスト結果を非同期で読み込む
 */
const loadHistoryFile = async (): Promise<void> => {
  if (!currentState.historyFilePath) {
    console.warn(
      "[testResultProcessor2] 履歴ファイルパスが利用できません。履歴の読み込みをスキップします。"
    );
    return;
  }

  let loadedCount = 0;

  // MessagePack (.mpack)から読み込みを試みる
  try {
    if (fs.existsSync(currentState.historyFilePath)) {
      console.log(
        "[testResultProcessor2] 履歴ファイルからデータを読み込み中..."
      );
      const startTime = Date.now();

      const buffer = await fsp.readFile(currentState.historyFilePath);
      const historyData: TestHistoryData = codec.decode(buffer);

      if (historyData?.testResults) {
        updateState({ testResults: historyData.testResults });

        // インデックスを再構築
        const { filePathIndex, directoryPathIndex } = buildIndicesFromResults(
          historyData.testResults
        );

        // 読み込んだテスト結果の数をカウント
        for (const tests of Object.values(historyData.testResults)) {
          loadedCount += Object.keys(tests).length;
        }

        updateState({
          filePathIndex,
          directoryPathIndex,
        });

        const endTime = Date.now();
        console.log(
          `[testResultProcessor2] 履歴データ読み込み完了: ${loadedCount}件のテスト結果を処理 (${
            endTime - startTime
          }ms)`
        );
      } else {
        console.warn(
          `[testResultProcessor2] historyData.testResultsが存在しません`
        );
      }
    } else {
      console.log(
        `[testResultProcessor2] 履歴ファイルが存在しません: ${currentState.historyFilePath}`
      );
    }
  } catch (error) {
    console.error(
      `[testResultProcessor2] MessagePack履歴ファイルの読み込みエラー: ${error}`
    );
    // エラーの場合、結果をクリア
    updateState({ testResults: {} });
    loadedCount = 0;
  }

  console.log(
    `[testResultProcessor2] loadHistoryFile 完了: ${loadedCount}件のテスト結果を読み込み`
  );
};

/**
 * テスト結果を履歴ファイルに保存
 */
const saveTestResultsToHistory = async (): Promise<void> => {
  if (!ensureInitialized() || !currentState.historyFilePath) {
    console.warn(
      "[testResultProcessor2] 初期化されていないか履歴ファイルパスが設定されていないため保存をスキップします"
    );
    return;
  }

  if (Object.keys(currentState.testResults).length === 0) {
    console.log("[testResultProcessor2] 保存するテスト結果がありません");
    return;
  }

  try {
    console.log("[testResultProcessor2] テスト結果を履歴ファイルに保存中...");
    const startTime = Date.now();

    // 履歴データを構築
    const historyData: TestHistoryData = {
      testResults: currentState.testResults,
    };

    // MessagePackにエンコードして保存
    const buffer = codec.encode(historyData);
    await fsp.writeFile(currentState.historyFilePath, buffer);

    // 結果数をカウント
    let resultCount = 0;
    Object.values(currentState.testResults).forEach((tests) => {
      resultCount += Object.keys(tests).length;
    });

    const endTime = Date.now();
    console.log(
      `[testResultProcessor2] 履歴ファイル保存完了: ${resultCount}件のテスト結果を保存 (${
        endTime - startTime
      }ms)`
    );
  } catch (error) {
    console.error(`[testResultProcessor2] 履歴ファイルの保存に失敗: ${error}`);
  }
};

/**
 * Jest出力用のJSON結果ファイルパスを生成
 */
export const generateJsonOutputFilePath = (): string => {
  if (!ensureInitialized() || !currentState.historyDirPath) {
    console.warn(
      "[testResultProcessor2] 初期化されていないか履歴ディレクトリが設定されていないため一時ディレクトリを使用します"
    );
    // 一時ディレクトリを使用
    const tmpDir =
      currentState.context?.globalStorageUri.fsPath ||
      path.join(path.join(path.resolve("."), "tmp"));

    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    } catch (error) {
      console.error(
        `[testResultProcessor2] 一時ディレクトリの作成に失敗: ${error}`
      );
    }

    const outputFilePath = path.join(tmpDir, `jest-results-${Date.now()}.json`);
    console.log(
      `[testResultProcessor2] 生成したJSONファイルパス: ${outputFilePath}`
    );
    return outputFilePath;
  }

  const outputFilePath = path.join(
    currentState.historyDirPath,
    `jest-results-${Date.now()}.json`
  );

  console.log(
    `[testResultProcessor2] 生成したJSONファイルパス: ${outputFilePath}`
  );

  // jsonOutputFilePathに保存しておく
  updateState({ jsonOutputFilePath: outputFilePath });

  return outputFilePath;
};

/**
 * Jestテスト結果JSONファイルを処理する (再実装)
 */
export const processTestResults = async (
  jsonOutputFilePath: string | null
): Promise<void> => {
  if (!ensureInitialized()) {
    return;
  }

  if (!jsonOutputFilePath) {
    console.error(
      "[testResultProcessor2] jsonOutputFilePathが指定されていません"
    );
    return;
  }

  // JSONファイルを読み込み
  const jsonData = await readTestResultsFromFile(jsonOutputFilePath);

  // JSONファイルが読み込めなかった場合
  if (!jsonData) {
    console.warn(
      `[testResultProcessor2] JSONファイルの読み込みに失敗またはファイルが存在しません: ${jsonOutputFilePath}`
    );

    // テストセッション終了イベントは発火する（UIをブロックしないため）
    notifyTestSessionEnd();
    return;
  }

  // テスト結果を処理
  await processJsonResults(jsonData);

  // テスト結果が更新されたことを通知
  testResultsUpdatedEventEmitter.fire();

  // テストセッション終了イベントを発火
  notifyTestSessionEnd();

  // JSONファイルを削除（一時ファイルのクリーンアップ）
  await cleanupTempJsonFile(jsonOutputFilePath);
};

/**
 * JSON ファイルからテスト結果を読み込む
 */
const readTestResultsFromFile = async (
  jsonFilePath: string
): Promise<any | null> => {
  try {
    console.log(
      `[testResultProcessor2] JSONファイル読み込み開始: ${jsonFilePath}`
    );
    const startTime = Date.now();

    // ファイルが存在するか確認
    try {
      await fsp.access(jsonFilePath, fs.constants.F_OK);
    } catch (error) {
      console.warn(
        `[testResultProcessor2] JSONファイルが存在しません: ${jsonFilePath} (恐らくテストがタイムアウトまたは失敗しました)`
      );
      return null;
    }

    // ファイル読み込み (UTF-8テキスト)
    const fileContent = await fsp.readFile(jsonFilePath, "utf-8");

    // 中身があるか確認
    if (!fileContent || fileContent.trim() === "") {
      console.warn(`[testResultProcessor2] 空のJSONファイル: ${jsonFilePath}`);
      return null;
    }

    let jsonData;
    try {
      // JSONパース
      jsonData = JSON.parse(fileContent);
    } catch (parseError) {
      console.error(
        `[testResultProcessor2] JSONパースエラー: ${parseError}、内容: ${fileContent.substring(
          0,
          200
        )}...`
      );
      return null;
    }

    const endTime = Date.now();
    console.log(
      `[testResultProcessor2] JSONファイル読み込み完了 (${
        endTime - startTime
      }ms)`
    );

    return jsonData;
  } catch (error) {
    console.error(`[testResultProcessor2] JSON読み込みエラー: ${error}`);
    return null;
  }
};

/**
 * Jestテスト結果JSONを処理して状態を更新 (再実装)
 */
const processJsonResults = async (jsonData: any): Promise<void> => {
  if (
    !jsonData ||
    !jsonData.testResults ||
    !Array.isArray(jsonData.testResults)
  ) {
    console.warn(
      "[testResultProcessor2] 無効なJSONデータ形式: testResults配列がありません"
    );
    return;
  }

  console.log("[testResultProcessor2] テスト結果JSON処理開始");
  const startTime = Date.now();

  // テスト結果用の一時マップ（重複を避けるため）
  const processedResults = new Map<string, Map<string, TestResultInfo>>();
  let processedCount = 0;

  try {
    // 各テストスイート (ファイル) を処理
    for (const testSuite of jsonData.testResults) {
      const testFilePath = testSuite.name;

      if (
        !testFilePath ||
        !testSuite.assertionResults ||
        !Array.isArray(testSuite.assertionResults)
      ) {
        console.warn(
          `[testResultProcessor2] スキップ: 無効なテストスイート形式: ${JSON.stringify(
            testSuite
          ).substring(0, 100)}...`
        );
        continue;
      }

      const normalizedFilePath = normalizePath(testFilePath);

      // ファイルごとの結果を格納するマップ
      if (!processedResults.has(normalizedFilePath)) {
        processedResults.set(
          normalizedFilePath,
          new Map<string, TestResultInfo>()
        );
      }

      const fileResults = processedResults.get(normalizedFilePath)!;

      // 各テストケースを処理
      for (const testCase of testSuite.assertionResults) {
        if (!testCase.fullName) {
          console.warn(
            `[testResultProcessor2] スキップ: 無効なテストケース (fullNameなし): ${JSON.stringify(
              testCase
            ).substring(0, 100)}...`
          );
          continue;
        }

        // テスト状態を TestResultStatus に変換
        let status: TestResultStatus;

        switch (testCase.status) {
          case "passed":
            status = TestResultStatus.Success;
            break;
          case "failed":
            status = TestResultStatus.Failure;
            break;
          case "pending":
            status = TestResultStatus.Pending;
            break;
          case "skipped":
            status = TestResultStatus.Skipped;
            break;
          default:
            status = TestResultStatus.Unknown;
        }

        // 失敗メッセージを処理
        let message: string | undefined;
        if (testCase.failureMessages && testCase.failureMessages.length > 0) {
          message = testCase.failureMessages.join("\n");
        }

        // テスト結果情報を作成
        const resultInfo: TestResultInfo = {
          status,
          message,
        };

        // 結果を保存
        fileResults.set(testCase.fullName, resultInfo);
        processedCount++;
      }
    }

    // 各ファイルの結果をまとめて更新（差分更新）
    for (const [filePath, testsMap] of processedResults.entries()) {
      const testsObj: Record<string, TestResultInfo> = {};
      for (const [testName, result] of testsMap.entries()) {
        testsObj[testName] = result;
      }

      // 差分更新関数を使用
      updateTestResultsForFile(filePath, testsObj);
    }

    const endTime = Date.now();
    console.log(
      `[testResultProcessor2] テスト結果処理完了: ${processedCount}件のテスト結果を処理 (${
        endTime - startTime
      }ms)`
    );

    // 保存をスケジュール
    scheduleHistorySave();
  } catch (error) {
    console.error(`[testResultProcessor2] JSON処理中にエラー: ${error}`);
  }
};

/**
 * 一時的なJSON結果ファイルを削除
 */
const cleanupTempJsonFile = async (jsonFilePath: string): Promise<void> => {
  if (!jsonFilePath) {
    return;
  }

  try {
    // ファイルが存在するか確認
    try {
      await fsp.access(jsonFilePath, fs.constants.F_OK);
    } catch (error) {
      // ファイルが既に存在しない場合は無視
      return;
    }

    // ファイルを削除
    await fsp.unlink(jsonFilePath);
    console.log(
      `[testResultProcessor2] 一時JSONファイル削除完了: ${jsonFilePath}`
    );
  } catch (error) {
    console.warn(
      `[testResultProcessor2] 一時JSONファイルの削除中にエラー (無視可): ${error}`
    );
    // ファイルが存在しないか削除できなかった場合はエラーを無視
  }
};

// テストセッション終了通知関数
export const notifyTestSessionEnd = (): void => {
  testSessionEndEventEmitter.fire();
};

// --- Public Access Functions ---

/**
 * 特定のテスト結果を取得
 */
export const getTestResult = (
  filePath: string,
  testName: string
): TestResultInfo | undefined => {
  const normalizedPath = normalizePath(filePath);
  return currentState.testResults[normalizedPath]?.[testName];
};

/**
 * すべてのテスト結果を取得
 */
export const getAllTestResults = (): Readonly<
  Record<string, Record<string, TestResultInfo>>
> => {
  return currentState.testResults;
};

/**
 * ファイルパスインデックスを取得
 */
export const getFilePathIndex = (): ReadonlyMap<
  string,
  ReadonlySet<string>
> => {
  return currentState.filePathIndex;
};

/**
 * ディレクトリパスインデックスを取得
 */
export const getDirectoryPathIndex = (): ReadonlyMap<
  string,
  ReadonlySet<string>
> => {
  return currentState.directoryPathIndex;
};

/**
 * 有効なテストファイルパスかどうかをチェック
 */
export const isValidTestFilePath = isTestFile;
