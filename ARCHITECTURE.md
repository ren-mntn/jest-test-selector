# Jest Test Selector アーキテクチャドキュメント

## 1. プロジェクト概要

Jest Test Selector は、モノレポ構造に対応した Visual Studio Code 向けの Jest テスト実行拡張機能です。
この拡張機能は、複雑なモノレポプロジェクト内の Jest テストを効率的に見つけて実行するためのインターフェースを提供します。

### 主な機能

- テストファイルとテストケースのツリービュー表示
- モノレポプロジェクト内のテストファイル検出
- 個別テストケースまたはファイル単位でのテスト実行
- Jest CLI オプションのカスタマイズ
- 絶対パスを使用した正確なテスト実行
- 「All Tests」オプションでファイル内のすべてのテストを実行
- 実装ファイルから対応するテストファイルのテスト一覧を表示
- ディレクトリベースでのテスト表示（同じディレクトリ内のすべてのテストファイルを一覧表示）
- 正確なテスト階層構造の認識と表示
- 現在のディレクトリ内のすべてのテストをワンクリックで実行する機能（ショートカットキー Cmd+Shift+D/Ctrl+Shift+D でも実行可能）
- テストエクスプローラーのルートレベルからワークスペース全体のテストを一括実行する機能
- モノレポ環境における「{パッケージ名}のテストを実行」機能（パッケージディレクトリ配下の全テストを実行）
- 「ユニットテストを実行」「E2E テストを実行」などの簡潔なテスト実行オプション

## 2. プロジェクト構造

```
jest-test-selector/
├── src/                    # ソースコードディレクトリ
│   ├── extension.ts        # 拡張機能のエントリーポイント
│   ├── debugger.ts         # Jestテスト実行とデバッグの管理
│   ├── testExtractor.ts    # テストファイルからテストケースを抽出
│   ├── testTreeDataProvider.ts # テストツリービューのデータプロバイダ
│   ├── testSettingsView.ts # テスト設定用WebView
│   └── monorepoDetector.ts # モノレポプロジェクト構造の検出
├── out/                    # コンパイル後のJavaScriptファイル
├── media/                  # 画像などの静的リソース
├── package.json            # 拡張機能のマニフェスト
├── tsconfig.json           # TypeScriptコンパイラ設定
└── README.md               # 拡張機能の説明ドキュメント
```

## 3. 主要コンポーネント詳細

### src/extension.ts

- 拡張機能のエントリーポイントであり、有効化時に実行される `activate` 関数を提供
- テスト設定ビューのプロバイダーを登録
- テストツリービューのデータプロバイダーを初期化・登録
- 以下のコマンドの登録と実装:
  - `jestTestSelector.selectOptions`: Jest CLI オプション設定タブを開く
  - `jestTestSelector.openSettings`: 設定エディタを開く
  - `jestTestSelector.refreshTests`: テストリストを更新
  - `jestTestSelector.runGlobalAllTests`: ワークスペース全体のテストを実行
  - `jestTestSelector.runDirectoryAllTests`: 選択されたディレクトリ内のテストを実行
  - `jestTestSelector.runFileAllTests`: 選択されたファイル内のすべてのテストを実行
  - `jestTestSelector.runSelectedTest`: 選択された個別のテストケースを実行
  - `jestTestSelector.runCurrentDirectoryTests`: 現在開いているファイルのディレクトリ内のテストを実行
- テスト実行時のスコープ（グローバル/ディレクトリ/ファイル）に基づくヘルパー関数の提供
- エディタが特定のファイルにフォーカスした際のテストビュー更新の制御
- ディレクトリやファイルの切り替え時にも「ワークスペース全体のテストを実行」ノードが常に表示されるよう管理

### src/debugger.ts

- `JestDebugger`クラスによるテスト実行とデバッグ管理
- テスト実行時のターミナル出力キャプチャ
- 以下の主要な機能を提供:
  - `startDebugging`: 特定テストケースのデバッグセッション開始
  - `startDebuggingAllTests`: ファイル内すべてのテストを実行
  - `startDebuggingDirectoryTests`: ディレクトリ内のテストを実行
  - `startDebuggingWithCustomCommand`: カスタムコマンドでのテスト実行
- 正確なテスト識別のための正規表現パターン生成
- デバッグ設定の構築と管理
- 保存された CLI オプションの適用
- E2E テストと通常テストの区別と適切な設定ファイルの選択
- モノレポ構造内での絶対パスを使用した正確なテスト実行
- ディレクトリテスト実行用の適切なパスパターン生成
- `--testPathPattern` オプションを使用して指定ディレクトリ直下のテストファイルのみを実行する機能
- 正規表現パターンのエスケープ処理強化による様々な環境での一貫した動作

### src/testExtractor.ts

