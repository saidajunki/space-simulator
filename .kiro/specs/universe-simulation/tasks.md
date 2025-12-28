# Implementation Plan: Universe Simulation

## Overview

最小公理アプローチによる宇宙シミュレーションの実装計画。ローカル優先で開発し、Run単位で回す設計。TypeScriptで実装。

## 実装言語

TypeScript（Node.js）

## Tasks

- [x] 1. プロジェクト初期設定
  - [x] 1.1 TypeScriptプロジェクトの初期化
    - package.json、tsconfig.json、eslint設定
    - 依存関係: fast-check（プロパティテスト）、vitest（テスト）
    - _Requirements: 15.1_
  - [ ]* 1.2 CI/CD設定
    - GitHub Actions for テスト実行
    - _Requirements: 15.1_

- [x] 2. Coreデータモデルの実装
  - [x] 2.1 基本型の定義
    - NodeId, EdgeId, EntityId, ArtifactId
    - TerrainType, ResourceType
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 2.2 Node/Edgeの実装
    - Node: id, attributes, entities, artifacts, resources
    - Edge: id, from, to, attributes, inTransit
    - _Requirements: 1.2, 1.3, 7.1, 7.6_
  - [ ]* 2.3 Node/Edgeのプロパティテスト
    - **Property 2: Node and Edge Attributes**
    - **Validates: Requirements 1.2, 1.3**
  - [x] 2.4 Spaceの実装
    - グラフ構造、最短経路計算
    - _Requirements: 1.1, 1.4, 1.5_
  - [ ]* 2.5 Spaceのプロパティテスト
    - **Property 1: Graph Structure Integrity**
    - **Property 3: Shortest Path Correctness**
    - **Validates: Requirements 1.1, 1.4, 1.5**

- [x] 3. Checkpoint - データモデル完了
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 時間管理とRNGの実装
  - [x] 4.1 TimeManagerの実装
    - 離散ステップ管理、tick記録
    - _Requirements: 2.1, 2.3_
  - [x] 4.2 RandomGeneratorの実装
    - seed管理、再現可能な乱数生成
    - _Requirements: 2.5, 13.6_
  - [ ]* 4.3 時間とRNGのプロパティテスト
    - **Property 4: Time Monotonicity**
    - **Property 5: Seed Reproducibility**
    - **Validates: Requirements 2.1, 2.3, 2.5, 13.6**

- [x] 5. Entityの実装
  - [x] 5.1 Entity基本構造の実装
    - id, nodeId, energy, state, behaviorRule, age
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [x] 5.2 InternalStateの実装
    - 有限容量の可変データ構造
    - _Requirements: 7.5, 8.4_
  - [x] 5.3 BehaviorRuleの実装
    - 遺伝子ベースの行動決定、継承、変異
    - _Requirements: 8.5, 11.2, 11.3_
  - [ ]* 5.4 Entityのプロパティテスト
    - **Property 14: Internal State Capacity**
    - **Property 15: Entity Uniqueness**
    - **Property 16: Entity Structure Completeness**
    - **Validates: Requirements 7.5, 8.1-8.6**

- [x] 6. Checkpoint - Entity完了
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. 知覚と行動の実装
  - [x] 7.1 Perceptionの実装
    - 局所知覚、ノイズ付加
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 7.2 Actionの実装
    - 移動、相互作用、変換、複製、アーティファクト生成
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  - [ ]* 7.3 知覚のプロパティテスト
    - **Property 11: Perception Locality**
    - **Validates: Requirements 5.1, 5.4**

- [x] 8. エネルギーシステムの実装
  - [x] 8.1 エネルギー消費の実装
    - 行動コスト、移動コスト（距離比例）
    - _Requirements: 3.2, 4.1_
  - [x] 8.2 エネルギー保存則の実装
    - 総エネルギー追跡、移動/変換
    - _Requirements: 3.4, 3.5_
  - [x] 8.3 エネルギー枯渇処理の実装
    - エネルギーゼロで消滅
    - _Requirements: 3.3_
  - [ ]* 8.4 エネルギーのプロパティテスト
    - **Property 6: Energy Conservation**
    - **Property 7: Energy Depletion Causes Death**
    - **Property 8: Action Energy Cost**
    - **Property 9: Distance-Proportional Cost**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 4.1**

- [x] 9. Checkpoint - エネルギーシステム完了
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. 遅延と輸送の実装
  - [x] 10.1 TransitItemの実装
    - 移動中の物資/情報/エンティティ
    - _Requirements: 4.4, 4.5_
  - [x] 10.2 遅延処理の実装
    - 距離に応じた遅延、到着処理
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  - [ ]* 10.3 遅延のプロパティテスト
    - **Property 10: Transit Delay**
    - **Validates: Requirements 4.4, 4.5**

- [x] 11. 相互作用の実装
  - [x] 11.1 InteractionEngineの実装
    - 同一ノードでの相互作用、状態変化、エネルギー移動
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  - [ ]* 11.2 相互作用のプロパティテスト
    - **Property 17: Same-Node Interaction**
    - **Validates: Requirements 10.1**

