import type { UnitConfig } from '../config/registry.js';
import type { CompositePart, ShapeType, UnitVisualParts } from '../types/index.js';

function visualSize(unit: UnitConfig): number {
  return unit.visual?.size ?? 28;
}

function visualColor(unit: UnitConfig): string {
  return unit.visual?.color ?? '#ffffff';
}

function shape(unit: UnitConfig, fallback: ShapeType): ShapeType {
  const raw = unit.visual?.shape;
  switch (raw) {
    case 'rect':
    case 'rectangle':
      return 'rect';
    case 'triangle':
    case 'diamond':
    case 'hexagon':
    case 'circle':
      return raw;
    default:
      return fallback;
  }
}

function part(
  shapeType: ShapeType,
  offsetX: number,
  offsetY: number,
  size: number,
  color: string,
  extras: Partial<CompositePart> = {},
): CompositePart {
  return {
    shape: shapeType,
    offsetX,
    offsetY,
    size,
    color,
    ...extras,
  };
}

function darkStroke(unit: UnitConfig): string {
  switch (unit.category) {
    case 'Tower':
      return '#1f2a33';
    case 'Trap':
      return '#2c211c';
    case 'Enemy':
      return '#3a1010';
    case 'Soldier':
    default:
      return '#102027';
  }
}

function soldierParts(unit: UnitConfig): UnitVisualParts {
  const size = visualSize(unit);
  const color = visualColor(unit);
  const id = unit.id;
  const bodyParts: CompositePart[] = [
    part('circle', 0, size * 0.18, size * 0.72, '#000000', { alpha: 0.16 }),
    part('rect', 0, size * 0.12, size * 0.78, '#263238', { h: size * 0.18, alpha: 0.9, stroke: darkStroke(unit), strokeWidth: 1 }),
    part('circle', -size * 0.18, -size * 0.22, size * 0.18, '#e0f7fa', { alpha: 0.85 }),
  ];

  let weapon: UnitVisualParts['weapon'] | undefined;
  if (id.includes('archer')) {
    weapon = { anchorX: size * 0.42, anchorY: -size * 0.02, length: size * 0.88, width: 3, color: '#6d4c41', stroke: '#3e2723', strokeWidth: 1, restAngle: -0.35, swingAngle: 0.45 };
    bodyParts.push(part('triangle', -size * 0.2, -size * 0.24, size * 0.25, '#81c784', { rotation: -0.2 }));
  } else if (id.includes('shield')) {
    weapon = { anchorX: size * 0.46, anchorY: size * 0.02, length: size * 0.58, width: size * 0.16, color: '#b0bec5', stroke: '#455a64', strokeWidth: 1, restAngle: 1.3, swingAngle: 0.2 };
    bodyParts.push(part('diamond', -size * 0.42, size * 0.02, size * 0.52, '#80deea', { stroke: '#006064', strokeWidth: 2 }));
  } else if (id.includes('priest')) {
    weapon = { anchorX: size * 0.44, anchorY: -size * 0.08, length: size * 0.8, width: 4, color: '#fff59d', stroke: '#f9a825', strokeWidth: 1, restAngle: -0.85, swingAngle: 0.35, glowColor: '#fff176', glowRadius: size * 0.5, glowAlpha: 0.18 };
    bodyParts.push(part('circle', 0, -size * 0.35, size * 0.22, '#fff176', { alpha: 0.9 }));
  } else if (id.includes('engineer')) {
    weapon = { anchorX: size * 0.45, anchorY: size * 0.03, length: size * 0.65, width: size * 0.14, color: '#ffb74d', stroke: '#e65100', strokeWidth: 1, restAngle: 0.15, swingAngle: 0.55 };
    bodyParts.push(part('rect', 0, -size * 0.42, size * 0.56, '#ffcc80', { h: size * 0.12, stroke: '#ef6c00', strokeWidth: 1 }));
  } else if (id.includes('assassin')) {
    weapon = { anchorX: size * 0.44, anchorY: -size * 0.02, length: size * 0.7, width: 3, color: '#cfd8dc', stroke: '#37474f', strokeWidth: 1, restAngle: -0.75, swingAngle: 1.15 };
    bodyParts.push(part('triangle', 0, -size * 0.36, size * 0.5, '#212121', { alpha: 0.8 }));
  } else {
    weapon = { anchorX: size * 0.43, anchorY: -size * 0.02, length: size * 0.82, width: 4, color: '#eceff1', stroke: '#455a64', strokeWidth: 1, restAngle: -0.55, swingAngle: 0.9 };
  }

  bodyParts.push(part('circle', -size * 0.2, -size * 0.2, size * 0.16, '#ffffff', { alpha: 0.45 }));

  return {
    bodyParts,
    weapon,
    bobStyle: 'walking',
  };
}

