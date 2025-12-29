# Implementation Plan: Information Transfer

## Overview

エンティティが情報を取得・保存・伝達する仕組みを実装し、知識ボーナス機能を有効化する。

## Tasks

- [ ] 1. InformationTransferモジュールの作成
  - [ ] 1.1 `src/core/information-transfer.ts`を作成
    - InformationTransferConfig型を定義
    - DEFAULT_INFORMATION_TRANSFER_CONFIGを定義
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ] 1.2 `exchangeInformation`関数を実装
    - 2つのエンティティ間で情報を交換
    - 交換率に応じた量を交換
    - FIFO オーバーフロー処理
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ] 1.3 `inheritInformation`関数を実装
    - 親から子へ情報を継承
    - 協力複製時は両親の情報を混合
    - 変異を適用
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ] 1.4 `acquireInformation`関数を実装
    - アーティファクトから情報を取得
    - 修復量に比例した量を取得
    - _Requirements: 3.1, 3.2_
  - [ ] 1.5 `initializeState`関数を実装
    - エンティティの初期stateを生成
    - 充填率に応じたランダムバイト
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 2. Universe設定の拡張
  - [ ] 2.1 `UniverseConfig`に`informationTransfer`フィールドを追加
    - デフォルト設定を定義
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 3. 相互作用への統合
  - [ ] 3.1 `executeInteract`メソッドを修正
    - 相互作用時に情報交換を実行
    - ログに交換量を記録
    - _Requirements: 1.1, 1.5_

- [ ] 4. 複製への統合
  - [ ] 4.1 `ReplicationEngine`を修正
    - 複製時に情報継承を実行
    - ログに継承量を記録
    - _Requirements: 2.1, 2.2, 2.5_

- [ ] 5. 修復への統合
  - [ ] 5.1 `executeRepairArtifact`メソッドを修正
    - 修復時に情報取得を実行
    - ログに取得量を記録
    - _Requirements: 3.1, 3.4_

- [ ] 6. エンティティ作成への統合
  - [ ] 6.1 `WorldGenerator`を修正
    - エンティティ作成時に初期stateを生成
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 7. 観測システムの拡張
  - [ ] 7.1 `SimulationStats`に情報伝達メトリクスを追加
    - avgStateSize, exchangeCount, inheritanceCount, acquisitionCount, diversity
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 8. Checkpoint - テスト実行
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 9. Property-based tests
  - [ ]* 9.1 Property test: 情報交換の比例性
    - **Property 1: Information Exchange Proportionality**
    - **Validates: Requirements 1.1, 1.2, 1.3**
  - [ ]* 9.2 Property test: FIFO オーバーフロー
    - **Property 2: FIFO Overflow Handling**
    - **Validates: Requirements 1.4, 3.3**
  - [ ]* 9.3 Property test: 情報継承
    - **Property 3: Information Inheritance**
    - **Validates: Requirements 2.1, 2.2**

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 新しい公理を追加しない（既存公理の拡張のみ）
- 各機能はON/OFF切り替え可能（A/Bテスト用）
