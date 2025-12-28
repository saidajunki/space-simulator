# Design Document: Universe Simulation

## Overview

最小公理アプローチによる宇宙シミュレーションシステムの設計。物理的制約のみを公理として設定し、「記憶」「学習」「言語」などの具体的概念は創発に任せる。

### 設計原則

1. **非恣意性**: 特定の成果を誘導しない
2. **局所性**: 知覚は近傍のみ、遅延あり
3. **有限性**: 全リソースは有限
4. **偶然**: 乱数による経路依存
5. **観測のみ**: メトリクスはログ、目的関数ではない

### アーキテクチャ選択

**Graph World + 離散時間**を採用：
- ノード = 地域（属性を持つ）
- エッジ = 移動/通信ルート（距離、遅延、容量）
- 離散ステップ（tick）で状態更新

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Universe                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Simulation Engine                 │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐            │   │
│  │  │  Time   │  │  RNG    │  │ Event   │            │   │
│  │  │ Manager │  │ (Seed)  │  │ Logger  │            │   │
│  │  └─────────┘  └─────────┘  └─────────┘            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                      Space (Graph)                   │   │
│  │  ┌─────────┐     ┌─────────┐     ┌─────────┐      │   │
│  │  │  Node   │────│  Edge   │────│  Node   │      │   │
│  │  │(Region) │     │(Route)  │     │(Region) │      │   │
│  │  └─────────┘     └─────────┘     └─────────┘      │   │
│  │       │                               │            │   │
│  │  ┌────┴────┐                    ┌────┴────┐      │   │
│  │  │Entity[] │                    │Entity[] │      │   │
│  │  │Artifact[]│                   │Artifact[]│     │   │
│  │  └─────────┘                    └─────────┘      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Observation                       │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐            │   │
│  │  │ Logger  │  │ Stats   │  │ Pattern │            │   │
│  │  │         │  │ Aggreg  │  │ Detect  │            │   │
│  │  └─────────┘  └─────────┘  └─────────┘            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Guardrail                         │   │
│  │  ┌─────────┐  ┌─────────┐                          │   │
│  │  │Condition│  │Interven │                          │   │
│  │  │ Checker │  │ tion    │                          │   │
│  │  └─────────┘  └─────────┘                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Universe

シミュレーション全体を管理するトップレベルコンポーネント。

```typescript
interface Universe {
  space: Space;
  time: TimeManager;
  rng: RandomGenerator;
  observation: Observation;
  guardrail: Guardrail;
  config: UniverseConfig;
  
  initialize(config: UniverseConfig): void;
  step(): void;
  run(steps: number): void;
  pause(): void;
  resume(): void;
  snapshot(): UniverseState;
  restore(state: UniverseState): void;
}

interface UniverseConfig {
  nodeCount: number;
  edgeConfig: EdgeConfig;
  initialEntityCount: number;
  initialEnergyDistribution: EnergyDistribution;
  distanceCostFunction: (distance: number) => number;
  entropyRate: number;
  noiseRate: number;
  seed: number;
}
```

### 2. Space (Graph World)

ノードとエッジからなるグラフ構造。

```typescript
interface Space {
  nodes: Map<NodeId, Node>;
  edges: Map<EdgeId, Edge>;
  
  getNode(id: NodeId): Node;
  getNeighbors(nodeId: NodeId): Node[];
  getEdge(from: NodeId, to: NodeId): Edge | null;
  shortestPath(from: NodeId, to: NodeId): Path;
  distance(from: NodeId, to: NodeId): number;
}

interface Node {
  id: NodeId;
  attributes: NodeAttributes;
  entities: Entity[];
  artifacts: Artifact[];
  resources: Map<ResourceType, number>;
}

interface NodeAttributes {
  temperature: number;      // 温度
  terrainType: TerrainType; // 地形タイプ
  disasterRate: number;     // 災害率
  resourceCapacity: Map<ResourceType, number>;
}

interface Edge {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  attributes: EdgeAttributes;
  inTransit: TransitItem[];  // 移動中の物資/情報
}

interface EdgeAttributes {
  distance: number;
  travelTime: number;
  capacity: number;
  dangerLevel: number;
  durability: number;  // 劣化用
}
```

### 3. TimeManager

離散時間ステップの管理。