function towerParts(unit: UnitConfig): UnitVisualParts {
  const size = visualSize(unit);
  const color = visualColor(unit);
  const id = unit.id;
  const accent = id.includes('ice') ? '#b3e5fc'
    : id.includes('lightning') ? '#fff176'
      : id.includes('laser') ? '#f48fb1'
        : id.includes('cannon') ? '#ffcc80'
          : id.includes('bat') ? '#ce93d8'
            : '#e1f5fe';

  const bodyParts: CompositePart[] = [
    part('circle', 0, size * 0.28, size * 1.08, '#000000', { alpha: 0.18 }),
    part('rect', 0, size * 0.18, size * 0.92, '#455a64', { h: size * 0.28, stroke: '#263238', strokeWidth: 2 }),
    part('circle', 0, -size * 0.05, size * 0.64, color, { stroke: darkStroke(unit), strokeWidth: 2 }),
    part('circle', 0, -size * 0.05, size * 0.34, accent, { alpha: 0.85 }),
  ];

  if (id.includes('cannon') || id.includes('missile')) {
    bodyParts.push(part('rect', size * 0.36, -size * 0.13, size * 0.72, '#37474f', { h: size * 0.18, stroke: '#102027', strokeWidth: 1 }));
    bodyParts.push(part('circle', size * 0.72, -size * 0.13, size * 0.2, '#212121'));
  } else if (id.includes('lightning')) {
    bodyParts.push(part('triangle', 0, -size * 0.48, size * 0.42, '#fff59d', { stroke: '#fbc02d', strokeWidth: 1 }));
    bodyParts.push(part('rect', 0, -size * 0.24, size * 0.14, '#fffde7', { h: size * 0.46, alpha: 0.9 }));
  } else if (id.includes('laser')) {
    bodyParts.push(part('diamond', 0, -size * 0.38, size * 0.46, '#ff80ab', { stroke: '#ad1457', strokeWidth: 1 }));
    bodyParts.push(part('circle', 0, -size * 0.38, size * 0.18, '#ffffff', { alpha: 0.85 }));
  } else if (id.includes('bat')) {
    bodyParts.push(part('triangle', -size * 0.36, -size * 0.18, size * 0.38, '#4a148c', { rotation: -0.4 }));
    bodyParts.push(part('triangle', size * 0.36, -size * 0.18, size * 0.38, '#4a148c', { rotation: 0.4 }));
  } else {
    bodyParts.push(part('rect', size * 0.34, -size * 0.18, size * 0.62, '#6d4c41', { h: size * 0.12, stroke: '#3e2723', strokeWidth: 1 }));
    bodyParts.push(part('triangle', size * 0.68, -size * 0.18, size * 0.22, '#eceff1'));
  }

  return { bodyParts, bobStyle: 'static' };
}

function trapParts(unit: UnitConfig): UnitVisualParts {
  const size = visualSize(unit);
  const color = visualColor(unit);
  const id = unit.id;
  const bodyParts: CompositePart[] = [
    part('circle', 0, size * 0.12, size * 1.12, '#000000', { alpha: 0.14 }),
    part(shape(unit, 'circle'), 0, 0, size * 0.88, color, { alpha: 0.9, stroke: darkStroke(unit), strokeWidth: 1 }),
  ];

  if (id.includes('spike')) {
    bodyParts.push(part('triangle', -size * 0.28, -size * 0.18, size * 0.42, '#cfd8dc'));
    bodyParts.push(part('triangle', 0, -size * 0.22, size * 0.5, '#eceff1'));
    bodyParts.push(part('triangle', size * 0.28, -size * 0.18, size * 0.42, '#cfd8dc'));
  } else if (id.includes('bear')) {
    bodyParts.push(part('diamond', -size * 0.22, 0, size * 0.48, '#a1887f', { stroke: '#4e342e', strokeWidth: 1 }));
    bodyParts.push(part('diamond', size * 0.22, 0, size * 0.48, '#a1887f', { stroke: '#4e342e', strokeWidth: 1 }));
    bodyParts.push(part('rect', 0, 0, size * 0.58, '#eceff1', { h: size * 0.1 }));
  } else if (id.includes('tar')) {
    bodyParts.push(part('circle', 0, 0, size * 0.62, '#111111', { alpha: 0.8 }));
    bodyParts.push(part('circle', -size * 0.18, -size * 0.12, size * 0.18, '#616161', { alpha: 0.55 }));
  } else {
    bodyParts.push(part('rect', -size * 0.16, -size * 0.12, size * 0.42, '#eceff1', { h: size * 0.08, rotation: -0.45, alpha: 0.8 }));
    bodyParts.push(part('circle', size * 0.18, size * 0.1, size * 0.2, '#ffffff', { alpha: 0.25 }));
  }

  return { bodyParts, bobStyle: 'static' };
}

