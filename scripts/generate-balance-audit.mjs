import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();
const unitDir = path.join(root, 'src/config/units');
const levelDir = path.join(root, 'src/config/levels');
const outputPath = path.join(root, 'design/11-balance-audit.md');

function readYamlDocuments(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const docs = [];
  yaml.loadAll(text, (doc) => {
    if (doc && typeof doc === 'object') docs.push(doc);
  });
  return docs.flatMap((doc) => Object.values(doc));
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function fmt(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '-';
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(digits)).toString();
}

function cell(value) {
  return String(value ?? '-').replaceAll('|', '\\|');
}

function dps(stats) {
  return (stats?.atk ?? 0) * (stats?.attackSpeed ?? 0);
}

function levelsForTower(unit) {
  const stats = unit.stats ?? {};
  const cost = unit.cost ?? {};
  const maxLevel = Math.max(
    1,
    1 + Math.max(
      Array.isArray(cost.upgrade) ? cost.upgrade.length : 0,
      Array.isArray(cost.atkGrowth) ? cost.atkGrowth.length : 0,
      Array.isArray(cost.rangeGrowth) ? cost.rangeGrowth.length : 0,
    ),
  );
  return buildLevelRows(unit, {
    maxLevel,
    hpGrowth: [],
    atkGrowth: cost.atkGrowth ?? [5, 8, 12, 16],
    rangeGrowth: cost.rangeGrowth ?? [20, 20, 30, 30],
    upgradeCosts: cost.upgrade ?? [],
  });
}

function levelsForSoldier(unit) {
  const cost = unit.cost ?? {};
  return buildLevelRows(unit, {
    maxLevel: cost.maxLevel ?? 3,
    hpGrowth: cost.hpGrowth ?? [40, 60],
    atkGrowth: cost.atkGrowth ?? [5, 8],
    rangeGrowth: [],
    upgradeCosts: cost.upgrade ?? [40, 60],
  });
}

function buildLevelRows(unit, growth) {
  const stats = unit.stats ?? {};
  const cost = unit.cost ?? {};
  const rows = [];
  let hp = stats.hp ?? 0;
  let atk = stats.atk ?? 0;
  let range = stats.range ?? 0;
  for (let level = 1; level <= growth.maxLevel; level += 1) {
    if (level > 1) {
      hp += growth.hpGrowth[level - 2] ?? 0;
      atk += growth.atkGrowth[level - 2] ?? 0;
      range += growth.rangeGrowth[level - 2] ?? 0;
    }
    rows.push({
      id: unit.id,
      name: unit.name,
      category: unit.category,
      level,
      hp,
      atk,
      attackSpeed: stats.attackSpeed ?? 0,
      dps: atk * (stats.attackSpeed ?? 0),
      defense: stats.armor ?? 0,
      mr: stats.mr ?? 0,
      range,
      damageType: stats.damageType ?? 'physical',
      cost: level === 1 ? cost.build : growth.upgradeCosts[level - 2],
    });
  }
  return rows;
}

function collectRuleNumbers(value, predicate, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectRuleNumbers(item, predicate, out);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  if (predicate(value)) out.push(value);
  for (const child of Object.values(value)) collectRuleNumbers(child, predicate, out);
  return out;
}

const units = fs.readdirSync(unitDir)
  .filter((file) => file.endsWith('.yaml'))
  .flatMap((file) => readYamlDocuments(path.join(unitDir, file)));

const towers = units.filter((unit) => unit.category === 'Tower');
const soldiers = units.filter((unit) => unit.category === 'Soldier');
const enemies = units.filter((unit) => unit.category === 'Enemy');
const traps = units.filter((unit) => unit.category === 'Trap');
const buildings = units.filter((unit) => unit.category === 'Building');
const objectives = units.filter((unit) => unit.category === 'Objective');
const neutrals = units.filter((unit) => unit.category === 'Neutral');

