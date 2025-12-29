# Requirements Document

## Introduction

アーティファクトが「維持にコストがかかるのに残る」現象を、人間の価値判断なしに物理的メカニズムで再現する。ハンディキャップ原理（高コスト＝シグナル）と焦点点理論（ランドマーク＝協力の座標系）を最小の公理追加で実装し、「維持が進化的に選択されるか」を観測可能にする。

## Glossary

- **Artifact**: 環境に刻まれた構造物。耐久度を持ち、時間経過で劣化する
- **Prestige**: アーティファクトに蓄積された維持エネルギーの累積値。高コストシグナルの指標
- **NodePrestige**: ノード内に存在する全ArtifactのPrestige合計
- **Beacon**: 一定耐久度以上のアーティファクトが発する知覚可能な信号。焦点点として機能
- **BeaconStrength**: Beacon信号強度（局所知覚に載るスカラー値）
- **Repair**: アーティファクトの耐久度を回復する行動。エネルギーを消費し廃熱化
- **Maintainer**: アーティファクトを修復した個体。一時的なボーナスを得る
- **Handicap_Principle**: 高コスト行動が能力の正直なシグナルとなる進化的原理
- **Focal_Point**: 協調問題において参加者が自然に収束する共通知識の点

## Requirements

### Requirement 1: 修復行動と廃熱会計

**User Story:** As a simulation designer, I want repair actions to consume energy and produce waste heat, so that maintenance costs are physically consistent with thermodynamics.

#### Acceptance Criteria

1. WHEN an Entity performs a repair action on an Artifact, THE System SHALL deduct repair energy cost from the Entity's energy
2. WHEN repair energy is consumed, THE System SHALL add the consumed energy to the Node's wasteHeat
3. WHEN a repair action succeeds, THE System SHALL increase the Artifact's durability by a calculated amount
4. IF an Entity has insufficient energy for repair, THEN THE System SHALL reject the repair action
5. THE System SHALL log repair events with entity ID, artifact ID, energy consumed, and durability change

### Requirement 2: Prestige蓄積

**User Story:** As a simulation designer, I want artifacts to accumulate prestige from maintenance, so that costly signaling can be measured.

#### Acceptance Criteria

1. WHEN an Artifact is created, THE System SHALL initialize its prestige to the creation energy cost
2. WHEN an Artifact is repaired, THE System SHALL add the repair energy cost to its prestige
3. THE Artifact SHALL expose its prestige value for other systems to query
4. WHEN an Artifact decays (durability reaches 0), THE System SHALL remove it along with its prestige

### Requirement 3: Beaconメカニズム

**User Story:** As a simulation designer, I want high-durability artifacts to emit beacons, so that they can serve as focal points for coordination.

#### Acceptance Criteria

1. WHILE an Artifact's durability exceeds a threshold (e.g., 0.5), THE Artifact SHALL emit a Beacon signal
2. WHEN an Entity perceives its surroundings, THE System SHALL include Beacon signals from artifacts in the current node and adjacent nodes
3. THE Beacon signal strength SHALL be monotonic in the Artifact's durability and prestige, and SHOULD have diminishing returns (bounded)
4. WHEN an Artifact's durability falls below the threshold, THE System SHALL stop its Beacon emission

### Requirement 4: 繁殖相手選好（Maintainerシグナル）

**User Story:** As a simulation designer, I want entities to prefer maintainers as partners, so that costly maintenance can function as an honest signal under locality constraints.

#### Acceptance Criteria

1. WHEN an Entity selects a replication partner, THE System SHALL consider only co-located candidates (same node)
2. THE System SHALL bias selection toward candidates with active maintainer status (Requirement 5)
3. THE bias weight MAY be scaled by the current node's total prestige (NodePrestige) with diminishing returns
4. WHEN no candidates have maintainer status, THE System SHALL fall back to uniform random selection
5. THE System SHALL log partner selection events including maintainer bias and NodePrestige

### Requirement 5: 維持者ボーナス（フリーライダー対策）

**User Story:** As a simulation designer, I want maintainers to receive temporary benefits, so that free-rider problems are mitigated.

#### Acceptance Criteria

1. WHEN an Entity repairs an Artifact, THE System SHALL grant the Entity a temporary "maintainer" status
2. WHILE an Entity has maintainer status, THE System SHALL expose the status as a perceivable signal for partner selection (Requirement 4)
3. THE maintainer status SHALL decay over time (e.g., 10-50 ticks)
4. WHEN maintainer status is active, THE System SHALL provide a small perception bonus (can see one additional hop)
5. THE System SHALL track maintainer status expiration per entity

### Requirement 6: 集合効果（Beacon誘引）

**User Story:** As a simulation designer, I want entities to be attracted to beacons, so that landmarks increase encounter rates.

#### Acceptance Criteria

1. WHEN an Entity decides its movement, THE System SHALL bias movement toward nodes with active Beacons
2. THE movement bias SHALL be proportional to the Beacon signal strength
3. WHEN multiple Beacons are visible, THE System SHALL weight by signal strength
4. IF no Beacons are visible, THEN THE System SHALL use default movement behavior
5. THE System SHALL NOT directly modify interaction/replication probabilities based on Beacons (effects MUST emerge via movement bias and local partner choice)

### Requirement 7: エネルギー保存との整合

**User Story:** As a simulation designer, I want all new mechanics to respect energy conservation, so that the simulation remains physically consistent.

#### Acceptance Criteria

1. THE repair action energy cost SHALL be fully converted to wasteHeat (no energy creation)
2. THE prestige value SHALL be accounting only (not represent stored energy)
3. THE Beacon emission SHALL NOT consume additional energy (passive property of durability)
4. THE maintainer bonus SHALL NOT create energy (only affects selection/perception)
5. THE movement bias toward Beacons SHALL NOT reduce movement energy cost
6. THE System SHALL NOT use global knowledge (e.g., scanning all nodes/entities) for any bias; it MUST rely on local perception only
