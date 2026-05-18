# 历史存档：合并前旧文档（v3.5 合并前）

> 存档日期：2026-05-18  
> 对应 commit：`HEAD~1`（合并前最后一个状态）

本目录保存的是 `design/` 目录在**合并为单层 10 文件结构之前**的完整旧文档。

## 目录结构

原始子目录结构完整保留：

```
00-vision/          项目愿景与验收
10-gameplay/        玩法与系统（roguelike 循环、经济、地图、天气…）
20-units/           单位与战斗（科技树、技能、战斗公式…）
30-ai/              AI 行为（士兵 AI、行为树已废弃文档）
40-presentation/    视觉表现层（UI/UX、渲染、音效…）
50-data-numerical/  数值权威源（50-mda.md）
60-tech/            技术与工具（架构、存档、调试、编辑器…）
_plans/             开发计划
archive/            原有 archive 子目录（更早期历史文档）
dev-logs/           每日开发日志（2026-05-10 ~ 2026-05-16）
v3.4-MAJOR-MIGRATION.md
v3.5-MAJOR-MIGRATION.md
```

## 当前有效文档

合并后的有效文档在 `design/` 根目录，共 10 个文件：

| 文件 | 内容 |
|------|------|
| `OVERVIEW.md` | 愿景、验收、核心循环 |
| `GAMEPLAY.md` | 玩法、卡牌、天气、波次 |
| `LEVELS.md` | 8 关主题、蓝图、路线图 |
| `UNITS.md` | 7 塔、6 兵、敌方单位、战斗公式 |
| `TECH-TREE.md` | 科技树、Crystal 升级、卡牌等级 |
| `AI.md` | 士兵四状态机、规则引擎路径 |
| `UI.md` | HUD、手牌、商店、秘境、主菜单 |
| `VISUALS.md` | 渲染 11 层、复合几何、特效、音效 |
| `NUMBERS.md` | 全局数值权威源 |
| `TECH.md` | 架构、ECS、存档、调试、编辑器 |
