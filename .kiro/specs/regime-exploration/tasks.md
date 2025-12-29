# Implementation Plan: レジーム探索

## Overview

パラメータ空間を探索してレジームを特定するシステムを実装する。
CLIコマンド `explore-regimes` を追加し、結果をファイルとコンソールに出力する。

## Tasks

- [x] 1. RegimeExplorerクラスの実装
  - [x] 1.1 `src/core/regime-explorer.ts` を作成
    - ExplorationConfig, ExplorationResult, ExplorationSummary インターフェース定義
    - RegimeExplorerクラスの基本構造
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 レジーム分類ロジックの実装
    - classifyRegime関数
    - 境界条件の処理
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 1.3 探索実行ロジックの実装
    - パラメータグリッド生成
    - LocalRunnerを使用したシミュレーション実行
    - 結果の集約
    - _Requirements: 1.1, 1.2, 3.2_

- [x] 2. 結果出力機能の実装
  - [x] 2.1 JSON出力の実装
    - saveResults関数
    - runs/ディレクトリへの保存
    - _Requirements: 4.1, 4.2_
  - [x] 2.2 マークダウンレポート生成の実装
    - generateReport関数
    - レジーム分布表の生成
    - _Requirements: 4.3_

- [x] 3. CLI統合
  - [x] 3.1 `explore-regimes` コマンドの追加
    - parseArgsの拡張
    - showHelpの更新
    - _Requirements: 5.1_
  - [x] 3.2 CLIオプションの実装
    - --ticks, --seeds, --regen-rates, --tool-effect-ab
    - _Requirements: 5.2_
  - [x] 3.3 コンソール出力の実装
    - サマリーテーブルの表示
    - _Requirements: 5.3_

- [x] 4. Checkpoint - 動作確認
  - 小規模グリッドでの探索実行テスト
  - 結果ファイルの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 初回レジーム探索の実行とレポート作成
  - [x] 5.1 デフォルトパラメータでの探索実行
    - regenRate: 0.004, 0.008, 0.016, 0.032, 0.064
    - seeds: 1, 2, 3
    - toolEffectAB: true
  - [x] 5.2 レポートの作成
    - `.kiro/reports/2024-12-29-regime-exploration.md` に結果を記録
    - CONCLUSIONS.mdの更新（必要に応じて）

## Notes

- 各シミュレーションは独立しているため、将来的に並列化可能
- 探索結果は再現性のためgitCommitHashを含める
- レジーム分類の閾値は初期値であり、観測結果に基づいて調整可能
