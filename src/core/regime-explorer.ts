/**
 * RegimeExplorer - パラメータ空間探索とレジーム分類
 * Requirements: regime-exploration 1.1, 1.2, 1.3, 2.1-2.4, 3.1-3.3, 4.1-4.3
 */

import { LocalRunner, RunInput } from './runner.js';
import { SimulationStats } from './observation.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 探索設定
 */
export interface ExplorationConfig {
  /** 探索するresourceRegenerationRateの値 */
  regenRates: number[];
  /** 各パラメータで実行するseed */
  seeds: number[];
  /** 最大tick数 */
  maxTicks: number;
  /** ノード数 */
  nodeCount: number;
  /** 初期エンティティ数 */
  entityCount: number;
  /** 道具効果A/B比較を行うか */
  toolEffectAB: boolean;
}

/**
 * 単一シミュレーションの結果
 */
export interface ExplorationResult {
  /** パラメータ */
  regenRate: number;
  seed: number;
  toolEffectEnabled: boolean;
  /** 結果 */
  exitReason: string;
  finalTick: number;
  entityCount: number;
  artifactCount: number;
  totalPrestige: number;
  avgArtifactAge: number;
  avgAge: number;
  replicationCount: number;
  interactionCount: number;
  spatialGini: number;
  /** 分類 */
  regime: string;
}

/**
 * 探索サマリー
 */
export interface ExplorationSummary {
  config: ExplorationConfig;
  results: ExplorationResult[];
  regimeCounts: Record<string, number>;
  timestamp: string;
  gitCommitHash?: string;
}

/**
 * デフォルトの探索設定
 */
export const DEFAULT_EXPLORATION_CONFIG: ExplorationConfig = {
  regenRates: [0.004, 0.008, 0.016, 0.032, 0.064],
  seeds: [1, 2, 3],
  maxTicks: 1000,
  nodeCount: 30,
  entityCount: 50,
  toolEffectAB: true,
};

/**
 * レジーム分類
 */
export type Regime = '静止' | '少数安定' | '活発' | '増殖/絶滅';

/**
 * レジーム分類ロジック
 */
export function classifyRegime(
  entityCount: number,
  replicationCount: number,
  exitReason: string,
  initialEntityCount: number
): Regime {
  // 絶滅
  if (exitReason === 'extinction') {
    return '増殖/絶滅';
  }
  
  // 増殖（初期より増加）
  if (entityCount > initialEntityCount) {
    return '増殖/絶滅';
  }
  
  // 静止（1-3体、複製なし）
  if (entityCount <= 3 && replicationCount === 0) {
    return '静止';
  }
  
  // 少数安定（3-10体、低頻度複製）
  if (entityCount <= 10 && replicationCount < 5) {
    return '少数安定';
  }
  
  // 活発（10体以上、または中頻度複製）
  if (entityCount >= 10 || replicationCount >= 5) {
    return '活発';
  }
  
  return '少数安定';
}

/**
 * RegimeExplorer - パラメータ空間探索
 */
export class RegimeExplorer {
  private config: ExplorationConfig;

  constructor(config: Partial<ExplorationConfig> = {}) {
    this.config = { ...DEFAULT_EXPLORATION_CONFIG, ...config };
  }

  /**
   * 探索を実行
   */
  explore(onProgress?: (current: number, total: number, result: ExplorationResult) => void): ExplorationSummary {
    const results: ExplorationResult[] = [];
    const toolEffectValues = this.config.toolEffectAB ? [true, false] : [true];
    
    const totalRuns = this.config.regenRates.length * this.config.seeds.length * toolEffectValues.length;
    let currentRun = 0;

    for (const regenRate of this.config.regenRates) {
      for (const seed of this.config.seeds) {
        for (const toolEffectEnabled of toolEffectValues) {
          currentRun++;
          
          const result = this.runSingleSimulation(regenRate, seed, toolEffectEnabled);
          results.push(result);
          
          onProgress?.(currentRun, totalRuns, result);
        }
      }
    }

    // レジームカウント
    const regimeCounts: Record<string, number> = {
      '静止': 0,
      '少数安定': 0,
      '活発': 0,
      '増殖/絶滅': 0,
    };
    for (const result of results) {
      regimeCounts[result.regime] = (regimeCounts[result.regime] ?? 0) + 1;
    }

    return {
      config: this.config,
      results,
      regimeCounts,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 単一シミュレーションを実行
   */
  private runSingleSimulation(
    regenRate: number,
    seed: number,
    toolEffectEnabled: boolean
  ): ExplorationResult {
    const input: RunInput = {
      runId: `explore-${regenRate}-${seed}-${toolEffectEnabled ? 'on' : 'off'}`,
      config: {
        worldGen: {
          nodeCount: this.config.nodeCount,
          initialEntityCount: this.config.entityCount,
        },
        resourceRegenerationRate: regenRate,
        toolEffectEnabled,
      },
      seed,
      maxTicks: this.config.maxTicks,
      logFrequency: this.config.maxTicks, // ログは最後だけ
      snapshotFrequency: this.config.maxTicks * 10, // スナップショットなし
    };

    const runner = new LocalRunner();
    runner.initialize(input);
    
    // 統計を収集
    let totalReplicationCount = 0;
    let totalInteractionCount = 0;
    
    const output = runner.run({
      onTick: (_tick, stats) => {
        totalReplicationCount += stats.replicationCount ?? 0;
        totalInteractionCount += stats.interactionCount ?? 0;
      },
    });

    const finalStats = output.stats[output.stats.length - 1];
    
    const regime = classifyRegime(
      finalStats?.entityCount ?? 0,
      totalReplicationCount,
      output.manifest.exitReason,
      this.config.entityCount
    );

    return {
      regenRate,
      seed,
      toolEffectEnabled,
      exitReason: output.manifest.exitReason,
      finalTick: output.manifest.finalTick,
      entityCount: finalStats?.entityCount ?? 0,
      artifactCount: finalStats?.artifactCount ?? 0,
      totalPrestige: finalStats?.totalPrestige ?? 0,
      avgArtifactAge: finalStats?.avgArtifactAge ?? 0,
      avgAge: finalStats?.averageAge ?? 0,
      replicationCount: totalReplicationCount,
      interactionCount: totalInteractionCount,
      spatialGini: finalStats?.spatialGini ?? 0,
      regime,
    };
  }

  /**
   * 結果をJSONファイルに保存
   */
  saveResults(summary: ExplorationSummary, outputDir: string): string {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = summary.timestamp.replace(/[:.]/g, '-').slice(0, 19);
    const filename = `regime-exploration-${timestamp}.json`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));
    return filepath;
  }

