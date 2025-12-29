# Design Document: Artifact Persistence

## Overview

本設計は、宇宙シミュレーションにおいて「維持にコストがかかるのに、アーティファクトが残り続ける」現象を、人間の価値判断や目的関数を導入せずに再現する。

中核アイデアは 2 つ：

1. **高コスト＝正直なシグナル（Handicap Principle）**  
   修復にエネルギーが必要である以上、それを継続できる個体は“能力”のシグナルになる（ただしシグナルは局所知覚に限定）。
2. **安定構造＝焦点点（Focal Point）**  
   残り続ける構造は「集合の座標系」として働き、探索/出会いコストを下げる（ビーコンとして表現）。

本機能は、既存の **エネルギー会計（free energy / waste heat）** と矛盾しないことを最優先とする（Requirements 1, 7）。

## Design Principles

1. **最小公理**: “文化”を直接入れず、シグナルと焦点点の2本だけを追加
2. **局所性**: 意思決定は Perception に載る近傍情報のみ（Requirement 7.6）
3. **熱力学整合**: 修復コストは廃熱化し、エネルギーを創造しない（Requirements 1.2, 7.1）
4. **非誘導**: ビーコンは移動のバイアスのみで、相互作用確率を直接いじらない（Requirement 6.5）
5. **観測可能性**: 修復/選好などのイベントをログ化し、創発か実装効果かを切り分ける（Requirements 1.5, 4.5）

## Added Axioms (Axiom Budget)

| 追加公理 | 内容 | 物理/情報理論的な位置づけ |
|---|---|---|
| Costly Signal | 高コスト行動は“能力”のシグナルになりうる | ハンディキャップ原理（嘘がつけない） |
| Landmark Beacon | 安定構造は局所探索の座標系になる | 焦点点・共通知、探索コスト低減 |

※ Prestige はエネルギーではなく「累積コストのカウンタ」であり、保存則を破らない（Requirement 7.2）。

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                             Universe                              │
│                                                                  │
│  Entity Loop                                                     │
│   perceive()  ───────────────┐                                   │
│   decideAction()             │  (local info only)                 │
│   executeAction()            │                                   │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                       Perception                           │  │
│  │  - currentNode: { resources, nodePrestige, beaconStrength } │  │
│  │  - neighborNodes: [{ …, nodePrestige, beaconStrength }]     │  │
│  │  - nearbyEntities: [{ id, energy, age, isMaintainer }]      │  │
│  │  - nearbyArtifacts: [{ id, durability, prestige? }]         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────┐     ┌──────────────────────────────┐  │
│  │   ArtifactManager     │     │  EnergySystem / WasteHeat     │  │
│  │  - durability         │     │  - dissipate -> node.wasteHeat│  │
│  │  - prestige (NEW)     │     └──────────────────────────────┘  │
│  └──────────────────────┘                                        │
│                                                                  │
│  Beacon/Prestige aggregation (NEW)                                │
│  - NodePrestige: sum(prestige)                                   │
│  - BeaconStrength: f(durability, prestige)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model Changes

### 1) Artifact拡張（Prestige）

```typescript
interface Artifact {
  id: ArtifactId;
  nodeId: NodeId;
  durability: number;   // 0..1
  createdAt: number;
  creatorId: EntityId;
  data: Uint8Array;

  // NEW: accounting-only
  prestige: number;     // >= 0 (NOT energy)
}
```

- 作成時: `prestige = creationEnergyCost`（Requirement 2.1）
- 修復時: `prestige += repairEnergyCost`（Requirement 2.2）

### 2) Entity拡張（Maintainerステータス）

```typescript
interface Entity {
  // ...
  maintainerUntilTick?: number; // NEW: temporary status (Requirement 5)
}
```

Perception に載せるため、`isMaintainer = (tick < maintainerUntilTick)` を導出できるようにする（Requirements 5.2, 5.5）。

### 3) Perception拡張（Beacon / NodePrestige / Maintainer）

- `NodeInfo` に `nodePrestige`, `beaconStrength` を追加（Requirements 3.2, 6.1）
- `EntityInfo` に `isMaintainer` を追加（Requirement 4.2）

現状の `perceive()` は「隣接ノード情報 + 同一ノードの個体/アーティファクト」までなので、Beaconは **“ノード集約値”** として載せるのが最小。

## Core Mechanics

### 1) Repair Action（修復）

**前提**: 修復対象は同一ノード上の Artifact（局所性）。  
**会計**:
- `entity.energy -= repairCost`
- `node.wasteHeat += repairCost`（Requirement 1.2）
- `artifact.durability += repairGain`（Requirement 1.3）
- `artifact.prestige += repairCost`（Requirement 2.2）

