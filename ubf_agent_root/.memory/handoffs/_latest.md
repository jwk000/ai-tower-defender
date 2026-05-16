HANDOFF CONTEXT
===============

USER REQUESTS (AS-IS)
---------------------

- "下一步我计划先做完所有UI界面，只实现简单的界面跳转，不用实现复杂逻辑。1，游戏主界面，只有3个按钮：新的征程（丢弃所有数据重新开始run）、继续游戏（加载游戏存档继续游戏）、离开游戏（关闭游戏回到桌面）需要补充设计文档。2，关卡选择界面，按需求文档的设计实现；3，对局界面，关卡内的玩法界面，按需求文档实现；4，通关结算界面，商店秘境离开3选1，设计文档里有说明；5，商店界面，按文档实现；6，秘境界面，按文档实现；7，run结算界面，run通关全部关卡或失败后弹出结算界面，需要补充设计文档，关闭结算界面回到游戏主界面。"
- 用户确认：放弃 v3.4 单 Run 闭环限制（恢复 ongoingRun 存档，支持「继续游戏」）
- 用户确认：先补充设计文档，再实现
- 用户确认：现在实现路线图（推荐选项）

GOAL
----

7 个 UI 界面全部已完成实现，代码已提交。下一步可以冒烟测试验收，或推进其他功能开发。

WORK COMPLETED
--------------

本次会话完成了所有 7 个 UI 界面的实现：

【设计文档（上一会话已完成）】
- 新建 design/40-presentation/49-main-menu.md：主菜单 UI 权威（3按钮 + 存档确认弹窗 + 存档同步）
- 新建 design/40-presentation/50-run-result.md：Run结算 UI 权威（胜利/失败 + 两个按钮 + 存档时序）
- 修改 design/60-tech/61-save-system.md §1.1：恢复 ongoingRun 字段 + OngoingRun interface

【代码实现（本次会话完成）】
- 新建 src/ui/LevelMapPanel.ts：关卡路线图纯函数面板（9节点水平布局、completed/current/locked 三态、hitTest、LevelMapPanel 类）
- 修改 src/render/PanelRenderers.ts：新增 LevelMapRenderer 类（节点圆角矩形 + 路径线 + 顶栏HUD + 挑战关卡按钮）
- 修改 src/unit-system/RunManager.ts：新增 RunPhase.LevelMap 相位，startRun() 进入 LevelMap（而非直接 Battle），新增 enterBattle()（LevelMap→Battle）和 returnToLevelMap()（InterLevel→LevelMap，已预留但暂未接线）
- 修改 src/core/RunController.ts：新增 levelMap 场景容器到 RunSceneContainers，新增 enterBattle() 方法，syncSceneVisibility 增加 LevelMap 分支
- 修改 src/main.ts：新建 levelMapContainer，导入 LevelMapPanel/LevelMapRenderer，startNewRun() 改为进路线图（不立刻开战），「挑战关卡」按钮处理器调 runController.enterBattle() + waveSystem.start()
- 更新集成测试和单元测试：run.integration.test.ts / content.integration.test.ts / RunManager.test.ts 中所有受影响的测试已加入 enterBattle() 调用，321 测试全绿

【已验证】
- npm run typecheck 通过
- npm test 321/321 全绿
- npm run check:doc 文档一致性通过
- 所有改动已 git commit（最新 commit: feat: 实现关卡路线图界面（LevelMapScreen））

CURRENT STATE
-------------

- 7 个 UI 界面均已实现并提交，代码干净无未提交变更
- 完整 UI 跳转流程：主菜单 → 路线图（新的征程/继续游戏） → 战斗 → 3选1面板 → 商店/秘境/技能树 → 战斗(下一关) → … → Run结算 → 主菜单
- SaveSystem 已实现 hasOngoingRun/loadOngoingRun/saveOngoingRun/clearOngoingRun
- RunPhase 状态机：Idle → LevelMap → Battle → InterLevel → Shop/Mystic/SkillTree → Battle(level++) → … → Result → Idle
- 路线图仅在 Run 启动时展示一次（新的征程 或 继续游戏），后续关卡切换走 InterLevel 3选1 流程
- typecheck 状态：通过

