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
exports.extractTestCases = extractTestCases;
const fs = __importStar(require("fs"));
const util = __importStar(require("util"));
const readFile = util.promisify(fs.readFile);
/**
 * ファイルからJestのテストケースを抽出する
 * @param filePath テストファイルのパス
 * @returns テストケース情報の配列
 */
async function extractTestCases(filePath) {
    try {
        const content = await readFile(filePath, "utf-8");
        const lines = content.split("\n");
        const testCases = [];
        const describeStack = [];
        // ブロックの開始と終了を追跡するためのスタック
        const blockDepthStack = [];
        // 現在の中括弧の深さ
        let currentDepth = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // 行内の中括弧をカウント
            for (const char of line) {
                if (char === "{") {
                    currentDepth++;
                }
                else if (char === "}") {
                    currentDepth--;
                    // describeブロックの終了を検出
                    if (blockDepthStack.length > 0 &&
                        currentDepth === blockDepthStack[blockDepthStack.length - 1]) {
                        blockDepthStack.pop();
                        describeStack.pop();
                    }
                }
            }
            // describeブロックの検出
            const describeMatch = line.match(/describe\(\s*['"](.+?)['"]/);
            if (describeMatch) {
                describeStack.push(describeMatch[1]);
                // describeが見つかった時点での深さを記録（次の中括弧開始の前）
                blockDepthStack.push(currentDepth);
                continue;
            }
            // testケースの検出（test.onlyも検出）
            const testMatch = line.match(/(?:test|it)(?:\.only)?\(\s*['"](.+?)['"]/);
            if (testMatch) {
                const testName = testMatch[1];
                const currentDescribePath = [...describeStack];
                const fullName = [...currentDescribePath, testName].join(" > ");
                testCases.push({
                    name: testName,
                    describePath: currentDescribePath,
                    fullName,
                    lineNumber: i + 1,
                });
            }
        }
        return testCases;
    }
    catch (error) {
        console.error("テストケース抽出エラー:", error);
        return [];
    }
}
//# sourceMappingURL=testExtractor.js.map