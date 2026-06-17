# 07 — 音效设计

> **定位**: 表现层 — 所有音效（SFX）与背景音乐（BGM）的完整清单和设计规范
> **依赖**: 02-gameplay（游戏规则），03-units（单位定义），04-levels（关卡数据），05-presentation（视觉表现）
> **被引用**: 06-technical（技术实现）

---

## 1. 音效系统架构

### 1.1 双轨制

| 系统 | 类 | 职责 | 格式 |
|------|-----|------|------|
| **SFX（音效）** | `Sound` (`src/utils/Sound.ts`) | 短促反馈音效，即时播放 | OGG（文件）+ WAV（合成回退） |
| **BGM（背景音乐）** | `Music` (`src/utils/Music.ts`) | 循环背景音乐，交叉淡入淡出 | OGG / MP3 |

### 1.2 播放规则

| 规则 | 说明 |
|------|------|
| 全局并发限制 | 150ms 滑动窗口内最多 8 个并发音效 |
| Per-key 节流 | 高频音效（塔攻击 80-250ms，命中 50-250ms） |
| UI 音效不节流 | `ui_click`、`build_place` 等即时反馈不设延迟 |
| 音频解锁 | 首次用户交互（pointerdown/click）时解锁 AudioContext |
| 设备适配 | 非浏览器环境自动跳过（支持 Node.js 测试运行器） |

### 1.3 音效来源

| 来源 | 说明 | 覆盖 |
|------|------|------|
| **音频文件** | `public/sfx/` 中的外部音频文件 | 95 个 SFX 键 |
| **SoundSynth 合成** | `src/utils/SoundSynth.ts` 程序化生成 WAV | 运行时备用波形 |
| **BGM 文件** | `public/bgm/` 中的外部音乐文件 | 19 个 BGM 键 |

---

## 2. SFX 音效完整清单

### 2.1 塔攻击音效（10 种塔）

| SFX Key | 塔类型 | 设计意图 | 实现来源 |
|---------|--------|---------|---------|
| `tower_arrow` | 箭塔 | 弓弦声 + 箭矢破空 | OGG + Synth |
| `tower_cannon` | 炮塔 | 低音炮击 + 混响 | OGG + Synth |
| `tower_ice` | 冰塔 | 晶体高音扫掠 + 闪光混响 | OGG + Synth |
| `tower_lightning` | 电塔 | 带通噪声电弧 + 低频轰鸣 | OGG + Synth |
| `tower_laser` | 激光塔 | 持续能量束扫掠 | OGG + Synth |
| `tower_bat` | 蝙蝠塔 | 低频扑翼扫掠 | OGG + Synth |
| `tower_missile` | 导弹塔 | 重型发射轰鸣 + 低频拖尾 | OGG + Synth |
| `tower_fire` | 火塔 | 火焰喷发声 + 温暖谐波 | OGG + Synth |
| `tower_poison` | 毒塔 | 毒液喷射 + 低沉气泡 | OGG + Synth |
| `tower_ballista` | 弩塔 | 弩矢发射后的短促破空呼啸，突出高伤穿透感 | OGG + Synth |

### 2.2 弹道命中音效

| SFX Key | 命中类型 | 设计意图 | 实现来源 |
|---------|---------|---------|---------|
| `arrow_hit` | 箭矢命中 | 木质闷响 | OGG + Synth |
| `cannon_hit` | 炮击命中 | 大爆炸冲击 + 混响尾音 | OGG + Synth |
| `ice_hit` | 冰晶命中 | 晶体碎裂 + 叮当声 | OGG + Synth |
| `lightning_hit` | 闪电命中 | 电击滋啦 + 低频闷响 | OGG + Synth |
| `missile_impact` | 导弹命中 | 巨型爆炸 + 长混响拖尾 | OGG + Synth |
| `fire_hit` | 火焰命中 | 灼烧嘶嘶声 | OGG + Synth |
| `poison_hit` | 毒液命中 | 液体溅射 + 腐蚀声 | OGG + Synth |
| `ballista_hit` | 弩箭命中 | 穿透式重击 | OGG + Synth |

### 2.3 敌人事件音效