- テストファイルを解析し、テストケース情報を抽出する機能を提供
- `TestCase` インターフェースの定義:
  ```typescript
  interface TestCase {
    name: string; // テスト名
    describePath: string[]; // テストが含まれるdescribeブロックの階層
    fullName: string; // 完全修飾テスト名（describe > test形式）
    lineNumber: number; // テストが定義されている行番号
    isAllTests?: boolean; // 「全テスト実行」フラグ
    isDirectoryAllTests?: boolean; // 「ディレクトリ全テスト実行」フラグ
  }
  ```
- 中括弧の深さを追跡して正確にブロック構造と階層を認識
- `describe`ブロックと`test`/`it`ブロックの検出
- テストケースの階層構造（親 describe ブロック）を正確に追跡
- シンプルかつ効率的なファイル解析アプローチ

### src/testTreeDataProvider.ts

- VS Code の `TreeDataProvider` インターフェースを実装
- テストエクスプローラービューのデータ提供
- 以下の機能を持つ:
  - ツリー構造でのテスト表示（ルート > ディレクトリ > ファイル > テストケース）
  - テストファイル、ディレクトリ、テストケースの階層的表示
  - 実装ファイルから対応するテストファイルの自動検出と表示
  - ディレクトリ内の複数テストファイルの一元管理
  - アクティブなエディタに基づくテストツリーの自動更新
  - テストアイテムの視覚的表現（アイコン、ツールチップ、コンテキストメニュー）
  - モノレポ環境における「{パッケージ名}のテストを実行」ノードの自動生成
- テストツリー項目のタイプ定義:
  - `file`: 通常のテストファイル
  - `describe`: テストグループ（describe ブロック）
  - `testCase`: 個別のテストケース
  - `globalAllTests`: ワークスペース全体のテスト実行
  - `directoryAllTests`: ディレクトリ内のすべてのテスト実行
  - `fileAllTests`: ファイル内のすべてのテスト実行
- 現在フォーカスしているファイルのテストアイテムをハイライト表示

### src/testSettingsView.ts

- Jest CLI オプション設定用 WebView の管理
- シングルトンパターンでのインスタンス管理
- `TestSettingsProvider` クラスによる WebView プロバイダー実装
- 以下の機能を提供:
  - 一般的な Jest CLI オプションの UI 表示（チェックボックス形式）
  - オプションの保存と読み込み
  - カスタムオプション入力サポート
  - VS Code 設定との連携
- CSS ファイルの変更を監視して自動的にビューを更新
- リアルタイムなフィードバック（保存完了通知、エラー通知）

### src/monorepoDetector.ts

- モノレポプロジェクト構造の自動検出
- `PackageInfo` インターフェースの定義:
  ```typescript
  interface PackageInfo {
    name: string; // パッケージ名
    path: string; // パッケージのパス
    hasTestScript: boolean; // テストスクリプトの有無
    packageManager: "npm" | "yarn" | "pnpm"; // パッケージマネージャ
  }
  ```
- workspaces プロパティに基づくモノレポパッケージの検出
- 設定から指定されたモノレポパターンでのパッケージ検索
- パッケージマネージャーの自動検出（npm, yarn, pnpm）
- package.json の解析と適切なパッケージ情報の抽出
- Jest 設定ファイル（jest.config.js）のあるディレクトリを自動的に検出し、パッケージ情報を取得

## 4. 主要なデータフロー

1. **テスト検出フロー**:

   - `monorepoDetector` がプロジェクト構造を分析
   - テストファイルを検索
   - `testExtractor` がファイルからテストケースを抽出
   - `testTreeDataProvider` がツリービューを構築

2. **テスト実行フロー**:

   - ユーザーがテストを選択
   - `debugger` が適切なコマンドとパラメータを構成
   - VS Code のデバッグセッションでテストを実行
   - 実行結果は統合ターミナルに直接表示される

3. **設定フロー**:

   - ユーザーが `testSettingsView` でオプションを設定
   - 設定が VS Code の設定ストレージに保存
   - `debugger` が実行時に設定を読み込んでコマンドに適用

4. **ディレクトリモードフロー**:
   - ディレクトリ内のすべてのテストファイルを検出
   - 各ファイルからテストケースを抽出
   - 階層化されたツリーを構築
   - ユーザーがテストまたはファイル単位で実行選択

## 5. 拡張ポイント

- **新しいパッケージマネージャのサポート**:
  `debugger.ts` の実行コマンド生成ロジックを拡張

- **新しいテストフレームワークのサポート**:
  `testExtractor.ts` と `debugger.ts` を修正して他のテストフレームワークに対応

- **テスト実行モードの追加**:
  異なる実行オプション（カバレッジレポートなど）をサポートするための拡張

