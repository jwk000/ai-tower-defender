HANDOFF CONTEXT
===============

USER REQUESTS (AS-IS)
---------------------

- "继续handoff任务，我检查了现在的UI界面，和设计文档不一致，需要改成一致"
- "全部都需要对齐一遍"（在 8 个 UI 面板对齐范围选择时确认）
- "废弃独立 SkillTreePanel，技能树逻辑合并进 DeckView 右栏（Recommended）"
- "全部做完不管多久"（确认要把所有面板都对齐到位，跨多会话也可）
- "走架构路线：先做实例化 L3 架构变更 + 集成测试，再做 UI"（当我提示发现 commit 8903793 只改了 docs 没改 src，问要走架构路线还是务实路线时确认）

GOAL
----

按 AGENTS.md L3 流程，先做技能树实例化（cardInstanceId 粒度）的架构变更 + 集成测试，跑通 RunManager + DeckSystem + SaveSystem 数据层的实例化；然后才能做 DeckView 左右分栏 UI 重构（嵌入右栏技能树面板），最后串联其他 7 个面板（Shop/LevelMap/MainMenu/InterLevel/Mystic/RunResult/HUD+Hand）的设计对齐。

WORK COMPLETED
--------------

本会话只完成了「探查 + 规划 + 范围共识」阶段，未改任何代码：

1. 读 ubf_agent_root/.memory/handoffs/_latest.md（上次 handoff）+ git log 确认上一会话已完成 4 个设计文档修改 commits（cb7368f / 4abf3f5 / fc2108f / 103671c）+ 1 个 commit 0e2579c "feat(ui): 对齐所有 UI 面板与 v3.4 设计文档"。
2. 与用户确认本会话目标：8 个面板系统性 UI 对齐 v3.4 设计文档。
3. 并行启动 4 个 explore agent 做差异盘点（覆盖 DeckView / Shop / LevelMap+SkillTree+MainMenu / InterLevel+Mystic+RunResult+HUD+Hand），整理出 8 面板共 ~30 项差异（详见 ## 详细差异清单 段，下方）。
4. 让用户决定优先级与 SkillTree 面板归并方向：用户选「全部做完，不管多久」+「废弃独立 SkillTreePanel，技能树逻辑合并进 DeckView 右栏」。
5. 准备动手 DeckView 时，读 src/ui/DeckViewPanel.ts + src/render/PanelRenderers.ts:826-943 + src/unit-system/RunManager.ts + src/main.ts，发现一个关键架构缺口：
   - commit 8903793 标题写「技能树改为实例级独立 + 卡池界面入口」，但 git show 显示只改了 3 个 .md 设计文档，src/ 完全没改。
   - RunManager._skillTreeState 当前仍是 Set<string>（全局共享），未实现设计文档 22-skill-tree-overview §8 要求的 instances: Record<string, CardSkillTreeState> 实例化结构。
   - DeckViewPanel.state 只有 cardIds: readonly string[]，没有 cardInstanceId 概念；deckSystem.previewDrawPile() 返回的是抽牌堆，不是「Run 收藏的卡」。
6. 与用户校准：必须先做 L3 架构变更（实例化）才能做 DeckView 左右分栏（右栏要绑实例的技能树）。用户拍板走架构路线。
7. 制订 14 项 todo 推进计划（见 PENDING TASKS）。
8. 上下文使用率达 70.5%（系统监控提示），按 AGENTS.md 上下文铁律立即停止新工作并 handoff。

代码侧 0 改动，git status clean（只有 .vscode/ 与 vite.config.ts 三个早已存在的本地未提交改动，与本次任务无关）。

CURRENT STATE
-------------

- 工作区无业务代码改动；git status 仅 3 个无关本地文件（.vscode/launch.json, .vscode/tasks.json, vite.config.ts）属于上次 fix commits 前的本地遗留。
- 最近 commits（最新在上）：
  2af90bd fix: url 改为 about:blank
  91fcbe8 fix: serverReadyAction
  3609003 fix: launch.json userDataDir
  47aa332 fix: 调试器空白页
  84416f0 fix: VSCode 调试器无法启动游戏
  0e2579c feat(ui): 对齐所有 UI 面板与 v3.4 设计文档（上一会话）
  103671c docs: 47-level-map-ui §1.5 新增卡池按钮入口
  fc2108f docs: 48-shop-redesign §1.5 左栏选中态
  4abf3f5 docs: 22-skill-tree-overview §9 左右分栏一体式
  cb7368f docs: 重写卡牌视觉规范 §3.2
  8903793 feat: 技能树改为实例级独立 + 卡池界面入口  ← 仅改 docs 未改 src（缺口！）