| SFX Key | 事件 | 触发时机 | 实现来源 |
|---------|------|---------|---------|
| `enemy_spawn` | 敌人出生 | 每 3 个出怪触发一次 | OGG + Synth |
| `enemy_death` | 敌人死亡 | 击杀敌人后 | OGG + Synth |
| `enemy_hit` | 敌人受击 | 弹道命中时 | OGG + Synth |
| `enemy_attack` | 敌人近战攻击 | 敌人普攻 | OGG + Synth |
| `mage_attack` | 法师远程攻击 | 法师弹道发射 | OGG + Synth |
| `exploder_boom` | 自爆爆炸 | 自爆单位/技能 | OGG + Synth |
| `base_hit` | 水晶受击 | 水晶命中（失败判定前） | OGG + Synth |
| `boss_phase2` | Boss 二阶段 | HP 低于阈值进入狂暴 | OGG + Synth |
| `enemy_death_heavy` | 重型敌人死亡 | 大型/高护甲单位死亡 | OpenGameArt CC0 OGG |
| `enemy_death_magic` | 魔法敌人死亡 | 法师/亡灵/深渊单位死亡 | OpenGameArt CC0 OGG |
| `enemy_death_machine` | 机械敌人死亡 | 机器狗等机械单位死亡 | OpenGameArt CC0 OGG |
| `enemy_death_flying` | 飞行敌人死亡 | 飞机/无人机等低空单位死亡 | OpenGameArt CC0 OGG |
| `enemy_spawn_flying` | 飞行敌人出生 | 低空单位入场 | OpenGameArt CC0 OGG |
| `enemy_spawn_machine` | 机械敌人出生 | 机械单位入场 | OpenGameArt CC0 OGG |
| `enemy_spawn_undead` | 亡灵敌人出生 | 亡灵/混沌单位入场 | OpenGameArt CC0 OGG |

### 2.4 Boss 技能音效

| SFX Key | Boss | 技能 | 实现来源 |
|---------|------|------|---------|
| `boss_split` | 巨型史莱姆 | 死亡分裂 | OGG + Synth |
| `boss_summon` | 虫族女王 / 路西法 | 召唤随从 | OGG + Synth |
| `boss_missile` | 超级机器人 | 远程导弹轰炸 | OGG + Synth |
| `boss_devour` | 深渊领主 | 黑暗吞噬 | OGG + Synth |
| `boss_enter_slime` | 巨型史莱姆 | 出场 | OpenGameArt CC0 OGG |
| `boss_enter_beetle` | 虫族女王 | 出场 | OpenGameArt CC0 OGG |
| `boss_enter_lucifer` | 路西法 | 出场 | OpenGameArt CC0 OGG |
| `boss_enter_robot` | 超级机器人 | 出场 | OpenGameArt CC0 OGG |
| `boss_enter_abyss` | 深渊领主 | 出场 | OpenGameArt CC0 OGG |
| `boss_death_heavy` | 主线 Boss | 重型死亡 | OpenGameArt CC0 OGG |
| `boss_death_void` | 深渊领主 | 虚空死亡 | OpenGameArt CC0 OGG |
| `boss_missile_warning` | 超级机器人 | 导弹预警 | OpenGameArt CC0 OGG |
| `boss_missile_impact` | 超级机器人 | 导弹落地 | OpenGameArt CC0 OGG |
| `boss_devour_cast` | 深渊领主 | 吞噬施法 | OpenGameArt CC0 OGG |
| `boss_devour_impact` | 深渊领主 | 吞噬命中 | OpenGameArt CC0 OGG |
| `boss_summon_insect` | 虫族 Boss | 虫群召唤 | OpenGameArt CC0 OGG |
| `boss_summon_undead` | 路西法 | 亡灵召唤 | OpenGameArt CC0 OGG |
| `boss_summon_machine` | 机械 Boss | 机械召唤 | OpenGameArt CC0 OGG |
| `boss_summon_void` | 深渊/菌群 Boss | 虚空召唤 | OpenGameArt CC0 OGG |
| `boss_phase_ice` | 冰霜 Boss | 冰霜阶段/控制 | OpenGameArt CC0 OGG |
| `boss_phase_void` | 深渊 Boss | 虚空阶段/扭曲 | OpenGameArt CC0 OGG |
| `boss_phase_enrage` | Boss | 狂暴阶段 | OpenGameArt CC0 OGG |

### 2.5 波次系统音效

| SFX Key | 事件 | 设计意图 | 实现来源 |
|---------|------|---------|---------|
| `wave_start` | 波次开始 | 号角/警报 | OGG |
| `wave_boss` | Boss 波 | 深沉号角 + 泛音混响 | OGG + Synth |
| `wave_clear` | 波次清除 | 上升双音阶 | OGG + Synth |
| `countdown_tick` | 倒计时滴答 | 高频短促三角波 | OGG + Synth |
| `countdown_go` | 倒计时出发 | 上升扫掠 | OGG + Synth |

