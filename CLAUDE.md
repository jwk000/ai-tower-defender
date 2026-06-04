# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

卡牌驱动的关卡制塔防游戏，带轻度肉鸽元素。5个主题关卡，玩家拖拽卡牌部署塔/士兵/机关守卫水晶。TypeScript + Vite + bitecs ECS + Canvas 2D渲染 + Preact UI + YAML配置。

## Commands

```bash
npm run dev          # 开发服务器 localhost:3000
npm run build        # tsc --noEmit && vite build（类型错误=构建失败）
npm run typecheck    # 仅类型检查
npm test             # 运行全部 vitest 单元测试
npx vitest run src/path/to/file.test.ts   # 运行单个测试文件
npx vitest run -t "test name"             # 按名称匹配测试
npm run test:e2e     # Playwright E2E 测试
```

**提交前必须**: `npm run typecheck && npm test` 均通过。

## 核心铁律（详见 AGENTS.md）

1. **每完成一个任务立即提交** — `feat/fix/refactor: <描述>`，不累积、不等待
2. **不破坏已有功能** — 修改前理解模块服务的所有需求，修改后验证关联需求
3. **TDD** — 先写测试（红）→ 实现（绿）→ 重构（保持绿）。禁止删测试、skip断言
4. **不问实现细节** — 只问产品设计/架构边界/需求歧义。实现细节自己决策：匹配现有风格 → 最佳实践 → 最简单方案

**Roguelike重构例外**: 明确标记的玩法重构可用 `refactor(roguelike):` 前缀提交，可推翻旧功能，但需：设计文档先行、构建通过、新测试覆盖、原子提交。

## 架构：四层设计

**配置驱动 + 规则引擎 + bitecs ECS + Canvas 2D渲染**

### ECS（bitecs）

- 组件：纯数据，SoA布局，定义在 `src/core/components.ts`
- 系统：实现 `{ name: string; update(world, dt): void }`，在 `main.ts` 的 `initBattle()` 中注册
- 实体延迟销毁：`destroyEntity(eid)` 标记，帧末 `cleanupDeadEntities()` 统一清理
- **8阶段管线顺序**（不可随意调换）：
  1. `PHASE_MANAGERS` — 经济/波次/天气管理器
  2. `PHASE_VFX` — 死亡/爆炸/闪电/激光视觉计时
  3. `PHASE_MODIFIERS` — Buff/治疗状态修改
  4. `PHASE_GAMEPLAY` — 移动/攻击/弹道/技能/陷阱/生产
  5. `PHASE_LIFECYCLE` — 生命周期事件分发 + 死亡检测
  6. `PHASE_CREATION` — 建造/实体创建
  7. `PHASE_AI` — AI执行
  8. `PHASE_RENDER` — `RenderSystem` + `UISystem`，始终最后

### 规则引擎

- `src/core/RuleEngine.ts` — 配置驱动的事件分发
- `src/core/RuleHandlers.ts` — 内置handler（explode, deal_aoe_damage, apply_buff, spawn_unit等）
- 生命周期事件：onCreate / onDeath / onHit / onAttack / onKill / onUpgrade / onDestroy
- 流程：系统检测事件 → `ruleEngine.dispatch()` → 查找单位YAML配置 → 执行RuleHandler
- **新增规则**：在 `RuleHandlers.ts` 注册handler，在单位YAML中引用，无需改系统代码

### 配置系统

- YAML文件通过 `import.meta.glob` 在构建时打包，无运行时fetch
- 单位：`src/config/units/` — towers, soldiers, enemies, buildings, neutrals, objectives
- 卡牌：`src/config/cards/` — towers, soldiers, spells, traps, production
- 关卡：`src/config/levels/` — level-01 到 level-05
- 注册表：`UnitConfigRegistry`（`src/config/registry.ts`）、`CardConfigRegistry`（`src/config/cardRegistry.ts`）

### 渲染

- Canvas 2D命令缓冲渲染器 `src/render/Renderer.ts`
- 设计分辨率 1920×1080，`LayoutManager` 基于高度等比缩放
- 所有视觉元素为程序化几何图形（rect, circle, triangle, diamond, hexagon, arrow）
- `RenderSystem`（1300+行）：地图瓦片、实体Y排序渲染、血条、Boss特效、复合士兵渲染

### 游戏循环（`src/core/Game.ts`）

1. `renderer.beginFrame()` — 清屏 + 设计空间变换
2. `input.flush()` — 派发排队的输入事件
3. 系统更新（未暂停时）→ `world.cleanupDeadEntities()`
4. `onAfterUpdate` — 阶段转换、自动存档
5. `renderer.endFrame()` — 排序 + 绘制
6. `onPostRender` — 后处理特效

### 输入派发

- `InputManager` 事件入队，每帧 `flush()` 处理
- 优先级：UI按钮 → 手牌区拖卡 → 战场建造放置 → 单位选择

## 开发约定

- **始终用中文回复**
- **设计先行**：`design/` 目录下的设计文档是事实来源，代码必须与文档一致
- **TypeScript严格模式**：`noUncheckedIndexedAccess`、`noImplicitOverride`
- **路径别名**：`@/*`、`@core/*`、`@components/*`、`@systems/*`、`@data/*`、`@ui/*`、`@render/*`、`@input/*`、`@utils/*`、`@types/*`
- **无linter/formatter**：仅编辑器级别格式化
- **设计分辨率**：所有UI/游戏逻辑在 1920×1080 坐标空间中工作

## 新增内容指南

- **新单位**：在 `src/config/units/` 添加YAML，无需改代码
- **新卡牌**：在 `src/config/cards/` 添加YAML，通过 `unitConfigId` 关联单位
- **新关卡**：在 `src/config/levels/` 添加YAML
- **新规则handler**：在 `src/core/RuleHandlers.ts` 注册，在单位YAML中引用
- **新ECS组件**：在 `src/core/components.ts` 用 `defineComponent()` 定义
- **新系统**：实现 `System` 接口，在 `main.ts` 的 `initBattle()` 中注册到对应阶段

## 关键文件

| 文件 | 作用 |
|------|------|
| `src/main.ts` | 入口，系统注册，屏幕管理 |
| `src/core/Game.ts` | 游戏循环基类 |
| `src/core/World.ts` | bitecs World包装 |
| `src/core/components.ts` | 所有ECS组件定义 |
| `src/core/RuleEngine.ts` | 规则引擎 |
| `src/core/RuleHandlers.ts` | 内置规则handler |
| `src/config/loader.ts` | YAML配置加载 |
| `src/config/registry.ts` | 单位配置注册表 |
| `src/config/cardRegistry.ts` | 卡牌配置注册表 |
| `src/render/Renderer.ts` | Canvas 2D渲染器 |
| `src/systems/RenderSystem.ts` | 主渲染系统 |
| `src/ui/LayoutManager.ts` | 响应式布局 |
| `src/input/InputManager.ts` | 输入管理 |
| `design/README.md` | 设计文档入口 |