```typescript
interface TimeManager {
  currentTick: number;
  
  advance(): void;
  getTick(): number;
}
```

### 4. RandomGenerator

再現可能な乱数生成。

```typescript
interface RandomGenerator {
  seed: number;
  
  random(): number;           // 0-1
  randomInt(min: number, max: number): number;
  randomChoice<T>(items: T[]): T;
  randomWithProbability(p: number): boolean;
  mutate<T>(value: T, rate: number): T;
}
```

### 5. Entity

空間内で活動する基本単位。

```typescript
interface Entity {
  id: EntityId;
  nodeId: NodeId;
  energy: number;
  state: InternalState;
  behaviorRule: BehaviorRule;
  age: number;
  
  perceive(space: Space, rng: RandomGenerator): Perception;
  decide(perception: Perception): Action;
  execute(action: Action, space: Space, rng: RandomGenerator): ActionResult;
}

interface InternalState {
  capacity: number;
  data: Uint8Array;  // 有限容量の可変データ
}

interface BehaviorRule {
  // 状態と知覚から行動を決定する関数（遺伝情報に相当）
  decide(state: InternalState, perception: Perception): Action;
  
  // 複製時の継承と変異
  inherit(other?: BehaviorRule, rng: RandomGenerator, mutationRate: number): BehaviorRule;
}

interface Perception {
  currentNode: NodeInfo;
  neighborNodes: NodeInfo[];
  nearbyEntities: EntityInfo[];
  nearbyArtifacts: ArtifactInfo[];
  noise: number;  // ノイズ量
}

type Action = 
  | { type: 'move'; targetNode: NodeId }
  | { type: 'interact'; targetEntity: EntityId; data: any }
  | { type: 'transform'; newState: Partial<InternalState> }
  | { type: 'replicate'; partner?: EntityId }
  | { type: 'createArtifact'; data: any }
  | { type: 'readArtifact'; artifactId: ArtifactId }
  | { type: 'idle' };
```

### 6. Artifact

環境に刻まれた情報。

```typescript
interface Artifact {
  id: ArtifactId;
  nodeId: NodeId;
  data: Uint8Array;
  durability: number;  // 耐久度（時間経過で減少）
  createdAt: number;   // 作成tick
  creatorId: EntityId;
}
```

### 7. Interaction

エンティティ間の相互作用。

```typescript
interface InteractionEngine {
  process(
    initiator: Entity,
    target: Entity,
    action: InteractAction,
    rng: RandomGenerator
  ): InteractionResult;
}

interface InteractionResult {
  initiatorStateChange: Partial<InternalState>;
  targetStateChange: Partial<InternalState>;
  energyTransfer: number;  // 正: initiator→target
  dataExchange: { from: Uint8Array; to: Uint8Array };
  success: boolean;
  noise: number;
}
```

### 8. Replication

複製と継承。

```typescript
interface ReplicationEngine {
  replicate(
    parent: Entity,
    partner: Entity | null,
    rng: RandomGenerator,
    config: ReplicationConfig
  ): Entity | null;
}

interface ReplicationConfig {
  energyCost: number;
  mutationRate: number;
  initialEnergyRatio: number;  // 親から子へのエネルギー移転率
}
```

### 9. Entropy Engine

エントロピー増大と劣化の処理。

```typescript
interface EntropyEngine {
  applyEntropy(
    space: Space,
    rng: RandomGenerator,
    rate: number
  ): EntropyResult;
}

interface EntropyResult {
  degradedEntities: EntityId[];
  degradedArtifacts: ArtifactId[];
  degradedEdges: EdgeId[];
  resourceDecay: Map<NodeId, Map<ResourceType, number>>;
}
```

### 10. Observation

観測とログ記録（誘導なし）。

```typescript
interface Observation {
  logger: EventLogger;
  stats: StatsAggregator;
  patternDetector: PatternDetector;
  
  recordTick(tick: number, space: Space): void;
  getStats(): SimulationStats;
  detectPatterns(): Pattern[];
  export(): ObservationData;
}

interface EventLogger {
  log(event: SimulationEvent): void;
  getEvents(fromTick: number, toTick: number): SimulationEvent[];
}

interface SimulationStats {
  entityCount: number;
  totalEnergy: number;
  spatialDistribution: Map<NodeId, number>;
  averageAge: number;
  artifactCount: number;
  interactionCount: number;
}

interface PatternDetector {
  // クラスタ、周期性、創発パターンの検出
  detectClusters(space: Space): Cluster[];
  detectPeriodicity(history: SimulationStats[]): Periodicity[];
}
```

