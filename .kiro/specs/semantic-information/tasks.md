# Implementation Plan: Semantic Information

## Overview

エンティティの内部状態（`state`）の特定パターンが行動効率に影響を与える仕組みを実装する。

## Tasks

- [x] 1. スキル抽出関数の実装
  - [x] 1.1 `src/core/skill.ts`を作成し、`extractSkills`関数を実装
    - stateの最初の8バイトをスキルベクトルとして抽出
    - 8バイト未満の場合はゼロパディング
    - 各バイトを255で割って正規化（0.0〜1.0）
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.2 `calculateSkillBonus`関数を追加
    - formula: 1.0 + (skill_value * 0.5)
    - _Requirements: 3.1, 3.2_

- [x] 2. Universe設定の拡張
  - [x] 2.1 `UniverseConfig`に`skillBonusEnabled`フィールドを追加
    - デフォルト値: true
    - _Requirements: 5.4_

- [x] 3. 行動実行への統合
  - [x] 3.1 `executeHarvest`にスキルボーナスを適用
    - Skill_Vector[0]を使用
    - harvest量にボーナスを乗算
    - _Requirements: 2.1, 3.3_
  - [x] 3.2 `executeRepairArtifact`にスキルボーナスを適用
    - Skill_Vector[1]を使用
    - repair量にボーナスを乗算
    - _Requirements: 2.2, 3.4_
  - [x] 3.3 `executeCreateArtifact`にスキルボーナスを適用
    - Skill_Vector[2]を使用
    - エネルギーコストをボーナスで割る
    - _Requirements: 2.3, 3.5_

- [x] 4. 観測システムの拡張
  - [x] 4.1 `SimulationStats`にスキル関連メトリクスを追加
    - avgSkills, skillVariance, bonusApplications
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. CLIオプションの追加
  - [x] 5.1 `--skill-bonus`オプションを追加
    - `on`/`off`で切り替え可能
    - _Requirements: 5.4_

- [x] 6. Checkpoint - テスト実行
  - ビルド成功を確認

- [x] 7. 検証シミュレーション
  - [x] 7.1 検証スクリプトを作成
    - スキルボーナスON/OFFの比較
    - スキル分布の時系列変化
  - [x] 7.2 シミュレーション実行とレポート作成
    - レポート: `.kiro/reports/2024-12-31-semantic-information.md`
    - CONCLUSIONS.md更新済み

## 検証結果サマリー

- スキルボーナス適用回数: 平均24,391回/シミュレーション
- マクロ指標への影響: 軽微（エンティティ数、アーティファクト数に大きな差なし）
- スキル分布: 均一（特定スキルへの偏りなし）
- 仮説H15: 部分的に支持（情報に意味が付与されたが、効果を高めるにはさらなる調整が必要）

## Notes

- 新しい公理を追加しない（既存の公理の接続強化のみ）
- A/Bテスト可能な設計（`skillBonusEnabled`で切り替え）
