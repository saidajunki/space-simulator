/**
 * デバッグ: statsの内容を確認
 */

import { Universe, UniverseConfig } from '../src/core/universe.js';

const config: Partial<UniverseConfig> = {
  seed: 42,
  worldGen: {
    nodeCount: 12,
    edgeDensity: 0.4,
    initialEntityCount: 30,
  },
  resourceRegenerationRate: 0.016,
};

const universe = new Universe(config);

// 100 tick実行
for (let t = 0; t < 100; t++) {
  universe.step();
}

const stats = universe.getStats();

console.log('=== Stats Debug ===');
console.log('entityCount:', stats.entityCount);
console.log('artifactCount:', stats.artifactCount);
console.log('spatialDistribution type:', typeof stats.spatialDistribution);
console.log('spatialDistribution:', stats.spatialDistribution);
console.log('spatialDistribution size:', stats.spatialDistribution?.size);

if (stats.spatialDistribution) {
  console.log('\nEntries:');
  for (const [key, value] of stats.spatialDistribution.entries()) {
    console.log(`  ${key}: ${value}`);
  }
  
  const values = Array.from(stats.spatialDistribution.values());
  console.log('\nValues:', values);
  
  if (values.length > 0 && stats.entityCount > 0) {
    const shares = values.map(v => v / stats.entityCount);
    const hhi = shares.reduce((sum, s) => sum + s * s, 0);
    console.log('Shares:', shares);
    console.log('HHI:', hhi);
  }
}