### 11. Guardrail

外的介入（最小限）。

```typescript
interface Guardrail {
  conditions: GuardrailCondition[];
  
  check(space: Space, stats: SimulationStats): GuardrailAlert[];
  proposeIntervention(alert: GuardrailAlert): Intervention[];
  apply(intervention: Intervention, universe: Universe): void;
}

interface GuardrailCondition {
  name: string;
  check: (space: Space, stats: SimulationStats) => boolean;
  severity: 'info' | 'warning' | 'critical';
}

interface Intervention {
  type: 'parameterAdjust' | 'energyInject' | 'entityAdd' | 'none';
  description: string;
  apply: (universe: Universe) => void;
}
```

## Data Models

### Core Types

```typescript
// 識別子
type NodeId = string;
type EdgeId = string;
type EntityId = string;
type ArtifactId = string;

// 地形タイプ
enum TerrainType {
  Plain = 'plain',
  Mountain = 'mountain',
  Water = 'water',
  Desert = 'desert',
  Forest = 'forest',
}

// 資源タイプ
enum ResourceType {
  Energy = 'energy',
  Material = 'material',
  Water = 'water',
}

// 移動中アイテム
interface TransitItem {
  type: 'entity' | 'resource' | 'information';
  payload: any;
  departedAt: number;
  arrivalAt: number;
  from: NodeId;
  to: NodeId;
}

// シミュレーションイベント
type SimulationEvent = 
  | { type: 'entityCreated'; entityId: EntityId; nodeId: NodeId; tick: number }
  | { type: 'entityDied'; entityId: EntityId; cause: string; tick: number }
  | { type: 'entityMoved'; entityId: EntityId; from: NodeId; to: NodeId; tick: number }
  | { type: 'interaction'; initiator: EntityId; target: EntityId; result: string; tick: number }
  | { type: 'replication'; parentId: EntityId; childId: EntityId; tick: number }
  | { type: 'artifactCreated'; artifactId: ArtifactId; nodeId: NodeId; tick: number }
  | { type: 'artifactDecayed'; artifactId: ArtifactId; tick: number }
  | { type: 'disaster'; nodeId: NodeId; type: string; tick: number }
  | { type: 'guardrailIntervention'; intervention: string; tick: number };

// スナップショット
interface UniverseState {
  tick: number;
  rngState: any;
  nodes: Map<NodeId, NodeState>;
  entities: Map<EntityId, EntityState>;
  artifacts: Map<ArtifactId, ArtifactState>;
  edges: Map<EdgeId, EdgeState>;
}
```

### Simulation Loop