- [-] 12. 複製と継承の実装
  - [x] 12.1 ReplicationEngineの実装
    - 単独複製、協力複製、エネルギー消費、継承、変異
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  - [ ]* 12.2 複製のプロパティテスト
    - **Property 18: Replication Inheritance**
    - **Property 19: Replication Energy Transfer**
    - **Property 20: Child Initial State**
    - **Validates: Requirements 11.1-11.6**

- [ ] 13. Checkpoint - 相互作用と複製完了
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. アーティファクトの実装
  - [ ] 14.1 Artifactの実装
    - 生成、配置、データ保持、劣化
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  - [ ]* 14.2 アーティファクトのプロパティテスト
    - **Property 21: Artifact Placement**
    - **Property 22: Artifact Degradation**
    - **Validates: Requirements 12.2, 12.4, 12.5**

- [ ] 15. エントロピーと劣化の実装
  - [ ] 15.1 EntropyEngineの実装
    - Entity状態劣化、Artifact劣化、Edge劣化
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ]* 15.2 エントロピーのプロパティテスト
    - **Property 12: Entropy Degradation**
    - **Validates: Requirements 6.1, 6.4, 6.5**

- [ ] 16. Checkpoint - アーティファクトとエントロピー完了
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. 世界生成の実装
  - [ ] 17.1 WorldGeneratorの実装
    - 確率分布ベースのグラフ生成
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  - [ ] 17.2 初期Entity配置の実装
    - ランダム配置、初期エネルギー分布
    - _Requirements: 3.1, 8.1_

- [ ] 18. シミュレーションループの実装
  - [ ] 18.1 Universeの実装
    - 全コンポーネントの統合
    - _Requirements: 15.1_
  - [ ] 18.2 step()の実装
    - 1ステップの処理フロー
    - _Requirements: 2.2_
  - [ ] 18.3 run()の実装
    - 複数ステップの実行
    - _Requirements: 15.1_

- [ ] 19. Checkpoint - シミュレーションループ完了
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. 観測とログの実装
  - [ ] 20.1 EventLoggerの実装
    - イベントログ（append-only）
    - _Requirements: 2.4, 14.1_
  - [ ] 20.2 StatsAggregatorの実装
    - 統計集計
    - _Requirements: 14.2_
  - [ ] 20.3 PatternDetectorの実装
    - クラスタ検出、周期性検出
    - _Requirements: 14.3_
  - [ ]* 20.4 観測のプロパティテスト
    - **Property 23: Event Logging Completeness**
    - **Validates: Requirements 2.4, 14.1**

- [ ] 21. スナップショットの実装
  - [ ] 21.1 スナップショット保存の実装
    - 状態のシリアライズ
    - _Requirements: 15.6_
  - [ ] 21.2 スナップショット復元の実装
    - 状態のデシリアライズ
    - _Requirements: 15.6_
  - [ ]* 21.3 スナップショットのプロパティテスト
    - **Property 24: Snapshot Round-Trip**
    - **Validates: Requirements 15.6**

- [ ] 22. Checkpoint - 観測とスナップショット完了
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 23. Runnerの実装
  - [ ] 23.1 RunInputの実装
    - 入力仕様の定義
    - _Requirements: 15.1, 15.2_
  - [ ] 23.2 RunOutputの実装
    - 出力仕様の定義（manifest.json, events.log, metrics.parquet, snapshots/）
    - _Requirements: 14.4_
  - [ ] 23.3 LocalRunnerの実装
    - CLIで1Runが回る
    - _Requirements: 15.3, 15.4, 15.5_

- [ ] 24. シミュレーション制御の実装
  - [ ] 24.1 一時停止/再開の実装
    - _Requirements: 15.3, 15.4_
  - [ ] 24.2 速度変更の実装
    - _Requirements: 15.5_
  - [ ] 24.3 seed指定実行の実装
    - _Requirements: 15.7_

- [ ] 25. Checkpoint - Runner完了
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 26. ガードレールの実装
  - [ ] 26.1 GuardrailConditionの実装
    - 条件チェック（絶滅、過密、エネルギー崩壊）
    - _Requirements: 16.1, 16.5_
  - [ ] 26.2 Interventionの実装
    - 介入提案、介入実行、記録
    - _Requirements: 16.2, 16.3, 16.4, 16.6_

- [ ] 27. ストレージ抽象化の実装
  - [ ] 27.1 StorageInterfaceの実装
    - ローカル/S3の抽象化
    - _Requirements: 14.4_
  - [ ] 27.2 LocalStorageの実装
    - ./runs/<run_id>/への保存
    - _Requirements: 14.4_

- [ ] 28. Checkpoint - ガードレールとストレージ完了
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 29. CLI実装
  - [ ] 29.1 runコマンドの実装
    - 単一Run実行
    - _Requirements: 15.1_
  - [ ] 29.2 batchコマンドの実装
    - 並列実行（seed違い）
    - _Requirements: 15.1_

- [ ] 30. Final Checkpoint - 全機能完了
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
