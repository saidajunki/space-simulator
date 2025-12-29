# Requirements Document

## Introduction

情報伝達（Information Transfer）機能の要件定義。

エンティティが情報を取得・保存・伝達する仕組みを実装し、知識ボーナス機能を有効化する。
既存の公理（相互作用、複製、アーティファクト）を拡張して実装する。

## Glossary

- **InternalState**: エンティティの内部状態。有限容量のバイト列
- **Information_Exchange**: 相互作用時に行われる情報の交換
- **Information_Inheritance**: 複製時に親から子へ伝達される情報
- **Information_Acquisition**: アーティファクト修復時に取得される情報
- **Exchange_Rate**: 情報交換時に交換されるバイト数の割合

## Requirements

### Requirement 1: 相互作用時の情報交換

**User Story:** As a simulation observer, I want entities to exchange information during interaction, so that knowledge can spread through the population.

#### Acceptance Criteria

1. WHEN two entities interact, THE Interaction_System SHALL exchange a portion of their states
2. THE Exchange_Rate SHALL be configurable (default: 10% of state capacity)
3. WHEN exchanging information, THE System SHALL append received bytes to the entity's state
4. IF the state exceeds capacity, THE System SHALL remove oldest bytes (FIFO)
5. THE System SHALL log the amount of information exchanged

---

### Requirement 2: 複製時の情報継承

**User Story:** As a simulation observer, I want offspring to inherit information from parents, so that knowledge can persist across generations.

#### Acceptance Criteria

1. WHEN an entity replicates alone, THE Replication_System SHALL copy parent's state to child
2. WHEN two entities replicate together, THE Replication_System SHALL mix both parents' states
3. THE System SHALL apply mutation to inherited state (configurable rate, default: 5%)
4. THE mutation SHALL randomly flip bits in the inherited state
5. THE System SHALL log the inheritance event

---

### Requirement 3: アーティファクト経由の情報取得

**User Story:** As a simulation observer, I want entities to learn from artifacts they repair, so that knowledge can be preserved in artifacts.

#### Acceptance Criteria

1. WHEN an entity repairs an artifact, THE Repair_System SHALL copy a portion of artifact.data to entity.state
2. THE acquisition rate SHALL be proportional to repair amount (more repair = more learning)
3. IF the state exceeds capacity, THE System SHALL remove oldest bytes (FIFO)
4. THE System SHALL log the information acquisition

---

### Requirement 4: 初期状態の設定

**User Story:** As a simulation observer, I want entities to start with some initial information, so that the system has non-trivial initial conditions.

#### Acceptance Criteria

1. WHEN an entity is created, THE System SHALL initialize state with random bytes
2. THE initial state size SHALL be configurable (default: 50% of capacity)
3. THE random bytes SHALL be generated using the simulation's RNG (reproducible)

---

### Requirement 5: 観測メトリクス

**User Story:** As a simulation observer, I want to track information-related metrics, so that I can analyze knowledge transfer patterns.

#### Acceptance Criteria

1. THE Observation_System SHALL track total information exchanged per tick
2. THE Observation_System SHALL track average state size across entities
3. THE Observation_System SHALL track information diversity (unique byte patterns)

---

### Requirement 6: 設定可能性

**User Story:** As a project maintainer, I want information transfer to be configurable, so that I can run A/B tests.

#### Acceptance Criteria

1. THE implementation SHALL support enabling/disabling information exchange
2. THE implementation SHALL support enabling/disabling information inheritance
3. THE implementation SHALL support enabling/disabling information acquisition
4. THE default configuration SHALL have all features enabled