```typescript
// 1ステップの処理フロー
function simulationStep(universe: Universe): void {
  const { space, time, rng, observation, guardrail } = universe;
  
  // 1. 時間を進める
  time.advance();
  
  // 2. 環境の更新（ノイズ、災害）
  applyEnvironmentNoise(space, rng, universe.config.noiseRate);
  
  // 3. エントロピー適用（劣化）
  applyEntropy(space, rng, universe.config.entropyRate);
  
  // 4. 移動中アイテムの到着処理
  processTransitItems(space, time.getTick());
  
  // 5. 各エンティティの行動
  for (const entity of getAllEntities(space)) {
    // 5.1 知覚（局所、ノイズあり）
    const perception = entity.perceive(space, rng);
    
    // 5.2 行動決定
    const action = entity.decide(perception);
    
    // 5.3 行動実行
    const result = entity.execute(action, space, rng);
    
    // 5.4 エネルギー消費
    entity.energy -= getActionCost(action);
    
    // 5.5 死亡判定
    if (entity.energy <= 0) {
      removeEntity(space, entity.id);
      observation.logger.log({ type: 'entityDied', entityId: entity.id, cause: 'energy', tick: time.getTick() });
    }
  }
  
  // 6. 観測記録
  observation.recordTick(time.getTick(), space);
  
  // 7. ガードレールチェック
  const alerts = guardrail.check(space, observation.getStats());
  for (const alert of alerts) {
    // 介入提案（実行はユーザー判断）
    const interventions = guardrail.proposeIntervention(alert);
    // ログに記録
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Graph Structure Integrity
*For any* initialized Universe, the Space SHALL contain at least one Node and the graph structure SHALL be valid (all edges connect existing nodes).
**Validates: Requirements 1.1, 1.5**

### Property 2: Node and Edge Attributes
*For any* Node in the Space, it SHALL have all required attributes (temperature, terrainType, resources, disasterRate). *For any* Edge, it SHALL have all required attributes (distance, travelTime, capacity, dangerLevel).
**Validates: Requirements 1.2, 1.3**

### Property 3: Shortest Path Correctness
*For any* two Nodes A and B in a connected Space, the shortest path calculation SHALL return a valid path with correct total distance.
**Validates: Requirements 1.4**

### Property 4: Time Monotonicity
*For any* simulation run, the tick counter SHALL monotonically increase by exactly 1 per step.
**Validates: Requirements 2.1, 2.3**

### Property 5: Seed Reproducibility
*For any* simulation with a fixed seed, running the same number of steps SHALL produce identical final states.
**Validates: Requirements 2.5, 13.6**

### Property 6: Energy Conservation
*For any* simulation step, the total energy in the Universe (entities + environment + in-transit) SHALL remain constant (within floating-point tolerance).
**Validates: Requirements 3.4, 3.5**

### Property 7: Energy Depletion Causes Death
*For any* Entity whose energy reaches zero or below, the Entity SHALL be removed from the simulation in the same or next tick.
**Validates: Requirements 3.3**

### Property 8: Action Energy Cost
*For any* Entity that performs an action, its energy SHALL decrease by at least the minimum action cost.
**Validates: Requirements 3.2**

### Property 9: Distance-Proportional Cost
*For any* Entity movement from Node A to Node B, the energy cost SHALL be proportional to the edge distance.
**Validates: Requirements 4.1**

### Property 10: Transit Delay
*For any* item (entity, resource, information) in transit on an Edge, it SHALL not be accessible at the destination until the arrival tick.
**Validates: Requirements 4.4, 4.5**

### Property 11: Perception Locality
*For any* Entity's perception, it SHALL only contain information from the current Node and directly adjacent Nodes.
**Validates: Requirements 5.1, 5.4**

### Property 12: Entropy Degradation
*For any* Entity, Artifact, or Edge that does not receive maintenance, its durability/state SHALL degrade over time at a rate proportional to the entropy rate parameter.
**Validates: Requirements 6.1, 6.4, 6.5**

### Property 13: Resource Finiteness
*For any* Node, the resource amount SHALL never exceed its capacity and SHALL decrease when consumed.
**Validates: Requirements 7.1, 7.2, 7.3**

### Property 14: Internal State Capacity
*For any* Entity, its internal state data size SHALL never exceed its capacity limit.
**Validates: Requirements 7.5, 8.4**

### Property 15: Entity Uniqueness
*For any* two Entities in the simulation, their IDs SHALL be distinct.
**Validates: Requirements 8.1**

### Property 16: Entity Structure Completeness
*For any* Entity, it SHALL have all required fields: id, nodeId, energy, state, behaviorRule.
**Validates: Requirements 8.2, 8.3, 8.5, 8.6**

### Property 17: Same-Node Interaction
*For any* interaction between two Entities, they SHALL be in the same Node at the time of interaction initiation.
**Validates: Requirements 10.1**

### Property 18: Replication Inheritance
*For any* successful replication, the child Entity's behaviorRule SHALL be derived from the parent(s) with possible mutation.
**Validates: Requirements 11.2, 11.3, 11.6**

### Property 19: Replication Energy Transfer
*For any* successful replication, the parent's energy SHALL decrease and the child SHALL receive initial energy from the parent.
**Validates: Requirements 11.1, 11.4**

### Property 20: Child Initial State
*For any* newly created Entity through replication, its internal state SHALL be empty or minimal.
**Validates: Requirements 11.5**

### Property 21: Artifact Placement
*For any* created Artifact, it SHALL be placed in the same Node as its creator.
**Validates: Requirements 12.2**

### Property 22: Artifact Degradation
*For any* Artifact without maintenance, its durability SHALL decrease over time.
**Validates: Requirements 12.4, 12.5**

### Property 23: Event Logging Completeness
*For any* simulation step, all significant events (entity creation, death, movement, interaction, replication) SHALL be logged.
**Validates: Requirements 2.4, 14.1**

### Property 24: Snapshot Round-Trip
*For any* Universe state, taking a snapshot and restoring it SHALL produce an equivalent state.
**Validates: Requirements 15.6**

## Error Handling

### Invalid Configuration

```typescript
class InvalidConfigError extends Error {
  constructor(message: string, public field: string) {
    super(`Invalid configuration: ${field} - ${message}`);
  }
}

