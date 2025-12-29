import type { SimulationStats } from 'universe-simulation';

interface StatsPanelProps {
  stats: SimulationStats | null;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  if (!stats) {
    return (
      <div className="stats-panel">
        <h2>Statistics</h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
          Start simulation to see stats
        </p>
      </div>
    );
  }

  const totalEnergy = (stats.entityEnergy ?? 0) + (stats.freeEnergy ?? 0) + (stats.wasteHeat ?? 0);
  const entityPct = totalEnergy > 0 ? ((stats.entityEnergy ?? 0) / totalEnergy) * 100 : 0;
  const freePct = totalEnergy > 0 ? ((stats.freeEnergy ?? 0) / totalEnergy) * 100 : 0;
  const wastePct = totalEnergy > 0 ? ((stats.wasteHeat ?? 0) / totalEnergy) * 100 : 0;

  return (
    <div className="stats-panel">
      <h2>Statistics</h2>

      <div className="stats-section">
        <h3>Population</h3>
        <div className="stat-row">
          <span className="label">Entities</span>
          <span className="value">{stats.entityCount}</span>
        </div>
        <div className="stat-row">
          <span className="label">Avg Age</span>
          <span className="value">{stats.averageAge.toFixed(1)}</span>
        </div>
        <div className="stat-row">
          <span className="label">Replications</span>
          <span className="value positive">+{stats.replicationCount}</span>
        </div>
        <div className="stat-row">
          <span className="label">Deaths</span>
          <span className="value negative">-{stats.deathCount}</span>
        </div>
      </div>

      <div className="stats-section">
        <h3>Artifacts</h3>
        <div className="stat-row">
          <span className="label">Count</span>
          <span className="value">{stats.artifactCount}</span>
        </div>
        <div className="stat-row">
          <span className="label">Total Prestige</span>
          <span className="value">{(stats.totalPrestige ?? 0).toFixed(0)}</span>
        </div>
        <div className="stat-row">
          <span className="label">Avg Beacon</span>
          <span className="value">{(stats.avgBeaconStrength ?? 0).toFixed(1)}</span>
        </div>
        <div className="stat-row">
          <span className="label">Maintainers</span>
          <span className="value">{stats.maintainerCount ?? 0}</span>
        </div>
        <div className="stat-row">
          <span className="label">Max Age</span>
          <span className="value">{stats.maxArtifactAge ?? 0}</span>
        </div>
      </div>

      <div className="stats-section">
        <h3>Energy</h3>
        <div className="stat-row">
          <span className="label">Entity</span>
          <span className="value">{(stats.entityEnergy ?? 0).toFixed(0)}</span>
        </div>
        <div className="stat-row">
          <span className="label">Free</span>
          <span className="value">{(stats.freeEnergy ?? 0).toFixed(0)}</span>
        </div>
        <div className="stat-row">
          <span className="label">Waste Heat</span>
          <span className="value">{(stats.wasteHeat ?? 0).toFixed(0)}</span>
        </div>
        
        <div className="energy-bar">
          <div 
            className="energy-segment entity" 
            style={{ width: `${entityPct}%` }} 
          />
          <div 
            className="energy-segment free" 
            style={{ width: `${freePct}%` }} 
          />
          <div 
            className="energy-segment waste" 
            style={{ width: `${wastePct}%` }} 
          />
        </div>
        
        <div className="energy-legend">
          <div className="legend-item">
            <div className="legend-dot entity" />
            <span>Entity</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot free" />
            <span>Free</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot waste" />
            <span>Waste</span>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <h3>Diversity</h3>
        <div className="stat-row">
          <span className="label">Types</span>
          <span className="value">{stats.typeDistribution?.size ?? 0}</span>
        </div>
        <div className="stat-row">
          <span className="label">Total Mass</span>
          <span className="value">{(stats.totalMass ?? 0).toFixed(0)}</span>
        </div>
        <div className="stat-row">
          <span className="label">Reactions</span>
          <span className="value">{stats.reactionCount ?? 0}</span>
        </div>
        <div className="stat-row">
          <span className="label">Spatial Gini</span>
          <span className="value">{(stats.spatialGini ?? 0).toFixed(3)}</span>
        </div>
      </div>
    </div>
  );
}
