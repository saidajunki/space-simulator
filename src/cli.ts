#!/usr/bin/env node
/**
 * Universe Simulation CLI
 * Requirements: 15.1
 */

import { LocalRunner, BatchRunner, RunInput, RunOutput } from './core/runner.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CLIオプション
 */
interface CLIOptions {
  command: 'run' | 'batch' | 'status' | 'help';
  seed?: number;
  seeds?: string;
  maxTicks?: number;
  nodeCount?: number;
  entityCount?: number;
  logFrequency?: number;
  snapshotFrequency?: number;
  parallel?: number;
  output?: string;
  background?: boolean;
  runId?: string;
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
    } else if (arg === 'status') {
      options.command = 'status';
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
    } else if (arg === '--background' || arg === '-b') {
      options.background = true;
    } else if (arg === '--run-id') {
      options.runId = args[++i] ?? '';
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
  universe-sim status [options]  Check status of a background run
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
  --background, -b           Run in background mode (output to files)
  --run-id <id>              Run ID for status check

Examples:
  universe-sim run --seed 42 --max-ticks 10000
  universe-sim run --seed 42 --max-ticks 100000 --background
  universe-sim status --run-id run-42-xxx
  universe-sim batch --seeds 1-10 --parallel 4
`);
}

/**
 * 出力ディレクトリを作成
 */
function ensureOutputDir(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * 進捗をファイルに書き込み
 */
function writeProgress(outputDir: string, runId: string, data: {
  status: 'running' | 'completed' | 'error';
  tick: number;
  maxTicks: number;
  entityCount: number;
  totalEnergy: number;
  artifactCount: number;
  averageAge: number;
  startTime: string;
  elapsedSeconds: number;
  estimatedRemainingSeconds?: number;
}): void {
  const progressFile = path.join(outputDir, `${runId}-progress.json`);
  fs.writeFileSync(progressFile, JSON.stringify(data, null, 2));
}

/**
 * ログをファイルに追記
 */
function appendLog(outputDir: string, runId: string, message: string): void {
  const logFile = path.join(outputDir, `${runId}-log.txt`);
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

/**
 * 結果をファイルに書き込み
 */
function writeResult(outputDir: string, runId: string, output: RunOutput): void {
  const resultFile = path.join(outputDir, `${runId}-result.json`);
  
  // スナップショットはサイズが大きいので除外
  const result = {
    manifest: output.manifest,
    stats: output.stats,
    eventCount: output.events.length,
    snapshotCount: output.snapshots.size,
  };
  
  fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
}

/**
 * 単一Run実行
 */
function runSingle(options: CLIOptions): void {
  const runId = options.runId || `run-${options.seed || 12345}-${Date.now()}`;
  const outputDir = options.output || './runs';
  
  const input: RunInput = {
    runId,
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

  if (options.background) {
    // バックグラウンドモード
    ensureOutputDir(outputDir);
    
    const startTime = new Date().toISOString();
    const startMs = Date.now();
    
    appendLog(outputDir, runId, `Starting simulation...`);
    appendLog(outputDir, runId, `  Seed: ${input.seed}`);
    appendLog(outputDir, runId, `  Max ticks: ${input.maxTicks}`);
    appendLog(outputDir, runId, `  Nodes: ${input.config.worldGen?.nodeCount}`);
    appendLog(outputDir, runId, `  Entities: ${input.config.worldGen?.initialEntityCount}`);
    
    console.log(`Background simulation started!`);
    console.log(`  Run ID: ${runId}`);
    console.log(`  Output: ${outputDir}`);
    console.log(`  Progress: ${outputDir}/${runId}-progress.json`);
    console.log(`  Log: ${outputDir}/${runId}-log.txt`);
    console.log('');
    console.log(`Check status with: node dist/cli.js status --run-id ${runId} --output ${outputDir}`);

    const runner = new LocalRunner();
    runner.initialize(input);

    let lastTickTime = startMs;
    let ticksPerSecond = 0;

    const output = runner.run({
      onTick: (tick, stats) => {
        const now = Date.now();
        const elapsedSeconds = (now - startMs) / 1000;
        
        // 速度計算
        const tickDelta = now - lastTickTime;
        if (tickDelta > 0) {
          ticksPerSecond = input.logFrequency / (tickDelta / 1000);
        }
        lastTickTime = now;
        
        // 残り時間推定
        const remainingTicks = input.maxTicks - tick;
        const estimatedRemainingSeconds = ticksPerSecond > 0 
          ? remainingTicks / ticksPerSecond 
          : undefined;

        writeProgress(outputDir, runId, {
          status: 'running',
          tick,
          maxTicks: input.maxTicks,
          entityCount: stats.entityCount,
          totalEnergy: stats.totalEnergy,
          artifactCount: stats.artifactCount,
          averageAge: stats.averageAge,
          startTime,
          elapsedSeconds,
          ...(estimatedRemainingSeconds !== undefined && { estimatedRemainingSeconds }),
        });

        appendLog(outputDir, runId, 
          `Tick ${tick}/${input.maxTicks} (${((tick/input.maxTicks)*100).toFixed(1)}%): ` +
          `Entities=${stats.entityCount}, Energy=${stats.totalEnergy.toFixed(0)}, Artifacts=${stats.artifactCount}`
        );
      },
    });

    const elapsedSeconds = (Date.now() - startMs) / 1000;
    const finalStats = output.stats[output.stats.length - 1];

    writeProgress(outputDir, runId, {
      status: 'completed',
      tick: output.manifest.finalTick,
      maxTicks: input.maxTicks,
      entityCount: finalStats?.entityCount ?? 0,
      totalEnergy: finalStats?.totalEnergy ?? 0,
      artifactCount: finalStats?.artifactCount ?? 0,
      averageAge: finalStats?.averageAge ?? 0,
      startTime,
      elapsedSeconds,
    });

    writeResult(outputDir, runId, output);

    appendLog(outputDir, runId, '');
    appendLog(outputDir, runId, '=== Simulation Complete ===');
    appendLog(outputDir, runId, `  Exit reason: ${output.manifest.exitReason}`);
    appendLog(outputDir, runId, `  Final tick: ${output.manifest.finalTick}`);
    appendLog(outputDir, runId, `  Duration: ${elapsedSeconds.toFixed(2)}s`);
    appendLog(outputDir, runId, `  Events logged: ${output.events.length}`);
    
    if (finalStats) {
      appendLog(outputDir, runId, '');
      appendLog(outputDir, runId, '=== Final Statistics ===');
      appendLog(outputDir, runId, `  Entities: ${finalStats.entityCount}`);
      appendLog(outputDir, runId, `  Total energy: ${finalStats.totalEnergy.toFixed(0)}`);
      appendLog(outputDir, runId, `  Artifacts: ${finalStats.artifactCount}`);
      appendLog(outputDir, runId, `  Average age: ${finalStats.averageAge.toFixed(1)}`);
    }

  } else {
    // 通常モード（コンソール出力）
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
}

/**
 * ステータス確認
 */
function checkStatus(options: CLIOptions): void {
  const outputDir = options.output || './runs';
  const runId = options.runId;

  if (!runId) {
    // runIdが指定されていない場合、最新のprogressファイルを探す
    if (!fs.existsSync(outputDir)) {
      console.log('No runs found.');
      return;
    }

    const files = fs.readdirSync(outputDir)
      .filter(f => f.endsWith('-progress.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.log('No runs found.');
      return;
    }

    console.log('Available runs:');
    for (const file of files.slice(0, 10)) {
      const progressPath = path.join(outputDir, file);
      try {
        const progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
        const runIdFromFile = file.replace('-progress.json', '');
        const percent = ((progress.tick / progress.maxTicks) * 100).toFixed(1);
        console.log(`  ${runIdFromFile}: ${progress.status} (${percent}%, ${progress.entityCount} entities)`);
      } catch {
        // ignore
      }
    }
    return;
  }

  const progressFile = path.join(outputDir, `${runId}-progress.json`);
  const logFile = path.join(outputDir, `${runId}-log.txt`);

  if (!fs.existsSync(progressFile)) {
    console.log(`Run not found: ${runId}`);
    return;
  }

  const progress = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
  const percent = ((progress.tick / progress.maxTicks) * 100).toFixed(1);

  console.log(`=== Run Status: ${runId} ===`);
  console.log(`  Status: ${progress.status}`);
  console.log(`  Progress: ${progress.tick}/${progress.maxTicks} (${percent}%)`);
  console.log(`  Entities: ${progress.entityCount}`);
  console.log(`  Energy: ${progress.totalEnergy.toFixed(0)}`);
  console.log(`  Artifacts: ${progress.artifactCount}`);
  console.log(`  Average age: ${progress.averageAge.toFixed(1)}`);
  console.log(`  Elapsed: ${progress.elapsedSeconds.toFixed(1)}s`);
  
  if (progress.estimatedRemainingSeconds !== undefined) {
    console.log(`  Estimated remaining: ${progress.estimatedRemainingSeconds.toFixed(0)}s`);
  }

  console.log('');
  console.log(`Log file: ${logFile}`);

  // 最新のログ行を表示
  if (fs.existsSync(logFile)) {
    const logContent = fs.readFileSync(logFile, 'utf-8');
    const lines = logContent.trim().split('\n');
    const recentLines = lines.slice(-5);
    console.log('');
    console.log('Recent log:');
    for (const line of recentLines) {
      console.log(`  ${line}`);
    }
  }
}

/**
 * バッチ実行
 */
async function runBatch(options: CLIOptions): Promise<void> {
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
    case 'status':
      checkStatus(options);
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

main().catch(console.error);
