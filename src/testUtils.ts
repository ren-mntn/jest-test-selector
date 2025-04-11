import * as path from "path";

/**
 * ファイルパスがテストファイルかどうかを判定します
 * @param filePath 判定対象のファイルパス
 * @returns テストファイルの場合はtrue、それ以外はfalse
 */
export const isTestFile = (filePath: string): boolean => {
  if (!filePath) return false;
  const fileName = path.basename(filePath);
  return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(fileName);
};
