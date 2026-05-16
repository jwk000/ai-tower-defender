HANDOFF CONTEXT
===============

USER REQUESTS (AS-IS)
---------------------
- "下一步我计划先做完所有UI界面，只实现简单的界面跳转，不用实现复杂逻辑。1，游戏主界面，只有3个按钮：新的征程（丢弃所有数据重新开始run）、继续游戏（加载游戏存档继续游戏）、离开游戏（关闭游戏回到桌面）需要补充设计文档。2，关卡选择界面，按需求文档的设计实现；3，对局界面，关卡内的玩法界面，按需求文档实现；4，通关结算界面，商店秘境离开3选1，设计文档里有说明；5，商店界面，按文档实现；6，秘境界面，按文档实现；7，run结算界面，run通关全部关卡或失败后弹出结算界面，需要补充设计文档，关闭结算界面回到游戏主界面。"
- 用户确认：放弃 v3.4 单 Run 闭环限制（恢复 ongoingRun 存档，支持「继续游戏」）
- 用户确认：先补充设计文档，再实现

GOAL
----
完成 7 个 UI 界面的设计文档补充（已完成主菜单+Run结算），然后实现所有 UI 界面的简单界面跳转（不含复杂逻辑）。

WORK COMPLETED
--------------
- 修改 design/40-presentation/40-ui-ux.md §11：将主菜单从 v3.4 的5项改为精简3按钮版，并添加关于「继续游戏」的设计意图说明
- 新建 design/40-presentation/49-main-menu.md：游戏主界面（主菜单）完整设计文档 v1.0.0
  - 布局：全屏1920×1080 + 标题 + 3 个按钮（新的征程/继续游戏/离开游戏）
  - 按钮行为：新的征程（有存档时弹确认）/ 继续游戏（无存档时灰显）/ 离开游戏（直接退出）
  - 丢弃存档确认弹窗结构
  - 存档同步规则（每次显示主菜单重新读取存档状态）
  - 验收清单
- 新建 design/40-presentation/50-run-result.md：Run 结算界面完整设计文档 v1.0.0
  - 触发时机：终战胜利 / 水晶HP归零 / ESC主动放弃
  - 胜利面板（金色 + 战绩 + 流派标签 + 关键技能树）+ 失败面板（暗红 + 战绩）
  - 字段定义：最远到达/时长/总击杀/最大单波击杀/水晶血量/金币
  - 按钮：「返回主菜单」（清除存档→主菜单）/ 「立即开始新征程」（清除存档→关1路线图，跳过主菜单）
  - 存档处理时序（RunManager.endRun() → 清ongoingRun → 更新RunHistory → 显示结算）
  - 验收清单
- 修改 design/60-tech/61-save-system.md §1.1：恢复 ongoingRun 字段定义到 SaveData，新增 OngoingRun interface（包含 currentLevelIdx / gold / skillPoints / crystalHp / deckCardIds / skillTreeState / savedAt）
- 修改 design/README.md：在 40-presentation 表格中添加 49-main-menu 和 50-run-result 条目
- 已 git commit：docs: 补充游戏主界面与Run结算设计文档，恢复ongoingRun存档支持

CURRENT STATE
-------------
- 设计文档已补充完毕（主菜单 + Run结算）
- 代码尚未修改，所有变更都是设计文档层面
- 现有代码 src/ui/MainMenu.ts 有5个按钮（start-run/continue-run/open-cards/open-settings/quit），需要精简为3个
- 现有代码 src/ui/RunResultPanel.ts 存在，但逻辑需要与新设计文档对齐
- 现有代码 src/core/RunController.ts 管理所有界面切换（主菜单/战斗/关间/商店/秘境/技能树/Run结算）
- 现有代码 src/main.ts 约800行，是启动和协调层
- typecheck 状态：未运行，待验证

PENDING TASKS
-------------
- [设计文档] 7 个 UI 界面中，已有详细文档的：
  - 关卡选择界面（47-level-map-ui.md）✅
  - 对局界面（40-ui-ux.md §2-§5）✅
  - 通关结算（3选1面板）（47-level-map-ui.md §4）✅
  - 商店界面（48-shop-redesign-v34.md）✅
  - 秘境界面（40-ui-ux.md §8）✅
  - 主菜单（49-main-menu.md）✅ 本次新建
  - Run结算（50-run-result.md）✅ 本次新建
