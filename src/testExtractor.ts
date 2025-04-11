import * as fs from "fs";
import * as ts from "typescript";
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
}

/**
 * ファイルからJestのテストケースを抽出する（AST解析を使用）
 * @param filePath テストファイルのパス
 * @returns テストケース情報の配列
 */
export async function extractTestCases(filePath: string): Promise<TestCase[]> {
  try {
    // ファイルの内容を読み込む
    const content = await readFile(filePath, "utf-8");

    // TypeScriptのASTを生成
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    // 抽出したテストケースを保存する配列
    const testCases: TestCase[] = [];

    // describeブロックのネストを追跡する配列
    const describeStack: { name: string; hasOnly: boolean }[] = [];

    // ASTを走査して、describeブロックとテストケースを検出
    function visit(node: ts.Node) {
      // 関数呼び出し式を探す (describe, it, test など)
      if (ts.isCallExpression(node)) {
        // describeブロックの名前を取得（最初の引数が文字列リテラルと想定）
        if (
          node.arguments.length > 0 &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const describeName = node.arguments[0].text;

          // describeスタックにpush (hasOnlyを削除)
          describeStack.push({ name: describeName, hasOnly: false }); // Always false

          // describeブロックの第2引数（関数）の中を探索
          if (node.arguments.length > 1) {
            ts.forEachChild(node.arguments[1], visit);
          }

          // 探索が終わったらスタックからpop
          describeStack.pop();
          return;
        }
      }

      // ノードの子ノードを再帰的に訪問（describeの第2引数以外の部分）
      ts.forEachChild(node, visit);
    }

    // ルートノードから探索を開始
    visit(sourceFile);

    return testCases;
  } catch (error) {
    console.error("テストケース抽出エラー:", error);
    return [];
  }
}

/**
 * ノードがdescribe関数の呼び出しかどうかを判定
 */
function isDescribeCall(node: ts.Node): boolean {
  // describe 直接呼び出し
  if (ts.isIdentifier(node) && node.text === "describe") {
    return true;
  }

  // describe.only などの呼び出し
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "describe"
  ) {
    return true;
  }

  return false;
}

/**
 * ノードがtest/it関数の呼び出しかどうかを判定
 */
function isTestCall(node: ts.Node): boolean {
  // test/it 直接呼び出し
  if (ts.isIdentifier(node) && (node.text === "test" || node.text === "it")) {
    return true;
  }

  // test.only/it.only などの呼び出し
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    (node.expression.text === "test" || node.expression.text === "it")
  ) {
    return true;
  }

  return false;
}
