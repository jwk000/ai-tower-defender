# Post-MVP 重构任务计划

> **版本**：1.0
> **创建日期**：2026-05-16
> **依据**：MVP 验收完成（311 tests 全绿）；design/v3.4-MAJOR-MIGRATION.md 第4轮；mvp-v3.4-rewrite.md P1-P7 路线图
> **执行原则**：原子提交 · 回归铁律 · 中文沟通

---

## 状态总览

| 批次 | 范围 | 状态 | 预估 |
|------|------|------|------|
| **Batch A** | 文档清理（MIGRATION 第4轮轻量版） | ⏳ 待做 | 0.5 天 |
| **Batch B** | 多关卡支持（L1→L8 Run 连闯） | ⏳ 待做 | 1 天 |
| **Batch C** | 内容扩展（更多单位 + 卡种） | ⏳ 待做 | 2 天 |
| **Batch D** | 商店 + 秘境完整化（S8/S9 替换） | ⏳ 待做 | 1 天 |
| **Batch E** | 技能树完整化（S10 替换） | ⏳ 待做 | 2 天 |
| **Batch F** | 能量模型升级（S1 替换） | ⏳ 待做 | 1 天 |

---

## Batch A — 文档清理（MIGRATION 第4轮轻量版）

> MIGRATION §3.4 原计划 18 个一般文档逐一删"碎片"字眼。
> 代码层：src/ 已无 shard/碎片，本批次纯文档。

### A1 — 设计文档碎片字眼扫描修复

- **文件范围**：design/ 目录下全部 .md（排除 archive/ 和 dev-logs/）
- **动作**：`grep -r "碎片\|shard\|shardBalance" design/ --include="*.md" -l | grep -v archive/ | grep -v dev-logs/` → 逐一删除"碎片"字眼，按 §2.3 清单处理
- **完成标准**：`grep -r "碎片" design/ --include="*.md" | grep -v archive | grep -v dev-logs` 返回 0 命中（除自声明引用）
- **测试要求**：无需测试，仅文档变更
- **提交**：`docs(v3.4): remove shard references from general design docs (MIGRATION round-4 docs)`

### A2 — cross-ref 反向链接修复（21-unit-roster + 23-skill-buff）

- **文件**：`design/20-units/21-unit-roster.md` §2.3 + `design/20-units/23-skill-buff.md` §6
- **动作**：按 MIGRATION §3.3 第7-8项说明，更新到技能树字段 cross-ref
- **完成标准**：两文件顶部无"⚠ v3.4 重构中"预警条悬空
- **提交**：`docs(v3.4): fix reverse cross-refs in unit-roster and skill-buff (MIGRATION round-4)`

---

## Batch B — 多关卡 Run 连闯

> 当前 MVP：RunManager totalLevels=1，只有 L1 可玩。
> 目标：支持 L1→L8 连闯（8 关 YAML 已存在）。

### B1 — WaveSystem 完整化（波次 spawn 完整流程）

- **文件**：`src/systems/WaveSystem.ts`，`src/__tests__/Wave2.integration.test.ts`
- **动作**：WaveSystem 支持从关卡 YAML 读 waves 字段，按间隔 spawn 敌人；Wave 结束触发 onWaveComplete 事件
- **完成标准**：现有 Wave2.integration.test.ts 全绿；新增 WaveSystem 单元测试覆盖 wave 切换
- **提交**：`feat(wave): complete WaveSystem with level YAML wave scheduling`

### B2 — RunManager totalLevels=8 + 多关切换

- **文件**：`src/unit-system/RunManager.ts`，`src/main.ts`
- **动作**：main.ts 传 totalLevels=8；completeLevel() 在非终局时加载下一关 YAML；crystalHp 跨关继承（S3 替换：关卡通关后 3选1单位卡抽卡）
- **完成标准**：run.integration.test.ts 新增 L1→L2 切换用例通过
- **简化点替换**：S3（关卡通关 3选1单位卡抽卡，10-roguelike-loop §2.6）
- **提交**：`feat(run): enable 8-level run with cross-level state carry`

### B3 — MovementSystem 多路径支持

- **文件**：`src/systems/MovementSystem.ts`，`src/main.ts`
- **动作**：MovementSystem 从 LevelState.path 读路径；关卡切换时重置 MovementSystem 路径；验证 L2（折线路径）敌人走位正确
- **完成标准**：MovementSystem.test.ts 新增多路径用例；浏览器 L1→L2 路径切换目测正确
- **提交**：`feat(movement): multi-path support for level switching`

---

## Batch C — 内容扩展（更多单位 + 卡种）

> 当前：仅 arrow_tower + cannon_tower（以及部分 YAML 中定义的其他单位）
> 目标：激活 6 种塔卡 + 6 种士兵卡 + 9 种陷阱卡 + 14 种法术卡（按 P1 范围）