  /**
   * マークダウンレポートを生成
   */
  generateReport(summary: ExplorationSummary): string {
    const lines: string[] = [];
    
    lines.push('# レジーム探索レポート');
    lines.push('');
    lines.push(`**日時**: ${summary.timestamp}`);
    if (summary.gitCommitHash) {
      lines.push(`**Git Commit**: ${summary.gitCommitHash}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
    
    // 設定
    lines.push('## 探索設定');
    lines.push('');
    lines.push(`| パラメータ | 値 |`);
    lines.push(`|-----------|-----|`);
    lines.push(`| regenRates | ${summary.config.regenRates.join(', ')} |`);
    lines.push(`| seeds | ${summary.config.seeds.join(', ')} |`);
    lines.push(`| maxTicks | ${summary.config.maxTicks} |`);
    lines.push(`| nodeCount | ${summary.config.nodeCount} |`);
    lines.push(`| entityCount | ${summary.config.entityCount} |`);
    lines.push(`| toolEffectAB | ${summary.config.toolEffectAB} |`);
    lines.push('');
    
    // レジーム分布
    lines.push('## レジーム分布');
    lines.push('');
    lines.push(`| レジーム | 件数 | 割合 |`);
    lines.push(`|---------|------|------|`);
    const total = summary.results.length;
    for (const [regime, count] of Object.entries(summary.regimeCounts)) {
      const percent = ((count / total) * 100).toFixed(1);
      lines.push(`| ${regime} | ${count} | ${percent}% |`);
    }
    lines.push('');
    
    // regenRate別の結果
    lines.push('## regenRate別の結果');
    lines.push('');
    
    for (const regenRate of summary.config.regenRates) {
      const rateResults = summary.results.filter(r => r.regenRate === regenRate);
      lines.push(`### regenRate = ${regenRate}`);
      lines.push('');
      lines.push(`| Seed | Tool | Entity | Artifact | Prestige | AvgAge | Repl | Regime |`);
      lines.push(`|------|------|--------|----------|----------|--------|------|--------|`);
      
      for (const r of rateResults) {
        const tool = r.toolEffectEnabled ? 'ON' : 'OFF';
        lines.push(`| ${r.seed} | ${tool} | ${r.entityCount} | ${r.artifactCount} | ${r.totalPrestige.toFixed(0)} | ${r.avgAge.toFixed(0)} | ${r.replicationCount} | ${r.regime} |`);
      }
      lines.push('');
    }
    
    // 道具効果A/B比較
    if (summary.config.toolEffectAB) {
      lines.push('## 道具効果A/B比較');
      lines.push('');
      lines.push(`| regenRate | Seed | ΔEntity | ΔArtifact | ΔPrestige | ΔAvgAge |`);
      lines.push(`|-----------|------|---------|-----------|-----------|---------|`);
      
      for (const regenRate of summary.config.regenRates) {
        for (const seed of summary.config.seeds) {
          const onResult = summary.results.find(r => 
            r.regenRate === regenRate && r.seed === seed && r.toolEffectEnabled
          );
          const offResult = summary.results.find(r => 
            r.regenRate === regenRate && r.seed === seed && !r.toolEffectEnabled
          );
          
          if (onResult && offResult) {
            const dEntity = onResult.entityCount - offResult.entityCount;
            const dArtifact = onResult.artifactCount - offResult.artifactCount;
            const dPrestige = onResult.totalPrestige - offResult.totalPrestige;
            const dAvgAge = onResult.avgAge - offResult.avgAge;
            
            lines.push(`| ${regenRate} | ${seed} | ${dEntity >= 0 ? '+' : ''}${dEntity} | ${dArtifact >= 0 ? '+' : ''}${dArtifact} | ${dPrestige >= 0 ? '+' : ''}${dPrestige.toFixed(0)} | ${dAvgAge >= 0 ? '+' : ''}${dAvgAge.toFixed(0)} |`);
          }
        }
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }
}
