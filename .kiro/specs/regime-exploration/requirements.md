# Requirements Document: レジーム探索

## Introduction

シミュレーションのパラメータ空間を探索し、「静止」「少数安定」「活発」「増殖」の各レジームを特定する。
これにより、面白いダイナミクスが観察できるパラメータ領域を発見し、仮説検証を可能にする。

## Glossary

- **Regime_Explorer**: パラメータグリッドを走査してシミュレーションを実行するシステム
- **Phase_Diagram**: パラメータ空間上のレジーム分布を可視化した図
- **Regime**: シミュレーションの定性的な挙動パターン（静止/少数安定/活発/増殖）
- **Tool_Effect**: アーティファクトによる採取効率・シェルター効果

## Requirements

### Requirement 1: パラメータグリッド実行

**User Story:** As a researcher, I want to run simulations across a parameter grid, so that I can identify different behavioral regimes.

#### Acceptance Criteria

1. WHEN the Regime_Explorer is invoked with a parameter grid, THE Regime_Explorer SHALL execute simulations for each parameter combination
2. WHEN a simulation completes, THE Regime_Explorer SHALL record final statistics including entityCount, artifactCount, totalPrestige, avgAge, interactionCount, replicationCount
3. WHEN all simulations complete, THE Regime_Explorer SHALL output a summary table with regime classifications

### Requirement 2: レジーム分類

**User Story:** As a researcher, I want automatic regime classification, so that I can quickly identify parameter regions of interest.

#### Acceptance Criteria

1. WHEN final entityCount is 1-3 AND replicationCount is 0, THE Regime_Explorer SHALL classify as "静止"
2. WHEN final entityCount is 3-10 AND replicationCount is low (<5), THE Regime_Explorer SHALL classify as "少数安定"
3. WHEN final entityCount is 10-50 AND replicationCount is moderate (5-50), THE Regime_Explorer SHALL classify as "活発"
4. WHEN exitReason is "extinction" OR entityCount exceeds initial, THE Regime_Explorer SHALL classify as "増殖/絶滅サイクル"

### Requirement 3: 道具効果A/B比較

**User Story:** As a researcher, I want to compare simulations with and without tool effects, so that I can separate "cultural" from "practical" artifact value.

#### Acceptance Criteria

1. WHEN toolEffectEnabled is false, THE Universe SHALL skip artifact harvest bonus and shelter effect calculations
2. WHEN running A/B comparison, THE Regime_Explorer SHALL run each parameter combination twice (tool ON/OFF)
3. WHEN outputting results, THE Regime_Explorer SHALL include delta metrics (totalPrestige, avgArtifactAge, repairCount) between ON/OFF conditions

### Requirement 4: 結果の永続化

**User Story:** As a researcher, I want results saved to files, so that I can reference them later and maintain reproducibility.

#### Acceptance Criteria

1. WHEN a grid exploration completes, THE Regime_Explorer SHALL save results to `runs/regime-exploration-{timestamp}.json`
2. THE saved file SHALL include: gitCommitHash, parameterGrid, allResults, regimeClassifications
3. WHEN generating a report, THE Regime_Explorer SHALL create a markdown summary in `.kiro/reports/`

### Requirement 5: CLI統合

**User Story:** As a researcher, I want to run regime exploration from the command line, so that I can easily execute experiments.

#### Acceptance Criteria

1. WHEN `node dist/cli.js explore-regimes` is invoked, THE CLI SHALL execute the regime exploration
2. THE CLI SHALL accept options for: --ticks, --seeds, --regen-rates, --tool-effect-ab
3. WHEN exploration completes, THE CLI SHALL print a summary table to stdout
