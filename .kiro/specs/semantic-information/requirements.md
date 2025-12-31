# Requirements Document

## Introduction

情報の意味（Semantic Information）機能の要件定義。

エンティティの内部状態（`state`）の特定パターンが行動効率に影響を与える仕組みを実装する。これにより情報に「意味」を持たせ、知識ボーナスの効果を高め、Q2（技術の蓄積）をより完全に達成する。

## Glossary

- **InternalState**: エンティティの内部状態。有限容量のバイト列
- **Skill_Vector**: stateの最初の8バイトを解釈したスキル値の配列
- **Skill_Bonus**: スキル値に基づく行動効率ボーナス（1.0〜1.5）
- **Action_Efficiency**: 行動の成功率またはエネルギー効率
- **Behavior_System**: エンティティの行動を決定・実行するシステム

## Requirements

### Requirement 1: スキルベクトルの抽出

**User Story:** As a simulation observer, I want entity state to have semantic meaning, so that information becomes meaningful for survival.

#### Acceptance Criteria

1. WHEN extracting skills from state, THE Behavior_System SHALL interpret the first 8 bytes as Skill_Vector
2. WHEN state has fewer than 8 bytes, THE Behavior_System SHALL pad with zeros
3. WHEN state is empty, THE Behavior_System SHALL return a zero Skill_Vector
4. THE Skill_Vector SHALL normalize each byte to range [0.0, 1.0] by dividing by 255

---

### Requirement 2: スキルと行動の対応

**User Story:** As a simulation observer, I want skills to affect specific actions, so that information specialization can emerge.

#### Acceptance Criteria

1. THE Skill_Vector[0] SHALL affect Harvest action efficiency
2. THE Skill_Vector[1] SHALL affect Repair action efficiency
3. THE Skill_Vector[2] SHALL affect Create action efficiency
4. THE Skill_Vector[3] SHALL affect Move action efficiency
5. THE Skill_Vector[4] SHALL affect Interact action efficiency
6. THE Skill_Vector[5] SHALL affect Replicate action efficiency
7. THE Skill_Vector[6] SHALL affect perception range (0.0 = base, 1.0 = +1 hop)
8. THE Skill_Vector[7] SHALL be reserved for future use

---

### Requirement 3: スキルボーナスの計算

**User Story:** As a simulation observer, I want skill bonuses to be meaningful but not overwhelming, so that the simulation remains balanced.

#### Acceptance Criteria

1. WHEN calculating Skill_Bonus, THE Behavior_System SHALL use formula: 1.0 + (skill_value * 0.5)
2. THE Skill_Bonus SHALL range from 1.0 (skill=0) to 1.5 (skill=1)
3. WHEN applying Skill_Bonus to Harvest, THE Behavior_System SHALL multiply harvest amount by bonus
4. WHEN applying Skill_Bonus to Repair, THE Behavior_System SHALL multiply repair amount by bonus
5. WHEN applying Skill_Bonus to Create, THE Behavior_System SHALL reduce energy cost by (bonus - 1.0)

---

### Requirement 4: 観測メトリクス

**User Story:** As a simulation observer, I want to track skill-related metrics, so that I can analyze skill evolution patterns.

#### Acceptance Criteria

1. THE Observation_System SHALL track average Skill_Vector across all entities
2. THE Observation_System SHALL track skill diversity (variance of each skill)
3. THE Observation_System SHALL log skill bonus applications per action type
4. WHEN generating statistics, THE Observation_System SHALL include skill-related metrics

---

### Requirement 5: 非恣意性の維持

**User Story:** As a project maintainer, I want to ensure this feature doesn't violate non-arbitrary principles.

#### Acceptance Criteria

1. THE implementation SHALL NOT add new axioms (only connect existing ones)
2. THE implementation SHALL NOT guarantee any specific skill distribution
3. THE Skill_Bonus SHALL be a simple, physically motivated formula
4. THE implementation SHALL be configurable (enable/disable) for A/B testing