- [代码实现] 用户要求"只实现简单的界面跳转，不用实现复杂逻辑"，以下工作待下一会话完成：
  1. src/ui/MainMenu.ts：改为3按钮（start-run/continue-run/quit），继续游戏按钮的 enabled 由 hasSavedRun 控制
  2. src/render/PanelRenderers.ts：MainMenuRenderer 对应更新（删除 open-cards 按钮渲染）
  3. 关卡选择界面（LevelMapScreen）：新建 PixiJS 全屏路线图，9节点Mario风格，按47文档实现
  4. 对局界面：现有 UIPresenter + HUD 基本可用，确认与40文档一致
  5. 通关结算面板（3选1）：现有 InterLevelPanel/InterLevelRenderer 需对比47文档补齐
  6. 商店界面：现有 ShopPanel/ShopRenderer 需对比48文档调整（两栏8槽）
  7. 秘境界面：现有 MysticPanel/MysticRenderer 需对比40文档 §8 确认
  8. Run结算界面：现有 RunResultPanel/RunResultRenderer 需对比50文档调整
  9. 存档逻辑：实现 SaveSystem.hasOngoingRun() / loadOngoingRun() / saveOngoingRun()

KEY FILES
---------
- design/40-presentation/49-main-menu.md — 主菜单 UI 权威（本次新建）
- design/40-presentation/50-run-result.md — Run结算 UI 权威（本次新建）
- design/40-presentation/47-level-map-ui.md — 关卡路线图 + 3选1面板 UI 权威
- design/40-presentation/48-shop-redesign-v34.md — 商店 UI 权威（两栏8槽）
- design/40-presentation/40-ui-ux.md — 对局界面 / 秘境 / HUD UI 权威
- src/core/RunController.ts — 界面切换状态机（控制哪个容器 visible）
- src/main.ts — 启动层，Wire所有UI/系统
- src/ui/MainMenu.ts — 主菜单逻辑（待改为3按钮）
- src/ui/RunResultPanel.ts — Run结算面板（待对比文档调整）
- src/render/PanelRenderers.ts — 各面板的 PixiJS 渲染器

IMPORTANT DECISIONS
-------------------
- 决策（2026-05-16）：放弃 v3.4 单 Run 闭环中断限制，重新引入 ongoingRun 存档支持「继续游戏」功能
  - 影响文档：61-save-system.md（已恢复 ongoingRun 字段）、49-main-menu.md（「继续游戏」有完整定义）
  - 实现时需要在 SaveSystem 中实现 ongoingRun 的读写，在 RunManager 中实现 loadRun(ongoingRun)
- 关卡路线图界面实现时不需要修改 RunManager（按47文档 §8.1，全部由 currentLevelIdx 派生）
- 「立即开始新征程」按钮跳转逻辑：结算界面 → 关卡路线图（关1高亮），跳过主菜单
- 「继续游戏」的存档摘要弹窗需显示：已通关关卡数 / 金币 / 技能点

EXPLICIT CONSTRAINTS
--------------------
- 只实现简单的界面跳转，不用实现复杂逻辑（用户明确说明）
- 始终用中文回复（AGENTS.md 铁律）
- 每完成一个逻辑任务单元立即 git commit（AGENTS.md 铁律）
- 修改完后跑 npm run typecheck 验证（AGENTS.md 铁律）
- 任务档位：L2（系统逻辑/功能扩展）—— 不改核心 ECS/规则引擎，只改 UI 层

CONTEXT FOR CONTINUATION
------------------------
- 下一会话：先读本 handoff，然后从"代码实现"部分开始，逐界面实现简单跳转
- 建议从主菜单开始（最简单，改3按钮+灰显逻辑），然后是Run结算，然后是关卡路线图（最复杂）
- 关卡路线图实现参考 47-level-map-ui.md §3.1 坐标（9节点两行波浪线布局）
- 现有 RunController.ts 的 phase 枚举：Idle(主菜单)/Battle/InterLevel/Shop/Mystic/SkillTree/Result
  - 关卡路线图需要新增 LevelMap phase，或者复用 InterLevel phase 并区分子状态
- SkillTreePanel 目前是关间3选1的第3个选项（跳过），设计文档里"跳过"是独立选项不进技能树界面，后续需要调整