### C1 — 6 种塔全部激活（YAML 已存在）

- **文件**：`src/config/cards/towers.yaml`，`src/unit-system/DeckSystem.ts`，`src/config/units/towers.yaml`
- **动作**：DeckSystem pool 扩展到 towers.yaml 中全部 6 张塔卡（ice/lightning/laser/bat 替换 S15 简化）；确保 UnitFactory 能从 YAML 读取对应单位配置创建实体
- **简化点替换**：S15（L1 卡池 6 张全塔卡）
- **完成标准**：content.integration.test.ts 验证 6 种塔卡均可从 deck 抽到并 spawn 实体
- **提交**：`feat(content): activate all 6 tower cards (replace S15)`

### C2 — 士兵 YAML 接入战斗系统

- **文件**：`src/config/units/soldiers.yaml`，`src/systems/AttackSystem.ts`
- **动作**：士兵单位走 UnitFactory 创建 + 按 YAML 配置的 targetSelection/attackMode 行为；盾卫（shield）激活并可被卡牌 spawn
- **完成标准**：新增士兵集成测试，spawn 盾卫后在战斗中正确行为（近战攻击敌人）
- **提交**：`feat(content): activate soldier units with rule-engine AI`

### C3 — 陷阱 YAML 接入（置于格子触发）

- **文件**：`src/config/units/traps.yaml`，`src/systems/LifecycleSystem.ts`，`src/input/InputManager.ts`
- **动作**：陷阱卡 drop 到 path 格子上触发 onEnter 事件伤害敌人；HandPanel 支持 trap 类型卡牌放置逻辑
- **完成标准**：陷阱放置后敌人经过时触发伤害事件
- **提交**：`feat(content): activate trap units with path-tile trigger mechanic`

### C4 — 法术卡完整化（fire_ball + 更多法术）

- **文件**：`src/config/units/spells.yaml`，`src/unit-system/SpellCastSystem.ts`
- **动作**：spells.yaml 中法术通过 SpellCastSystem → RuleEngine 触发 deal_aoe_damage/apply_buff 等 handler；fire_ball 为基准验证
- **完成标准**：法术卡集成测试，fire_ball 命中敌人并扣 HP
- **提交**：`feat(content): activate spell cards via SpellCastSystem`

### C5 — 生产建筑激活（金矿 + 能量水晶）

- **文件**：`src/config/units/production.yaml`，`src/systems/EconomySystem.ts`
- **动作**：金矿每 N 秒产金币；能量水晶每波产能量（为 S1 替换铺路）
- **完成标准**：content.integration.test.ts 验证金矿产金逻辑
- **提交**：`feat(content): activate production buildings (gold mine + energy crystal)`

---

## Batch D — 商店 + 秘境完整化

### D1 — 商店 8 槽完整实现（S8 替换）

- **文件**：`src/ui/ShopPanel.ts`，`src/render/PanelRenderers.ts`，`src/main.ts`
- **动作**：ShopPanel 支持最多 8 个 ShopItem（前 4 单位卡槽 + 后 4 功能卡槽）；按 50-mda §14 价格：30/60/120/240G；ShopRenderer 双栏布局
- **简化点替换**：S8（商店 2 槽 → 8 槽）
- **完成标准**：ShopPanel.test.ts 更新覆盖 8 槽逻辑；ShopRenderer 目测双栏渲染
- **提交**：`feat(shop): upgrade to 8-slot two-column shop layout (replace S8)`

### D2 — 秘境 14 事件池（S9 替换）

- **文件**：`src/config/mystic-events.yaml`，`src/ui/MysticPanel.ts`，`src/main.ts`
- **动作**：mystic-events.yaml 扩展到 14 个事件（按 27-traps-spells-scene §5）；5/14 高风险事件带特殊样式；MysticPanel 随机呈现 3 个事件供选择
- **简化点替换**：S9（秘境 2 事件 → 14 事件池）
- **完成标准**：MysticEvent.test.ts 验证 14 事件 schema；运行时秘境随机 3 选 1
- **提交**：`feat(mystic): expand to 14-event pool with high-risk events (replace S9)`

---

## Batch E — 技能树完整化

### E1 — 技能树 YAML 化（S19 替换）

- **文件**：`src/config/units/towers.yaml`（添加 skillTree 字段），`src/ui/SkillTreePanel.ts`
- **动作**：arrow_tower YAML 增加 skillTree 字段（按 22-skill-tree-overview YAML schema）；SkillTreePanel 从 CardRegistry 读 skillTree 而非 TS 常量
- **简化点替换**：S19（TS 常量 → YAML）
- **完成标准**：SkillTreePanel.test.ts 验证从 YAML 加载技能树并解锁节点
- **提交**：`feat(skilltree): migrate arrow tower skill tree from TS constant to YAML (replace S19)`