function enemyParts(unit: UnitConfig): UnitVisualParts {
  const size = visualSize(unit);
  const color = visualColor(unit);
  const id = unit.id;
  const flying = unit.layer === 'LowAir' || id.includes('bat') || id.includes('locust') || id.includes('plane') || id.includes('drone') || id.includes('balloon');
  const boss = unit['isBoss'] === true || id.includes('boss') || id.includes('lord') || id.includes('queen') || id.includes('giant') || id.includes('lucifer');
  const bodyParts: CompositePart[] = [
    part('circle', 0, size * 0.22, size * (flying ? 0.6 : 0.82), '#000000', { alpha: flying ? 0.08 : 0.16 }),
    part(shape(unit, boss ? 'hexagon' : 'circle'), 0, 0, size * 0.92, color, { stroke: boss ? '#ffd54f' : darkStroke(unit), strokeWidth: boss ? 2 : 1 }),
    part('circle', -size * 0.18, -size * 0.2, size * 0.18, '#ffffff', { alpha: 0.35 }),
  ];

  if (flying) {
    bodyParts.push(part('triangle', -size * 0.46, -size * 0.02, size * 0.46, '#5d4037', { alpha: 0.85, rotation: -0.25 }));
    bodyParts.push(part('triangle', size * 0.46, -size * 0.02, size * 0.46, '#5d4037', { alpha: 0.85, rotation: 0.25 }));
  } else if (id.includes('tank') || id.includes('robot') || id.includes('mech')) {
    bodyParts.push(part('rect', 0, size * 0.2, size * 0.86, '#455a64', { h: size * 0.24, stroke: '#263238', strokeWidth: 1 }));
    bodyParts.push(part('rect', size * 0.36, -size * 0.1, size * 0.58, '#263238', { h: size * 0.14 }));
  } else if (id.includes('beetle') || id.includes('bug') || id.includes('locust')) {
    bodyParts.push(part('rect', 0, 0, size * 0.12, '#4e342e', { h: size * 0.82, alpha: 0.6 }));
    bodyParts.push(part('triangle', -size * 0.34, -size * 0.14, size * 0.28, '#3e2723', { rotation: -0.3 }));
    bodyParts.push(part('triangle', size * 0.34, -size * 0.14, size * 0.28, '#3e2723', { rotation: 0.3 }));
  } else {
    bodyParts.push(part('triangle', -size * 0.28, -size * 0.34, size * 0.24, '#3e2723', { rotation: -0.25 }));
    bodyParts.push(part('triangle', size * 0.28, -size * 0.34, size * 0.24, '#3e2723', { rotation: 0.25 }));
  }

  if (boss) {
    bodyParts.push(part('circle', 0, 0, size * 1.25, '#ffd54f', { alpha: 0.18, stroke: '#ffecb3', strokeWidth: 1 }));
  }

  return {
    bodyParts,
    bobStyle: flying ? 'floating' : 'walking',
  };
}

export function getProceduralVisualParts(unit: UnitConfig): UnitVisualParts {
  const explicit = unit['visualParts'] as UnitVisualParts | undefined;
  let generated: UnitVisualParts;
  switch (unit.category) {
    case 'Tower':
      generated = towerParts(unit);
      break;
    case 'Trap':
      generated = trapParts(unit);
      break;
    case 'Enemy':
      generated = enemyParts(unit);
      break;
    case 'Soldier':
    default:
      generated = soldierParts(unit);
      break;
  }

  if (!explicit) return generated;

  return {
    ...generated,
    ...explicit,
    bodyParts: explicit.bodyParts && explicit.bodyParts.length > 0 ? explicit.bodyParts : generated.bodyParts,
    eyes: undefined,
    weapon: explicit.weapon ?? generated.weapon,
    bobStyle: explicit.bobStyle ?? generated.bobStyle,
  };
}