- **ファイル関係性の検出強化**:
  より複雑なファイル命名規則に対応するための検出ロジックの拡張

- **テストエクスプローラーの機能拡張**:
  新しいコマンドやテスト実行オプションを追加する場合は、`extension.ts` の `activate` 関数内でコマンドを登録し、`testTreeDataProvider.ts` の `TestTreeItem` クラスにアイコンやコンテキストメニューを設定する。

- **テスト実行範囲の拡張**:
  特定の条件やパターンに基づいてテストを実行する機能を追加する場合は、`debugger.ts` の実行メソッドを拡張し、`extension.ts` に新しいコマンドを登録する。

## 6. 実装の注意点

- **テスト名の正確な一致**:
  テスト名を正確に一致させるための正規表現パターン生成が重要

- **絶対パスの使用**:
  テストファイルへの絶対パスを使用することで、複雑なモノレポ構造でも正確にテストを実行

- **WebView の処理**:
  WebView の初期化とメッセージ処理のタイミングに注意

- **デバッグセッション管理**:
  デバッグセッションの開始/終了イベントの適切な処理が必要

- **ブロック構造の正確な把握**:
  テストファイル内の階層構造を正確に認識するための括弧の深さ追跡が重要

- **ディレクトリモードとファイルモードの切り替え**:
  状況に応じた適切なモード選択とユーザーエクスペリエンスの維持

- **サブディレクトリの除外**:
  ディレクトリテスト実行時にサブディレクトリ内のテストを除外するには `--testPathPattern` オプションを使用

## 7. 一般的な機能拡張シナリオ

### 1. テストエクスプローラーに新しいコマンドを追加する場合

1. **package.json の更新**:

   - `contributes.commands` セクションに新しいコマンドを登録
   - 必要に応じて `contributes.menus` にメニュー項目を追加
   - 例:
     ```json
     {
       "command": "jestTestSelector.newCommand",
       "title": "新しいコマンド"
     }
     ```

2. **extension.ts の更新**:

   - `activate` 関数内で新しいコマンドを登録
   - 例:
     ```typescript
     const newCommandDisposable = vscode.commands.registerCommand(
       "jestTestSelector.newCommand",
       async () => {
         // コマンドの実装
       }
     );
     disposables.push(newCommandDisposable);
     ```

3. **testTreeDataProvider.ts の更新** (必要に応じて):
   - `TestTreeItem` クラスのコンストラクタ内でアイテムタイプに応じた処理を追加
   - コンテキストメニューに対応させる場合は、`contextValue` を適切に設定

### 2. 特定のテスト範囲を実行する機能を追加する場合

1. **debugger.ts の更新**:

   - 新しいテスト実行メソッドを `JestDebugger` クラスに追加
   - 例:
     ```typescript
     public static async startDebuggingCustomScope(
       scopePath: string,
       packageInfo: PackageInfo,
       options: any
     ): Promise<boolean> {
       // 実装
     }
     ```

2. **extension.ts の更新**:

   - 新しいコマンドを登録して、上記のメソッドを呼び出す
   - 例:
     ```typescript
     const runCustomScopeTestsDisposable = vscode.commands.registerCommand(
       "jestTestSelector.runCustomScopeTests",
       async (item: TestTreeItem) => {
         // JestDebugger.startDebuggingCustomScope を呼び出す
       }
     );
     ```

3. **testTreeDataProvider.ts の更新**:
   - 必要に応じて新しいアイテムタイプとコンテキストメニューを追加

### 3. テスト設定に新しいオプションを追加する場合

1. **testSettingsView.ts の更新**:

   - Jest CLI オプションの定義に新しいオプションを追加
   - 例:
     ```typescript
     {
       id: "--newOption",
       label: "新しいオプション",
       description: "新しいオプションの説明",
       value: !!currentOptions["--newOption"],
     }
     ```

2. **debugger.ts の更新**:
   - `getJestCliArgs` メソッド内で新しいオプションの処理を追加（必要に応じて）

### 4. ワークスペース全体のテストを実行する機能を追加する場合

1. **package.json の更新**:

   - 新しいコマンドを登録

2. **extension.ts の更新**:

   - グローバルスコープのテスト実行用コマンドを追加
   - 例:

     ```typescript
     const runAllTestsDisposable = vscode.commands.registerCommand(
       "jestTestSelector.runAllTests",
       async () => {
         const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
         if (!workspaceFolder) {
           vscode.window.showErrorMessage("ワークスペースが開かれていません");
           return;
         }

         // モノレポパッケージの取得と実行
         const packages = await detectMonorepoPackages(
           workspaceFolder.uri.fsPath
         );
         // ルートパッケージを取得
         const rootPackage = {
           name: "root",
           path: workspaceFolder.uri.fsPath,
           hasTestScript: true,
           packageManager: "npm",
         };

         await runTestsAtScope(
           "global",
           workspaceFolder.uri.fsPath,
           rootPackage
         );
       }
     );
     ```