### E2 — 技能树效果接入 AttackSystem（S18 替换）

- **文件**：`src/ui/SkillTreePanel.ts`，`src/systems/AttackSystem.ts`，`src/core/RuleEngine.ts`
- **动作**：技能树节点 effects[] 通过 RuleEngine.dispatch 分发（替代当前直改 ECS 组件路径）；AttackSystem 读取技能树 buff 修正攻速/目标数
- **简化点替换**：S18（绕过 RuleEngine → 走 RuleEngine dispatch）
- **完成标准**：集成测试：解锁 Quick Draw 节点后 AttackSystem 攻速正确变化
- **提交**：`feat(skilltree): route skill tree effects through RuleEngine (replace S18)`

### E3 — 其余单位技能树接入（22a 箭塔完整 2 路径 6 节点）

- **文件**：`src/config/units/towers.yaml`，`src/ui/SkillTreePanel.ts`
- **动作**：按 22a-skill-tree-tower.md，箭塔实现完整 2 路径 × 3 节点（精准连射 + 穿透箭）
- **完成标准**：箭塔技能树 6 节点全部可解锁并有效果
- **提交**：`feat(skilltree): implement arrow tower full 2-path 6-node skill tree per 22a`

---

## Batch F — 能量模型升级

### F1 — EnergySystem 接入波次触发（S1 替换）

- **文件**：`src/unit-system/EnergySystem.ts`，`src/systems/WaveSystem.ts`，`src/main.ts`
- **动作**：每波开始 +5 能量；击杀敌人触发 onDeath RuleHandler 返还能量；保留 fallback 自动恢复作可配置选项
- **简化点替换**：S1（1 E/s 自动恢复 → 每波 +5 + 击杀回能）
- **完成标准**：EnergySystem.test.ts 新增波次触发用例；combat.integration.test.ts 验证击杀回能
- **提交**：`feat(energy): upgrade energy model to wave-trigger + kill-regen (replace S1)`

### F2 — 卡组 12 张（S2 替换）

- **文件**：`src/unit-system/DeckSystem.ts`，`src/unit-system/__tests__/DeckSystem.test.ts`
- **动作**：DeckSystem 初始抽 12 张（per 10-roguelike-loop §2.3）；调整 HandSystem 上限逻辑
- **简化点替换**：S2（8 张 → 12 张）
- **完成标准**：DeckSystem.test.ts 更新验证 12 张起始卡组
- **提交**：`feat(deck): upgrade initial draw to 12 cards (replace S2)`

---

## 任务依赖图

```
A1 → A2 (文档，独立)
B1 → B2 → B3 (顺序依赖)
C1 → C2, C3, C4, C5 (C1 为基础，其他并行)
D1, D2 (并行)
E1 → E2 → E3 (顺序依赖)
F1, F2 (并行)

跨批次依赖：
B1 是 F1 的前置（WaveSystem 要先完整化）
C5 是 F1 的前置（能量水晶生产建筑）
```

---

## 执行顺序建议

1. **A 批次**（文档，最快，0.5天）— 先做，扫清文档债
2. **B1 → B2 → B3**（多关卡，1天）— 解锁8关游玩体验，影响最大
3. **C1**（6塔激活，半天）— 快速扩展内容广度
4. **D1 + D2**（商店+秘境，1天）— 关间节点体验升级
5. **F1 + F2**（能量+卡组，1天）— 战斗手感升级（需 B1/C5 先完成）
6. **E1 → E2 → E3**（技能树，2天）— 深度系统
7. **C2 → C3 → C4 → C5**（其他内容，2天）— 内容广度收尾

---

## 完成标准（Post-MVP 全部完成判定）

- [ ] `grep -r "碎片" design/ --include="*.md" | grep -v archive | grep -v dev-logs` 返回 0 命中
- [ ] L1→L8 Run 连闯可玩（手动验证）
- [ ] 6 种塔卡 + 至少 1 种士兵卡 + 至少 1 种陷阱卡 + 1 种法术卡可用
- [ ] 商店 8 槽双栏布局（目测）
- [ ] 秘境 14 事件池随机呈现
- [ ] 箭塔技能树 6 节点完整（2 路径 × 3）
- [ ] 能量模型：每波 +5 + 击杀回能
- [ ] 卡组 12 张起始
- [ ] `npm run typecheck && npm test && npm run build` 全绿
- [ ] 无 MVP-SIMPLIFICATION 注释未替换（S1/S2/S3/S8/S9/S10/S18/S19 全部消除）

---

## 修订历史

| 版本 | 日期 | 摘要 |
|------|------|------|
| 1.0 | 2026-05-16 | 初版：基于 MVP 验收后上下文，按 P1-P7 路线图拆分 Batch A-F |