### 2.6 建造与升级音效

| SFX Key | 事件 | 设计意图 | 实现来源 |
|---------|------|---------|---------|
| `build_place` | 建造放置 | 确认放置 - 机械锁扣 | OGG |
| `build_deny` | 建造拒绝 | 低沉拒绝 | OGG + Synth |
| `upgrade` | 塔升级 | 上升音阶 | OGG + Synth |
| `sell` | 塔出售 | 下降音阶 + 低通滤波 | OGG + Synth |

### 2.7 经济音效

| SFX Key | 事件 | 设计意图 | 实现来源 |
|---------|------|---------|---------|
| `gold_earn` | 金币获得 | 高频叮当 | OGG + Synth |
| `gold_spend` | 金币花费 | 下降音阶 + 低通 | OGG + Synth |

### 2.8 UI 交互音效

| SFX Key | 事件 | 设计意图 | 实现来源 |
|---------|------|---------|---------|
| `ui_click` | UI 点击 | 温暖三角波短音 | OGG + Synth |
| `ui_error` | UI 错误 | 低沉三角波 + 低通 | OGG + Synth |
| `draft_select` | 3 选 1 确认 | 卡牌确认音 | OGG + Synth |
| `buff_select` | Buff 选择确认 | 强化确认音 | OGG + Synth |

### 2.9 技能卡音效

| SFX Key | 技能 | 设计意图 | 实现来源 |
|---------|------|---------|---------|
| `skill_taunt` | 嘲讽 | 深沉战吼 | OGG + Synth |
| `skill_whirlwind` | 旋风斩 | 旋转扫掠 + 风声 | OGG + Synth |
| `skill_fireball` | 火球术 | 火焰爆发 | OGG + Synth |
| `skill_arrow_rain` | 剑雨 | 箭矢齐发呼啸 | OGG + Synth |
| `skill_blizzard` | 暴风雪 | 寒风呼啸 | OGG + Synth |
| `skill_bomb` | 炸弹 | 计时滴答 + 爆炸 | OGG + Synth |
| `skill_earthquake` | 大地裂变 | 持续低频地震隆隆声 + 地面开裂 | OGG + Synth |

### 2.10 自施法技能音效

| SFX Key | 技能卡 | 设计意图 | 实现来源 |
|---------|--------|---------|---------|
| `gold_earn` | 淘金热 | 金币获得反馈 | **OGG + Synth fallback** |

### 2.11 天气音效

| SFX Key | 事件 | 设计意图 | 实现来源 |
|---------|------|---------|---------|
| `weather_change` | 天气切换 | 渐变扫掠 + 混响 | OGG + Synth |

### 2.12 胜利/失败音效

| SFX Key | 关卡 | 设计意图 | 实现来源 |
|---------|------|---------|---------|
| `victory` | 通用 | 四音阶上升胜利号角 | OGG + Synth |
| `victory_meadow` | 第 1 关 | 草原主题胜利 | OGG + Synth |
| `victory_desert` | 第 2 关 | 沙漠主题胜利 | OGG + Synth |
| `victory_castle` | 第 3 关 | 古堡主题胜利 | OGG + Synth |
| `victory_waste` | 第 4 关 | 废土主题胜利 | OGG + Synth |
| `victory_abyss` | 第 5 关 | 深渊主题胜利 | OGG + Synth |
| `defeat` | 全部 | 下行旋律失败 | OGG + Synth |

### 2.13 状态效果音效

| SFX Key | 状态效果 | 设计意图 | 实现来源 |
|---------|---------|---------|---------|
| `freeze_apply` | 冰冻施加 | 结冰晶体声 | OGG + Synth |
| `stun_apply` | 眩晕施加 | 撞击眩晕声 | OGG + Synth |
| `poison_tick` | 中毒跳伤 | 腐蚀滴答 | OGG + Synth |
| `burn_tick` | 灼烧跳伤 | 火焰噼啪 | OGG + Synth |

### 2.14 士兵音效

| SFX Key | 事件 | 设计意图 | 实现来源 |
|---------|------|---------|---------|
| `soldier_deploy` | 士兵部署 | 单位放置确认 | OGG + Synth |
| `soldier_death` | 士兵阵亡 | 单位死亡哀嚎 | OGG + Synth |
| `soldier_heal` | 治疗生效 | 温暖治疗音 | OGG + Synth |

