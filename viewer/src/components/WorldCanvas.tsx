import { useRef, useEffect, useCallback } from 'react';
import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';
import type { SimulationState, EntityState } from '../hooks/useSimulation';

interface WorldCanvasProps {
  state: SimulationState | null;
}

// タイプごとの色
const TYPE_COLORS = [
  0x3b82f6, // blue
  0xef4444, // red
  0x22c55e, // green
  0xf59e0b, // amber
  0x8b5cf6, // violet
  0xec4899, // pink
  0x06b6d4, // cyan
  0xf97316, // orange
  0x84cc16, // lime
  0x6366f1, // indigo
];

// 資源量に応じた色（暗い茶色→緑）
function resourceColor(resources: number, maxResources: number = 200): number {
  const ratio = Math.min(1, Math.max(0, resources / maxResources));
  const r1 = 0x3d, g1 = 0x28, b1 = 0x17;
  const r2 = 0x22, g2 = 0x8b, b2 = 0x22;
  const r = Math.floor(r1 + (r2 - r1) * ratio);
  const g = Math.floor(g1 + (g2 - g1) * ratio);
  const b = Math.floor(b1 + (b2 - b1) * ratio);
  return (r << 16) | (g << 8) | b;
}

export function WorldCanvas({ state }: WorldCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const graphicsRef = useRef<{
    terrain: Graphics;
    sunlight: Graphics;
    heatOverlay: Graphics;
    edges: Graphics;
    entities: Graphics;
    artifacts: Graphics;
    labels: Container;
  } | null>(null);
  const gridRef = useRef<{ cols: number; rows: number; cellSize: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const initPixi = async () => {
      const app = new Application();
      await app.init({
        width: containerRef.current!.clientWidth,
        height: containerRef.current!.clientHeight,
        backgroundColor: 0x1a1a2e,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      const terrain = new Graphics();
      const sunlight = new Graphics();   // 太陽光エフェクト
      const heatOverlay = new Graphics();
      const edges = new Graphics();
      const artifacts = new Graphics();
      const entities = new Graphics();
      const labels = new Container();

      app.stage.addChild(terrain);
      app.stage.addChild(sunlight);
      app.stage.addChild(heatOverlay);
      app.stage.addChild(edges);
      app.stage.addChild(artifacts);
      app.stage.addChild(entities);
      app.stage.addChild(labels);

      graphicsRef.current = { terrain, sunlight, heatOverlay, edges, entities, artifacts, labels };
    };

    initPixi();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (appRef.current && containerRef.current) {
        appRef.current.renderer.resize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
        gridRef.current = null;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const calculateGrid = useCallback((nodeCount: number, width: number, height: number) => {
    const aspectRatio = width / height;
    const cols = Math.ceil(Math.sqrt(nodeCount * aspectRatio));
    const rows = Math.ceil(nodeCount / cols);
    const cellWidth = width / cols;
    const cellHeight = height / rows;
    const cellSize = Math.min(cellWidth, cellHeight);
    return { cols, rows, cellSize };
  }, []);

  const getNodePosition = useCallback((index: number, grid: { cols: number; rows: number; cellSize: number }, width: number, height: number) => {
    const col = index % grid.cols;
    const row = Math.floor(index / grid.cols);
    const offsetX = (width - grid.cols * grid.cellSize) / 2;
    const offsetY = (height - grid.rows * grid.cellSize) / 2;
    return {
      x: offsetX + col * grid.cellSize + grid.cellSize / 2,
      y: offsetY + row * grid.cellSize + grid.cellSize / 2,
      cellSize: grid.cellSize,
    };
  }, []);

  const draw = useCallback((state: SimulationState) => {
    if (!graphicsRef.current || !appRef.current) return;

    const { terrain, sunlight, heatOverlay, edges, entities, artifacts, labels } = graphicsRef.current;
    const width = appRef.current.screen.width;
    const height = appRef.current.screen.height;

    if (!gridRef.current) {
      gridRef.current = calculateGrid(state.nodes.length, width, height);
    }
    const grid = gridRef.current;

    const nodePositions = new Map(state.nodes.map((n, i) => {
      const pos = getNodePosition(i, grid, width, height);
      return [n.id, pos];
    }));

    terrain.clear();
    sunlight.clear();
    heatOverlay.clear();
    edges.clear();
    entities.clear();
    artifacts.clear();
    labels.removeChildren();

    const padding = 4;
    const cellInner = grid.cellSize - padding * 2;

    // 地形描画
    for (const node of state.nodes) {
      const pos = nodePositions.get(node.id);
      if (!pos) continue;
      const color = resourceColor(node.resources);
      const x = pos.x - cellInner / 2;
      const y = pos.y - cellInner / 2;
      terrain.roundRect(x, y, cellInner, cellInner, 4);
      terrain.fill({ color, alpha: 0.9 });
      const borderWidth = 1 + Math.min(3, node.entityCount * 0.5);
      terrain.roundRect(x, y, cellInner, cellInner, 4);
      terrain.stroke({ width: borderWidth, color: 0x4a5568, alpha: 0.5 });
    }

    // 太陽光エフェクト（資源回復量を可視化）
    for (const node of state.nodes) {
      const pos = nodePositions.get(node.id);
      if (!pos) continue;
      
      // 回復量 = (容量 - 現在値) * 0.008
      const capacity = node.resourceCapacity || 200;
      const regeneration = (capacity - node.resources) * 0.008;
      
      if (regeneration > 0.1) {
        // 上から降り注ぐ光線
        const intensity = Math.min(1, regeneration / 2);
        const rayWidth = cellInner * 0.3;
        const x = pos.x;
        const y = pos.y - cellInner / 2;
        
        // 光線（上から）
        sunlight.moveTo(x - rayWidth / 2, 0);
        sunlight.lineTo(x - rayWidth / 4, y);
        sunlight.lineTo(x + rayWidth / 4, y);
        sunlight.lineTo(x + rayWidth / 2, 0);
        sunlight.closePath();
        sunlight.fill({ color: 0xffd700, alpha: intensity * 0.15 });
        
        // セル上部のグロー
        sunlight.circle(x, y, cellInner * 0.4);
        sunlight.fill({ color: 0xffd700, alpha: intensity * 0.2 });
      }
    }

    // 廃熱オーバーレイ
    for (const node of state.nodes) {
      const pos = nodePositions.get(node.id);
      if (!pos || node.wasteHeat < 1) continue;
      const alpha = Math.min(0.6, node.wasteHeat / 100);
      const x = pos.x - cellInner / 2;
      const y = pos.y - cellInner / 2;
      heatOverlay.roundRect(x, y, cellInner, cellInner, 4);
      heatOverlay.fill({ color: 0xff4444, alpha });
    }

    // エッジ描画
    for (const edge of state.edges) {
      const from = nodePositions.get(edge.from);
      const to = nodePositions.get(edge.to);
      if (from && to) {
        edges.moveTo(from.x, from.y);
        edges.lineTo(to.x, to.y);
        edges.stroke({ width: 1, color: 0x2d3748, alpha: 0.3 });
      }
    }

    // アーティファクト描画
    const artifactsByNode = new Map<string, typeof state.artifacts>();
    for (const artifact of state.artifacts) {
      const list = artifactsByNode.get(artifact.nodeId) ?? [];
      list.push(artifact);
      artifactsByNode.set(artifact.nodeId, list);
    }

    for (const [nodeId, nodeArtifacts] of artifactsByNode) {
      const pos = nodePositions.get(nodeId);
      if (!pos) continue;
      const maxShow = Math.min(4, nodeArtifacts.length);
      const artSize = Math.min(8, cellInner / 4);
      for (let i = 0; i < maxShow; i++) {
        const artifact = nodeArtifacts[i]!;
        const ax = pos.x - cellInner / 4 + (i % 2) * artSize * 1.5;
        const ay = pos.y - cellInner / 4 + Math.floor(i / 2) * artSize * 1.5;
        const alpha = 0.5 + artifact.durability * 0.5;
        const size = artSize * (0.5 + Math.min(0.5, artifact.prestige / 100));
        drawStar(artifacts, ax, ay, size, 4, 0.5);
        artifacts.fill({ color: 0xfbbf24, alpha });
        if (artifact.prestige > 30) {
          artifacts.circle(ax, ay, size + 4);
          artifacts.fill({ color: 0xfbbf24, alpha: 0.15 });
        }
      }
      if (nodeArtifacts.length > 4) {
        const label = new Text({ text: `+${nodeArtifacts.length - 4}`, style: new TextStyle({ fontSize: 10, fill: 0xfbbf24, fontFamily: 'monospace' }) });
        label.x = pos.x + cellInner / 4 - 10;
        label.y = pos.y + cellInner / 4 - 10;
        labels.addChild(label);
      }
    }

    // エンティティ描画
    const entityByNode = new Map<string, EntityState[]>();
    for (const entity of state.entities) {
      const list = entityByNode.get(entity.nodeId) ?? [];
      list.push(entity);
      entityByNode.set(entity.nodeId, list);
    }

    for (const [nodeId, nodeEntities] of entityByNode) {
      const pos = nodePositions.get(nodeId);
      if (!pos) continue;
      const count = nodeEntities.length;
      const maxShow = Math.min(16, count);
      const entitySize = Math.max(3, Math.min(6, cellInner / 8));
      const gridSize = Math.ceil(Math.sqrt(maxShow));
      const spacing = cellInner / (gridSize + 1);

      for (let i = 0; i < maxShow; i++) {
        const entity = nodeEntities[i]!;
        const col = i % gridSize;
        const row = Math.floor(i / gridSize);
        const ex = pos.x - cellInner / 2 + spacing * (col + 1);
        const ey = pos.y - cellInner / 2 + spacing * (row + 1);
        const color = TYPE_COLORS[entity.type % TYPE_COLORS.length] ?? 0x3b82f6;
        const alpha = 0.4 + Math.min(0.6, entity.energy / 100);
        entities.circle(ex, ey, entitySize);
        entities.fill({ color, alpha });
        if (entity.isMaintainer) {
          entities.circle(ex, ey, entitySize + 2);
          entities.stroke({ width: 1.5, color: 0xfbbf24, alpha: 0.8 });
        }
      }

      if (count > 16) {
        const label = new Text({ text: `${count}`, style: new TextStyle({ fontSize: 11, fill: 0xffffff, fontFamily: 'monospace', fontWeight: 'bold' }) });
        label.x = pos.x - 8;
        label.y = pos.y + cellInner / 2 - 14;
        labels.addChild(label);
      }
    }

    // 資源量ラベル
    for (const node of state.nodes) {
      const pos = nodePositions.get(node.id);
      if (!pos) continue;
      const resLabel = new Text({ text: `${Math.floor(node.resources)}`, style: new TextStyle({ fontSize: 9, fill: 0x94a3b8, fontFamily: 'monospace' }) });
      resLabel.x = pos.x + cellInner / 2 - 20;
      resLabel.y = pos.y + cellInner / 2 - 12;
      labels.addChild(resLabel);
    }
  }, [calculateGrid, getNodePosition]);

  useEffect(() => {
    if (state) draw(state);
  }, [state, draw]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

function drawStar(graphics: Graphics, cx: number, cy: number, outerRadius: number, points: number, innerRatio: number) {
  const innerRadius = outerRadius * innerRatio;
  const step = Math.PI / points;
  graphics.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + step * i;
    graphics.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  graphics.closePath();
}