// 検証例
function validateConfig(config: UniverseConfig): void {
  if (config.nodeCount <= 0) {
    throw new InvalidConfigError('must be positive', 'nodeCount');
  }
  if (config.entropyRate < 0 || config.entropyRate > 1) {
    throw new InvalidConfigError('must be between 0 and 1', 'entropyRate');
  }
  // ...
}
```

### Entity Action Failures

```typescript
interface ActionResult {
  success: boolean;
  error?: ActionError;
  energyConsumed: number;
}

type ActionError =
  | { type: 'insufficientEnergy'; required: number; available: number }
  | { type: 'invalidTarget'; reason: string }
  | { type: 'capacityExceeded'; limit: number }
  | { type: 'pathBlocked'; edge: EdgeId }
  | { type: 'noiseFailure'; originalAction: Action };
```

### Resource Exhaustion

```typescript
// 資源枯渇時の処理
function consumeResource(node: Node, type: ResourceType, amount: number): ConsumeResult {
  const available = node.resources.get(type) ?? 0;
  if (available < amount) {
    return {
      success: false,
      consumed: available,
      shortage: amount - available,
    };
  }
  node.resources.set(type, available - amount);
  return { success: true, consumed: amount, shortage: 0 };
}
```

### Guardrail Alerts

```typescript
// ガードレール条件の例
const defaultGuardrailConditions: GuardrailCondition[] = [
  {
    name: 'extinction',
    check: (space, stats) => stats.entityCount === 0,
    severity: 'critical',
  },
  {
    name: 'overpopulation',
    check: (space, stats) => stats.entityCount > space.nodes.size * 1000,
    severity: 'warning',
  },
  {
    name: 'energyCollapse',
    check: (space, stats) => stats.totalEnergy < 100,
    severity: 'critical',
  },
];
```

## Testing Strategy

### Unit Tests

単体テストは以下の領域をカバー：

1. **Space/Graph操作**: ノード追加、エッジ追加、最短経路計算
2. **Entity操作**: 生成、行動、エネルギー消費、死亡
3. **Interaction**: 相互作用の結果計算
4. **Replication**: 継承、変異
5. **Entropy**: 劣化計算
6. **Observation**: ログ記録、統計集計

### Property-Based Tests

プロパティベーステストは上記のCorrectness Propertiesを検証：

- 各プロパティに対して最低100回のランダム入力でテスト
- fast-checkライブラリを使用（TypeScript）
- テストにはプロパティ番号と要件参照をタグ付け

```typescript
// 例: Property 6 - Energy Conservation
describe('Property 6: Energy Conservation', () => {
  it('total energy remains constant across simulation steps', () => {
    fc.assert(
      fc.property(
        arbitraryUniverseConfig(),
        arbitraryStepCount(),
        (config, steps) => {
          const universe = new Universe(config);
          const initialEnergy = universe.getTotalEnergy();
          
          for (let i = 0; i < steps; i++) {
            universe.step();
          }
          
          const finalEnergy = universe.getTotalEnergy();
          return Math.abs(initialEnergy - finalEnergy) < 0.0001;
        }
      ),
      { numRuns: 100 }
    );
  });
});
// **Feature: universe-simulation, Property 6: Energy Conservation**
// **Validates: Requirements 3.4, 3.5**
```

### Integration Tests

統合テストは以下のシナリオをカバー：

1. **シミュレーション実行**: 初期化→複数ステップ実行→終了
2. **スナップショット**: 保存→復元→継続実行
3. **ガードレール**: 条件検出→介入提案

### Edge Cases

- 空のSpace（ノード0）
- 単一ノード（エッジなし）
- 単一Entity
- エネルギー0での初期化
- 最大容量での操作


## Platform Architecture

### 設計原則: Run単位の抽象化

シミュレーション実行を「どこでも同じ形で動くバッチジョブ（Run）」として定義し、ローカル→クラウドへスライドできる設計。

### 5層アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    5. Observer / Analysis                    │
│         （観測と可視化：世界には介入しない、後段処理）          │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│                    4. Scheduler                              │
│         （多数Runを回すための実行基盤）                        │
│         ローカル: プロセス並列 / AWS: Batch job array        │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│                    3. Storage                                │
│         （保存先の差し替え）                                   │
│         ローカル: ./runs/<run_id>/ / AWS: S3                 │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│                    2. Runner                                 │
│         （実行ドライバ：Runの入出力を管理）                    │
│         config + seed → tick実行 → ログ/スナップショット      │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│                    1. Core                                   │
│         （シミュレーションカーネル：純粋なロジック）            │
│         ファイル・ネットワーク・クラウドAPIに触れない           │
└─────────────────────────────────────────────────────────────┘
```

