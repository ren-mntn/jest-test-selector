# Jest Test Selector アーキテクチャドキュメント

npm run compile && npm run package

## 1. プロジェクト概要

Jest Test Selector は、モノレポ構造に対応した Visual Studio Code 向けの Jest テスト実行拡張機能です。
この拡張機能は、複雑なモノレポプロジェクト内の Jest テストを効率的に見つけて実行するためのインターフェースを提供します。

### 主な機能

- テストファイルとテストケースのツリービュー表示
- モノレポプロジェクト内のテストファイル検出
- 個別テストケースまたはファイル単位でのテスト実行
- Jest CLI オプションのカスタマイズ
- 絶対パスを使用した正確なテスト実行
- "All Tests"オプションでファイル内のすべてのテストを実行
- 実装ファイルから対応するテストファイルのテスト一覧を表示
- ディレクトリベースでのテスト表示（同じディレクトリ内のすべてのテストファイルを一覧表示）
- 正確なテスト階層構造の認識と表示
- 現在のディレクトリ内のすべてのテストをワンクリックで実行する機能（ショートカットキー Cmd+Shift+D/Ctrl+Shift+D でも実行可能）
- テストエクスプローラーのルートレベルからワークスペース全体のテストを一括実行する機能
- モノレポ環境における"{パッケージ名}のテストを実行"機能（パッケージディレクトリ配下の全テストを実行）
- "ユニットテストを実行" "E2E テストを実行"などの簡潔なテスト実行オプション
- ユニットテスト完了後に E2E テストを自動的に実行する機能（イベントリスナーを使用した連続実行方式）

## 2. プロジェクト構造

