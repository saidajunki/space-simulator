# Requirements Document

## Introduction

情報→行動の接続（Information-Action Connection）機能の要件定義。

アーティファクトに保存された情報（`data`）とエンティティの内部状態（`state`）の一致度が、修復効率に影響を与える仕組みを実装する。これにより「技術の蓄積」（Q2）を検証可能にする。

## Glossary

- **Artifact**: エンティティが環境に残す情報構造体。`data`フィールドに任意のバイト列を保持
- **InternalState**: エンティティの内部状態。有限容量のバイト列
- **Repair_System**: アーティファクトの修復を行うシステム
- **Similarity_Score**: 2つのバイト列の一致度（0.0〜1.0）
- **Repair_Efficiency**: 修復時のエネルギー効率（高いほど少ないエネルギーで多く修復）
- **Knowledge_Bonus**: 一致度に基づく修復効率ボーナス

## Requirements

### Requirement 1: 一致度計算

**User Story:** As a simulation observer, I want to measure the similarity between artifact data and entity state, so that I can understand information transfer dynamics.

#### Acceptance Criteria

1. WHEN comparing two byte arrays, THE Similarity_Score SHALL be calculated as the ratio of matching bytes to total bytes
2. WHEN one or both arrays are empty, THE Similarity_Score SHALL be 0.0
3. WHEN arrays have different lengths, THE Similarity_Score SHALL compare up to the shorter length and penalize the difference
4. THE Similarity_Score SHALL always be in the range [0.0, 1.0]

---

### Requirement 2: 修復効率への反映

**User Story:** As a simulation observer, I want repair efficiency to depend on knowledge similarity, so that information becomes meaningful for survival.

#### Acceptance Criteria

1. WHEN an entity repairs an artifact, THE Repair_System SHALL calculate the Similarity_Score between entity.state and artifact.data
2. WHEN Similarity_Score is high (>0.5), THE Repair_System SHALL apply a Knowledge_Bonus to repair efficiency
3. WHEN Similarity_Score is low (≤0.5), THE Repair_System SHALL apply no bonus (efficiency = 1.0)
4. THE Knowledge_Bonus SHALL scale linearly from 1.0 (at similarity 0.5) to 2.0 (at similarity 1.0)
5. THE Repair_System SHALL log the Similarity_Score and applied bonus for observation

---

### Requirement 3: 観測メトリクス

**User Story:** As a simulation observer, I want to track knowledge-related metrics, so that I can analyze information transfer patterns.

#### Acceptance Criteria

1. WHEN a repair occurs, THE Observation_System SHALL record the Similarity_Score
2. THE Observation_System SHALL track average Similarity_Score per tick
3. THE Observation_System SHALL track the distribution of Similarity_Scores across all repairs
4. WHEN generating statistics, THE Observation_System SHALL include knowledge-related metrics

---

### Requirement 4: 非恣意性の維持

**User Story:** As a project maintainer, I want to ensure this feature doesn't violate non-arbitrary principles, so that the simulation remains scientifically valid.

#### Acceptance Criteria

1. THE implementation SHALL NOT add new axioms (only connect existing ones)
2. THE implementation SHALL NOT guarantee any specific outcome (e.g., language emergence)
3. THE Knowledge_Bonus SHALL be a simple, physically motivated formula (information → efficiency)
4. THE implementation SHALL be configurable (enable/disable) for A/B testing