### Run契約（入出力仕様）

#### 入力（必須）

```typescript
interface RunInput {
  runId: string;           // UUID
  config: UniverseConfig;  // 世界生成・物理パラメータ
  seed: number;            // 乱数seed
  gitCommitHash: string;   // 再現性のため
  maxTicks: number;        // 終了条件
  logFrequency: number;    // ログ頻度（tick数）
  snapshotFrequency: number; // スナップショット頻度
}
```

#### 出力

```
runs/<run_id>/
├── manifest.json          # 入力・環境・開始/終了時刻・乱数seed・git hash
├── events.log             # イベントログ（append-only）
├── metrics.parquet        # 集計値（Entity数、エネルギー分布など）
├── snapshots/
│   ├── step_000000.bin
│   ├── step_001000.bin
│   └── ...
└── final_state.bin        # 終了時の完全状態
```

#### manifest.json

```json
{
  "runId": "uuid",
  "config": { ... },
  "seed": 12345,
  "gitCommitHash": "abc123",
  "startedAt": "2024-12-28T10:00:00Z",
  "endedAt": "2024-12-28T12:00:00Z",
  "finalTick": 100000,
  "exitReason": "maxTicks" | "extinction" | "userStop" | "error",
  "environment": {
    "platform": "local" | "aws-batch",
    "nodeVersion": "20.x",
    "containerImage": "..."
  }
}
```

### ログ設計（コスト最適化）

**原則**: 毎tickの全Entity全状態を吐くと破綻する

1. **イベントログ中心（append-only）**
   - 相互作用、移動開始/到着、複製、artifact生成、死亡
   - 状態変化のみ記録（変化なしは記録しない）

2. **スナップショットは間引く**
   - デフォルト: 1000tickに1回 + 終了時
   - 重要イベント時（絶滅危機など）は追加保存

3. **観測解像度を設定可能に**
   - デバッグRun: 詳細ログ（全イベント）
   - 本番Run: 集計中心（統計のみ）

4. **チェックポイントとログを分離**
   - 再開に必要: スナップショット
   - 分析に必要: イベント/集計

### 実行基盤

#### ローカル実行

```bash
# 単一Run
universe-sim run --config config.yaml --seed 12345 --output ./runs/

# 並列実行（seed違い）
universe-sim batch --config config.yaml --seeds 1-100 --parallel 4 --output ./runs/
```

#### AWS Batch実行

```bash
# コンテナ化
docker build -t universe-sim .

# ECRにプッシュ
aws ecr push ...

# Batch job array投入
universe-sim submit-batch --config config.yaml --seeds 1-1000 --job-queue my-queue
```

### 世界生成（Graph生成）

**原則**: 単一の固定マップを作らない（恣意性を避ける）

```typescript
interface WorldGenerator {
  // 分布（確率過程）として定義し、seedで再現
  generate(config: WorldGenConfig, rng: RandomGenerator): Space;
}

interface WorldGenConfig {
  nodeCount: number;
  edgeDensity: number;  // 0-1
  
  // 確率分布パラメータ
  temperatureDistribution: Distribution;
  terrainDistribution: Distribution;
  resourceDistribution: Distribution;
  disasterRateDistribution: Distribution;
  edgeDangerDistribution: Distribution;
}
```

### ガードレール介入の設計

**原則**: デフォルトOFF、介入は「別世界線」として記録