```
jest-test-selector/
├── src/                    # ソースコードディレクトリ
│   ├── extension.ts        # 拡張機能のエントリーポイント
│   ├── debugger.ts         # Jestテスト実行とデバッグの管理
│   ├── testExtractor.ts    # テストファイルからテストケースを抽出
│   ├── testTreeDataProvider.ts # テストツリービューのデータプロバイダ
│   ├── testSettingsView.ts # テスト設定用WebView
│   ├── monorepoDetector.ts # モノレポプロジェクト構造の検出
│   ├── testRunner.ts       # テスト実行関連の機能
│   ├── testResultProcessor.ts # テスト結果の処理と管理
│   └── decorationProvider.ts # テスト結果のエディタ内表示機能
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
  - `jestTestSelector.openSettings`: 設定エディタを開く
  - `jestTestSelector.refreshTests`: テストリストを更新
  - `jestTestSelector.runGlobalAllTests`: ワークスペース全体のテストを実行
  - `jestTestSelector.runDirectoryAllTests`: 選択されたディレクトリ内のテストを実行
  - `jestTestSelector.runFileAllTests`: 選択されたファイル内のすべてのテストを実行
  - `jestTestSelector.runSelectedTest`: 選択された個別のテストケースを実行
  - `jestTestSelector.runCurrentDirectoryTests`: 現在開いているファイルのディレクトリ内のテストを実行
- テスト実行時のスコープ（グローバル/ディレクトリ/ファイル）に基づくヘルパー関数の提供
- エディタが特定のファイルにフォーカスした際のテストビュー更新の制御
- ディレクトリやファイルの切り替え時にも"ワークスペース全体のテストを実行"ノードが常に表示されるよう管理

### src/debugger.ts

- `JestDebugger`クラスによるテスト実行とデバッグ管理
- テスト実行時のターミナル出力キャプチャ
- 以下の主要な機能を提供:
  - `startDebugging`: 特定テストケースのデバッグセッション開始
  - `startDebuggingAllTests`: ファイル内すべてのテストを実行
  - `startDebuggingDirectoryTests`: ディレクトリ内のテストを実行（ユニットテスト後に E2E テストを自動実行）
  - `startDebuggingWithCustomCommand`: カスタムコマンドでのテスト実行
- デバッグ設定の構築と管理
- 保存された CLI オプションの適用
- E2E テストと通常テストの区別と適切な設定ファイルの選択
- モノレポ構造内での絶対パスを使用した正確なテスト実行
- ディレクトリテスト実行用の適切なパスパターン生成
- `--testPathPattern` オプションを使用して指定ディレクトリ直下のテストファイルのみを実行する機能
- テスト実行時の出力キャプチャとモニタリング

### src/testExtractor.ts

- テストファイルを解析し、テストケース情報を抽出する機能を提供
- `TestCase` インターフェースの定義:
  ```typescript
  interface TestCase {
    name: string; // テスト名
    describePath: string[]; // テストが含まれるdescribeブロックの階層
    fullName: string; // 完全修飾テスト名（describe > test形式）
    lineNumber: number; // テストが定義されている行番号
    isAllTests?: boolean; // "全テスト実行"フラグ
    isDirectoryAllTests?: boolean; // "ディレクトリ全テスト実行"フラグ
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
  - モノレポ環境における"{パッケージ名}のテストを実行"ノードの自動生成
- テストツリー項目のタイプ定義:
  - `file`: 通常のテストファイル
  - `describe`: テストグループ（describe ブロック）
  - `testCase`: 個別のテストケース
  - `globalAllTests`: ワークスペース全体のテスト実行
  - `directoryAllTests`: ディレクトリ内のすべてのテスト実行
  - `packageAllTests`: パッケージのすべてのテスト実行
- ファイルノードにはテスト実行用のアイコンをインラインに表示
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
- 2 つの表示モード:
  - サイドパネルの WebviewView として表示（従来の方法）
  - トップバーのドロップダウンボタンから表示できる WebviewPanel として表示（新機能）
- ステータスバーの「Jest 設定」ボタンからワンクリックでアクセス可能

### src/monorepoDetector.ts

- モノレポプロジェクト構造の自動検出（究極にシンプルな実装）
- `PackageInfo` インターフェースの定義:
  ```typescript
  interface PackageInfo {
    name: string; // パッケージ名
    path: string; // パッケージのパス
    hasTestScript: boolean; // テストスクリプトの有無
    packageManager: "npm" | "yarn" | "pnpm"; // パッケージマネージャ
  }
  ```
- わずか 3 つの関数で構成された明快なコード:
  - `getPackageInfo`: package.json からパッケージ情報を取得
  - `getPackagesFromDirectory`: ディレクトリ内のパッケージを取得
  - `detectMonorepoPackages`: メインのエクスポート関数
- 簡潔な 1 行条件文と明確なコメントによる可読性の向上
- 不要なブロック記号を省略した最小限のコード
- 直感的で論理的なエラーハンドリング
- シンプル設計の原則"必要最小限のコードで最大の明確さを実現"を体現

### src/testRunner.ts

- テスト実行関連の機能を関数型プログラミングスタイルで実装
- テスト実行のためのパラメータ生成、実行環境の判定、実行処理を提供
- 以下の主要な機能群を提供:
  - テスト実行のスコープ（グローバル/ディレクトリ/ファイル/テスト/パッケージ）の型定義
  - テスト実行オプションとパラメータの型定義
  - テスト実行パラメータの生成（純粋関数）
  - パッケージ特定ロジック（純粋関数）
  - テスト実行処理（副作用を含む関数）
  - 様々なテスト実行パターン対応（ユニットテスト、E2E テスト、両方実行など）
- 関数型プログラミングの特徴:
  - 純粋関数と副作用を含む関数の明確な区別
  - パラメータ生成と実行を分離した設計
  - 型安全性の確保による堅牢な実装
  - エラーハンドリングの一元管理

### src/testResultProcessor.ts

- テスト結果処理と管理のすべての機能を提供
- モジュールレベルの状態を使用した効率的な管理
- 以下の主要な機能を提供:
  - テスト結果情報の型定義と状態管理
  - テスト出力のキャプチャと処理
  - テスト出力からのリアルタイムテスト結果パース
  - テスト結果の履歴ファイル操作（保存・読み込み）
  - 古いテスト結果のクリーンアップ
  - JSON テスト結果ファイルの処理
  - CLI 引数の生成
  - ファイルパスインデックスによる効率的なテスト結果検索
- 関数型プログラミングスタイルの特徴:
  - 純粋関数と副作用を含む関数の明確な区別
  - 不変データ構造の使用
  - 高階関数による動作のカスタマイズ
  - 明示的な状態管理
- Stream ベースと JSON ベースの両方のテスト結果解析に対応
- 持続性のあるテスト結果履歴の管理（MessagePack 形式）
- テストファイルパスの検証と正規化

### src/decorationProvider.ts

- テスト結果をエディタ内に視覚的に表示するための機能を提供
- VS Code の Decoration API を活用した直感的なユーザーインターフェース
- 以下の主要な機能を提供:
  - 失敗したテストケースの行にエラーメッセージを表示
  - テストの状態に応じたデコレーションの適用と管理
  - ファイルパスベースでのデコレーション管理
  - アクティブエディタ変更時のデコレーション更新
  - テスト結果更新時のデコレーション更新
  - ファイル保存時のデコレーション更新
- 関数型プログラミングの特徴:
  - 純粋関数と副作用を含む関数の明確な区別
  - 明示的な状態管理（`activeDecorations` Map）
  - エラーハンドリングの一元管理
  - 副作用の分離（デコレーション適用とリソース管理）
- テスト失敗箇所にエラーメッセージの要約を行末に表示し、ホバー時に詳細なエラーメッセージをツールチップで表示

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
   - テスト結果が JSON ファイルに出力され、履歴ファイルに保存される
   - "全テスト"モードの場合、ユニットテスト完了後にイベントリスナーが E2E テストを自動的に開始

3. **テスト結果フロー**:

   - テスト実行時に`--outputFile`オプションで JSON ファイルに結果出力
   - `readTestResultsFromFile`メソッドが JSON データを解析
   - 解析結果が内部マップに保存され、ツリービューに反映
   - テスト結果が`.vscode/.jest-test-selector-history.json`履歴ファイルに保存
   - 拡張機能起動時に履歴ファイルから過去のテスト結果を自動的に読み込み

4. **設定フロー**:

   - ユーザーが `testSettingsView` でオプションを設定
   - 設定が VS Code の設定ストレージに保存
   - `debugger` が実行時に設定を読み込んでコマンドに適用

5. **ディレクトリモードフロー**:
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

## 追加の機能

### 1. --outputFile オプションを使用した JSON ファイル出力と読み込み機能

#### テスト結果解析の方法

1. **JSON ファイルからの読み込み（推奨）**:

   - Jest コマンドに`--json --outputFile=<ファイルパス>`オプションを追加
   - 実行結果を一時ファイルに出力（`jest-results-{timestamp}.json`）
   - テスト完了後、ファイルから JSON データを直接読み込み
   - JSON から正確なファイルパスとテスト結果を抽出

2. **標準出力からの解析（フォールバック）**:
   - デバッグコンソールの出力をキャプチャ
   - 正規表現を使用してテストファイルパスとテスト結果を抽出
   - 複数のパターンを使用してテスト結果の検出率を向上

#### データフロー

1. ユーザーがテストケースを選択して実行
2. デバッガーがテストを実行し、結果をキャプチャ
3. テスト結果が解析され、内部マップに保存
4. UI が更新され、テスト結果が表示される

#### 設定オプション

- `jestExecutable`: Jest の実行コマンド（デフォルト: `npx jest`）
- `cliOptions`: Jest に渡すコマンドラインオプション

#### 機能拡張ポイント

- テスト結果の表示形式のカスタマイズ
- 追加のテストフレームワークのサポート
- CI との統合

## テスト結果のステータス

テスト結果には以下のステータスがあります：

- `TestResultStatus.Success` - テストが成功した状態
- `TestResultStatus.Failure` - テストが失敗した状態
- `TestResultStatus.Unknown` - テスト状態が不明
- `TestResultStatus.Running` - テスト実行中
- `TestResultStatus.Skipped` - テストがスキップされた状態
- `TestResultStatus.Pending` - テストが保留中の状態

### ユーザーインターフェイス

#### ツリービュー

テストケースはツリービューに階層的に表示されます：

1. パッケージ全体のテスト実行ノード（該当する場合）
2. ファイルノード（現在のファイルまたはディレクトリ）
   - 全てのテストが成功している場合は緑色のチェックマークアイコンで表示
   - 失敗したテストがある場合は赤色のバツ印アイコンで表示
   - それ以外の場合は通常のフォルダアイコンで表示
3. describe ブロックノード
4. 個々のテストケースノード
   - テスト結果に応じたステータスアイコン（成功、失敗、実行中、保留中）が表示されます

## 関数型プログラミングスタイル

プロジェクトでは、特に debugger.ts において関数型プログラミングスタイルを採用しています。以下の原則に従っています：

1. **純粋関数と副作用の分離**: 関数は副作用を持たない純粋関数と、副作用を持つ関数に明確に分けられています。

   - 純粋関数: 同じ入力に対して常に同じ出力を返し、副作用を持ちません（例: `createTestCommand`, `extractTestFilePathFromArgs`）
   - 副作用を持つ関数: VSCode API との連携などで外部状態を変更する関数（例: `startDebugging`, `monitorDebugOutput`）

2. **状態管理の明示化**: 状態はデータ構造として明示的に定義され、状態の変更は専用の関数を通じて行われます。

   - 状態の型: `DebuggerState`
   - 状態操作: `getDebuggerState`, `updateDebuggerState`

3. **不変性の重視**: データ構造は変更せず、新しいコピーを作成して返します。

   - スプレッド演算子（`...`）を使用して新しいオブジェクトを作成
   - 配列操作では`.push()`などの破壊的メソッドの代わりに`[...array, newItem]`などを使用

4. **小さな関数の組み合わせ**: 大きな機能を小さな関数の組み合わせとして実装しています。

この設計により、コードの可読性、テスト容易性、再利用性が向上します。

## 機能と実装

### ターミナルモード実行

デバッガーではなく通常のターミナルでテストを実行するための機能を提供しています。ユーザーはステータスバーのアイコンをクリックするだけで、デバッグモードとターミナルモードを切り替えることができます。

- **実装ファイル**:

  - `src/debugger.ts`: `startTerminalExecution`関数
  - `src/testRunner.ts`: テスト実行オプションに`useTerminal`フラグを追加
  - `src/extension.ts`: ターミナルモード切り替え用のステータスバーアイテムとコマンド

- **使用フロー**:
  1. ステータスバーの「ターミナル実行」ボタンをクリックしてモードを切り替え
  2. テストエクスプローラーから通常通りテストを実行
  3. モードに応じて処理が分岐：
     - 通常モード：デバッガーでテストを実行（ブレークポイントが機能）
     - ターミナルモード：VSCode のターミナルでテストを実行（高速だが、デバッグ機能は使えない）

### モノレポ検出

## テスト履歴の管理

テスト結果は拡張機能の実行間で永続化され、テスト実行のたびに自動的に更新されます。

### データ構造

テスト履歴は次の 2 層のネストされたオブジェクト構造で管理されています：

```typescript
{
  // 1層目: ファイルパスをキーとしたオブジェクト
  "src/module1/feature.test.ts": {
    // 2層目: テスト名をキーとしたオブジェクト
    "正常系 - データが正しく処理される": {
      status: "success",
      timestamp: 1626782400000
    },
    "異常系 - 無効な入力でエラーがスローされる": {
      status: "failure",
      message: "Expected error to be thrown but it wasn't",
      timestamp: 1626782400000
    }
  },
  "src/module2/util.test.ts": {
    "ユーティリティ関数が正しく動作する": {
      status: "success",
      timestamp: 1626782400000
    }
  }
}
```

この構造により、以下のメリットがあります：

1. ファイルパスとテスト名で直接アクセスできる直感的なデータ構造
2. テスト結果の検索と更新が効率的
3. ファイル単位での結果集計が容易
4. JSON と MessagePack での保存と読み込みが自然

### 永続化の仕組み

1. テスト結果は MessagePack 形式で拡張機能のグローバルストレージに保存されます
2. 拡張機能の起動時に過去の結果を読み込み
3. テスト実行が完了するたびに結果が更新・保存されます

### 古いテスト結果の管理

テスト結果は無期限に保存されるわけではなく、一定期間(デフォルト 30 日)経過した古い結果は自動的にクリーンアップされます。

```typescript
// 30日より古いテスト結果をクリーンアップ
cleanupOldResults(30);
```
