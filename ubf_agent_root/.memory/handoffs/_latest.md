# Handoff — Post-MVP 重构 Batch A+B 完成，C-F 待续

> 生成时间: 2026-05-16 (Asia/Shanghai)
> 主动 handoff 原因：context 73.6%，命中上下文铁律阈值（≥70%）。
> 续跑请新建会话，第一动作读本文件。

---

## 1. User Requests (As-Is)

- 历史指令仍生效：roguelike 重构、不再用行为树、token 接近上限直接 handoff
- 技术细节不问用户，AI 自决；只在产品体验/架构边界变更时询问
- **本会话新指令**："从 handoff 继续，列出下一步重构计划任务拆分文档，开始执行"

## 2. Final Goal

从 MVP 验收完成后，推进 Post-MVP 重构，按 `design/_plans/post-mvp-refactor.md` Batch A-F 计划执行。

---

## 3. 本会话完成进度

| 批次 | 任务 | commit | 状态 |
|------|------|--------|------|
| 计划文档 | 创建 `design/_plans/post-mvp-refactor.md`（Batch A-F 拆分） | `ac6eb27` | ✅ |
| Batch A1 | design/ 文档碎片字眼批量清理（MIGRATION 第4轮） | `47a7d0c` | ✅ |
| Batch A2 | 21-unit-roster + 23-skill-buff 反向 cross-ref 修复 | `f6add59` | ✅ |
| Batch B | RunManager totalLevels=8 + 多关卡切换 + crystalHp 跨关继承 | `b0737bd` | ✅ |

### Verification State（HEAD = ac6eb27）

- 分支 `rougelike-v34`，ahead origin 4 commits（均未 push）
- 工作树 clean
- `npm run typecheck` ✅（312 tests passed，Batch B 后新增1个集成测试）
- `npm test` ✅ 312 passed
- `npm run build` ✅

---

## 4. 未完成任务（续跑 Batch C-F）

详细规格见 `design/_plans/post-mvp-refactor.md`，以下是重点：

### Batch C1 — 6 种塔全部激活（S15 替换）[HIGH]

**简化点 S15**：当前 DeckSystem pool 只用 arrow_tower_card + cannon_tower_card 两张。
YAML 中有 6 张（ice/lightning/laser/bat 另外4张），需要激活。

- 文件：`src/unit-system/DeckSystem.ts` pool 构造逻辑，`src/main.ts`（cardIds 构建逻辑）
- 当前 `src/main.ts` 第116行：`const cardIds = cardConfigs.map((c) => c.id);` — 已经全取所有 card！
- 关键：`src/config/loader.ts` 的 `loadCardConfigsForLevel` 是否过滤了某些卡？
- 先读 `loadCardConfigsForLevel` 确认，再看 level-01.yaml 的 `cardPool` 字段

实际上 `level-01.yaml` 可能有 cardPool 字段限制了可用卡。需要检查后决定是扩展 L1 的 cardPool，还是改 main.ts 逻辑。

### Batch D1 — 商店 8 槽（S8 替换）[MEDIUM]

- 文件：`src/ui/ShopPanel.ts`，`src/render/PanelRenderers.ts`，`src/main.ts` 的 `buildShopState()`
- 当前：2 槽固定（grunt_card 30G + sp_exchange 50G→1SP）
- 目标：8 槽双栏（前4单位卡 30/60/120/240G + 后4功能卡，按 48-shop-redesign-v34 §1）
- 依赖：level YAML 的 shopPool 字段（需检查 level-01.yaml 是否有）

### Batch D2 — 秘境 14 事件池（S9 替换）[MEDIUM]

- 文件：`src/config/mystic-events/`，`src/ui/MysticPanel.ts`，`src/main.ts` MVP_MYSTIC_EVENT
- 当前：1 个固定事件（获得 10 金币）
- 目标：14 事件池随机 3 选 1（按 27-traps-spells-scene §5）
- 参考文档：`design/20-units/27-traps-spells-scene.md` §5（14 事件 + 5/14 高风险）

### Batch E1 — 技能树 YAML 化（S19 替换）[MEDIUM]

- 文件：`src/config/units/towers.yaml`（添加 skillTree 字段），`src/ui/SkillTreePanel.ts`（读 YAML 而非 TS 常量）
- 当前：箭塔技能树用 TS 常量 `ARROW_TOWER_SKILL_TREE`（第24行 import）
- 参考：`design/20-units/22-skill-tree-overview.md` YAML schema，`design/20-units/22a-skill-tree-tower.md` 箭塔详设

### Batch F2 — 卡组 12 张（S2 替换）[MEDIUM]

- 文件：`src/unit-system/DeckSystem.ts`，`src/main.ts`（deckSystem deckSize=5 → 12）
- 当前 main.ts 第117行：`new DeckSystem({ pool: cardIds, deckSize: 5, rng: Math.random })`
- 目标：deckSize: 12（per 10-roguelike-loop §2.3）

---

## 5. Active Working Context

### Branch & HEAD

- 分支 `rougelike-v34`，HEAD `ac6eb27`，ahead origin 4，均未 push
- 旧分支 `rougelike` 冻结（v3.3 归档，禁动）

### 关键架构变更（本会话）

**多关卡支持**（b0737bd）：
- `RunController` 新增 `onLevelStart?: (levelNumber: number) => void` 回调
- `main.ts` 预加载 level-01.yaml ~ level-08.yaml（`import.meta.env` 动态加载模式）
- 关卡切换时：WaveSystem 重建（新关配置）、MovementSystem path 更新、LevelState 重置
- ECS 清理：关卡切换时销毁所有 UnitTag/Projectile 实体（保留 Crystal）

### MVP 简化点残存状态

| 编号 | 简化点 | 状态 |
|------|-------|------|
| S1 | 能量 1 E/s 自动恢复 | 🟡 Batch F1 |
| S2 | 卡组 8 张（→12 张） | 🟡 Batch F2 |
| S8 | 商店 2 槽（→8 槽） | 🟡 Batch D1 |
| S9 | 秘境 1 事件（→14 事件池） | 🟡 Batch D2 |
| S15 | L1 卡池 2 塔卡（→6 塔卡） | 🟡 Batch C1 |
| S18 | 技能树绕过 RuleEngine | 🟡 Batch E2 |
| S19 | 技能树用 TS 常量（→YAML） | 🟡 Batch E1 |

---

## 6. Explicit Constraints

- 中文沟通；原子提交；roguelike 重构铁律
- 接近 token 上限直接 handoff
- 技术细节不问用户

---

## 7. 续跑会话第一动作

```
1. 读本文件 .memory/handoffs/_latest.md
2. git log --oneline -5（确认 HEAD = ac6eb27）
3. git status（确认工作树 clean）
4. 从 Batch C1（6种塔激活）开始，先读 src/config/loader.ts 的 loadCardConfigsForLevel 和 level-01.yaml 的 cardPool 字段
5. 按 design/_plans/post-mvp-refactor.md 顺序继续执行
```

**执行优先级**：C1（6塔激活）→ D2（秘境14事件）→ D1（商店8槽）→ F2（卡组12张）→ E1（技能树YAML化）→ F1（能量模型）→ E2（技能树接RuleEngine）