---

## 3. BGM 背景音乐清单

### 3.1 战斗音乐

| BGM Key | 关卡 | 主题 | 文件 | 来源 |
|---------|------|------|------|------|
| `main_menu` | 主菜单 | 冒险启程 | `bgm/main_menu.ogg` | OpenGameArt CC-BY-SA |
| `battle_default` | 通用 | 电子幻想 | `bgm/battle_default.ogg` | OpenGameArt CC-BY |
| `battle_meadow` | 第 1 关 | 草原仙堡 | `bgm/battle_meadow.mp3` | OpenGameArt CC0 |
| `battle_desert` | 第 2 关 | 沙漠循环 | `bgm/battle_desert.mp3` | OpenGameArt CC0 |
| `battle_castle` | 第 3 关 | 恐怖城堡 | `bgm/battle_castle.ogg` | OpenGameArt CC-BY |
| `battle_waste` | 第 4 关 | 钢铁废土 | `bgm/battle_waste.ogg` | OpenGameArt CC0 |
| `battle_abyss` | 第 5 关 | 黑暗深渊 | `bgm/battle_abyss.mp3` | OpenGameArt CC-BY |
| `battle_intense` | Boss 战 | 史诗 Boss 战 | `bgm/battle_intense.mp3` | OpenGameArt CC-BY-SA |
| `battle_snow` | 雪地（预留） | → `battle_meadow.mp3` | 回退 | — |
| `battle_lava` | 熔岩（预留） | → `battle_abyss.mp3` | 回退 | — |

### 3.2 转换音乐

| BGM Key | 场景 | 文件 | 来源 |
|---------|------|------|------|
| `wave_break` | 波间休息 | `bgm/wave_break.ogg` | OpenGameArt CC0 |
| `victory` | 胜利通用 | `bgm/victory.ogg` | OpenGameArt CC0 |
| `victory_meadow` | 第 1 关胜利 | `bgm/victory_meadow.ogg` | OpenGameArt CC0 |
| `victory_desert` | 第 2 关胜利 | `bgm/victory_desert.ogg` | OpenGameArt CC0 |
| `victory_castle` | 第 3 关胜利 | `bgm/victory_castle.ogg` | OpenGameArt CC0 |
| `victory_waste` | 第 4 关胜利 | `bgm/victory_waste.ogg` | OpenGameArt CC0 |
| `victory_abyss` | 第 5 关胜利 | `bgm/victory_abyss.ogg` | OpenGameArt CC0 |
| `defeat` | 失败 | `bgm/defeat.mp3` | OpenGameArt CC0 |
| `endless` | 无限模式 | `bgm/endless.ogg` | OpenGameArt CC-BY-SA |

---

## 4. 音效缺口分析

### 4.1 已覆盖（有文件或有合成器）

| 类别 | 覆盖数 | 状态 |
|------|--------|------|
| 塔攻击 (10 种) | 10/10 | ✅ 全部有 OGG 文件 |
| 弹道命中 (8 种) | 8/8 | ✅ 全部有 OGG 文件 |
| 敌人事件 (15 种) | 15/15 | ✅ 通用 OGG + 类型化 OpenGameArt CC0 OGG |
| Boss 技能/事件 (22 种) | 22/22 | ✅ 通用 OGG + 专属 OpenGameArt CC0 OGG |
| 波次系统 (5 种) | 5/5 | ✅ |
| 建造升级 (4 种) | 4/4 | ✅ |
| 经济 (2 种) | 2/2 | ✅ |
| UI (4 种) | 4/4 | ✅ 全部有 OGG 文件 |
| 技能卡 (7 种) | 7/7 | ✅ 全部有 OGG 文件或 Synth fallback |
| 自施法技能 (1 种) | 1/1 | ✅ 使用金币获得音效 |
| 天气 (1 种) | 1/1 | ✅ |
| 胜利/失败 (7 种) | 7/7 | ✅ SFX 全部有 OGG 文件，BGM 主题胜利曲已补齐 |
| 状态效果 (4 种) | 4/4 | ✅ 全部有 OGG 文件 |
| 士兵 (3 种) | 3/3 | ✅ 全部有 OGG 文件 |
| **合计** | **96** | ✅ 全部覆盖 |

