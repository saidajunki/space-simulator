#!/usr/bin/env node
/**
 * Universe Simulation CLI
 * Requirements: 15.1
 */

import { LocalRunner, BatchRunner, RunInput, RunOutput } from './core/runner.js';

/**
 * CLIオプション
 */
interface CLIOptions {
  command: 'run' | 'batch' | 'help';
  seed?: number;
  seeds?: string;
  maxTicks?: number;
  nodeCount?: number;
  entityCount?: number;
  logFrequency?: number;
  snapshotFrequency?: number;
  parallel?: number;
  output?: string;
}

/**
 * 引数をパース
 */
function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    command: 'help',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === 'run') {
      options.command = 'run';
    } else if (arg === 'batch') {
      options.command = 'batch';
    } else if (arg === 'help' || arg === '--help' || arg === '-h') {
      options.command = 'help';
    } else if (arg === '--seed' || arg === '-s') {
      options.seed = parseInt(args[++i] || '12345', 10);
    } else if (arg === '--seeds') {
      options.seeds = args[++i] ?? '';
    } else if (arg === '--max-ticks' || arg === '-t') {
      options.maxTicks = parseInt(args[++i] || '1000', 10);
    } else if (arg === '--nodes' || arg === '-n') {
      options.nodeCount = parseInt(args[++i] || '100', 10);
    } else if (arg === '--entities' || arg === '-e') {
      options.entityCount = parseInt(args[++i] || '50', 10);
    } else if (arg === '--log-freq') {
      options.logFrequency = parseInt(args[++i] || '100', 10);
    } else if (arg === '--snapshot-freq') {
      options.snapshotFrequency = parseInt(args[++i] || '1000', 10);
    } else if (arg === '--parallel' || arg === '-p') {
      options.parallel = parseInt(args[++i] || '1', 10);
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i] ?? './runs';
    }
  }

  return options;
}

/**
 * ヘルプを表示
 */
function showHelp(): void {
  console.log(`
Universe Simulation CLI

Usage:
  universe-sim run [options]     Run a single simulation
  universe-sim batch [options]   Run multiple simulations with different seeds
  universe-sim help              Show this help message

Options:
  --seed, -s <number>        Random seed (default: 12345)
  --seeds <range>            Seed range for batch (e.g., "1-100")
  --max-ticks, -t <number>   Maximum ticks to run (default: 1000)
  --nodes, -n <number>       Number of nodes (default: 100)
  --entities, -e <number>    Initial entity count (default: 50)
  --log-freq <number>        Log frequency in ticks (default: 100)
  --snapshot-freq <number>   Snapshot frequency in ticks (default: 1000)
  --parallel, -p <number>    Parallel runs for batch (default: 1)
  --output, -o <path>        Output directory (default: ./runs)

Examples:
  universe-sim run --seed 42 --max-ticks 10000
  universe-sim batch --seeds 1-10 --parallel 4
`);
}

/**
 * 単一Run実行
 */
function runSingle(options: CLIOptions): void {
  const input: RunInput = {
    runId: `run-${options.seed || 12345}-${Date.now()}`,
    config: {
      worldGen: {
        nodeCount: options.nodeCount || 100,
        initialEntityCount: options.entityCount || 50,
      },
    },
    seed: options.seed || 12345,
    maxTicks: options.maxTicks || 1000,
    logFrequency: options.logFrequency || 100,
    snapshotFrequency: options.snapshotFrequency || 1000,
  };

  console.log(`Starting simulation...`);
  console.log(`  Seed: ${input.seed}`);
  console.log(`  Max ticks: ${input.maxTicks}`);
  console.log(`  Nodes: ${input.config.worldGen?.nodeCount}`);
  console.log(`  Entities: ${input.config.worldGen?.initialEntityCount}`);
  console.log('');

  const runner = new LocalRunner();
  runner.initialize(input);

  const startTime = Date.now();
  
  const output = runner.run({
    onTick: (tick, stats) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[${elapsed}s] Tick ${tick}: ` +
        `Entities=${stats.entityCount}, ` +
        `Energy=${stats.totalEnergy.toFixed(0)}, ` +
        `Artifacts=${stats.artifactCount}`
      );
    },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('');
  console.log('=== Simulation Complete ===');
  console.log(`  Exit reason: ${output.manifest.exitReason}`);
  console.log(`  Final tick: ${output.manifest.finalTick}`);
  console.log(`  Duration: ${elapsed}s`);
  console.log(`  Events logged: ${output.events.length}`);
  console.log(`  Snapshots: ${output.snapshots.size}`);
  
  // 最終統計
  const finalStats = output.stats[output.stats.length - 1];
  if (finalStats) {
    console.log('');
    console.log('=== Final Statistics ===');
    console.log(`  Entities: ${finalStats.entityCount}`);
    console.log(`  Total energy: ${finalStats.totalEnergy.toFixed(0)}`);
    console.log(`  Artifacts: ${finalStats.artifactCount}`);
    console.log(`  Average age: ${finalStats.averageAge.toFixed(1)}`);
  }
}

/**
 * バッチ実行
 */
async function runBatch(options: CLIOptions): Promise<void> {
  // seedsをパース
  let seeds: number[] = [];
  if (options.seeds) {
    const match = options.seeds.match(/^(\d+)-(\d+)$/);
    if (match) {
      const start = parseInt(match[1]!, 10);
      const end = parseInt(match[2]!, 10);
      for (let i = start; i <= end; i++) {
        seeds.push(i);
      }
    } else {
      seeds = options.seeds.split(',').map(s => parseInt(s.trim(), 10));
    }
  } else {
    seeds = [1, 2, 3, 4, 5];
  }

  console.log(`Starting batch simulation...`);
  console.log(`  Seeds: ${seeds.length} (${seeds[0]} - ${seeds[seeds.length - 1]})`);
  console.log(`  Parallel: ${options.parallel || 1}`);
  console.log('');

  const batchRunner = new BatchRunner();
  const startTime = Date.now();

  const results = await batchRunner.runBatch(
    {
      config: {
        worldGen: {
          nodeCount: options.nodeCount || 100,
          initialEntityCount: options.entityCount || 50,
        },
      },
      maxTicks: options.maxTicks || 1000,
      logFrequency: options.logFrequency || 100,
      snapshotFrequency: options.snapshotFrequency || 1000,
    },
    seeds,
    options.parallel || 1
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('');
  console.log('=== Batch Complete ===');
  console.log(`  Total runs: ${results.length}`);
  console.log(`  Duration: ${elapsed}s`);
  console.log('');

  // 結果サマリー
  const exitReasons = new Map<string, number>();
  let totalFinalEntities = 0;
  let extinctionCount = 0;

  for (const result of results) {
    const count = exitReasons.get(result.manifest.exitReason) || 0;
    exitReasons.set(result.manifest.exitReason, count + 1);
    
    const finalStats = result.stats[result.stats.length - 1];
    if (finalStats) {
      totalFinalEntities += finalStats.entityCount;
    }
    if (result.manifest.exitReason === 'extinction') {
      extinctionCount++;
    }
  }

  console.log('=== Summary ===');
  console.log(`  Exit reasons:`);
  for (const [reason, count] of exitReasons) {
    console.log(`    ${reason}: ${count}`);
  }
  console.log(`  Extinction rate: ${((extinctionCount / results.length) * 100).toFixed(1)}%`);
  console.log(`  Avg final entities: ${(totalFinalEntities / results.length).toFixed(1)}`);
}

/**
 * メイン
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  switch (options.command) {
    case 'run':
      runSingle(options);
      break;
    case 'batch':
      await runBatch(options);
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

main().catch(console.error);
