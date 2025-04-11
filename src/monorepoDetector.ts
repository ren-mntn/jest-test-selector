import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import * as vscode from "vscode";

// ファイルシステム操作のプロミス化
const readFile = util.promisify(fs.readFile);
const stat = util.promisify(fs.stat);
const readdir = util.promisify(fs.readdir);

/**
 * パッケージ情報の型定義
 */
export interface PackageInfo {
  name: string;
  path: string;
  hasTestScript: boolean;
  packageManager: "npm" | "yarn" | "pnpm";
}

/**
 * package.jsonからパッケージ情報を取得する
 */
async function getPackageInfo(
  packagePath: string
): Promise<PackageInfo | null> {
  try {
    const packageJsonPath = path.join(packagePath, "package.json");
    const packageContent = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageContent);

    // パッケージマネージャの検出 - 優先順位: pnpm > yarn > npm(デフォルト)
    let packageManager: "npm" | "yarn" | "pnpm" = "npm";

    // ロックファイルの存在チェックを一つのブロックで処理
    const pnpmLockPath = path.join(packagePath, "pnpm-lock.yaml");
    const yarnLockPath = path.join(packagePath, "yarn.lock");

    try {
      await stat(pnpmLockPath);
      packageManager = "pnpm";
    } catch {
      try {
        await stat(yarnLockPath);
        packageManager = "yarn";
      } catch {}
    }

    return {
      name: packageJson.name || path.basename(packagePath),
      path: packagePath,
      hasTestScript: Boolean(packageJson.scripts && packageJson.scripts.test),
      packageManager,
    };
  } catch {
    return null;
  }
}

/**
 * ディレクトリ内のすべてのパッケージを取得する
 */
async function getPackagesFromDirectory(
  baseDir: string,
  workspacePath: string
): Promise<PackageInfo[]> {
  const fullPath = path.join(workspacePath, baseDir);
  const packages: PackageInfo[] = [];

  try {
    // ディレクトリかどうか確認
    const stats = await stat(fullPath);
    if (!stats.isDirectory()) return packages; // 空の配列を返す

    // ディレクトリ内のエントリを取得
    const entries = await readdir(fullPath);

    // 各サブディレクトリを処理
    for (const entry of entries) {
      const packagePath = path.join(workspacePath, baseDir, entry);

      try {
        // サブディレクトリかどうか確認
        const entryStats = await stat(packagePath);
        if (!entryStats.isDirectory()) continue; // ディレクトリでなければスキップ

        // package.json情報を取得
        const packageInfo = await getPackageInfo(packagePath);
        if (packageInfo) packages.push(packageInfo);
      } catch {}
    }
  } catch {}

  return packages;
}

/**
 * ワークスペースからパッケージ情報を取得する
 */
export async function detectMonorepoPackages(
  workspacePath: string
): Promise<PackageInfo[]> {
  try {
    // 設定から情報を取得
    const config = vscode.workspace.getConfiguration("jestTestSelector");
    const monorepoPattern = config.get<string>("monorepoPattern") || "apps/*";

    // ルートのpackage.jsonからワークスペース情報を取得
    try {
      const rootPackageJsonPath = path.join(workspacePath, "package.json");
      const rootPackageContent = await readFile(rootPackageJsonPath, "utf-8");
      const rootPackage = JSON.parse(rootPackageContent);

      // workspacesプロパティがあればそれを使用
      const workspaces = rootPackage.workspaces || [];
      if (workspaces.length > 0) {
        const packages: PackageInfo[] = [];

        // 各ワークスペースパターンからパッケージを収集
        for (const pattern of workspaces) {
          const baseDir = pattern.replace(/\/\*$/, "");
          const packagesFromDir = await getPackagesFromDirectory(
            baseDir,
            workspacePath
          );
          packages.push(...packagesFromDir);
        }

        return packages;
      }
    } catch {}

    // workspacesが見つからない場合はmonorepoPatternを使用
    const baseDir = monorepoPattern.replace(/\/\*$/, "");
    return await getPackagesFromDirectory(baseDir, workspacePath);
  } catch (error) {
    console.error("モノレポパッケージ検出エラー:", error);
    return [];
  }
}