const towerRows = towers.flatMap(levelsForTower);
const soldierRows = soldiers.flatMap(levelsForSoldier);
const enemyRows = enemies.map((unit) => {
  const stats = unit.stats ?? {};
  const gold = unit.reward?.gold ?? 0;
  return {
    id: unit.id,
    name: unit.name,
    hp: stats.hp ?? 0,
    atk: stats.atk ?? 0,
    attackSpeed: stats.attackSpeed ?? 0,
    dps: dps(stats),
    defense: stats.armor ?? 0,
    mr: stats.mr ?? 0,
    speed: stats.speed ?? 0,
    range: stats.range ?? 0,
    damageType: stats.damageType ?? '-',
    gold,
    goldMin: Math.floor(gold * 0.8),
    goldMax: Math.floor(gold * 1.2),
    isBoss: unit.isBoss === true,
    attackMode: unit.behavior?.attackMode ?? '-',
  };
});

const staticRows = [...traps, ...buildings, ...objectives, ...neutrals].map((unit) => {
  const stats = unit.stats ?? {};
  const trap = unit.trap ?? {};
  return {
    id: unit.id,
    name: unit.name,
    category: unit.category,
    hp: stats.hp ?? 0,
    atk: stats.atk ?? 0,
    attackSpeed: stats.attackSpeed ?? 0,
    dps: dps(stats),
    defense: stats.armor ?? 0,
    mr: stats.mr ?? 0,
    trapDps: trap.damagePerSecond ?? 0,
    damage: trap.damage ?? 0,
  };
});

const spellLikeRows = units.flatMap((unit) => {
  const rows = [];
  for (const rule of collectRuleNumbers(unit, (item) => typeof item.damagePerSecond === 'number' || typeof item.dps === 'number')) {
    rows.push({
      source: `${unit.name} (${unit.id})`,
      type: rule.type ?? rule.id ?? 'effect',
      dps: rule.damagePerSecond ?? rule.dps,
      duration: rule.duration ?? rule.dotDuration ?? '-',
      radius: rule.radius ?? '-',
    });
  }
  for (const rule of collectRuleNumbers(unit, (item) => typeof item.dotDamage === 'number')) {
    rows.push({
      source: `${unit.name} (${unit.id})`,
      type: rule.type ?? rule.id ?? 'dot',
      dps: rule.dotDamage,
      duration: rule.dotDuration ?? rule.duration ?? '-',
      radius: rule.radius ?? '-',
    });
  }
  return rows;
});

const levels = fs.readdirSync(levelDir)
  .filter((file) => file.endsWith('.yaml'))
  .sort()
  .map((file) => ({ file, ...readYaml(path.join(levelDir, file)) }));

const waveRows = [];
const levelRows = [];
for (const level of levels) {
  let levelEnemyCount = 0;
  let levelGoldMin = level.starting?.gold ?? 0;
  let levelGoldMax = level.starting?.gold ?? 0;
  for (const wave of level.waves ?? []) {
    const enemiesInWave = (wave.enemies ?? []).map((group) => {
      const config = enemyRows.find((enemy) => enemy.id === group.enemyType);
      const count = group.count ?? 0;
      levelEnemyCount += count;
      levelGoldMin += (config?.goldMin ?? 0) * count;
      levelGoldMax += (config?.goldMax ?? 0) * count;
      return `${group.enemyType}×${count}`;
    });
    levelGoldMin += wave.reward ?? 0;
    levelGoldMax += wave.reward ?? 0;
    waveRows.push({
      level: `${level.name} (${level.id})`,
      wave: wave.waveNumber,
      groups: enemiesInWave.join(', '),
      count: (wave.enemies ?? []).reduce((sum, group) => sum + (group.count ?? 0), 0),
      reward: wave.reward ?? 0,
      boss: wave.isBossWave === true ? '是' : '',
    });
  }
  levelRows.push({
    level: `${level.name} (${level.id})`,
    waves: (level.waves ?? []).length,
    enemyCount: levelEnemyCount,
    startingGold: level.starting?.gold ?? 0,
    incomeMin: levelGoldMin,
    incomeMax: levelGoldMax,
  });
}

