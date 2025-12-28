# Design Document: Material Diversity

## Overview

本設計は、宇宙シミュレーションにエンティティの「物質の多様性」を導入する。現在のエンティティは「エネルギーを持つ点」だが、タイプ（元素に相当）、質量、構成を追加することで、より物理的なシミュレーションを実現する。

### 設計原則

1. **最小公理**: 必要最小限の概念のみを追加
2. **非恣意性**: 現実世界の具体（元素名、反応式）を持ち込まない
3. **経路依存**: 反応ルールはseed依存で生成、事前定義しない
4. **計算効率**: 量子レベルは再現せず、抽象化されたモデルを使用

### 追加公理

| 公理番号 | 名称 | 内容 | 必要性 |
|---------|------|------|--------|
| 19 | Material Diversity | エンティティはタイプを持つ | エネルギーだけでは多様性を表現できない |
| 20 | Mass | エンティティは質量を持つ | 物理的慣性の表現 |
| 21 | Reaction | タイプの組み合わせで変換が起きる | 物質の創発的変換 |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Universe                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   TypeRegistry                       │    │
│  │  - typeProperties: Map<TypeId, TypeProperties>      │    │
│  │  - reactionTable: Map<ReactionKey, ReactionResult>  │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│  ┌───────────────────────────┼───────────────────────────┐  │
│  │                     Space (Graph)                      │  │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐           │  │
│  │  │  Node   │────│  Node   │────│  Node   │           │  │
│  │  │         │    │         │    │         │           │  │
│  │  │ Entity  │    │ Entity  │    │ Entity  │           │  │
│  │  │ type:0  │    │ type:2  │    │ type:1  │           │  │
│  │  │ mass:5  │    │ mass:3  │    │ mass:8  │           │  │
│  │  └─────────┘    └─────────┘    └─────────┘           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. TypeProperties（タイプ性質）

各タイプの基本性質を定義する。

```typescript
interface TypeProperties {
  typeId: number;           // タイプID（0からN-1）
  baseMass: number;         // 基本質量
  harvestEfficiency: number; // 採取効率（0.5-2.0）
  reactivity: number;       // 反応性（0.0-1.0）
  stability: number;        // 安定性（エントロピー耐性）
}
```

### 2. TypeRegistry（タイプレジストリ）

タイプ性質と反応テーブルを管理する。

```typescript
interface TypeRegistry {
  maxTypes: number;
  properties: Map<number, TypeProperties>;
  reactionTable: Map<string, ReactionResult>;
  
  getTypeProperties(typeId: number): TypeProperties;
  getReaction(type1: number, type2: number): ReactionResult | null;
  registerReaction(type1: number, type2: number, result: ReactionResult): void;
  generateTypeProperties(typeId: number, random: RandomGenerator): TypeProperties;
}
```

### 3. ReactionResult（反応結果）

化学反応の結果を定義する。

```typescript
interface ReactionResult {
  reactants: number[];      // 反応物のタイプリスト
  products: number[];       // 生成物のタイプリスト
  energyDelta: number;      // エネルギー変化（正=発熱、負=吸熱）
  probability: number;      // 反応確率（0.0-1.0）
}
```

### 4. 拡張されたEntity

```typescript
interface Entity {
  id: string;
  nodeId: string;
  energy: number;
  age: number;
  
  // 新規追加
  type: number;             // タイプID
  mass: number;             // 質量
  composition: number[];    // 構成タイプリスト（単体なら[type]）
}
```

### 5. ReactionEngine（反応エンジン）

化学反応を処理するエンジン。

```typescript
interface ReactionEngine {
  checkReaction(entity1: Entity, entity2: Entity, registry: TypeRegistry, random: RandomGenerator): ReactionResult | null;
  executeReaction(entity1: Entity, entity2: Entity, result: ReactionResult, universe: Universe): Entity[];
  generateNewReaction(type1: number, type2: number, random: RandomGenerator): ReactionResult;
}
```

## Data Models

### TypeProperties生成アルゴリズム

タイプ性質はseedから決定論的に生成される。

```typescript
function generateTypeProperties(typeId: number, random: RandomGenerator): TypeProperties {
  // タイプIDをシードに混ぜて決定論的に生成
  const typeSeed = random.nextFloat() * (typeId + 1);
  
  return {
    typeId,
    baseMass: Math.floor(1 + random.nextFloat() * 10),  // 1-10
    harvestEfficiency: 0.5 + random.nextFloat() * 1.5,   // 0.5-2.0
    reactivity: random.nextFloat(),                       // 0.0-1.0
    stability: random.nextFloat(),                        // 0.0-1.0
  };
}
```

### 反応テーブル生成アルゴリズム

反応ルールは遭遇時に動的に生成される。

```typescript
function generateReaction(type1: number, type2: number, random: RandomGenerator): ReactionResult {
  const reactants = [type1, type2].sort();
  
  // 反応が起きるかどうか（30%の確率で反応なし）
  if (random.nextFloat() < 0.3) {
    return {
      reactants,
      products: reactants,  // 変化なし
      energyDelta: 0,
      probability: 0,
    };
  }
  
  // 生成物を決定
  const productCount = 1 + Math.floor(random.nextFloat() * 2);  // 1-2個
  const products: number[] = [];
  for (let i = 0; i < productCount; i++) {
    // 新しいタイプか既存タイプか
    if (random.nextFloat() < 0.5) {
      products.push(reactants[Math.floor(random.nextFloat() * 2)]);
    } else {
      products.push(Math.floor(random.nextFloat() * maxTypes));
    }
  }
  
  return {
    reactants,
    products,
    energyDelta: (random.nextFloat() - 0.5) * 20,  // -10 to +10
    probability: 0.1 + random.nextFloat() * 0.5,    // 0.1-0.6
  };
}
```