```typescript
interface GuardrailPolicy {
  mode: 'observe' | 'stop' | 'fork' | 'intervene';
  // observe: 検出のみ、継続
  // stop: 検出時に停止
  // fork: 検出時に新Runとして分岐
  // intervene: 介入実行（非推奨）
}

interface InterventionManifest {
  runId: string;
  parentRunId: string;  // fork元
  tick: number;
  reason: string;
  changes: ParameterChange[];
  timestamp: string;
}
```

### 実装ロードマップ

1. **Run契約の確定**（入出力フォーマット、seed、ログ、スナップショット）
2. **Coreの最小実装**（Graph + tick + 移動/遅延 + エネルギー + 劣化 + ノイズ）
3. **ローカルRunner**（CLIで1Runが回る）
4. **ローカル並列**（seed違いをN並列）
5. **コンテナ化**（同じRunがDockerで回る）
6. **AWS Batchに載せる**（同一コンテナを投げるだけ）


## AI使用方針

**方針: AIなし（純粋アルゴリズム）**

恣意性を排除するため、シミュレーション全体でAI（LLM等）を使用しない。

### 理由

1. **恣意性の排除**: LLMは現世界の知識を持っており、それがシミュレーションに混入するリスクがある
2. **再現性**: 同じseedで同じ結果を保証するため、決定論的なアルゴリズムが必要
3. **コスト**: LLM呼び出しは高コスト・高遅延で、大規模シミュレーションに不向き

### エンティティの行動決定

エンティティの行動は**遺伝的アルゴリズム的なルール**で決定：

```typescript
interface BehaviorRule {
  // 遺伝子（パラメータ）
  genes: Float32Array;
  
  // 状態と知覚から行動を決定（決定論的）
  decide(state: InternalState, perception: Perception, rng: RandomGenerator): Action;
  
  // 継承と変異
  inherit(other?: BehaviorRule, rng: RandomGenerator, mutationRate: number): BehaviorRule;
}

// 行動決定の例（単純なルールベース）
function decide(state: InternalState, perception: Perception, rng: RandomGenerator): Action {
  const genes = this.genes;
  
  // 遺伝子に基づく重み付け
  const hungerWeight = genes[0];
  const socialWeight = genes[1];
  const explorationWeight = genes[2];
  
  // エネルギーが低い → 資源を探す
  if (state.energy < genes[3] * 100) {
    const resourceNode = findNearestResource(perception);
    if (resourceNode) return { type: 'move', targetNode: resourceNode };
  }
  
  // 社会性が高い → 他のエンティティと相互作用
  if (rng.random() < socialWeight && perception.nearbyEntities.length > 0) {
    const target = rng.randomChoice(perception.nearbyEntities);
    return { type: 'interact', targetEntity: target.id, data: null };
  }
  
  // 探索性が高い → ランダム移動
  if (rng.random() < explorationWeight && perception.neighborNodes.length > 0) {
    const target = rng.randomChoice(perception.neighborNodes);
    return { type: 'move', targetNode: target.id };
  }
  
  return { type: 'idle' };
}
```

### 将来的なAI導入の可能性

将来的に以下の用途でAIを導入する可能性は残す：

1. **観測・分析（後段処理）**: 創発パターンの解釈・命名
2. **ユーザーインターフェース**: シミュレーション結果の説明
3. **エンティティへのAI憑依**: 特定のエンティティにAIエージェントを「憑依」させ、そのエンティティの行動をAIが決定する（シミュレーション効率化のため）

**AI憑依の設計方針**（将来実装時）:
- 憑依はオプション機能として実装
- 憑依エンティティは通常エンティティと同じインターフェースを持つ
- 憑依の有無はログに記録（再現性のため）
- 憑依エンティティの行動は「外部からの介入」として扱い、manifest.jsonに記録

```typescript
interface PossessedEntity extends Entity {
  aiAgent: AIAgent;
  isPossessed: true;
  
  // AIエージェントが行動を決定
  decide(perception: Perception): Promise<Action>;
}

interface AIAgent {
  id: string;
  model: string;  // 使用するAIモデル
  prompt: string; // システムプロンプト
  
  think(perception: Perception, state: InternalState): Promise<Action>;
}
```

ただし、**初期実装ではAIを使用せず、純粋アルゴリズムで進める**。