- 设计文档已全部更新到 v3.4 一致状态。
- typecheck / 测试 未运行（本次未改任何代码）。

PENDING TASKS
-------------

按依赖顺序（共 14 项，前 7 项是 L3 架构变更属于本会话原本要做的「阶段 A 前置」）：

阶段 P0 — 技能树实例化数据层（L3，必须 TDD 红→绿）

  P0.1 [in_progress] 新增 src/unit-system/__tests__/RunManager.skillTree.test.ts（TDD 红）
       - 覆盖 activateNode/equipPath/resolveCardEffects/resetSkillTreeState 4 个接口
       - 覆盖 5 个 activateNode 错误码（INSUFFICIENT_SP / INSTANCE_NOT_FOUND / NODE_NOT_FOUND / PREREQUISITE_NOT_MET / NODE_ALREADY_ACTIVE）
       - 覆盖 5 个 equipPath 错误码（INSTANCE_NOT_FOUND / PATH_NOT_FOUND / PATH_NOT_ACTIVATABLE / UNIT_DEPLOYED / ALREADY_EQUIPPED）
       - 接口契约见 design/20-units/22-skill-tree-overview.md §8.2-8.3（行 463-503）

  P0.2 新建 src/unit-system/SkillTreeState.ts
       - export interface SkillTreeState { instances: Record<string, CardSkillTreeState> }
       - export interface CardSkillTreeState { unitCardId: string; activeNodes: Set<string>; equippedPath: string | null }
       - export enum SkillTreeError { INSUFFICIENT_SP, INSTANCE_NOT_FOUND, NODE_NOT_FOUND, ... }

  P0.3 重构 src/unit-system/RunManager.ts
       - 删 _skillTreeState: Set<string>，删 hasSkillNode/unlockSkillNode（或保留以兼容并标记 @deprecated）
       - 新增 _skillTree: SkillTreeState
       - 实现 activateNode / equipPath / resolveCardEffects / resetSkillTreeState
       - snapshot/restoreFrom 序列化新结构（需配合 SaveSystem 升版本）

  P0.4 src/unit-system/DeckSystem.ts
       - 卡牌入卡组时分配 cardInstanceId（如 'arrow_tower_inst_1'，需累加计数器或 UUID）
       - 区分「卡库 collection」（本 Run 已获得，含技能树状态）与「抽牌堆 drawPile」（关内战斗用）
       - 新增 getCardInstances(): Array<{ instanceId: string; unitCardId: string }> 供 DeckView 使用
       - 现有 DeckSystem.test.ts 可能要扩展

  P0.5 src/core/SaveSystem.ts
       - skillTreeUnlocked: string[] → 改为 skillTree: SerializedSkillTreeState
       - 升存档版本（当前 v1，应该升到 v2 或 v3 反映实例化）
       - 旧存档迁移逻辑：丢弃旧 skillTreeUnlocked 字段（设计文档说技能树本 Run 内有效，正在进行的 Run 存档若版本不匹配可强制重置技能树）

  P0.6 src/__tests__/save.integration.test.ts + run.integration.test.ts
       - save.integration.test.ts:55 `mgr.unlockSkillNode('node_a')` → `mgr.activateNode(instanceId, nodeId)`
       - run.integration.test.ts:954 `runManager.skillTreeState` 作为 Set 用 → 改 instance API
       - 集成测试需要构造完整实例化场景（卡入组 → 实例 ID → 点亮节点）

  P0.7 src/main.ts 接线
       - 行 549/665/685/687 当前用 runManager.skillTreeState / unlockSkillNode
       - 改为 runManager.activateNode(currentInstanceId, nodeId) 等
       - DeckView 入口 deckSystem.previewDrawPile() → deckSystem.getCardInstances()
       - 跑 typecheck + 冷烟（debug/ 一键通关）验证

