import * as fs from "fs";
import * as util from "util";

const readFile = util.promisify(fs.readFile);

/**
 * テストケース情報の型定義
 */
export interface TestCase {
  name: string;
  describePath: string[];
  fullName: string;
  lineNumber: number;
  isAllTests?: boolean;
  isDirectoryAllTests?: boolean;
  hasOnly?: boolean; // test.onlyまたはit.onlyがある場合にtrue
}

/**
 * ファイルからJestのテストケースを抽出する
 * @param filePath テストファイルのパス
 * @returns テストケース情報の配列
 */
export async function extractTestCases(filePath: string): Promise<TestCase[]> {
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    const testCases: TestCase[] = [];
    const describeStack: string[] = [];
    // ブロックの開始と終了を追跡するためのスタック
    const blockDepthStack: number[] = [];
    // 現在の中括弧の深さ
    let currentDepth = 0;
    // ファイル内にdescribe.onlyがあるかどうか
    let hasDescribeOnly = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 行内の中括弧をカウント
      for (const char of line) {
        if (char === "{") {
          currentDepth++;
        } else if (char === "}") {
          currentDepth--;

          // describeブロックの終了を検出
          if (
            blockDepthStack.length > 0 &&
            currentDepth === blockDepthStack[blockDepthStack.length - 1]
          ) {
            blockDepthStack.pop();
            describeStack.pop();
          }
        }
      }

      // describe.onlyの検出
      if (/describe\.only\(\s*['"]/.test(line)) {
        hasDescribeOnly = true;
      }

      // describeブロックの検出
      const describeMatch = line.match(/describe(?:\.only)?\(\s*['"](.+?)['"]/);
      if (describeMatch) {
        describeStack.push(describeMatch[1]);
        // describeが見つかった時点での深さを記録（次の中括弧開始の前）
        blockDepthStack.push(currentDepth);
        continue;
      }

      // onlyがついているかどうかを検出
      const hasOnly = /(?:test|it)\.only\(\s*['"]/.test(line);

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
          hasOnly: hasOnly || hasDescribeOnly, // test.onlyまたはdescribe.onlyがある場合はtrue
        });
      }
    }

    // ファイル内にdescribe.onlyがある場合、すべてのテストケースにhasOnlyフラグを設定
    if (hasDescribeOnly) {
      testCases.forEach((testCase) => {
        testCase.hasOnly = true;
      });
    }

    return testCases;
  } catch (error) {
    console.error("テストケース抽出エラー:", error);
    return [];
  }
}
