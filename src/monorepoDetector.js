"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectMonorepoPackages = detectMonorepoPackages;
var vscode = require("vscode");
var fs = require("fs");
var path = require("path");
var util = require("util");
var readFile = util.promisify(fs.readFile);
var stat = util.promisify(fs.stat);
var readdir = util.promisify(fs.readdir);
/**
 * ワークスペースからパッケージ情報を取得する
 * @param workspacePath ワークスペースのパス
 * @returns パッケージ情報の配列
 */
function detectMonorepoPackages(workspacePath) {
    return __awaiter(this, void 0, void 0, function () {
        var config, monorepoPattern, packages, rootPackageJsonPath, rootPackageContent, rootPackage, workspaces, _i, workspaces_1, pattern, baseDir_1, dirs, _a, dirs_1, dir, packagePath, packageInfo, e_1, baseDir, dirs, _b, dirs_2, dir, packagePath, packageInfo, error_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    config = vscode.workspace.getConfiguration('jestTestSelector');
                    monorepoPattern = config.get('monorepoPattern') || 'apps/*';
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 23, , 24]);
                    packages = [];
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 14, , 15]);
                    rootPackageJsonPath = path.join(workspacePath, 'package.json');
                    return [4 /*yield*/, readFile(rootPackageJsonPath, 'utf-8')];
                case 3:
                    rootPackageContent = _c.sent();
                    rootPackage = JSON.parse(rootPackageContent);
                    workspaces = rootPackage.workspaces || [];
                    if (!(workspaces.length > 0)) return [3 /*break*/, 13];
                    _i = 0, workspaces_1 = workspaces;
                    _c.label = 4;
                case 4:
                    if (!(_i < workspaces_1.length)) return [3 /*break*/, 12];
                    pattern = workspaces_1[_i];
                    baseDir_1 = pattern.replace(/\/\*$/, '');
                    return [4 /*yield*/, isDirectory(path.join(workspacePath, baseDir_1))];
                case 5:
                    if (!_c.sent()) return [3 /*break*/, 11];
                    return [4 /*yield*/, readdir(path.join(workspacePath, baseDir_1))];
                case 6:
                    dirs = _c.sent();
                    _a = 0, dirs_1 = dirs;
                    _c.label = 7;
                case 7:
                    if (!(_a < dirs_1.length)) return [3 /*break*/, 11];
                    dir = dirs_1[_a];
                    packagePath = path.join(workspacePath, baseDir_1, dir);
                    return [4 /*yield*/, isDirectory(packagePath)];
                case 8:
                    if (!_c.sent()) return [3 /*break*/, 10];
                    return [4 /*yield*/, getPackageInfo(packagePath)];
                case 9:
                    packageInfo = _c.sent();
                    if (packageInfo) {
                        packages.push(packageInfo);
                    }
                    _c.label = 10;
                case 10:
                    _a++;
                    return [3 /*break*/, 7];
                case 11:
                    _i++;
                    return [3 /*break*/, 4];
                case 12: return [2 /*return*/, packages];
                case 13: return [3 /*break*/, 15];
                case 14:
                    e_1 = _c.sent();
                    return [3 /*break*/, 15];
                case 15:
                    baseDir = monorepoPattern.replace(/\/\*$/, '');
                    return [4 /*yield*/, isDirectory(path.join(workspacePath, baseDir))];
                case 16:
                    if (!_c.sent()) return [3 /*break*/, 22];
                    return [4 /*yield*/, readdir(path.join(workspacePath, baseDir))];
                case 17:
                    dirs = _c.sent();
                    _b = 0, dirs_2 = dirs;
                    _c.label = 18;
                case 18:
                    if (!(_b < dirs_2.length)) return [3 /*break*/, 22];
                    dir = dirs_2[_b];
                    packagePath = path.join(workspacePath, baseDir, dir);
                    return [4 /*yield*/, isDirectory(packagePath)];
                case 19:
                    if (!_c.sent()) return [3 /*break*/, 21];
                    return [4 /*yield*/, getPackageInfo(packagePath)];
                case 20:
                    packageInfo = _c.sent();
                    if (packageInfo) {
                        packages.push(packageInfo);
                    }
                    _c.label = 21;
                case 21:
                    _b++;
                    return [3 /*break*/, 18];
                case 22: return [2 /*return*/, packages];
                case 23:
                    error_1 = _c.sent();
                    console.error('モノレポパッケージ検出エラー:', error_1);
                    return [2 /*return*/, []];
                case 24: return [2 /*return*/];
            }
        });
    });
}
/**
 * ディレクトリかどうかを確認する
 * @param path 確認するパス
 * @returns ディレクトリならtrue
 */
function isDirectory(path) {
    return __awaiter(this, void 0, void 0, function () {
        var stats, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, stat(path)];
                case 1:
                    stats = _a.sent();
                    return [2 /*return*/, stats.isDirectory()];
                case 2:
                    e_2 = _a.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * package.jsonからパッケージ情報を取得する
 * @param packagePath パッケージのパス
 * @returns パッケージ情報
 */
function getPackageInfo(packagePath) {
    return __awaiter(this, void 0, void 0, function () {
        var packageJsonPath, packageContent, packageJson, packageManager, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, , 7]);
                    packageJsonPath = path.join(packagePath, 'package.json');
                    return [4 /*yield*/, readFile(packageJsonPath, 'utf-8')];
                case 1:
                    packageContent = _a.sent();
                    packageJson = JSON.parse(packageContent);
                    packageManager = 'npm';
                    return [4 /*yield*/, isFileExists(path.join(packagePath, 'pnpm-lock.yaml'))];
                case 2:
                    if (!_a.sent()) return [3 /*break*/, 3];
                    packageManager = 'pnpm';
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, isFileExists(path.join(packagePath, 'yarn.lock'))];
                case 4:
                    if (_a.sent()) {
                        packageManager = 'yarn';
                    }
                    _a.label = 5;
                case 5: return [2 /*return*/, {
                        name: packageJson.name || path.basename(packagePath),
                        path: packagePath,
                        hasTestScript: Boolean(packageJson.scripts && packageJson.scripts.test),
                        packageManager: packageManager
                    }];
                case 6:
                    e_3 = _a.sent();
                    return [2 /*return*/, null];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * ファイルが存在するかを確認する
 * @param filePath ファイルパス
 * @returns 存在すればtrue
 */
function isFileExists(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var e_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, stat(filePath)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, true];
                case 2:
                    e_4 = _a.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