阶段 A — DeckView 左右分栏 UI 重构（L3，依赖 P0 完成）

  A1 重构 src/ui/DeckViewPanel.ts
     - DeckViewState: 改为 { instances: Array<{ instanceId, unitCardId, ... }>; selectedInstanceId: string | null; sp: number }
     - DeckViewAction: 'close' | 'select-card' | 'activate-node' | 'equip-path'
     - DeckViewHandler 接收 payload（如 selectCard 带 instanceId）

  A2 重构 src/render/PanelRenderers.ts DeckViewRenderer（826-943）
     - 改为左右两个 Container：左 30%（卡列表）+ 右 70%（技能树面板）
     - 左栏：按类型分组（塔/士兵/法术/陷阱/生产），每张卡显示 #N 实例序号
     - 默认选中第一张卡，点击切换右栏

  A3 DeckView 右栏嵌入技能树
     - 复用现有 layoutSkillTree（SkillTreePanel.ts）的布局逻辑，但作为 DeckViewRenderer 的子区域
     - 显示选中卡的 path × node 网格，节点点击触发 activate-node action

  A4 DeckView 卡牌视觉应用 §3.2 规范
     - 等级=稀有度 L1 绿（0x4caf50）/ L2 蓝（0x2196f3）/ L3 金（0xffc107）边框
     - 菱形 ✦ 等级标记（L2 一颗 / L3 两颗）
     - 名字 = 当前装备路径最深点亮节点的 name（无点亮时回退 cardId 默认 name）
     - 显示 ❤HP / ⚔ATK / ◇能量费用（需要从 RunManager.resolveCardEffects 拿合并后数值）
     - 顶栏右侧加 SP 余额

  A5 删除独立 SkillTreePanel + SkillTreeRenderer
     - 删 src/ui/SkillTreePanel.ts + src/ui/__tests__/SkillTreePanel.test.ts
     - 删 src/render/PanelRenderers.ts:567-685 SkillTreeRenderer
     - 删 src/main.ts 中 skillTreeRenderer 相关接线
     - RunPhase.SkillTree 是否还保留？设计 §9.1 说卡池入口与 3 选 1 并行（不消耗节点），可能可以删 SkillTree 相位；但 RunManager.closeSkillTree 当前 +1 level 用作 3 选 1 选项的实现，需检查 InterLevelChoice 是否还有 'skilltree' 选项（若有，意味着 3 选 1 仍可选「技能树」，那 SkillTree 相位要保留但显示卡池界面）。先决策再删。
     - 跑 npm run check:doc:fix 同步 architecture.md（删了 SkillTreeRenderer 名字）

阶段 B-E — 其他面板对齐（L1/L2，每个独立 commit）

  B Shop 左右分栏 + 左栏选中态 + 8 槽（参考 design/40-presentation/48-shop-redesign-v34.md §1.5 + §1.1/§4/§5）
    - 详细差异见 ## 详细差异清单 / Shop 段
  C Hand 卡片 §3.2 规范 + HUD 锚点迁移 + 暂停按钮 + 能量闪烁
  D MainMenu 3 按钮重写 + InterLevel emoji + Mystic 结构化选项 + RunResult 固定文案
  E LevelMap 节点形状 + 呼吸动画 + 路径 marching ants

阶段 F — 收尾

  F1 npm run check:all（typecheck + check:doc）
  F2 集成测试补全（DeckView 选中切换 + Shop 选中态）
  F3 debug/ 一键通关冷烟验证
  F4 提交所有原子 commits（每阶段独立 commit）

KEY FILES
---------

- src/unit-system/RunManager.ts — 当前 _skillTreeState: Set<string>（行 73），需重构为 instances: Record<string, CardSkillTreeState>。snapshot/restoreFrom 在 261-285。
- src/unit-system/DeckSystem.ts — 需新增 cardInstanceId 分配 + 卡库/抽牌堆分离
- src/core/SaveSystem.ts — skillTreeUnlocked: string[] (行 10) 待改 instances 序列化；需升版本
- src/ui/DeckViewPanel.ts — 27 行极简实现，需重构 state 加 selectedInstanceId
- src/render/PanelRenderers.ts — DeckViewRenderer (826-943) 单栏网格，需改左右分栏；SkillTreeRenderer (567-685) 待删
- src/main.ts — 行 549/665/685/687 当前用全局 skillTreeState；deckViewContainer 接线在 151/161/526-535/721-735；arrowTowerSkillTree 仅硬编码读箭塔配置，需扩展按 instance unitCardId 动态加载
- src/__tests__/save.integration.test.ts — 行 55/65/72/82 用 unlockSkillNode/skillTreeUnlocked
- src/__tests__/run.integration.test.ts — 行 954/960/971 用 skillTreeState/unlockSkillNode/hasSkillNode
- design/20-units/22-skill-tree-overview.md — §8.1-8.3（行 432-503）= 接口契约权威；§9 = 左右分栏 UI 草图（行 507-630）
- design/40-presentation/40-ui-ux.md §3.2 — 卡牌视觉规范（L1绿/L2蓝/L3金 + 菱形 + 动态名字）

