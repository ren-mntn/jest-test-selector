import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

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
  packageManager: 'npm' | 'yarn' | 'pnpm';
}

/**
 * ワークスペースからパッケージ情報を取得する
 * @param workspacePath ワークスペースのパス
 * @returns パッケージ情報の配列
 */
export async function detectMonorepoPackages(
  workspacePath: string
): Promise<PackageInfo[]> {
  const config = vscode.workspace.getConfiguration('jestTestSelector');
  const monorepoPattern = config.get<string>('monorepoPattern') || 'apps/*';

  try {
    const packages: PackageInfo[] = [];

    // ルートのpackage.jsonを確認
    try {
      const rootPackageJsonPath = path.join(workspacePath, 'package.json');
      const rootPackageContent = await readFile(rootPackageJsonPath, 'utf-8');
      const rootPackage = JSON.parse(rootPackageContent);

      // workspacesプロパティがあればワークスペースパターンを取得
      const workspaces = rootPackage.workspaces || [];

      if (workspaces.length > 0) {
        // workspacesパターンに基づきパッケージを検索
        for (const pattern of workspaces) {
          // 簡易的なglobパターンの処理（実際にはもっと複雑な処理が必要）
          const baseDir = pattern.replace(/\/\*$/, '');
          if (await isDirectory(path.join(workspacePath, baseDir))) {
            const dirs = await readdir(path.join(workspacePath, baseDir));
            for (const dir of dirs) {
              const packagePath = path.join(workspacePath, baseDir, dir);
              if (await isDirectory(packagePath)) {
                const packageInfo = await getPackageInfo(packagePath);
                if (packageInfo) {
                  packages.push(packageInfo);
                }
              }
            }
          }
        }
        return packages;
      }
    } catch (e) {
      // ルートpackage.jsonがない場合は続行
    }

    // monorepoPatternに基づきパッケージを検索
    const baseDir = monorepoPattern.replace(/\/\*$/, '');
    if (await isDirectory(path.join(workspacePath, baseDir))) {
      const dirs = await readdir(path.join(workspacePath, baseDir));
      for (const dir of dirs) {
        const packagePath = path.join(workspacePath, baseDir, dir);
        if (await isDirectory(packagePath)) {
          const packageInfo = await getPackageInfo(packagePath);
          if (packageInfo) {
            packages.push(packageInfo);
          }
        }
      }
    }

    return packages;
  } catch (error) {
    console.error('モノレポパッケージ検出エラー:', error);
    return [];
  }
}

/**
 * ディレクトリかどうかを確認する
 * @param path 確認するパス
 * @returns ディレクトリならtrue
 */
async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch (e) {
    return false;
  }
}

/**
 * package.jsonからパッケージ情報を取得する
 * @param packagePath パッケージのパス
 * @returns パッケージ情報
 */
async function getPackageInfo(
  packagePath: string
): Promise<PackageInfo | null> {
  try {
    const packageJsonPath = path.join(packagePath, 'package.json');
    const packageContent = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageContent);

    // パッケージマネージャの検出
    let packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm';

    if (await isFileExists(path.join(packagePath, 'pnpm-lock.yaml'))) {
      packageManager = 'pnpm';
    } else if (await isFileExists(path.join(packagePath, 'yarn.lock'))) {
      packageManager = 'yarn';
    }

    return {
      name: packageJson.name || path.basename(packagePath),
      path: packagePath,
      hasTestScript: Boolean(packageJson.scripts && packageJson.scripts.test),
      packageManager
    };
  } catch (e) {
    return null;
  }
}

/**
 * ファイルが存在するかを確認する
 * @param filePath ファイルパス
 * @returns 存在すればtrue
 */
async function isFileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (e) {
    return false;
  }
}
