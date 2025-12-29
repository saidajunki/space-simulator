# Implementation Plan: Information-Action Connection

## Overview

アーティファクトの`data`とエンティティの`state`の一致度が修復効率に影響を与える仕組みを実装する。

## Tasks

- [x] 1. 一致度計算関数の実装
  - [x] 1.1 `src/core/similarity.ts`を作成し、`calculateSimilarity`関数を実装
    - 2つのUint8Arrayを受け取り、一致度（0.0〜1.0）を返す
    - 空配列の場合は0.0を返す
    - 長さが異なる場合はペナルティを適用
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ]* 1.2 Property test: 一致度の範囲と対称性
    - **Property 1: Similarity Score Range Invariant**
    - **Property 3: Similarity Symmetry**
    - **Property 4: Perfect Match**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 2. 知識ボーナス計算の実装
  - [x] 2.1 `src/core/similarity.ts`に`calculateKnowledgeBonus`関数を追加
    - similarity ≤ 0.5 → 1.0
    - similarity > 0.5 → 線形補間で1.0〜2.0
    - _Requirements: 2.2, 2.3, 2.4_
  - [ ]* 2.2 Property test: ボーナス計算の正確性
    - **Property 2: Knowledge Bonus Calculation**
    - **Validates: Requirements 2.2, 2.3, 2.4**

- [x] 3. Universe設定の拡張
  - [x] 3.1 `UniverseConfig`に`knowledgeBonusEnabled`フィールドを追加
    - デフォルト値: true
    - _Requirements: 4.4_

- [x] 4. 修復処理への統合
  - [x] 4.1 `executeRepairArtifact`メソッドを修正
    - 一致度計算を追加
    - ボーナスを修復量に適用
    - `knowledgeBonusEnabled`が`false`の場合はボーナス1.0
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. 観測システムの拡張
  - [x] 5.1 `SimulationEvent`型に`similarity`と`knowledgeBonus`フィールドを追加
    - `artifactRepaired`イベントを拡張
    - _Requirements: 2.5, 3.1_
  - [x] 5.2 `SimulationStats`に知識関連メトリクスを追加
    - `avgSimilarity`, `repairCount`, `bonusAppliedCount`
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 6. CLIオプションの追加
  - [x] 6.1 `--knowledge-bonus`オプションを追加
    - `on`/`off`で切り替え可能
    - _Requirements: 4.4_

- [x] 7. Checkpoint - テスト実行
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 8. 統合テスト
  - [ ]* 8.1 修復時に一致度が計算されることを確認
  - [ ]* 8.2 ボーナスが修復量に反映されることを確認
  - [ ]* 8.3 `knowledgeBonusEnabled: false`でボーナスが無効になることを確認

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 新しい公理を追加しない（既存の公理の接続強化のみ）
- A/Bテスト可能な設計（`knowledgeBonusEnabled`で切り替え）
