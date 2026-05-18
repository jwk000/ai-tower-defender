HANDOFF CONTEXT - v3.5设计文档更新（2026-05-18）
===============

USER REQUESTS (AS-IS)
---------------------
- 设计文档修改：1，关卡外的卡池中每种卡只有一张，关卡内战斗中抽卡系统会在整个卡池里随机，没有数量限制；2，关卡内手牌固定4张，打出一张卡立即随机抽下一张卡放入手牌；3.关卡内增加人口上限，每张卡打出需要消耗能量点，卡创建的场上单位占用一定人口数（等同于能量点），用人口上限防止玩家使用大量高费用卡；4.增加科技树系统，水晶可以用金币升级，共3级，每个级别提升战斗机制相关的数值（人口上限，卡牌等级上限），使用金币解锁卡牌（进入卡池），使用金币升级卡牌（跟随水晶等级限制）；5，科技树替代技能树，原来的技能树合并到科技树系统里，取消技能点的概念；6，去掉关卡内临时升级的设计，容易导致玩家混乱；7，商店购买卡、关卡奖励卡可以直接解锁科技树上的节点，不依赖前置节点解锁；

GOAL
----
继续完成 v3.5 设计文档的剩余更新工作（11-economy.md、22-skill-tree-overview.md、22a-22e 技能树、48-shop-redesign、50-mda、README.md）

WORK COMPLETED
--------------
- 已确认用户的7条变更的设计意图（通过问答）：
  - 变更4的"水晶"=防御Crystal本体（花金币升级它，Lv1→Lv3）
  - 技能树节点保留（改货币 SP→金币），节点设计迁移至科技树
  - 人口=持续占用型（单位死亡后释放人口）
  - 获得卡=自动解锁科技树对应节点（无前置依赖）
- 创建了 design/v3.5-MAJOR-MIGRATION.md（v3.5 主声明文档，7项变更+受影响文档清单+不变式+迁移规划）
- 更新了 design/10-gameplay/10-roguelike-loop.md v3.0.0：
  - §1 玩法定位改为二资源（删SP），三大支柱重写
  - §2 卡牌系统完全重写：卡池每种1张/手牌打出立即抽/新增人口系统/科技树升级/废弃instanceLevel
  - §3.2 商店边界删SP引用
  - §4.3 改为二资源分工（删SP整行）
  - §11 不变式更新（删INV-02/08，修INV-01/07，新增INV-11/12/13）
- 已提交：docs: v3.5 形态级重构 - 主声明文档 + Run长征循环文档更新

CURRENT STATE
-------------
- 当前在 /Users/happyelements/ai-games/ai-tower-defender
- v3.5 第 1 轮已完成（主声明 + Run 循环文档），已 commit
- 无未提交变更

PENDING TASKS
-------------
高优先级：
1. 重写 design/10-gameplay/11-economy.md
   - 删除§4 SP整章（替换为"技能点 SP 已废弃"说明）
   - §1 三资源 → 二资源（删SP行，新增人口说明：人口是关内资源，不在三资源框架内）
   - §3 金币：新增用途 Crystal升级 + 卡牌升级（科技树）
   - 删除§3.5 金币→SP兑换 整节
   - §8 已删除机制：新增"技能点SP系统"条目
   - 注意：§8 里有"旧的人口资源P"提及，v3.5 的人口系统是重新引入（语义不同），需区分说明

2. 整文重写 design/20-units/22-skill-tree-overview.md → 科技树总览
   - 文件从"技能树系统总览"改名为"科技树总览（v3.5）"
   - 核心内容：
     a. Crystal 升级机制（Lv1→Lv3，花金币，提升人口上限+卡牌等级上限）
     b. 卡牌等级系统（等级1/2/3对应原depth=1/2/3节点效果）
     c. 解锁机制：获得卡=自动解锁（无前置依赖图）
     d. 升级机制：花金币升等级，受Crystal等级上限约束
     e. RunManager 接口：crystalLevel, cardLevels 替代 skillPoints, skillTreeState
     f. UI草图：左侧卡牌列表 + 右侧等级升级面板（简化，无路径互斥）

