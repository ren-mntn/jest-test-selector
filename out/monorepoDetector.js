"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectMonorepoPackages = detectMonorepoPackages;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util = __importStar(require("util"));
const readFile = util.promisify(fs.readFile);
const stat = util.promisify(fs.stat);
const readdir = util.promisify(fs.readdir);
/**
 * ワークスペースからパッケージ情報を取得する
 * @param workspacePath ワークスペースのパス
 * @returns パッケージ情報の配列
 */
async function detectMonorepoPackages(workspacePath) {
    const config = vscode.workspace.getConfiguration('jestTestSelector');
    const monorepoPattern = config.get('monorepoPattern') || 'apps/*';
    try {
        const packages = [];
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
        }
        catch (e) {
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
    }
    catch (error) {
        console.error('モノレポパッケージ検出エラー:', error);
        return [];
    }
}
/**
 * ディレクトリかどうかを確認する
 * @param path 確認するパス
 * @returns ディレクトリならtrue
 */
async function isDirectory(path) {
    try {
        const stats = await stat(path);
        return stats.isDirectory();
    }
    catch (e) {
        return false;
    }
}
/**
 * package.jsonからパッケージ情報を取得する
 * @param packagePath パッケージのパス
 * @returns パッケージ情報
 */
async function getPackageInfo(packagePath) {
    try {
        const packageJsonPath = path.join(packagePath, 'package.json');
        const packageContent = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageContent);
        // パッケージマネージャの検出
        let packageManager = 'npm';
        if (await isFileExists(path.join(packagePath, 'pnpm-lock.yaml'))) {
            packageManager = 'pnpm';
        }
        else if (await isFileExists(path.join(packagePath, 'yarn.lock'))) {
            packageManager = 'yarn';
        }
        return {
            name: packageJson.name || path.basename(packagePath),
            path: packagePath,
            hasTestScript: Boolean(packageJson.scripts && packageJson.scripts.test),
            packageManager
        };
    }
    catch (e) {
        return null;
    }
}
/**
 * ファイルが存在するかを確認する
 * @param filePath ファイルパス
 * @returns 存在すればtrue
 */
async function isFileExists(filePath) {
    try {
        await stat(filePath);
        return true;
    }
    catch (e) {
        return false;
    }
}
//# sourceMappingURL=monorepoDetector.js.map