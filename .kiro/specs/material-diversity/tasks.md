# Implementation Plan: Material Diversity

## Overview

本実装計画は、宇宙シミュレーションに「物質の多様性」を導入する。既存のEntityにtype, mass, compositionを追加し、TypeRegistryとReactionEngineを新規作成する。

## Tasks

- [x] 1. TypePropertiesとTypeRegistryの実装
  - [x] 1.1 TypeProperties インターフェースを定義
    - typeId, baseMass, harvestEfficiency, reactivity, stability を含む
    - `src/core/type-properties.ts` を作成
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 1.2 TypeRegistry クラスを実装
    - maxTypes, properties Map, reactionTable Map を管理
    - generateTypeProperties メソッドを実装（seed依存）
    - `src/core/type-registry.ts` を作成
    - _Requirements: 6.4, 5.1_

  - [ ]* 1.3 Property test: タイプ性質生成の決定論性
    - **Property 7: Type Properties Generation**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 2. ReactionResultとReactionEngineの実装
  - [x] 2.1 ReactionResult インターフェースを定義
    - reactants, products, energyDelta, probability を含む
    - `src/core/reaction.ts` を作成
    - _Requirements: 4.2, 4.3_

  - [x] 2.2 ReactionEngine クラスを実装
    - checkReaction, executeReaction, generateNewReaction メソッド
    - 反応テーブルの動的生成ロジック
    - _Requirements: 4.1, 4.4, 5.2_

  - [ ]* 2.3 Property test: 反応テーブルの決定論性
    - **Property 6: Reaction Table Determinism**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 3. Entityの拡張
  - [x] 3.1 Entity インターフェースに type, mass, composition を追加
    - `src/core/entity.ts` を更新
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 3.2 Entity生成ロジックを更新
    - createEntity 関数でタイプと質量を割り当て
    - `src/core/world-generator.ts` を更新
    - _Requirements: 1.2, 2.3_

  - [ ]* 3.3 Property test: Entity構造の不変条件
    - **Property 1: Entity Structure Invariant**
    - **Validates: Requirements 1.1, 2.1, 2.4, 3.1**

- [x] 4. Checkpoint - 基本構造の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 移動コストの実装
  - [x] 5.1 移動コスト計算関数を実装
    - calculateMovementCost(entity, baseCost) を追加
    - `src/core/transit.ts` を更新
    - _Requirements: 7.1, 7.2_

  - [x] 5.2 移動アクションに質量ベースのコストを適用
    - `src/core/action.ts` の move アクションを更新
    - エネルギー不足時の移動防止
    - _Requirements: 2.2, 7.3_

  - [ ]* 5.3 Property test: 移動コスト計算
    - **Property 4: Movement Cost Calculation**
    - **Validates: Requirements 2.2, 7.1, 7.2, 7.3**

- [x] 6. 化学反応の統合
  - [x] 6.1 interact アクションに反応チェックを追加
    - 同じノードのエンティティ間で反応を試行
    - `src/core/interaction.ts` を更新
    - _Requirements: 4.1_

  - [x] 6.2 反応実行ロジックを統合
    - 反応物の消費と生成物の作成
    - Universe に ReactionEngine を統合
    - _Requirements: 4.2, 4.3, 4.4_

  - [ ]* 6.3 Property test: 反応実行の一貫性
    - **Property 5: Reaction Execution Consistency**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 7. 複製時のタイプ継承
  - [x] 7.1 replicate アクションにタイプ継承を追加
    - 変異率 1% でタイプが変化
    - `src/core/replication.ts` を更新
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 7.2 Property test: タイプ継承と変異
    - **Property 8: Type Inheritance and Mutation**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 8. Checkpoint - 機能統合の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. エネルギー・質量変換
  - [x] 9.1 エネルギー・質量変換ロジックを実装
    - エンティティ破壊時のエネルギー放出
    - エンティティ生成時のエネルギー消費
    - `src/core/energy.ts` を更新
    - _Requirements: 9.1, 9.2_

  - [x] 9.2 変換レートを設定可能にする
    - ENERGY_MASS_CONVERSION_RATE パラメータを追加
    - _Requirements: 9.3_

  - [ ]* 9.3 Property test: エネルギー・質量保存
    - **Property 9: Energy-Mass Conservation**
    - **Validates: Requirements 9.1, 9.2, 9.4**

- [x] 10. 観測とログの拡張
  - [x] 10.1 スナップショットにタイプ分布を追加
    - typeDistribution: Map<number, number> を追加
    - `src/core/snapshot.ts` を更新
    - _Requirements: 10.1_

  - [x] 10.2 スナップショットに総質量を追加
    - totalMass フィールドを追加
    - _Requirements: 10.2_

  - [x] 10.3 反応ログを追加
    - 反応イベントをログに記録
    - `src/core/observation.ts` を更新
    - _Requirements: 10.3, 4.5_

  - [ ]* 10.4 Property test: 観測ログの完全性
    - **Property 10: Observation Logging Completeness**
    - **Validates: Requirements 10.1, 10.2, 10.3, 4.5, 7.4, 8.4**

- [x] 11. Universe統合とCLI更新
  - [x] 11.1 Universe に TypeRegistry を統合
    - 初期化時にタイプ性質を生成
    - `src/core/universe.ts` を更新
    - _Requirements: 1.4, 6.4_

  - [x] 11.2 CLI に maxTypes パラメータを追加
    - `--max-types` オプションを追加
    - `src/cli.ts` を更新
    - _Requirements: 1.4_

  - [x] 11.3 ログ出力にタイプ情報を追加
    - タイプ分布、反応数などを表示
    - _Requirements: 10.4_

- [x] 12. Final checkpoint - 全機能の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. ドキュメント更新
  - [x] 13.1 README.md に新公理を追加
    - 公理19, 20, 21 を記載
  
  - [x] 13.2 ideas/README.md を更新
    - 新スペックを関連スペック一覧に追加

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