const issues = [];
for (const row of towerRows.filter((row) => row.level === 1)) {
  if (row.dps < 8 && row.category === 'Tower') issues.push(`- ${row.name} L1 基础 DPS 仅 ${fmt(row.dps)}，若没有控制或持续伤害补偿，前期击杀反馈偏弱。`);
}
for (const row of soldierRows.filter((row) => row.level === 1)) {
  if (row.defense >= 50 && row.dps < 5) issues.push(`- ${row.name} 是高防御前排但 DPS 只有 ${fmt(row.dps)}，定位合理；需要避免关卡强制依赖它输出。`);
  if (row.hp <= 90 && row.defense <= 5) issues.push(`- ${row.name} 生存值偏低（HP ${row.hp}, 防御 ${row.defense}），高压波次中需要靠射程或治疗保护。`);
}
for (const row of enemyRows) {
  if (row.attackSpeed === 0 && row.atk > 0 && row.attackMode !== 'none') issues.push(`- ${row.name} 配置 ATK ${row.atk} 但 attackSpeed=0 且 attackMode=${row.attackMode}，需要确认是否应通过自爆/技能造成伤害。`);
  if (row.gold > 0 && row.hp / row.gold > 35 && !row.isBoss) issues.push(`- ${row.name} HP/金币=${fmt(row.hp / row.gold)}，击杀耗时与经济回报可能偏亏。`);
  if (row.gold > 0 && row.hp / row.gold < 4 && !row.isBoss) issues.push(`- ${row.name} HP/金币=${fmt(row.hp / row.gold)}，可能成为刷钱目标。`);
}
for (const row of levelRows) {
  if (row.incomeMin < row.startingGold * 2) issues.push(`- ${row.level} 全关保底资源 ${row.incomeMin} 与初始金币 ${row.startingGold} 接近，容错可能较低。`);
}

