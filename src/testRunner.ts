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
        // 実行
        success = await JestDebugger.originalStartDebugging(
          targetPackage.path,
          targetPackage.path,
          false,
          false
        );
      } else if (unitTestOnly) {
        // 実行
        success = await JestDebugger.originalStartDebugging(
          targetPackage.path,
          targetPackage.path,
          false,
          false
        );
      } else if (e2eTestOnly) {
        // 実行
        success = await JestDebugger.originalStartDebugging(
          targetPackage.path,
          targetPackage.path,
          false,
          true
        );
      }
    } else if (scope === "directory") {
      // ディレクトリに対するテスト実行
      console.log(`ディレクトリに対するテスト実行: ${targetPath}`);
      if (e2eTestOnly) {
        success = await JestDebugger.originalStartDebugging(
          targetPackage.path,
          targetPath,
          true,
          true
        );
      } else if (unitTestOnly) {
        success = await JestDebugger.originalStartDebugging(
          targetPackage.path,
          path.join(targetPath),
          true,
          false
        );
      } else {
        success = await JestDebugger.originalStartDebugging(
          targetPackage.path,
          path.join(targetPath),
          true,
          true
        );
      }
    } else if (scope === "file") {
      // ファイルに対するテスト実行
      if (testCase) {
        success = await JestDebugger.originalStartDebugging(
          targetPackage.path,
          targetPath,
          targetPath.endsWith(".e2e.test.ts"),
          false,
          testCase
        );
      } else {
        success = await JestDebugger.originalStartDebugging(
          targetPackage.path,
          targetPath,
          targetPath.endsWith(".e2e.test.ts"),
          true
        );
      }
    } else if (scope === "test") {
      // 個別のテストケース実行
      if (!testCase) {
        throw new Error("テストケースが指定されていません");
      }
      success = await JestDebugger.originalStartDebugging(
        targetPackage.path,
        targetPath,
        targetPath.endsWith(".e2e.test.ts"),
        false,
        testCase
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
