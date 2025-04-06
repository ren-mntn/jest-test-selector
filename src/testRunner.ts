import * as path from "path";
import * as vscode from "vscode";
import { JestDebugger } from "./debugger";
import { detectMonorepoPackages, PackageInfo } from "./monorepoDetector";
import { TestCase } from "./testExtractor";

// テスト実行のスコープを定義する型
export type TestScope = "global" | "directory" | "file" | "test" | "package";

// テスト実行のオプションを定義する型
export interface TestRunOptions {
  unitTestOnly?: boolean;
  e2eTestOnly?: boolean;
  runBoth?: boolean;
}

// テスト実行のパラメータを定義する型
export interface TestRunParameters {
  scope: TestScope;
  targetPath: string;
  targetPackage: PackageInfo;
  testCase?: TestCase;
  options: TestRunOptions;
}

/**
 * 純粋関数: テスト実行パラメータの生成
 */
export const createTestRunParameters = (
  scope: TestScope,
  targetPath: string,
  targetPackage: PackageInfo,
  testCase?: TestCase,
  options: TestRunOptions = {}
): TestRunParameters => {
  return {
    scope,
    targetPath,
    targetPackage,
    testCase,
    options,
  };
};

/**
 * 副作用を含む関数: テスト実行
 */
export const runTest = async (params: TestRunParameters): Promise<boolean> => {
  const { scope, targetPath, targetPackage, testCase, options } = params;
  const { unitTestOnly, e2eTestOnly, runBoth } = options;

  try {
    let success = false;

    // パッケージのテスト
    if (scope === "package") {
      // パッケージ全体のテストを実行するケース
      if (runBoth) {
        // 両方（Unit + E2E）実行する場合
        vscode.window.showInformationMessage(
          `パッケージ ${targetPackage.name} のユニットテストとE2Eテストを実行します`
        );

        // カスタムコマンドを構築
        const testCmd = await JestDebugger.prepareDirectoryTestCommand(
          path.join(targetPackage.path, "src"),
          targetPackage,
          false,
          true
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
        const testCmd = await JestDebugger.prepareDirectoryTestCommand(
          path.join(targetPackage.path, "src"),
          targetPackage,
          false,
          true
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
        const testCmd = await JestDebugger.prepareDirectoryTestCommand(
          path.join(targetPackage.path, "src"),
          targetPackage,
          true,
          true
        );

        // 実行
        success = await JestDebugger.startDebuggingWithCustomCommand(
          targetPackage.path,
          targetPackage,
          testCmd,
          `E2Eテスト: ${targetPackage.name}`
        );
      }
    } else if (scope === "directory") {
      // ディレクトリに対するテスト実行
      if (e2eTestOnly) {
        vscode.window.showInformationMessage(
          `ディレクトリ ${path.basename(targetPath)} の E2E テストを実行します`
        );
        success = await JestDebugger.startDebuggingDirectoryTests(
          targetPath,
          targetPackage,
          "e2e"
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
          "unit"
        );
      } else {
        vscode.window.showInformationMessage(
          `ディレクトリ ${path.basename(targetPath)} のテストを実行します`
        );
        success = await JestDebugger.startDebuggingDirectoryTests(
          targetPath,
          targetPackage,
          "all"
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
          `ファイル ${path.basename(targetPath)} のすべてのテストを実行します`
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

    return success;
  } catch (error) {
    if (error instanceof Error) {
      vscode.window.showErrorMessage(`テスト実行エラー: ${error.message}`);
    } else {
      vscode.window.showErrorMessage(
        "テスト実行中に不明なエラーが発生しました"
      );
    }
    return false;
  }
};

/**
 * テストファイル全体を実行する
 * @param filePath テストファイルのパス
 * @param describeBlock 実行するdescribeブロック名（オプション）
 */
export async function runTestFile(
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
    const targetPackage = findPackageForPath(
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
export async function runSpecificTest(
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
    const targetPackage = findPackageForPath(
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
 * 純粋関数: ターゲットパッケージの特定
 */
export const findPackageForPath = (
  filePath: string,
  workspaceFolder: vscode.WorkspaceFolder,
  packages: PackageInfo[]
): PackageInfo | undefined => {
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
};

/**
 * スコープに基づいてテストを実行するヘルパー関数
 */
export async function runTestsAtScope(
  scope: TestScope,
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
      throw new Error(`ワークスペースフォルダが見つかりません: ${targetPath}`);
    }

    // モノレポパッケージを検出
    const packages = await detectMonorepoPackages(workspaceFolder.uri.fsPath);
    if (packages.length === 0) {
      throw new Error("モノレポパッケージが検出できませんでした");
    }

    // ターゲットパスが所属するパッケージを特定
    const targetPackage = findPackageForPath(
      targetPath,
      workspaceFolder,
      packages
    );
    if (!targetPackage) {
      throw new Error(`パッケージが見つかりません: ${targetPath}`);
    }

    console.log(`スコープ: ${scope}, パッケージ: ${targetPackage.name}`);

    // テスト実行パラメータを作成
    const params = createTestRunParameters(
      scope,
      targetPath,
      targetPackage,
      testCase,
      { unitTestOnly, e2eTestOnly, runBoth }
    );

    // テスト実行
    await runTest(params);
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
