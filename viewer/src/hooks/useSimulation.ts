import { useState, useRef, useCallback, useEffect } from 'react';
import { Universe } from 'universe-simulation';
import type { UniverseConfig, SimulationStats } from 'universe-simulation';

export interface SimulationConfig {
  seed: number;
  maxTicks: number;
  nodes: number;
  entities: number;
  maxTypes: number;
}

export interface SimulationState {
  tick: number;
  nodes: NodeState[];
  entities: EntityState[];
  artifacts: ArtifactState[];
  edges: EdgeState[];
}

export interface NodeState {
  id: string;
  x: number;
  y: number;
  resources: number;
  entityCount: number;
  artifactCount: number;
  beaconStrength: number;
  wasteHeat: number;
}

export interface EntityState {
  id: string;
  nodeId: string;
  energy: number;
  type: number;
  isMaintainer: boolean;
}

export interface ArtifactState {
  id: string;
  nodeId: string;
  durability: number;
  prestige: number;
}

export interface EdgeState {
  id: string;
  from: string;
  to: string;
}

export function useSimulation(config: SimulationConfig) {
  const [state, setState] = useState<SimulationState | null>(null);
  const [stats, setStats] = useState<SimulationStats | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  
  const universeRef = useRef<Universe | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // ノード位置を計算（force-directed風の配置）
  const calculateNodePositions = useCallback((nodeCount: number) => {
    const positions = new Map<string, { x: number; y: number }>();
    const centerX = 400;
    const centerY = 300;
    const radius = Math.min(300, 150 + nodeCount * 5);
    
    for (let i = 0; i < nodeCount; i++) {
      const angle = (2 * Math.PI * i) / nodeCount;
      const r = radius * (0.5 + 0.5 * Math.random());
      positions.set(`node-${i}`, {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      });
    }
    
    return positions;
  }, []);

  // シミュレーション状態を抽出
  const extractState = useCallback((universe: Universe): SimulationState => {
    const tick = universe.time.getTick();
    const allNodes = universe.space.getAllNodes();
    const allEntities = universe.getAllEntities();
    const allArtifacts = universe.getAllArtifacts();
    const allEdges = universe.space.getAllEdges();
    const landscape = universe.getLandscape();
    
    // ノード位置がなければ計算
    if (nodePositionsRef.current.size === 0) {
      nodePositionsRef.current = calculateNodePositions(allNodes.length);
    }
    
    const landscapeMap = new Map(landscape.map(l => [l.nodeId, l]));
    
    const nodes: NodeState[] = allNodes.map(node => {
      const pos = nodePositionsRef.current.get(node.id) ?? { x: 400, y: 300 };
      const info = landscapeMap.get(node.id);
      return {
        id: node.id,
        x: pos.x,
        y: pos.y,
        resources: info?.resources ?? 0,
        entityCount: info?.entityCount ?? 0,
        artifactCount: info?.artifactCount ?? 0,
        beaconStrength: info?.beaconStrength ?? 0,
        wasteHeat: info?.wasteHeat ?? 0,
      };
    });
    
    const entities: EntityState[] = allEntities.map(entity => ({
      id: entity.id,
      nodeId: entity.nodeId,
      energy: entity.energy,
      type: entity.type ?? 0,
      isMaintainer: (entity.maintainerUntilTick ?? 0) > tick,
    }));
    
    const artifacts: ArtifactState[] = allArtifacts.map(artifact => ({
      id: artifact.id,
      nodeId: artifact.nodeId,
      durability: artifact.durability,
      prestige: artifact.prestige ?? 0,
    }));
    
    const edges: EdgeState[] = allEdges.map(edge => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
    }));
    
    return { tick, nodes, entities, artifacts, edges };
  }, [calculateNodePositions]);

  // シミュレーションループ
  const tick = useCallback(() => {
    if (!universeRef.current || !isRunning) return;
    
    const now = performance.now();
    const interval = 1000 / (10 * speed); // 基本10fps × speed
    
    if (now - lastTickRef.current >= interval) {
      universeRef.current.step();
      const newState = extractState(universeRef.current);
      const newStats = universeRef.current.getStats();
      
      setState(newState);
      setStats(newStats);
      lastTickRef.current = now;
      
      // 絶滅チェック
      if (newStats.entityCount === 0) {
        setIsRunning(false);
        return;
      }
    }
    
    animationRef.current = requestAnimationFrame(tick);
  }, [isRunning, speed, extractState]);

  // isRunning変更時にループ開始/停止
  useEffect(() => {
    if (isRunning) {
      lastTickRef.current = performance.now();
      animationRef.current = requestAnimationFrame(tick);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, tick]);

  // 開始
  const start = useCallback(() => {
    nodePositionsRef.current = new Map();
    
    const universeConfig: Partial<UniverseConfig> = {
      seed: config.seed,
      worldGen: {
        nodeCount: config.nodes,
        initialEntityCount: config.entities,
        maxTypes: config.maxTypes,
      },
    };
    
    universeRef.current = new Universe(universeConfig);
    const initialState = extractState(universeRef.current);
    const initialStats = universeRef.current.getStats();
    
    setState(initialState);
    setStats(initialStats);
    setIsRunning(true);
  }, [config, extractState]);

  // 一時停止
  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  // 再開
  const resume = useCallback(() => {
    if (universeRef.current) {
      setIsRunning(true);
    }
  }, []);

  // 1ステップ
  const step = useCallback(() => {
    if (!universeRef.current) {
      start();
      setIsRunning(false);
      return;
    }
    
    setIsRunning(false);
    universeRef.current.step();
    const newState = extractState(universeRef.current);
    const newStats = universeRef.current.getStats();
    setState(newState);
    setStats(newStats);
  }, [start, extractState]);

  return {
    state,
    stats,
    isRunning,
    speed,
    start,
    pause,
    resume,
    step,
    setSpeed,
  };
}