**修復量モデル（例）**  
修復量は「払ったコストに比例、ただし上限 1.0」で十分：

```
repairGain = min(1 - durability, repairCost / REPAIR_ENERGY_PER_DURABILITY)
```

（数値は config 化し、創発を観測しながら調整する）

### 2) Prestige（高コストシグナルのカウンタ）

Prestige は「過去に注がれた維持エネルギーの累積」を表すだけで、エネルギーの貯蔵ではない（Requirement 7.2）。

ノード集約として以下を定義する：

```
nodePrestige(node) = Σ artifact.prestige (artifact in node)
```

### 3) Beacon（焦点点の座標系）

耐久度が閾値を超える Artifact は Beacon を発する（Requirement 3.1）。

**強度関数（提案）**  
単純比例は runaway を起こしやすいため、diminishing returns を入れる（Requirement 3.3）:

```
beaconStrength = durability * log1p(prestige) * BEACON_SCALE
```

ノードの Beacon 強度は合算または最大値で集約する（どちらも局所に載せやすい）。MVP は合算でよい：

```
nodeBeaconStrength(node) = Σ beaconStrength(artifact)
```

### 4) Partner Choice（Maintainerシグナル）

協力複製のパートナー選択は **同一ノードの候補のみ**（Requirement 4.1）。  
選好は maintainer status を用いる（Requirement 4.2）:

```
weight(candidate) = 1 + (candidate.isMaintainer ? PARTNER_MAINTAINER_BONUS : 0)
weight *= g(nodePrestige)   // optional, diminishing returns (Requirement 4.3)
```

これにより、フリーライダー（維持しないが周辺にいる）と維持者を区別できる。

### 5) Maintainer Bonus（短期の私益）

修復を行った個体に一時ステータスを付与する（Requirement 5.1）。

- 期限: `tick + U[10,50]`（Requirement 5.3）
- ボーナス: `perceptionRange + 1 hop`（Requirement 5.4）

ボーナスは「情報（到達範囲）」に限定し、エネルギーは作らない（Requirement 7.4）。

### 6) Movement Bias（Beacon誘引）

移動先候補（隣接ノード）に対し、BeaconStrength に比例した重み付けを行う（Requirements 6.1-6.3）。  
ただし、移動エネルギーコストは変えない（Requirement 7.5）。

実装は softmax が安全：

```
score(node) = baseScore(node) + BEACON_ATTRACTION * beaconStrength(node)
P(move to node) = softmax(score)
```

## Logging / Observability

最低限ログに必要なイベント（Requirements 1.5, 4.5）:

- `artifactRepaired`: entityId, artifactId, repairCost, durabilityBefore/After
- `maintainerGranted`: entityId, untilTick
- `partnerSelected`: entityId, partnerId, isMaintainer, nodePrestige, weights

## Correctness Properties (Suggested)

### Property 1: Repair Energy Accounting

修復 1 回について:
- `Δ(entityEnergy) = -repairCost`
- `Δ(nodeWasteHeat) = +repairCost`
- `Δ(freeEnergy) = 0`（修復では環境資源を増減しない）

**Validates:** Requirements 1.1, 1.2, 7.1

### Property 2: Prestige Is Not Energy

Prestige の増加は、総エネルギー内訳（entity/free/wasteHeat）を変化させない。

**Validates:** Requirements 2.1, 2.2, 7.2

### Property 3: Locality Constraint

Beacon誘引とパートナー選好は、Perception の範囲を超える情報を参照しない（全ノード走査などを禁止）。

**Validates:** Requirement 7.6

## Parameters (Initial Defaults)

- `BEACON_DURABILITY_THRESHOLD = 0.5`（Requirement 3.1）
- `BEACON_SCALE`（強度のスケール）
- `REPAIR_ENERGY_PER_DURABILITY`（修復効率）
- `PARTNER_MAINTAINER_BONUS`
- `MAINTAINER_DURATION_RANGE = [10,50] ticks`（Requirement 5.3）
- `BEACON_ATTRACTION`（移動バイアスの強さ）

## Risks / Tuning Notes

- **runaway**: prestige→beacon→集合→修復→prestige の正帰還は起こり得るため、`log1p` と上限で制御する
- **過密**: 1点集中で資源枯渇が起こる場合、beacon attraction を弱める/ノイズを増やす
- **計算量**: +1 hop 知覚は、グラフの2-hop近傍を事前計算して参照するのが安全

