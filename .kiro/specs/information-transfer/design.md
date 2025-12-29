# Design Document: Information Transfer

## Overview

エンティティが情報を取得・保存・伝達する仕組みを実装する。
これにより、知識ボーナス機能が有効化され、Q2「技術の蓄積は可能か？」を検証可能にする。

既存の公理を拡張して実装（新規公理なし）:
- 公理10「相互作用」→ 情報交換を追加
- 公理11「複製と継承」→ 情報継承を追加
- 公理12「アーティファクト」→ 情報取得を追加

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Universe                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Entity A  │    │   Entity B  │    │      Artifact       │ │
│  │  ┌───────┐  │    │  ┌───────┐  │    │  ┌───────────────┐  │ │
│  │  │ state │◄─┼────┼──│ state │  │    │  │     data      │  │ │
│  │  └───────┘  │    │  └───────┘  │    │  └───────────────┘  │ │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘ │
│         │                  │                      │             │
│         │  Interaction     │                      │             │
│         └────────┬─────────┘                      │             │
│                  │                                │             │
│         ┌────────▼─────────┐              ┌───────▼───────┐    │
│         │ Information      │              │ Information   │    │
│         │ Exchange         │              │ Acquisition   │    │
│         └──────────────────┘              └───────────────┘    │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐                            │
│  │   Parent    │    │    Child    │                            │
│  │  ┌───────┐  │    │  ┌───────┐  │                            │
│  │  │ state │──┼────┼─►│ state │  │  Information Inheritance   │
│  │  └───────┘  │    │  └───────┘  │                            │
│  └─────────────┘    └─────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. InformationTransfer モジュール

情報伝達のユーティリティ関数を提供。

```typescript
// src/core/information-transfer.ts

/**
 * 情報交換設定
 */
interface InformationTransferConfig {
  /** 情報交換を有効にするか */
  exchangeEnabled: boolean;
  /** 交換率（state容量に対する割合） */
  exchangeRate: number;
  /** 情報継承を有効にするか */
  inheritanceEnabled: boolean;
  /** 変異率 */
  mutationRate: number;
  /** 情報取得を有効にするか */
  acquisitionEnabled: boolean;
  /** 初期state充填率 */
  initialStateFillRate: number;
}

/**
 * 2つのエンティティ間で情報を交換
 */
function exchangeInformation(
  entityA: Entity,
  entityB: Entity,
  config: InformationTransferConfig,
  rng: RandomGenerator
): { exchangedBytesA: number; exchangedBytesB: number };

/**
 * 親から子へ情報を継承
 */
function inheritInformation(
  child: Entity,
  parent: Entity,
  partner: Entity | null,
  config: InformationTransferConfig,
  rng: RandomGenerator
): { inheritedBytes: number; mutatedBits: number };

/**
 * アーティファクトから情報を取得
 */
function acquireInformation(
  entity: Entity,
  artifact: Artifact,
  repairAmount: number,
  config: InformationTransferConfig
): { acquiredBytes: number };

/**
 * エンティティの初期stateを生成
 */
function initializeState(
  state: InternalState,
  config: InformationTransferConfig,
  rng: RandomGenerator
): void;
```

### 2. UniverseConfig拡張

```typescript
interface UniverseConfig {
  // ... existing fields ...
  
  /** 情報伝達設定 */
  informationTransfer: InformationTransferConfig;
}

const DEFAULT_INFORMATION_TRANSFER_CONFIG: InformationTransferConfig = {
  exchangeEnabled: true,
  exchangeRate: 0.1,  // 10%
  inheritanceEnabled: true,
  mutationRate: 0.05,  // 5%
  acquisitionEnabled: true,
  initialStateFillRate: 0.5,  // 50%
};
```

### 3. 各処理への統合

#### 相互作用（executeInteract）

```typescript
private executeInteract(entity: Entity, targetId: EntityId, tick: number): void {
  // ... existing interaction logic ...
  
  // 情報交換
  if (this.config.informationTransfer.exchangeEnabled) {
    const result = exchangeInformation(
      entity, target, this.config.informationTransfer, this.rng
    );
    // ログ記録
  }
}
```

#### 複製（executeReplicate）

```typescript
// ReplicationEngine.replicateAlone / replicateWithPartner 内で
if (config.inheritanceEnabled) {
  inheritInformation(child, parent, partner, config, rng);
}
```

#### 修復（executeRepairArtifact）

```typescript
// 修復後に情報取得
if (this.config.informationTransfer.acquisitionEnabled) {
  const result = acquireInformation(
    entity, artifact, repairGain, this.config.informationTransfer
  );
  // ログ記録
}
```

#### エンティティ作成（createEntity）

```typescript
// WorldGenerator.generate 内で
initializeState(entity.state, config.informationTransfer, rng);
```

## Data Models

### SimulationStats拡張

```typescript
interface SimulationStats {
  // ... existing fields ...
  
  /** 情報伝達メトリクス */
  informationTransfer?: {
    /** 平均state size */
    avgStateSize: number;
    /** 情報交換回数（このtick） */
    exchangeCount: number;
    /** 情報継承回数（このtick） */
    inheritanceCount: number;
    /** 情報取得回数（このtick） */
    acquisitionCount: number;
    /** 情報多様性（ユニークなバイトパターン数） */
    diversity: number;
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do.*

### Property 1: Information Exchange Proportionality

*For any* two entities with non-empty states, after interaction, each entity's state SHALL contain bytes from the other entity, with the amount proportional to the exchange rate.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: FIFO Overflow Handling

*For any* entity whose state is at capacity, when new bytes are added, the oldest bytes SHALL be removed to maintain capacity.

**Validates: Requirements 1.4, 3.3**

### Property 3: Information Inheritance

*For any* replication event, the child's state SHALL contain bytes from the parent(s), with solo replication copying from one parent and cooperative replication mixing from both.

**Validates: Requirements 2.1, 2.2**

### Property 4: Mutation Application

*For any* inheritance event with mutation enabled, the child's state SHALL differ from the parent's state by approximately the mutation rate.

**Validates: Requirements 2.3, 2.4**

### Property 5: Information Acquisition Proportionality

*For any* repair event, the entity SHALL acquire bytes from the artifact's data, with the amount proportional to the repair amount.

**Validates: Requirements 3.1, 3.2**

### Property 6: Initial State Reproducibility

*For any* entity creation with the same seed, the initial state SHALL be identical.

**Validates: Requirements 4.1, 4.2, 4.3**

## Error Handling

- 空のstate: 交換/継承/取得は何もしない
- 空のartifact.data: 取得は何もしない
- 設定が無効: 該当機能をスキップ

## Testing Strategy

### Unit Tests

1. `exchangeInformation`関数のテスト
   - 交換後に互いのバイトが含まれる
   - 交換率に応じた量が交換される

2. `inheritInformation`関数のテスト
   - 単独複製: 親のstateがコピーされる
   - 協力複製: 両親のstateが混合される
   - 変異が適用される

3. `acquireInformation`関数のテスト
   - 修復量に応じた情報が取得される

4. `initializeState`関数のテスト
   - 指定された充填率でstateが初期化される
   - 同じseedで同じ結果

### Property-Based Tests

**Testing Framework**: vitest + fast-check

**Configuration**: Minimum 100 iterations per property test

1. **Property 1**: Exchange proportionality
2. **Property 2**: FIFO overflow
3. **Property 3**: Inheritance
4. **Property 4**: Mutation
5. **Property 5**: Acquisition proportionality
6. **Property 6**: Reproducibility
