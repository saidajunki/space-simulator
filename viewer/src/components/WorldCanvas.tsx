import { useRef, useEffect, useCallback } from 'react';
import { Application, Graphics, Container } from 'pixi.js';
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

// 資源量に応じた色（緑→黄→赤）
function resourceColor(resources: number, maxResources: number = 200): number {
  const ratio = Math.min(1, resources / maxResources);
  if (ratio > 0.5) {
    // 緑→黄
    const t = (ratio - 0.5) * 2;
    const r = Math.floor(255 * (1 - t));
    const g = 255;
    return (r << 16) | (g << 8) | 0;
  } else {
    // 黄→赤
    const t = ratio * 2;
    const r = 255;
    const g = Math.floor(255 * t);
    return (r << 16) | (g << 8) | 0;
  }
}

export function WorldCanvas({ state }: WorldCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const graphicsRef = useRef<{
    edges: Graphics;
    nodes: Graphics;
    entities: Graphics;
    artifacts: Graphics;
    labels: Container;
  } | null>(null);

  // Pixi.js初期化
  useEffect(() => {
    if (!containerRef.current) return;

    const initPixi = async () => {
      const app = new Application();
      await app.init({
        width: containerRef.current!.clientWidth,
        height: containerRef.current!.clientHeight,
        backgroundColor: 0x0f0f23,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // グラフィックスレイヤー作成
      const edges = new Graphics();
      const nodes = new Graphics();
      const entities = new Graphics();
      const artifacts = new Graphics();
      const labels = new Container();

      app.stage.addChild(edges);
      app.stage.addChild(nodes);
      app.stage.addChild(artifacts);
      app.stage.addChild(entities);
      app.stage.addChild(labels);

      graphicsRef.current = { edges, nodes, entities, artifacts, labels };
    };

    initPixi();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, []);

  // リサイズ対応
  useEffect(() => {
    const handleResize = () => {
      if (appRef.current && containerRef.current) {
        appRef.current.renderer.resize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 描画更新
  const draw = useCallback((state: SimulationState) => {
    if (!graphicsRef.current) return;

    const { edges, nodes, entities, artifacts, labels } = graphicsRef.current;
    const nodeMap = new Map(state.nodes.map(n => [n.id, n]));

    // クリア
    edges.clear();
    nodes.clear();
    entities.clear();
    artifacts.clear();
    labels.removeChildren();

    // エッジ描画
    for (const edge of state.edges) {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (from && to) {
        edges.moveTo(from.x, from.y);
        edges.lineTo(to.x, to.y);
        edges.stroke({ width: 1, color: 0x1e3a5f, alpha: 0.5 });
      }
    }

    // ノード描画
    for (const node of state.nodes) {
      const radius = 20 + Math.min(20, node.entityCount * 2);
      const color = resourceColor(node.resources);
      
      // ノード本体
      nodes.circle(node.x, node.y, radius);
      nodes.fill({ color, alpha: 0.3 });
      nodes.stroke({ width: 2, color, alpha: 0.8 });
      
      // Beacon効果（グロー）
      if (node.beaconStrength > 0) {
        const glowRadius = radius + Math.min(30, node.beaconStrength * 0.5);
        nodes.circle(node.x, node.y, glowRadius);
        nodes.fill({ color: 0xfbbf24, alpha: 0.1 });
      }
    }

    // アーティファクト描画（星形）
    for (const artifact of state.artifacts) {
      const node = nodeMap.get(artifact.nodeId);
      if (!node) continue;
      
      const size = 5 + Math.min(15, artifact.prestige * 0.1);
      const alpha = 0.5 + artifact.durability * 0.5;
      
      // 星形を描画
      drawStar(artifacts, node.x, node.y - 15, size, 5, 0.5);
      artifacts.fill({ color: 0xfbbf24, alpha });
      
      // 高Prestigeはグロー
      if (artifact.prestige > 50) {
        drawStar(artifacts, node.x, node.y - 15, size + 5, 5, 0.5);
        artifacts.fill({ color: 0xfbbf24, alpha: 0.2 });
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
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const count = nodeEntities.length;
      const angleStep = (2 * Math.PI) / Math.max(count, 1);
      const baseRadius = 25 + Math.min(15, count);

      nodeEntities.forEach((entity, i) => {
        const angle = angleStep * i;
        const x = node.x + baseRadius * Math.cos(angle);
        const y = node.y + baseRadius * Math.sin(angle);
        const color = TYPE_COLORS[entity.type % TYPE_COLORS.length] ?? 0x3b82f6;
        const alpha = 0.3 + Math.min(0.7, entity.energy / 100);
        const radius = 4;

        entities.circle(x, y, radius);
        entities.fill({ color, alpha });

        // 維持者はグロー
        if (entity.isMaintainer) {
          entities.circle(x, y, radius + 3);
          entities.fill({ color: 0xfbbf24, alpha: 0.3 });
        }
      });
    }
  }, []);

  // state変更時に再描画
  useEffect(() => {
    if (state) {
      draw(state);
    }
  }, [state, draw]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

// 星形を描画するヘルパー
function drawStar(
  graphics: Graphics,
  cx: number,
  cy: number,
  outerRadius: number,
  points: number,
  innerRatio: number
) {
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