function table(headers, rows) {
  const lines = [];
  lines.push(`| ${headers.map((h) => h.label).join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    lines.push(`| ${headers.map((h) => cell(h.value(row))).join(' | ')} |`);
  }
  return lines.join('\n');
}

const md = `# 数值总览与合理性审查

> 生成时间：2026-06-17
> 数据来源：\`src/config/units/*.yaml\`、\`src/config/levels/*.yaml\`
> 计算口径：攻击 DPS = ATK × attackSpeed；塔和士兵等级按 \`cost.*Growth\` 逐级累加；击杀金币范围按 \`reward.gold × 0.8 ~ 1.2\` 向下取整。波次统计仅包含 YAML 明确配置的敌人，不含运行时额外随机精英。

## 结论摘要

- 当前塔的基础 DPS 覆盖约 ${fmt(Math.min(...towerRows.filter((r) => r.level === 1).map((r) => r.dps)))} 到 ${fmt(Math.max(...towerRows.filter((r) => r.level === 1).map((r) => r.dps)))}，单体、AOE、控制、召唤型之间存在明显角色差异；高等级成长主要集中在后两级，形成偏后期的火力爆发。
- 士兵中盾卫明显是承伤单位，输出极低；弓手和法师生存低但射程长，符合远程单位定位，不过需要避免被突进/低空波次瞬间击杀。
- 敌人经济回报差异较大，部分高 HP 非 Boss 的 HP/金币比偏高，可能导致玩家感觉“打得久但没钱”；部分低 HP 敌人金币效率偏高，可作为奖励波，但不宜大量堆叠。
- 关卡资源预算应继续以保底金币核算，因为设计文档说明运行时每波还会额外生成随机精英，实际压力会高于本表波次数量。

## 塔：所有等级攻击/防御/血量

${table([
  { label: '单位', value: (r) => `${r.name} (${r.id})` },
  { label: '等级', value: (r) => `L${r.level}` },
  { label: 'HP', value: (r) => r.hp },
  { label: 'ATK', value: (r) => r.atk },
  { label: '攻速', value: (r) => fmt(r.attackSpeed, 2) },
  { label: 'DPS', value: (r) => fmt(r.dps, 1) },
  { label: '防御', value: (r) => r.defense },
  { label: '魔抗', value: (r) => r.mr },
  { label: '射程', value: (r) => r.range },
  { label: '伤害', value: (r) => r.damageType },
  { label: '建造/升级金币', value: (r) => r.cost ?? '-' },
], towerRows)}

## 士兵：所有等级攻击/防御/血量

${table([
  { label: '单位', value: (r) => `${r.name} (${r.id})` },
  { label: '等级', value: (r) => `L${r.level}` },
  { label: 'HP', value: (r) => r.hp },
  { label: 'ATK', value: (r) => r.atk },
  { label: '攻速', value: (r) => fmt(r.attackSpeed, 2) },
  { label: 'DPS', value: (r) => fmt(r.dps, 1) },
  { label: '防御', value: (r) => r.defense },
  { label: '魔抗', value: (r) => r.mr },
  { label: '射程', value: (r) => r.range },
  { label: '伤害', value: (r) => r.damageType },
  { label: '建造/升级金币', value: (r) => r.cost ?? '-' },
], soldierRows)}

## 敌人：攻击/防御/血量与掉落金币

${table([
  { label: '单位', value: (r) => `${r.name} (${r.id})` },
  { label: 'HP', value: (r) => r.hp },
  { label: 'ATK', value: (r) => r.atk },
  { label: '攻速', value: (r) => fmt(r.attackSpeed, 2) },
  { label: 'DPS', value: (r) => fmt(r.dps, 1) },
  { label: '防御', value: (r) => r.defense },
  { label: '魔抗', value: (r) => r.mr },
  { label: '速度', value: (r) => r.speed },
  { label: '射程', value: (r) => r.range },
  { label: '金币基准', value: (r) => r.gold },
  { label: '掉落范围', value: (r) => `${r.goldMin}-${r.goldMax}` },
], enemyRows)}

## 其他单位/陷阱

${table([
  { label: '单位', value: (r) => `${r.name} (${r.id})` },
  { label: '类别', value: (r) => r.category },
  { label: 'HP', value: (r) => r.hp },
  { label: 'ATK', value: (r) => r.atk },
  { label: '攻速', value: (r) => fmt(r.attackSpeed, 2) },
  { label: '攻击DPS', value: (r) => fmt(r.dps, 1) },
  { label: '防御', value: (r) => r.defense },
  { label: '魔抗', value: (r) => r.mr },
  { label: '陷阱DPS', value: (r) => fmt(r.trapDps, 1) },
  { label: '单次伤害', value: (r) => r.damage || '-' },
], staticRows)}

## 法术/持续伤害 DPS

${spellLikeRows.length > 0 ? table([
  { label: '来源', value: (r) => r.source },
  { label: '效果', value: (r) => r.type },
  { label: 'DPS', value: (r) => fmt(r.dps, 1) },
  { label: '持续', value: (r) => r.duration },
  { label: '半径', value: (r) => r.radius },
], spellLikeRows) : '当前配置未发现显式 `damagePerSecond` / `dps` / `dotDamage` 法术项。'}

## 波次敌人数量

${table([
  { label: '关卡', value: (r) => r.level },
  { label: '波次', value: (r) => r.wave },
  { label: '敌人', value: (r) => r.groups },
  { label: '数量', value: (r) => r.count },
  { label: '波次奖励', value: (r) => r.reward },
  { label: 'Boss波', value: (r) => r.boss },
], waveRows)}

## 关卡资源汇总

${table([
  { label: '关卡', value: (r) => r.level },
  { label: '波数', value: (r) => r.waves },
  { label: 'YAML敌人数', value: (r) => r.enemyCount },
  { label: '初始金币', value: (r) => r.startingGold },
  { label: '保底总金币', value: (r) => r.incomeMin },
  { label: '最高总金币', value: (r) => r.incomeMax },
], levelRows)}

## 不合理或需确认的数值点

${issues.length > 0 ? [...new Set(issues)].join('\n') : '- 未发现明显异常。'}

## 调整建议

- 优先把“HP/金币比”作为敌人经济手感指标：普通肉盾可高于杂兵，但非 Boss 长时间战斗不宜长期超过 35，否则容易形成拖时无收益。
- 对低 DPS 控制塔和坦克士兵，应在关卡卡池中明确配套输出来源，避免玩家抽到防守组件却缺少击杀能力。
- 对 Boss 波预算需要把随机精英也纳入验算；本表未计入额外精英，若实测压力偏高，应先调精英倍率或波次奖励，而不是只看 YAML 数量。
- 法术/陷阱的持续伤害项目前分布较少，后续如果扩充 DOT/地面效果，建议统一配置为显式 DPS、持续时间、半径，便于和塔 DPS 横向对比。
`;

fs.writeFileSync(outputPath, md, 'utf8');
console.log(`Wrote ${path.relative(root, outputPath)}`);