### 質量による移動コスト計算

```typescript
function calculateMovementCost(entity: Entity, baseMoveCost: number): number {
  const massFactor = 1 + entity.mass / BASE_MASS_UNIT;
  return Math.ceil(baseMoveCost * massFactor);
}
```

### 複製時のタイプ継承

```typescript
function inheritType(parentType: number, random: RandomGenerator, maxTypes: number): number {
  const MUTATION_RATE = 0.01;  // 1%の変異率
  
  if (random.nextFloat() < MUTATION_RATE) {
    return Math.floor(random.nextFloat() * maxTypes);
  }
  return parentType;
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Entity Structure Invariant

*For any* Entity in the simulation, the following invariants SHALL hold:
- type is a non-negative integer less than maxTypes
- mass is a positive integer (mass > 0)
- composition is a non-empty array of non-negative integers
- energy is a non-negative number

**Validates: Requirements 1.1, 2.1, 2.4, 3.1**

### Property 2: Type Assignment Validity

*For any* newly created Entity, the assigned type SHALL be:
- Within the range [0, maxTypes - 1]
- Consistent with the type's baseMass (mass equals type's baseMass for simple entities)
- Deterministically derived from the seed when created from initial conditions

**Validates: Requirements 1.2, 1.4, 2.3**

### Property 3: Composition Consistency

*For any* Entity:
- If the entity is a simple type, composition SHALL equal [type]
- If the entity is a compound, composition SHALL contain all constituent types from the reaction
- The entity's effective properties SHALL be derivable from its composition

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 4: Movement Cost Calculation

*For any* Entity attempting to move:
- The movement cost SHALL equal ceil(baseCost * (1 + mass / BASE_MASS_UNIT))
- If entity.energy < movementCost, the movement SHALL be prevented
- The entity's position SHALL remain unchanged if movement is prevented

**Validates: Requirements 2.2, 7.1, 7.2, 7.3**

### Property 5: Reaction Execution Consistency

*For any* two Entities at the same node:
- A reaction check SHALL occur during interaction
- If a reaction occurs, both reactant entities SHALL be removed
- Product entities SHALL match the ReactionTable entry for the reactant types
- If no entry exists, a new reaction SHALL be generated and recorded

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 6: Reaction Table Determinism

*For any* simulation with the same seed:
- The same type combination SHALL always produce the same reaction result
- Once a reaction is recorded, subsequent lookups SHALL return the same result
- The reaction table SHALL persist throughout the simulation

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 7: Type Properties Generation

*For any* type ID in [0, maxTypes - 1]:
- The type SHALL have a baseMass in range [1, 10]
- The type SHALL have a harvestEfficiency in range [0.5, 2.0]
- The type SHALL have a reactivity in range [0.0, 1.0]
- The same seed SHALL produce the same type properties

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 8: Type Inheritance and Mutation

*For any* replication event:
- With probability (1 - MUTATION_RATE), child.type SHALL equal parent.type
- With probability MUTATION_RATE, child.type SHALL be a random valid type
- The child's type SHALL always be in range [0, maxTypes - 1]

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 9: Energy-Mass Conservation

*For any* mass-energy conversion:
- When an entity is destroyed, released energy SHALL equal mass * CONVERSION_RATE
- When an entity is created from energy, consumed energy SHALL equal mass * CONVERSION_RATE
- Total (energy + mass * CONVERSION_RATE) in the system SHALL remain constant (excluding external input)

**Validates: Requirements 9.1, 9.2, 9.4**

### Property 10: Observation Logging Completeness

*For any* simulation snapshot:
- The type distribution (count per type) SHALL be recorded
- The total mass in the system SHALL be recorded
- All reactions SHALL be logged with reactants, products, and location

**Validates: Requirements 10.1, 10.2, 10.3, 4.5, 7.4, 8.4**

## Error Handling

### Invalid Type
- If an entity is created with type >= maxTypes, clamp to maxTypes - 1
- Log a warning for debugging

### Insufficient Energy for Reaction
- If a reaction requires energy (endothermic) and entities don't have enough, skip the reaction
- Log the skipped reaction

### Mass Underflow
- If a reaction would create an entity with mass <= 0, set mass to 1
- Log a warning

### Reaction Table Overflow
- If the reaction table exceeds a configurable limit, stop generating new reactions
- Use a default "no reaction" result for new combinations

## Testing Strategy

### Unit Tests
- TypeRegistry initialization and type property generation
- ReactionEngine reaction checking and execution
- Movement cost calculation
- Type inheritance with mutation

### Property-Based Tests (using fast-check)

Each correctness property will be implemented as a property-based test with minimum 100 iterations.

```typescript
// Example: Property 1 - Entity Structure Invariant
// Feature: material-diversity, Property 1: Entity Structure Invariant
fc.assert(
  fc.property(
    arbitraryEntity(),
    (entity) => {
      return (
        entity.type >= 0 &&
        entity.type < maxTypes &&
        entity.mass > 0 &&
        entity.composition.length > 0 &&
        entity.energy >= 0
      );
    }
  ),
  { numRuns: 100 }
);
```

### Integration Tests
- Full simulation with material diversity enabled
- Reaction chain verification
- Type distribution evolution over time