PENDING TASKS
-------------

暂无强制 pending 任务。可选的后续工作：

1. 冒烟测试：运行 debug/ 下冒烟脚本验证完整 UI 流程（主菜单 → 路线图 → 战斗 → 通关 → Run结算）
2. 美术补全：路线图界面当前为程序美术（纯色块），可接入实际资源
3. 对局界面细节确认：UIPresenter + HUD 是否与 40-ui-ux.md §2-§5 完全对齐
4. InterLevel 通关后回到路线图（目前通关后直接进3选1，RunManager 已有 returnToLevelMap() 方法，但 RunController 未接线）
5. 丢弃存档确认弹窗（49-main-menu.md 设计了弹窗，目前新的征程直接清档，无二次确认）
6. v3.4 第4轮代码改造（design/README.md 提到的 21-unit-roster §2.3 + 23-skill-buff §6 cross-ref 修复 + 18 文档「碎片」清理 + src 代码改造）

KEY FILES
---------

- src/main.ts — 启动层，全部 UI/系统接线主文件（约 890 行）
- src/ui/LevelMapPanel.ts — 关卡路线图纯函数面板（新建）
- src/render/PanelRenderers.ts — 所有面板的 PixiJS 渲染器（含新增 LevelMapRenderer）
- src/unit-system/RunManager.ts — Run 状态机 + Run 级资源（新增 LevelMap 相位）
- src/core/RunController.ts — UI 场景切换协调器（新增 levelMap 容器 + enterBattle()）
- src/core/SaveSystem.ts — 存档系统（hasOngoingRun/loadOngoingRun/saveOngoingRun/clearOngoingRun）
- design/40-presentation/49-main-menu.md — 主菜单 UI 权威（上次新建）
- design/40-presentation/50-run-result.md — Run结算 UI 权威（上次新建）
- design/40-presentation/47-level-map-ui.md — 关卡路线图 UI 权威（v3.4 已审计）
- src/unit-system/__tests__/RunManager.test.ts — RunManager 单元测试（已同步更新）

IMPORTANT DECISIONS
-------------------

- 决策（本次）：路线图仅在 Run 启动时显示一次，不在每关通关后回到路线图。理由：用户要求"只实现简单界面跳转"，最小化工作量。RunManager 已预留 returnToLevelMap() 方法，将来可扩展为通关后回路线图。
- 决策（上次）：放弃 v3.4 单 Run 闭环中断限制，重新引入 ongoingRun 存档支持「继续游戏」。影响：61-save-system.md（已恢复 ongoingRun 字段）、SaveSystem.ts（已实现完整存档 API）。
- 决策（上次）：关卡路线图（47-level-map-ui.md §8.1）全部由 currentLevelIdx 派生，不需要修改 RunManager 的关卡数据。

EXPLICIT CONSTRAINTS
--------------------

- 只实现简单的界面跳转，不用实现复杂逻辑（用户明确说明）
- 始终用中文回复（AGENTS.md 铁律）
- 每完成一个逻辑任务单元立即 git commit（AGENTS.md 铁律）
- 修改完后跑 npm run typecheck 验证（AGENTS.md 铁律）
- 任务档位：L2（系统逻辑/功能扩展）—— 不改核心 ECS/规则引擎，只改 UI 层

CONTEXT FOR CONTINUATION
------------------------

- 7 个 UI 界面已全部完成，本阶段目标已达成
- 如需继续，建议从冒烟测试验收开始（运行 debug/ 下脚本，或手动启动游戏验证完整流程）
- 路线图界面目前只在 Run 开始时出现；若需要"通关后回路线图→看进度→3选1"体验，需接线 returnToLevelMap() 并更新 RunController/main.ts
- 「丢弃存档确认弹窗」(49-main-menu.md §3.2) 尚未实现，目前新的征程直接清档
- v3.4 第4轮代码改造（存档结构升级、src 代码改造）是下一个大块工作，详见 design/README.md