### 4.2 低优先级 - 暂缓

| 缺口 | 原因 |
|------|------|
| 敌人类型专属死亡音效 (20+) | 工程量大，当前通用 `enemy_death` 可接受 |
| 塔被摧毁音效 | 极少触发，当前无声可接受 |
| 暂停/恢复音效 | 非必需 |
| 卡牌拖拽悬停音效 | 过多 UI 噪音，不推荐 |

---

## 5. 音效设计原则

### 5.1 风格基调

- **参考**: Warcraft 3 史诗风格 — 深沉低音 + 混响尾音 + 温暖谐波
- **声音类型**: 避免尖锐刺耳的高频；偏好闷响、轰鸣、晶体等耐听音色
- **UI 音效**: 温暖、不刺耳，支持高频次点击不疲劳

### 5.2 分层策略

| 音效层 | 说明 |
|--------|------|
| **高频次** (塔攻击/命中) | 200-500ms 短促，有节流控制，不清脆刺耳 |
| **中频次** (敌人死亡/金币) | 200-500ms，可带混响尾音 |
| **低频次** (波次/Boss/胜利) | 500-2000ms，可复杂编配，强调史诗感 |
| **UI** | 30-100ms，极短促，温暖三角波 |

### 5.3 距离感模拟（计划）

- 当前所有音效无空间化，统一音量
- 未来可基于屏幕坐标衰减（远处敌人音量降低）
- 优先级：塔攻击 > 敌人音效 > 环境音效

---

## 6. 新增音效集成指南

### 6.1 添加外部音频文件

1. 将 `.ogg` / `.wav` 文件放入 `public/sfx/` 或 `public/bgm/`
2. 若为新 SfxKey，在 `src/utils/Sound.ts` 中：
   - 添加到 `SfxKey` union 类型
   - 在 `SFX_PATH` 中添加路径映射
   - 可选：在 `PER_KEY_THROTTLE_MS` 中设置节流
3. 若为新 BgmKey，在 `src/utils/Music.ts` 中同样操作

### 6.2 添加程序化合成音效

1. 确保 SfxKey 已在 `Sound.ts` 中定义
2. 在 `src/utils/SoundSynth.ts` 的 `generators` 对象中添加生成函数
3. 使用 `tone()` / `sweep()` / `impact()` / `noise()` / `bandNoise()` 等辅助函数
4. 遵循 Warcraft 3 史诗风格调性

### 6.3 触发音效

```typescript
import { Sound } from '../utils/Sound.js';
Sound.play('your_sfx_key');
```

---

## 7. 版权声明

### 7.1 BGM 来源

所有 BGM 来自 [OpenGameArt.org](https://opengameart.org)，许可证包括 CC0（公共领域）、CC-BY（需署名）和 CC-BY-SA（需署名 + 相同许可证）。详见 `public/bgm/CREDITS.md`。

### 7.2 SFX 来源

SFX 版权与原始文件对应关系维护在 `public/sfx/CREDITS.md`。弩塔飞行音效 `tower_ballista.ogg` 使用 OpenGameArt `80-CC0-RPG-SFX_0.zip` 中的 `blade_01.ogg`，许可证为 CC0 / Public Domain。

| 来源 | 数量 | 许可 |
|------|------|------|
| OGG 文件 (public/sfx/) | 95 | OpenGameArt CC0 / 合成 / 混合来源 |
| BGM 文件 (public/bgm/) | 17 | OpenGameArt |
| SoundSynth 程序化合成 | 运行时备用 | 原创代码生成，无版权限制 |

### 7.3 目标

- 所有外部音频文件使用 CC0 或 CC-BY 许可证
- 新增外部音效优先使用开源音效库下载资源，避免临时程序生成音效进入正式资源
- 商业化使用前须最终审核所有外部文件许可证

---

## 8. 文件统计

| 类别 | 文件数 | 总大小（约） |
|------|--------|------------|
| public/sfx/ | 95 | ~3 MB |
| public/bgm/ | 17 | ~21 MB |
| SoundSynth 生成（运行时） | 备用生成器 | <500 KB（内存缓存） |
| **合计运行时音频** | 114 个声明键 | ~24 MB |

---

> **版本**: v1.2 — 敌方单位与 Boss 专属音效补充
> **最后更新**: 2026-06-16
> **原则**: 所有代码声明的 SFX/BGM 路径必须有实体文件；新增外部音频优先使用 CC0 / Public Domain 来源