3. 更新 22a-22e（只需轻量更新，不用重写）：
   - 顶部添加 v3.5 变更声明块
   - spCost 字段 → goldCost
   - 路径互斥→线性等级说明
   - 22d-skill-tree-spell.md：删除精炼术(refining)节点、buff_instance 子类型引用
   - 22a-22e 节点设计（RuleHandler效果）本身保留不动

中优先级：
4. 更新 design/40-presentation/48-shop-redesign-v34.md
   - 顶栏资源显示：删除技能点 SP
   - 商店槽位调整：删除"技能点兑换卡"（槽5），可能替换为"Crystal升级"道具
   - 更新 RunManager 接口引用（删 skillPoints）

5. 更新 design/50-data-numerical/50-mda.md
   - 标记§17（技能点SP系统）为废弃/删除
   - 新增§NEW-CRYSTAL：人口上限数值（Lv1/2/3）+ Crystal升级金币费用占位
   - 其余章节保持不变

6. 更新 design/README.md
   - 在 v3.4 声明之后添加 v3.5 形态级重构声明
   - 更新文档状态表（新增 v3.5-MAJOR-MIGRATION 条目）

KEY FILES
---------
- design/v3.5-MAJOR-MIGRATION.md — v3.5 主声明（已完成）
- design/10-gameplay/10-roguelike-loop.md — Run长征循环 v3.0.0（已完成）
- design/10-gameplay/11-economy.md — 经济系统（待修改：删SP整章，改二资源轴）
- design/20-units/22-skill-tree-overview.md — 技能树总览（待整文重写为科技树总览）
- design/20-units/22a-skill-tree-tower.md — 7塔技能树（待更新：spCost→goldCost）
- design/20-units/22d-skill-tree-spell.md — 14法术（待更新：删精炼术 refining + instanceLevel 引用）
- design/40-presentation/48-shop-redesign-v34.md — 商店+SP（待更新：删SP）
- design/50-data-numerical/50-mda.md — 数值真理源（待更新：删§17 SP）

IMPORTANT DECISIONS
-------------------
- "水晶(Crystal)"=防御核心Crystal，花金币升级（Lv1-3），提升人口上限+卡牌等级上限
- 22a-22e 的节点设计（RuleHandler效果）保留，只将 spCost 改为 goldCost
- 路径互斥机制废弃，改为线性等级成长（等级N=原depth=N节点效果）
- 获得卡=自动解锁科技树对应节点（无前置依赖图，任意节点可直接解锁）
- 人口=持续占用型（单位在场占用=energyCost，死亡释放）
- instanceLevel 整套废弃（23-skill-buff §7整节删除，22d精炼术删除）
- 手牌始终4张（打出立即补，无卡组/弃牌堆结构）
- 关外卡池每种卡唯一（不重复持有多张同种卡）

EXPLICIT CONSTRAINTS
--------------------
- 始终用中文回复（AGENTS.md规定）
- 每完成一个逻辑任务单元立即 git commit（AGENTS.md核心铁律）
- 这是设计文档修改，不涉及代码实现（代码改造是第4轮的事）
- 修改文档时要更新 frontmatter version + last-modified + 修订历史

CONTEXT FOR CONTINUATION
------------------------
- 新建会话后，直接开始修改 11-economy.md（最紧迫的文档）
- 11-economy.md §8"已删除机制"里有"旧的人口资源P"条目（v3.0删除），v3.5的人口是全新引入，两者语义不同，新文档要区分说明
- 22-skill-tree-overview.md 需要整文重写量最大，建议单独一个 commit
- 提醒：23-skill-buff.md §7 instanceLevel 整节需要删除（v3.5废弃）—— 目前尚未处理
- 提醒：47-level-map-ui.md 的关间节点可能需要新增 Crystal 升级选项（目前文档里没有）—— 可以第3轮处理
