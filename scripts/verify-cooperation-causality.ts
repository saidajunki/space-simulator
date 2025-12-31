/**
 * H62検証: 協力率の増加は回復の「原因」ではなく「結果」である
 * 
 * 検証方法:
 * - 罠からの回復過程で、協力率と人口の時系列変化を分析
 * - どちらが先に変化するかを観察（因果関係の方向）
 * - グレンジャー因果性テストの簡易版
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

interface TimeSeriesPoint {
  tick: number;
  population: number;
  cooperationRate: number;
  hhi: number;
  artPerPop: number;
  civScore: number;
}

interface TrapRecoveryEvent {
  trapTick: number;
  recoveryTick: number;
  timeSeries: TimeSeriesPoint[];
  populationLeadsCooperation: boolean;  // 人口変化が協力率変化に先行
  cooperationLeadsPopulation: boolean;  // 協力率変化が人口変化に先行
}

function calculateHHI(distribution: Map<string, number>): number {
  const values = Array.from(distribution.values());
  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  
  let hhi = 0;
  for (const v of values) {
    const share = v / total;
    hhi += share * share;
  }
  return hhi;
}

function getCivScore(pop: number, artPerPop: number, coopRate: number, hhi: number): number {
  let score = 0;
  if (pop >= 10) score++;
  if (artPerPop >= 5) score++;
  if (coopRate >= 0.5) score++;
  if (hhi >= 0.15) score++;
  return score;
}

function runSimulation(seed: number, ticks: number): TrapRecoveryEvent[] {
  const config: Partial<UniverseConfig> = {
    seed,
    worldGen: {
      nodeCount: 15,
      initialEntityCount: 30,
    },
    resourceRegenerationRate: 0.024,
  };

  const universe = new Universe(config);
  const events: TrapRecoveryEvent[] = [];
  const sampleInterval = 10;  // 細かく観察
  
  let inTrap = false;
  let trapStartTick = 0;
  let currentTimeSeries: TimeSeriesPoint[] = [];
  let prevCivScore = 0;

  for (let t = 0; t < ticks; t++) {
    universe.step();
    
    if ((t + 1) % sampleInterval === 0) {
      const stats = universe.getStats();
      const eventLog = universe.getEventLog();
      
      // 協力率を計算
      const replications = eventLog.filter(e => e.type === 'replication');
      const cooperativeReplications = eventLog.filter(e => 
        e.type === 'partnerSelected'
      ).length;
      const coopRate = replications.length > 0 
        ? cooperativeReplications / replications.length 
        : 0;
      
      // HHIを計算
      const hhi = calculateHHI(stats.spatialDistribution);
      
      // Art/人口
      const artPerPop = stats.entityCount > 0 
        ? stats.artifactCount / stats.entityCount 
        : 0;
      
      // 文明スコア
      const civScore = getCivScore(stats.entityCount, artPerPop, coopRate, hhi);
      
      const point: TimeSeriesPoint = {
        tick: t + 1,
        population: stats.entityCount,
        cooperationRate: coopRate,
        hhi,
        artPerPop,
        civScore,
      };
      
      // 罠の検出（4/4から3/4以下に落ちる）
      if (prevCivScore === 4 && civScore < 4 && !inTrap) {
        inTrap = true;
        trapStartTick = t + 1;
        currentTimeSeries = [point];
      } else if (inTrap) {
        currentTimeSeries.push(point);
        
        // 回復の検出（4/4に戻る）
        if (civScore === 4) {
          // 因果関係を分析
          const analysis = analyzeCausality(currentTimeSeries);
          
          events.push({
            trapTick: trapStartTick,
            recoveryTick: t + 1,
            timeSeries: currentTimeSeries,
            populationLeadsCooperation: analysis.populationLeads,
            cooperationLeadsPopulation: analysis.cooperationLeads,
          });
          
          inTrap = false;
          currentTimeSeries = [];
        }
      }
      
      prevCivScore = civScore;
    }
    
    universe.clearEventLog();
  }

  return events;
}

function analyzeCausality(timeSeries: TimeSeriesPoint[]): {
  populationLeads: boolean;
  cooperationLeads: boolean;
  populationChangeFirst: number;  // 人口が先に変化したtick
  cooperationChangeFirst: number;  // 協力率が先に変化したtick
} {
  if (timeSeries.length < 3) {
    return { populationLeads: false, cooperationLeads: false, populationChangeFirst: 0, cooperationChangeFirst: 0 };
  }
  
  const initial = timeSeries[0]!;
  const threshold = 0.1;  // 10%以上の変化を「変化」とみなす
  
  let populationChangeFirst = 0;
  let cooperationChangeFirst = 0;
  
  // 最初に有意な変化が起きたtickを探す
  for (let i = 1; i < timeSeries.length; i++) {
    const point = timeSeries[i]!;
    
    // 人口の変化
    if (populationChangeFirst === 0) {
      const popChange = Math.abs(point.population - initial.population) / Math.max(1, initial.population);
      if (popChange > threshold) {
        populationChangeFirst = point.tick;
      }
    }
    
    // 協力率の変化
    if (cooperationChangeFirst === 0) {
      const coopChange = Math.abs(point.cooperationRate - initial.cooperationRate);
      if (coopChange > threshold) {
        cooperationChangeFirst = point.tick;
      }
    }
    
    if (populationChangeFirst > 0 && cooperationChangeFirst > 0) break;
  }
  
  return {
    populationLeads: populationChangeFirst > 0 && (cooperationChangeFirst === 0 || populationChangeFirst < cooperationChangeFirst),
    cooperationLeads: cooperationChangeFirst > 0 && (populationChangeFirst === 0 || cooperationChangeFirst < populationChangeFirst),
    populationChangeFirst,
    cooperationChangeFirst,
  };
}

// 相関係数を計算
function correlation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX;
    const dy = y[i]! - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  
  const denom = Math.sqrt(denomX * denomY);
  return denom > 0 ? numerator / denom : 0;
}

// ラグ相関を計算（xがyに先行するか）
function lagCorrelation(x: number[], y: number[], lag: number): number {
  if (lag >= x.length) return 0;
  
  const xLagged = x.slice(0, x.length - lag);
  const yShifted = y.slice(lag);
  
  return correlation(xLagged, yShifted);
}

// メイン実行
console.log('=== H62検証: 協力率の増加は回復の「原因」ではなく「結果」である ===\n');

const seeds = [42, 123, 456, 789, 1000];
const ticks = 30000;

let totalEvents = 0;
let populationLeadsCount = 0;
let cooperationLeadsCount = 0;
let simultaneousCount = 0;

const allLagCorrelations: { popToCoop: number[]; coopToPop: number[] } = {
  popToCoop: [],
  coopToPop: [],
};

for (const seed of seeds) {
  console.log(`=== Seed ${seed} ===\n`);
  const events = runSimulation(seed, ticks);
  
  console.log(`罠→回復イベント数: ${events.length}`);
  
  for (const event of events) {
    totalEvents++;
    
    if (event.populationLeadsCooperation && !event.cooperationLeadsPopulation) {
      populationLeadsCount++;
    } else if (event.cooperationLeadsPopulation && !event.populationLeadsCooperation) {
      cooperationLeadsCount++;
    } else {
      simultaneousCount++;
    }
    
    // ラグ相関を計算
    if (event.timeSeries.length >= 5) {
      const pops = event.timeSeries.map(p => p.population);
      const coops = event.timeSeries.map(p => p.cooperationRate);
      
      // 人口→協力率（人口が先行）
      const popToCoopLag = lagCorrelation(pops, coops, 2);
      // 協力率→人口（協力率が先行）
      const coopToPopLag = lagCorrelation(coops, pops, 2);
      
      allLagCorrelations.popToCoop.push(popToCoopLag);
      allLagCorrelations.coopToPop.push(coopToPopLag);
    }
  }
  
  if (events.length > 0) {
    const avgRecoveryTime = events.reduce((s, e) => s + (e.recoveryTick - e.trapTick), 0) / events.length;
    console.log(`平均回復時間: ${avgRecoveryTime.toFixed(0)} tick`);
    
    const popLeads = events.filter(e => e.populationLeadsCooperation && !e.cooperationLeadsPopulation).length;
    const coopLeads = events.filter(e => e.cooperationLeadsPopulation && !e.populationLeadsCooperation).length;
    const simul = events.filter(e => 
      (e.populationLeadsCooperation && e.cooperationLeadsPopulation) ||
      (!e.populationLeadsCooperation && !e.cooperationLeadsPopulation)
    ).length;
    
    console.log(`人口が先行: ${popLeads}/${events.length} (${(popLeads/events.length*100).toFixed(1)}%)`);
    console.log(`協力率が先行: ${coopLeads}/${events.length} (${(coopLeads/events.length*100).toFixed(1)}%)`);
    console.log(`同時/不明: ${simul}/${events.length} (${(simul/events.length*100).toFixed(1)}%)`);
  }
  console.log();
}

console.log('=== 全体の傾向分析 ===\n');

console.log(`総イベント数: ${totalEvents}`);
console.log(`人口が先行: ${populationLeadsCount}/${totalEvents} (${(populationLeadsCount/totalEvents*100).toFixed(1)}%)`);
console.log(`協力率が先行: ${cooperationLeadsCount}/${totalEvents} (${(cooperationLeadsCount/totalEvents*100).toFixed(1)}%)`);
console.log(`同時/不明: ${simultaneousCount}/${totalEvents} (${(simultaneousCount/totalEvents*100).toFixed(1)}%)`);

if (allLagCorrelations.popToCoop.length > 0) {
  const avgPopToCoop = allLagCorrelations.popToCoop.reduce((s, v) => s + v, 0) / allLagCorrelations.popToCoop.length;
  const avgCoopToPop = allLagCorrelations.coopToPop.reduce((s, v) => s + v, 0) / allLagCorrelations.coopToPop.length;
  
  console.log(`\nラグ相関（lag=2）:`);
  console.log(`  人口→協力率: ${avgPopToCoop.toFixed(3)}`);
  console.log(`  協力率→人口: ${avgCoopToPop.toFixed(3)}`);
  
  if (avgPopToCoop > avgCoopToPop + 0.1) {
    console.log(`  → 人口変化が協力率変化に先行する傾向`);
  } else if (avgCoopToPop > avgPopToCoop + 0.1) {
    console.log(`  → 協力率変化が人口変化に先行する傾向`);
  } else {
    console.log(`  → 明確な先行関係なし`);
  }
}

console.log('\n=== 結論 ===\n');

if (populationLeadsCount > cooperationLeadsCount * 1.5) {
  console.log('H62を支持: 協力率の増加は回復の「原因」ではなく「結果」である');
  console.log('→ 人口変化が先に起き、その後に協力率が変化する');
  console.log('→ 協力率の増加は回復の「結果」として観察される');
} else if (cooperationLeadsCount > populationLeadsCount * 1.5) {
  console.log('H62を棄却: 協力率の増加は回復の「原因」である');
  console.log('→ 協力率変化が先に起き、その後に人口が変化する');
  console.log('→ 協力率の増加が回復を引き起こしている');
} else {
  console.log('H62は不明確: 人口と協力率の因果関係は複雑');
  console.log('→ 両者は相互に影響し合っている可能性');
  console.log('→ 単純な因果関係では説明できない');
}

console.log('\n現世界との対応:');
console.log('- 経済成長と協力: 成長が協力を促進するか、協力が成長を促進するか');
console.log('- 社会資本と発展: 信頼関係と経済発展の因果関係');
console.log('- 鶏と卵の問題: 複雑系では因果関係が双方向');
