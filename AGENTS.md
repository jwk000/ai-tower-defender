# AGENTS.md — 塔防游戏（Tower Defender）

> 设计文档: `design/README.md`

## ⛔ 核心铁律：每完成一个任务立即提交代码

> **这是最重要的规范，优先级高于一切。违反此规则视为任务未完成。**

- **触发时机**: 每完成一个逻辑任务单元（功能实现/修复/重构完成），不等用户提醒，立即执行 `git add` + `git commit`
- **提交信息**: 使用任务描述作为 commit message，格式：`feat/fix/refactor: <简短描述>`
- **绝不**: 累积多个任务的改动后一并提交
- **绝不**: 等待用户提醒才提交

## ⛔ 沟通铁律：不要向人类询问代码实现细节

> **人类关心产品设计和技术框架设计，不关心代码实现细节。实现层面的决策由你自主完成。**

- **禁止行为**: 就具体实现方式向人类提问，例如：
  - "应该用哪个变量名？"
  - "这个函数放在 A 文件还是 B 文件？"
  - "用 for 循环还是 map？"
  - "这里要不要加个缓存？"
  - "类型应该定义成 interface 还是 type？"
  - 其他任何只涉及代码层面、不影响产品体验和架构边界的细节决策。
- **允许行为（应该问）**: 涉及以下层面的问题必须与人类确认：
  - **产品设计**: 玩法机制、数值规则、交互流程、UI 表现、用户体验取舍。
  - **技术框架设计**: 模块边界划分、新增系统/组件的职责定位、跨模块依赖关系、关键架构变更（如引入新的状态管理方式、渲染管线调整、ECS 规则变动等）。
  - **需求歧义**: 用户描述存在多种合理解读且效果差异显著时。
- **判断标准**: 提问前自问 ——"这个问题的答案会改变玩家看到/感受到的东西吗？会改变模块之间的契约吗？" 如果都不会，那就是实现细节，自己决策。
- **决策原则**: 实现细节遵循"匹配现有代码风格 → 遵循最佳实践 → 选择最简单可行方案"的优先级，必要时在提交说明里简述选择理由即可。

## 构建与运行

```bash
npm run dev          # 启动开发服务器 (localhost:3000)
npm run build        # tsc --noEmit && vite build
npm run typecheck    # 仅类型检查，不产出文件
npm test             # 运行 vitest 测试
npm run release      # clean + typecheck + build
.\build.ps1 <cmd>    # Windows 包装脚本（或使用 `make <cmd>`）
```

构建流水线强制执行顺序：`typecheck → clean → build`。类型错误 = 构建失败。

## 架构

**配置驱动 + 规则引擎 + bitecs ECS + PixiJS WebGL** 四层架构。详见 [`design/60-tech/60-architecture.md`](./design/60-tech/60-architecture.md) §2-§5。

- **ECS 框架**: [`bitecs`](https://github.com/NateTheGreatt/bitecs) —— 数据导向 ECS，SoA（Structure of Arrays）内存布局，类型安全查询。
- **渲染**: PixiJS WebGL —— `Graphics`（几何图形）+ `ParticleContainer`（粒子特效）+ `Container`（分层管理），程序化几何图形构成所有视觉元素。
- **配置驱动**: 单位/卡牌/关卡/技能 Buff 全部由 YAML 配置定义，策划可编辑、运行时加载。
- **规则引擎**: 将声明式配置（如 `onDeath`、`onHit` 生命周期、目标选择/攻击模式行为规则）转换为运行时行为，在 ECS 系统之间提供配置驱动的调度层。

### ECS 规则（bitecs）

- **组件**: 使用 `defineComponent({ field: Types.f32 })` 定义，组件即字段集合，数据以 SoA 形式存储。组件本体没有方法，纯数据。
- **实体**: `addEntity(world)` 返回 `eid: number`；`addComponent(world, Component, eid)` 挂载组件。
- **查询**: 系统内部用 `defineQuery([CompA, CompB])` 声明，每帧调用查询函数获取匹配实体数组（AND 逻辑）。查询有类型推断，避免字符串标签。
- **系统**: 实现 `System` 接口 —— `{ name: string; update(world: TowerWorld, dt: number): void }`。系统自管查询，不再依赖 World 预过滤。
- **管线顺序**: 8 阶段拓扑排序（详见 `core/pipeline.ts`），不可随意调换：
  1. `PHASE_MANAGERS` —— 经济 / 波次 / 天气等独立管理器
  2. `PHASE_VFX` —— 死亡 / 爆炸 / 闪电 / 激光等视觉计时
  3. `PHASE_MODIFIERS` —— Buff / 治疗等状态修改
  4. `PHASE_GAMEPLAY` —— 移动 / 攻击 / 弹道 / 技能 / 陷阱 / 生产
  5. `PHASE_LIFECYCLE` —— 生命周期事件分发 + 死亡检测
  6. `PHASE_CREATION` —— 建造 / 实体新建
  7. `PHASE_AI` —— AI执行
  8. `PHASE_RENDER` —— `RenderSystem` + `UISystem`，始终最后
- **死亡实体清理**: `destroyEntity(eid)` 标记延迟删除，在 `World.update()` 末尾统一 `removeEntity` 清理。

### 规则引擎

- **生命周期事件**: `onCreate` / `onDeath` / `onHit` / `onAttack` / `onKill` / `onUpgrade` / `onDestroy` / `onEnter` / `onLeave`。
- **触发流程**: 系统检测事件 → 调用 `ruleEngine.dispatch(event, entity, context)` → 引擎查找该单位配置的规则 → 执行对应 `RuleHandler`（如 `deal_aoe_damage`、`apply_buff`、`spawn_unit`）。
- **行为规则**: 单位配置中声明 `targetSelection` / `attackMode` / `movementMode`，规则引擎在 AttackSystem / MovementSystem 中提供决策。
- **新增规则**: 在 `core/RuleHandlers.ts` 注册新 handler，再在单位 YAML 中引用，无需改动系统代码。

### 渲染层级（PixiJS）

- PixiJS Stage 分层 Container，渲染顺序由 Container 添加顺序决定（无需手动命令缓冲）。
- `RenderSystem` 同步实体组件到 PixiJS Display Object，按 Y 坐标排序场景实体。
- `UIRenderer` / `UISystem` 在最顶层 Container 绘制 HUD、工具栏、手牌区、弹窗等。
- 文本使用 PixiJS `Text` 对象，与图形共用同一渲染管线。

### 输入派发

- `InputManager` 将原始事件入队，每帧 `flush()` 处理，避免在事件回调中操作 ECS。
- `onPointerDown` 派发优先级：UI 按钮 → 手牌区拖卡 → 战场建造放置 → 单位选择。
- UI 面板区域（坐标根据响应式布局动态计算）不进入战场点击逻辑。

## 开发流程

1. **设计先行，代码在后。** 任何功能从设计文档开始。代码必须与文档一致 —— 文档是事实来源。
2. **代码与文档一致性审查。** 写完代码后由审查 agent 校验代码与文档的一致性。文档优先级最高，代码必须改成与文档一致。
3. **原子任务、原子提交。** 把开发工作拆分成只做一件事的任务。完成后立刻提交，commit message 即任务描述。
4. **变更先入文档。** 任何验收问题或需求变更必须先写入文档，再修改代码。
5. **始终用中文回复。** 本项目所有沟通必须使用中文。
6. **开发日志。** 每次对话结束时，agent 必须写一份开发日志。日志按日期归档（每天一个文件），保留完整历史。
