# Handoff — Post-MVP Batch C-E 完成，F1 待续

> 生成时间: 2026-05-16 (Asia/Shanghai)
> 主动 handoff 原因：context 70.3%，命中上下文铁律阈值（≥70%）。
> 续跑请新建会话，第一动作读本文件。

---

## 1. User Requests (As-Is)

- 历史指令仍生效：roguelike 重构、不再用行为树、token 接近上限直接 handoff
- 技术细节不问用户，AI 自决；只在产品体验/架构边界变更时询问
- 本会话指令：从 handoff 继续执行 post-mvp-refactor Batch C-F

## 2. Final Goal

按 `design/_plans/post-mvp-refactor.md` Batch A-F 计划推进至完成。

---

## 3. 本会话完成进度

| 批次 | 任务 | commit | 状态 |
|------|------|--------|------|
| Batch F2 (草稿提交) | deckSize=12, handSize=4 | `6a543c1` | ✅ |
| Batch C1 | level-02~08 available.towers 统一为 6 种 (arrow/cannon/ice/lightning/laser/bat) | `e7a50fc` | ✅ |
| Batch D2 | 14 秘境事件池 YAML + 随机选 1 + effect handler | `4cf0de7` | ✅ |
| Batch D1 | 商店 8 槽双行（前4单位卡随机 + 后4功能卡） | `2491c6f` | ✅ |
| Batch E1 | towers.yaml skillTree 字段 + parseSkillTreeFromUnitYaml | `e14ce49` | ✅ |

### Verification State（HEAD = e14ce49）

- 分支 `rougelike-v34`，ahead origin 10 commits（均未 push）
- 工作树：`.memory/handoffs/_latest.md` 和 `.memory/handoffs/dev-log-2026-05-16-wave7-perf.md` 已修改（handoff 文件本身）
- `npm run typecheck` ✅（本会话全程 typecheck 通过）
- `npm test` ✅ 312 passed（包含 ShopPanel.test.ts 回归修复）

---

## 4. 未完成任务（剩余 Batch F1 + E2）

### Batch F1 — 能量模型：每波开始一次性 +5E（S1 替换）[LOW]

**简化点 S1**：当前 `ENERGY_REGEN_PER_SECOND = 1`（持续自动恢复），设计稿规格是**每波开始时一次性恢复 +5E**（不是持续恢复）。

**改法分析**：
- `EnergySystem` 当前有 `regenPerSecond` + `tick(dt)` 持续恢复机制
- 设计稿 `11-economy.md` §2.1：「每波开始恢复 +5（不超过上限 10）」
- 需要：在 WaveSystem 波次开始时调用 `energySystem.restoreForWave(5)`
- 具体实现方式：
  1. 把 `ENERGY_REGEN_PER_SECOND = 0` （关闭持续恢复）
  2. 在 main.ts 的 `onWaveStart` 回调里调用 `energySystem.restoreForWave(5)`（新增方法）
  3. 或保留现有 `tick`，但在 WaveSystem 中发出 wave_start 事件，由外部加能量

- 文件：`src/unit-system/EnergySystem.ts`（加 `addEnergy(amount)` 方法）、`src/main.ts`（onWaveStart 回调里调用）、`const ENERGY_REGEN_PER_SECOND = 0`

**注意**：EnergySystem 有单测，改动后需跑测试。WaveSystem 的 onWaveStart 回调在 main.ts 里是否已有？需确认。

### Batch E2 — 技能树接 RuleEngine（S18）[LOW]

技能树效果（boost_attack_speed / add_extra_target）目前不接入 RuleEngine，只是客户端状态。这是架构级改动，优先级低，可以继续推迟。

---

## 5. Active Working Context

### Branch & HEAD

- 分支 `rougelike-v34`，HEAD `e14ce49`，ahead origin 10，均未 push

### 关键架构变更（本会话）

**商店 8 槽**（2491c6f）：
- `ShopItemKind` 新增 `'restore-crystal-hp' | 'recycle-card' | 'buy-skill-point'`
- `PurchaseResult` 新增 `itemKind` 字段（ShopPanel.test.ts 已同步更新）
- `buildShopState()` 随机从 6 种塔卡选 4 张 + 固定 4 个功能槽
- `ShopRenderer.itemRect()` 改为 4列双行布局
- `RunManager.healCrystal()` 新增（restore-crystal-hp effect 处理）

**秘境 14 事件池**（4cf0de7）：
- 14 个 YAML 在 `src/config/mystic-events/`
- `parseMysticEventConfig()` 解析每个 YAML
- effect handler 支持：`grant_gold`, `grant_sp`, `spend_gold`, `heal_crystal`, `deal_crystal_damage`, `spend_gold_percent`, `grant_gold_or_damage`, `grant_sp_tiered`

**技能树 YAML 化**（e14ce49）：
- `src/config/units/towers.yaml` arrow_tower 段新增 `skillTree` 字段
- `loader.ts` 新增 `parseSkillTreeFromUnitYaml()` + `SkillTreeConfigFromYaml` 类型
- `main.ts` 用 `arrowTowerSkillTree`（从 YAML 加载）替代 `ARROW_TOWER_SKILL_TREE`（保留为 fallback）

### MVP 简化点残存状态

| 编号 | 简化点 | 状态 |
|------|-------|------|
| S1 | 能量 1E/s 自动恢复 → 每波 +5E | 🟡 Batch F1 |
| S2 | 卡组 12 张 | ✅ 已完成 |
| S8 | 商店 8 槽 | ✅ 已完成 |
| S9 | 秘境 14 事件池 | ✅ 已完成 |
| S15 | 6 塔卡激活 | ✅ 已完成 |
| S18 | 技能树绕过 RuleEngine | 🟡 Batch E2 |
| S19 | 技能树用 TS 常量 | ✅ 已完成 |

---

## 6. Explicit Constraints

- 中文沟通；原子提交；roguelike 重构铁律
- 接近 token 上限直接 handoff
- 技术细节不问用户

---

## 7. 续跑会话第一动作

```
1. 读本文件 .memory/handoffs/_latest.md
2. git log --oneline -5（确认 HEAD = e14ce49）
3. git status（确认工作树 clean）
4. 执行 Batch F1：
   a. EnergySystem 加 addEnergy(amount) 方法
   b. main.ts: ENERGY_REGEN_PER_SECOND = 0，onWaveStart 回调里 energySystem.addEnergy(5)
   c. 确认 WaveSystem 有 onWaveStart 回调（grep onWaveStart in main.ts）
   d. 跑 npm test 确保回归
5. 按需继续 Batch E2（低优先级）
```

**执行优先级**：F1（能量模型）→ E2（技能树接 RuleEngine，可推迟）
