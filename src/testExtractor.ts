import * as fs from 'fs';
import * as util from 'util';

const readFile = util.promisify(fs.readFile);

/**
 * テストケース情報の型定義
 */
export interface TestCase {
  name: string;
  describePath: string[];
  fullName: string;
  lineNumber: number;
}

/**
 * ファイルからJestのテストケースを抽出する
 * @param filePath テストファイルのパス
 * @returns テストケース情報の配列
 */
export async function extractTestCases(filePath: string): Promise<TestCase[]> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    const testCases: TestCase[] = [];
    const describeStack: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // describeブロックの検出
      const describeMatch = line.match(/describe\(\s*['"](.+?)['"]/);
      if (describeMatch) {
        describeStack.push(describeMatch[1]);
        continue;
      }

      // describeブロックの終了検出
      if (line.includes('});') && describeStack.length > 0) {
        describeStack.pop();
        continue;
      }

      // testケースの検出（test.onlyも検出）
      const testMatch = line.match(/(?:test|it)(?:\.only)?\(\s*['"](.+?)['"]/);
      if (testMatch) {
        const testName = testMatch[1];
        const currentDescribePath = [...describeStack];
        const fullName = [...currentDescribePath, testName].join(' > ');

        testCases.push({
          name: testName,
          describePath: currentDescribePath,
          fullName,
          lineNumber: i + 1
        });
      }
    }

    return testCases;
  } catch (error) {
    console.error('テストケース抽出エラー:', error);
    return [];
  }
}