IMPORTANT DECISIONS
-------------------

- L3 架构变更必须先于 UI 重做：DeckView 右栏要绑实例的技能树，没有实例化数据层就做 UI 是空中楼阁
- 走 TDD 红→绿→重构（AGENTS.md L3 铁律）：先写 RunManager.skillTree.test.ts 红色测试，再实现 SkillTreeState + RunManager
- 废弃独立 SkillTreePanel + SkillTreeRenderer（用户决策），技能树逻辑合并进 DeckViewRenderer 右栏
- 同名卡显示「箭塔 #1 / 箭塔 #2」实例化（卡牌实例 ID 由 DeckSystem 分配，跨 Run 不持久化）
- 存档版本必须升级（v1 → v2 或 v3）反映实例化结构变更，旧存档迁移策略：丢弃 skillTreeUnlocked 字段（设计上技能树本 Run 临时，迁移逻辑可丢）
- 8 个面板全部对齐是多会话工程，预计需要 3-5 个续跑会话
- 上下文 70.5% 触发 handoff（AGENTS.md 上下文铁律），本会话 0 代码改动是为了避免推进到半截被打断

EXPLICIT CONSTRAINTS
--------------------

- 始终用中文回复（AGENTS.md 沟通铁律）
- 每完成一个逻辑任务单元立即 git commit（AGENTS.md 核心铁律，原子提交）
- 不得通过删除测试/跳过断言来"通过"测试（AGENTS.md 测试铁律）
- L3 任务必须 TDD（红→绿→重构）+ npm test 全量通过才能提交
- L3 任务修改前需列出受影响模块清单（本文档已列）
- 涉及 ECS 组件变更必须 npm run check:doc:fix 同步 architecture.md（删 SkillTreeRenderer 时触发）
- 不得就实现细节问用户，只问产品/架构层级问题（AGENTS.md 沟通铁律）

详细差异清单
------------

为保留 4 个 explore agent 盘点的成果，浓缩版差异清单（完整版可重新跑 explore 获取）：

【DeckView】（最关键，11 项差异）
- D1 整体：单栏网格 → 必须改左右分栏（左 30% 卡列表 + 右 70% 技能树）
- D2 缺卡牌实例化（无 #N 序号，无独立技能树）
- D3 卡片边框：BUTTON_BORDER 固定色 → 必须按等级 L1绿/L2蓝/L3金
- D4 卡片名字：cardId → 必须动态显示「装备路径最深点亮节点 name」
- D5 缺属性显示（❤HP / ⚔ATK / ◇能量）
- D6 缺选中态视觉（主题蓝 2px 边框 + 已强化卡金色光晕）
- D7 缺顶栏 SP 余额（标题「📚 本局卡组」要改成「卡池」）
- D8 关闭按钮：'✕ 关闭' 红色 → 改普通底栏样式
- D9 缺图标 + 卡牌缩略图（当前只画矩形 + 文字）
- D10 DeckViewState/Action 接口缺实例化字段
- D11 右栏技能树完全缺失（最大差异）

【Shop】（8 项）
- S1 整体：单栏 4 列 → 必须改左 35% 卡池 + 右 65% 8 槽
- S2 左栏卡池完全缺失（应显示当前 Run 卡组按 4 类型分组）
- S3 左栏选中态完全缺失（§1.5 v1.1.0 新增需求：主题蓝 2px 高亮 + 右栏不联动）
- S4 右栏 8 槽未分前 4 单位卡（200×280）+ 后 4 功能卡，商品视觉缺稀有度色边
- S5 缺确认浮窗 + 回收卡拖拽 + 刷新按钮 + SOLD 售罄态
- S6 必须无技能树（当前正确，但需 selection logic 保证选中只高亮不触发技能树）
- S7 顶栏：仅 goldText → 必须显示 3 资源（能量/金币/技能点）+ 关 N 标题
- S8 ShopState/ShopItem 缺左栏 deck 字段

