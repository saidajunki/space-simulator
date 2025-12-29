# Implementation Plan: Artifact Persistence

## Overview

本実装計画は、アーティファクトが劣化して消滅しがちな現状に対し、**修復（Repair）**と**Prestige / Beacon / Maintainer**を導入して「維持が選択される回路」を作る。

前提として、既存の **wasteHeat 会計**と矛盾しないこと、意思決定は **局所知覚のみ**であることを守る（Requirements 1, 7）。

## Tasks

- [ ] 1. データモデル拡張（Prestige / Maintainer）
  - [ ] 1.1 `Artifact` に `prestige: number` を追加
    - `src/core/artifact.ts` を更新（create時に初期化）
    - _Requirements: 2.1, 2.3_

  - [ ] 1.2 `Entity` に `maintainerUntilTick?: number` を追加
    - `src/core/entity.ts` を更新（型と初期値）
    - _Requirements: 5.5_

  - [ ] 1.3 `Perception` を拡張（NodePrestige / BeaconStrength / isMaintainer）
    - `src/core/perception.ts` の `NodeInfo`, `EntityInfo` を更新
    - _Requirements: 3.2, 4.2, 5.2_

- [ ] 2. Beacon/Prestige の集約と知覚への露出
  - [ ] 2.1 `NodePrestige` を計算できるようにする（ノード内Prestige合計）
    - Universe側で tick 毎に集約（全ノード走査はOK、ただしエンティティ意思決定は局所のみ）
    - _Requirements: 3.3, 4.3, 7.6_

  - [ ] 2.2 `BeaconStrength` を計算し、current/adjacent に載せる
    - 閾値（durability）と diminishing returns を実装（例: `durability * log1p(prestige)`）
    - `src/core/perception.ts` に `beaconStrength` を載せる
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Repairアクションの追加
  - [ ] 3.1 Action型に `repairArtifact` を追加
    - `src/core/types.ts`, `src/core/action.ts` を更新
    - _Requirements: 1.1, 1.4_

  - [ ] 3.2 `Universe.executeRepairArtifact`（または同等）を追加
    - エネルギーチェック、エネルギー減算、wasteHeat加算、durability回復、prestige加算
    - `src/core/universe.ts`, `src/core/artifact.ts` を更新
    - _Requirements: 1.1, 1.2, 1.3, 2.2, 7.1_

  - [ ] 3.3 修復イベントをログに追加
    - `repair`: entityId, artifactId, energyConsumed, durabilityDelta
    - _Requirements: 1.5_

- [ ] 4. Maintainerステータス（付与・期限・知覚ボーナス）
  - [ ] 4.1 修復成功時に maintainer status を付与
    - `untilTick = tick + U[10,50]`（seed依存の乱数）
    - _Requirements: 5.1, 5.3, 5.5_

  - [ ] 4.2 `isMaintainer` を Perception に反映
    - `src/core/perception.ts` で EntityInfo に載せる
    - _Requirements: 5.2_

  - [ ] 4.3 知覚 +1 hop（Maintainer Bonus）を実装
    - グラフの2-hop近傍を取得できるAPIを用意（事前計算 or BFS）
    - Beacon可視範囲を +1 する（MVPはBeacon/neighborNodesだけでも可）
    - _Requirements: 5.4, 7.6_

- [ ] 5. 繁殖相手選好（Maintainerシグナル）
  - [ ] 5.1 協力複製のパートナー選択を重み付きに変更
    - co-located candidates のみ（現状仕様維持）
    - maintainer の重み付け（必要なら nodePrestige でスケール、diminishing returns）
    - `src/core/universe.ts`（decideActionの partner 選択部分）を更新
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 5.2 パートナー選択イベントをログに追加
    - selected partner, weights, nodePrestige, maintainer有無
    - _Requirements: 4.5_

- [ ] 6. 移動のBeacon誘引（集合効果）
  - [ ] 6.1 移動意思決定で BeaconStrength を利用できるようにする
    - `perception.neighborNodes[].beaconStrength` を参照
    - _Requirements: 6.1, 6.3_

  - [ ] 6.2 移動先選択を「ビーコンに比例したバイアス」に変更（soft）
    - _Requirements: 6.2, 6.4_

  - [ ] 6.3 相互作用/複製の確率をビーコンで直接変えないことを確認
    - _Requirements: 6.5_

  - [ ] 6.4 移動コストは据え置き（誘引でコスト減はしない）
    - _Requirements: 7.5_

- [ ] 7. 保存則・会計のチェックポイント
  - [ ] 7.1 repair の消費エネルギーが wasteHeat に完全に積まれることを確認
    - _Requirements: 7.1_

  - [ ] 7.2 prestige がエネルギーとして扱われていないことを確認
    - _Requirements: 7.2_

- [ ] 8. 観測の拡張（任意）
  - [ ]* 8.1 CLI/集計にメトリクスを追加（例: totalPrestige, repairCount, beaconNodes）
    - `src/cli.ts` または観測モジュールを更新
    - _Requirements: 1.5, 4.5_

  - [ ]* 8.2 SnapshotにPrestige/Beacon概要を載せる

- [ ] 9. テスト（任意）
  - [ ]* 9.1 Property test: Repair Energy Accounting
    - **Property 1: Repair Energy Accounting**
    - **Validates: Requirements 1.1, 1.2, 7.1**

  - [ ]* 9.2 Property test: Locality Constraint
    - **Property 3: Locality Constraint**
    - **Validates: Requirement 7.6**

- [ ] 10. ドキュメント更新（任意）
  - [ ]* 10.1 `.kiro/ideas/README.md` の関連スペック一覧に追加

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 「進捗評価」は `repairCount / totalPrestige / beaconStrength分布 / artifact lifetime` を見れば判断しやすい

