# Jest Test Selector

モノレポ構造に対応した Jest テストケース選択実行ツール。特定のテストケースだけを簡単に選択して実行できます。

## 機能

- 現在開いているテストファイルからテストケースを自動検出
- クイックピック UI でテストケースを選択して実行
- モノレポ構造を自動検出し、適切なディレクトリでテストを実行
- pnpm、npm、yarn などのパッケージマネージャに対応

## 使い方

1. Jest テストファイル（`.test.ts` または `.spec.ts` など）を開きます
2. コマンドパレットから「Jest: テストケースを選択して実行」を選択するか、ショートカットキー `Cmd+Shift+T`（Mac）または `Ctrl+Shift+T`（Windows/Linux）を押します
3. 表示されるクイックピックメニューからテストケースを選択します
4. 選択したテストケースがデバッグモードで実行されます

## 設定オプション

| 設定                               | 説明                         | デフォルト値 |
| ---------------------------------- | ---------------------------- | ------------ |
| `jestTestSelector.packageManager`  | 使用するパッケージマネージャ | `pnpm`       |
| `jestTestSelector.testCommand`     | テスト実行コマンド           | `test`       |
| `jestTestSelector.monorepoPattern` | モノレポのパッケージパターン | `apps/*`     |

## モノレポ対応

この拡張機能は以下のようなモノレポ構造を自動検出します：

```
/your-project
├── package.json
├── apps/
│   ├── server/
│   │   ├── package.json
│   │   └── src/
│   │       └── **/*.test.ts
│   └── client/
│       ├── package.json
│       └── src/
│           └── **/*.test.ts
└── packages/
    └── shared/
        ├── package.json
        └── src/
            └── **/*.test.ts
```

テストファイルが検出されると、そのファイルが属するパッケージを自動的に特定し、適切なディレクトリで `pnpm test` などを実行します。

## 開発

### 前提条件

- Node.js 14.0.0 以上
- VSCode 1.60.0 以上

### インストール

```bash
git clone https://github.com/yourusername/jest-test-selector.git
cd jest-test-selector
npm install
```

### ビルド

```bash
npm run compile
```

### デバッグ

1. VSCode でこのリポジトリを開く
2. F5 キーを押してデバッグセッションを開始する
3. 新しい VSCode ウィンドウが開くので、そこでテストしたいプロジェクトを開く
4. テストファイルを開いて拡張機能を試す

## ライセンス

MIT