3. **testTreeDataProvider.ts の更新**:
   - `globalAllTests` タイプのノードを追加（既存のものを使用可能）
   - コンストラクタでアイコンと動作を設定

### 5. 特殊なテストファイル形式に対応する場合

1. **testExtractor.ts の更新**:

   - 必要に応じて正規表現パターンを更新して新しいファイル形式を検出
   - 例:
     ```typescript
     const specialTestMatch = line.match(/specialTest\(\s*['"](.+?)['"]/);
     if (specialTestMatch) {
       // 特殊テストケースの処理
     }
     ```

2. **testTreeDataProvider.ts の更新**:
   - `isTestFile` メソッドの条件を拡張して新しいテストファイル形式を検出
   - 特殊なファイル表示ロジックが必要な場合は `buildTestTree` メソッドを更新

## 8. Jest コマンド実行と正規表現の注意点

### テスト実行コマンド例

実際に成功したディレクトリテスト実行コマンドの例を以下に示します：

```bash
cd /Users/ren/workspace/aeon-pet/apps/server ; /usr/bin/env 'NODE_OPTIONS= --require /Applications/Cursor.app/Contents/Resources/app/extensions/ms-vscode.js-debug/src/bootloader.js  --inspect-publish-uid=http' 'VSCODE_INSPECTOR_OPTIONS=:::{"inspectorIpc":"/var/folders/nj/gsm1ftq52g757vhzttjntq_80000gn/T/node-cdp.77223-36e865a2-36.sock","deferredMode":false,"waitForDebugger":"","execPath":"/Users/ren/.nodenv/versions/20.0.0/bin/node","onlyEntrypoint":false,"autoAttachMode":"always","fileCallback":"/var/folders/nj/gsm1ftq52g757vhzttjntq_80000gn/T/node-debug-callback-c9b8e4b01ea2736e"}' /bin/sh -c npx\ jest\ \'/Users/ren/workspace/aeon-pet/apps/server/src/routes/app/users/_userId/coupons/*\'\ --config\ jest.config.js\  \&\&\ npx\ jest\ \'/Users/ren/workspace/aeon-pet/apps/server/src/routes/app/users/_userId/coupons/*\'\ --config\ jest.config.e2e.js\
```

この例から以下の重要なポイントを理解できます：

1. **VS Code デバッグ環境変数の設定**：`NODE_OPTIONS`と`VSCODE_INSPECTOR_OPTIONS`を設定してデバッグを有効化
2. **ディレクトリの指定**：`cd`コマンドで正しいワーキングディレクトリに移動してから実行
3. **パターン指定の形式**：パスにはシングルクォートを使用し、`*`でファイルマッチング
4. **連続実行**：通常テストと E2E テストを`&&`で連結して順次実行

### テストファイルパターン指定の注意点

Jest のファイルパターン指定には以下の注意点があります：

1. **拡張子指定は不要**：Jest 自体がデフォルトでテストファイルのみを認識するため、`.test.ts`などの拡張子指定は基本的に不要

   ```bash
   # 良い例（シンプルでロバスト）
   npx jest '/path/to/directory/*'

   # 不要な複雑さを持つ例
   npx jest '/path/to/directory/*.test.ts'
   ```

2. **ディレクトリ指定の方法**：ディレクトリ指定は末尾に`/*`をつけるだけで十分

   ```bash
   # ディレクトリ内のすべてのテスト
   npx jest '/path/to/directory/*'
   ```

3. **正規表現よりもグロブパターン**：複雑な正規表現よりも単純なグロブパターンを使用する方が信頼性が高い

4. **サブディレクトリを除外する方法**：Jest はデフォルトで再帰的にサブディレクトリを検索するため、特定のディレクトリのみを対象とする場合は `--testPathPattern` オプションを使用する

   ```bash
   # 悪い例（サブディレクトリも含めて検索される）
   npx jest '/path/to/directory/*'

   # 良い例（指定ディレクトリ直下のファイルのみを検索）
   npx jest --testPathPattern='^/path/to/directory/[^/]+\.test\.(ts|js)$'
   ```

   この正規表現の意味：

   - `^` - パスの先頭からマッチング
   - `/path/to/directory/` - 指定ディレクトリまでのパス
   - `[^/]+` - スラッシュを含まない 1 文字以上の文字列（つまりファイル名）
   - `\.test\.(ts|js)$` - .test.ts または .test.js で終わるファイル

このガイドラインに従うことで、Jest のテスト実行コマンドがより堅牢になり、異なる環境でも一貫して動作するようになります。