【LevelMap】（4 项，commit 0e2579c 已部分对齐）
- L1 节点视觉：统一 roundRect → 8 关主题应有不同几何形状（圆/六边形/星形/王座+皇冠等）
- L2 缺当前节点呼吸脉冲（1.5s 周期 + 上浮 4px）+ 路径 marching ants 流动
- L3 [对齐] 底栏「卡池」按钮已实现（bottom-right offset(-160,-40)），但 3 选 1 显示时需隐藏（可能在 UISystem 层已处理，需确认）
- L4 路径端点用 a.x+a.width / a.y+a.height/2 → 应按节点中心+半径方向向量精确连接

【SkillTree】（架构问题，3 项 → 决策：废弃）
- ST1 是否保留独立面板：用户决策废弃
- ST2 节点路径分支 Graphics 缺失
- ST3 SP 余额未绑 RunManager.sp
- 处理方式：删除整个文件 + 入口注册，技能树逻辑合并进 DeckView 右栏

【MainMenu】（3 项）
- M1 应为 3 按钮（新的征程/继续游戏/离开游戏，per 49-main-menu.md 2026-05-16 新增），代码 PanelRenderers MainMenuRenderer 较旧
- M2 缺标题「塔防长征」+ 版本号 v3.4
- M3 视觉风格未统一（应与 LevelMap 同 0x0d1b2a 背景 + BUTTON_ENABLED）

【InterLevel】（3 项）
- I1 卡片缺 emoji 图标（🏪/🌀/⏭）+ 类型颜色区分
- I2 InterLevelState.items 缺 type 字段
- I3 缺单位卡 3 选 1（B4c）与节点 3 选 1 的两阶段切换逻辑

【Mystic】（3 项）
- My1 选项缺 cost/reward 分行 + 高风险红边框（设计 27-traps-spells-scene §5：14 事件中 5 个高风险）
- My2 effects[] 缺结构化展示（type/value/resource）
- My3 关闭按钮 'Exit Mystic' → 改「离开秘境」，须保证至少 1 个 choice.id === 'exit'

【RunResult】（3 项）
- R1 缺胜利/失败固定文案（「通关成功！」/「水晶破碎…」）
- R2 缺标准统计字段（maxWave/runCount/heroScore/kills）
- R3 缺「本 Run 所有资源已清零」提示 + 强制两按钮（restart/menu）

【HUD】（3 项）
- H1 缺能量条专门视觉（应底部居中 + 能量不足红色闪烁）
- H2 缺 41-responsive-layout 9 类锚点系统（当前使用绝对坐标）
- H3 缺暂停按钮 + 关卡目标提示

【Hand】（3 项）
- Hd1 卡片视觉未应用 §3.2 新规范（L1绿/L2蓝/L3金 边框 + 动态名字 + 菱形）
- Hd2 缺左上能量图标 + E:X 数字
- Hd3 缺抽卡区视觉 + 拖拽半透明投影 + 合法落点高亮

CONTEXT FOR CONTINUATION
------------------------

- 续跑会话第一动作：读本 handoff → 同步 PENDING TASKS 到 todo 列表 → 从 P0.1 开始（写 RunManager.skillTree.test.ts 红色测试）
- 不要先动 UI！必须先做完 P0.1-P0.7 数据层 L3 架构变更（技能树实例化），才能动 DeckView。
- P0 阶段每完成一个原子任务（一个 .ts 文件改动 + 对应测试绿）就 git commit，遵循 AGENTS.md 原子提交铁律。commit message 用 `feat(skilltree):` 前缀。
- 设计文档已是权威：22-skill-tree-overview.md §8（行 432-503）的接口签名一字不差实现。错误码大小写、名称都要与文档完全一致。
- 注意 commit 8903793 的 message 描述与实际 git stat 不符（只改 docs 未改 src），这是已知的「设计先行但代码未跟上」状态。续跑会话不要被 commit message 误导以为 src 已经实现实例化。
- 上下文管理：续跑会话感知到 70% 时同样立即 handoff，本工程预计 3-5 个会话才能完结。
- 跑 typecheck 用 `npm run typecheck`，跑测试用 `npm test`（vitest），跑文档一致性用 `npm run check:doc`，全量校验用 `npm run check:all`。
- 冷烟测试：debug/ 目录下可能有一键通关脚本，未在本会话验证；续跑会话第一次跑 P0 时可先检查 debug/ 内容。
- 如果发现 design/20-units/22a-22e（5 个单位详设技能树）的某些节点配置在 src/config/loader.ts 还未加载，那 P0.7 main.ts 接线时 resolveCardEffects 可能拿不到完整效果——这是正交问题，先实现框架，节点效果由后续 RuleHandler 补完。
