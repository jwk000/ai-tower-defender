# 08 — 美术素材设计

> **定位**: 美术资产层 — 可增加的美术素材清单、规格说明、AI 生成提示词
> **依赖**: 03-units（单位视觉属性）、04-levels（关卡主题）、05-presentation（渲染架构）
> **状态**: 设计提案 — 待确认后实施

---

## 1. 概述

### 1.1 当前视觉状态

游戏当前采用 **100% 程序化几何渲染**：所有视觉内容（塔、敌人、地面、UI、粒子、天气）均由 Canvas 2D 的 6 种几何原语（rect/circle/triangle/diamond/hexagon/arrow）拼接绘制，不存在任何图像/纹理/精灵资产。

当前视觉优势：
- 风格统一、干净利落
- 运行时零加载成本
- 随意缩放不失真

当前视觉短板：
- 缺乏纹理细节和材质感
- 背景为纯色渐变，氛围感不足
- 卡牌仅有色块几何预览，缺少辨识度
- 粒子和特效为简单几何体，表现力有限
- UI 面板为纯色矩形，缺少装饰性

### 1.2 美术增强策略

**不替换现有程序化美术本体**（塔/敌人/士兵的几何外观保留为默认兜底），而是在以下层面叠加美术素材：

| 层级 | 策略 | 提升效果 |
|------|------|---------|
| 背景层 | 每关增加全幅场景背景图 | 极大提升氛围感，成本低 |
| UI 层 | 卡牌插图 + 面板装饰纹理 | 提升 UI 品质感和辨识度 |
| 粒子层 | 特效精灵图替换简单几何体 | 提升战斗表现力和爽感 |
| 地面层 | 地形瓦片纹理 | 提升地图质感 |
| 装饰层 | 场景物件 Sprite | 提升场景丰富度 |

### 1.3 美术风格定位

整体风格：**暗色奇幻 + 几何简约**，融合手绘质感和清晰的轮廓线。

- 与现有几何程序化风格兼容：不追求写实，保持风格化
- 以暗色调为基底（匹配当前 `#1a1a2e` 深蓝黑背景），用高饱和主题色突出重点
- 轮廓清晰、剪影可辨 —— 32px 小单位也能区分阵营
- AI 生成后需经过去背景、统一调色等后处理

---

## 2. 背景与环境素材

### 2.1 规格统一

| 属性 | 值 |
|------|-----|
| 分辨率 | 1920×1080（设计分辨率） |
| 格式 | PNG（透明无需）或 WebP |
| 风格 | 暗色调 + 主题色点缀，不抢前景单位 |
| 层次 | 远景（天空/地平线）+ 中景（建筑/山体轮廓） |
| 渲染位置 | 棋盘背景层（z=0 以下），先于地图瓦片绘制 |

### 2.2 第1关：绿野仙踪（雨夜草原）

**主题色**: 绿地 `#7cb342`、棕色路径 `#8d6e63`、雨天氛围

| 素材 | 描述 |
|------|------|
| `bg_meadow_far` | 远景：阴雨天空 + 远山轮廓 + 低垂乌云 |
| `bg_meadow_mid` | 中景：起伏草地 + 零星树木剪影 + 朦胧雨幕 |

**AI 提示词**:
```
Dark fantasy landscape background, rainy grasslands at night, dark green rolling hills, distant mountain silhouettes under heavy rain clouds, moody atmosphere, deep forest green (#2e4a1e) and dark earth tones, subtle lightning in far clouds, misty rain layers, game background art, stylized, dark atmospheric, 1920x1080, no characters, no UI, no text --ar 16:9
```

### 2.3 第2关：沙漠虫潮（烈日荒漠）

**主题色**: 沙黄 `#e6c44d`、土褐路径 `#bfa045`、晴天烈日

| 素材 | 描述 |
|------|------|
| `bg_desert_far` | 远景：烈日天空 + 热浪扭曲 + 沙丘轮廓 |
| `bg_desert_mid` | 中景：沙丘 + 风化岩石 + 虫洞入口剪影 |

**AI 提示词**:
```
Dark fantasy desert landscape, scorching sun in hazy sky, endless sand dunes, heat waves shimmering, ancient weathered rock formations, giant insect burrow entrances in sand, dark gold (#8b6914) and burnt orange tones, oppressive heat atmosphere, stylized game background, dark atmospheric, 1920x1080, no characters, no UI, no text --ar 16:9
```

### 2.4 第3关：黑暗古堡（暗夜城堡）

**主题色**: 灰白 `#9e9e9e`、石板路径 `#616161`、夜晚

| 素材 | 描述 |
|------|------|
| `bg_castle_far` | 远景：残月夜空 + 古堡塔楼剪影 + 蝙蝠群 |
| `bg_castle_mid` | 中景：城堡外墙废墟 + 枯树 + 雾霭 |

**AI 提示词**:
```
Dark gothic castle landscape at night, ruined castle towers silhouetted against a pale crescent moon, swirling fog banks, dead twisted trees, crumbling stone walls, bat swarms in sky, cold blue-grey (#37474f) and deep black tones, eerie moonlit atmosphere, stylized game background, dark atmospheric, 1920x1080, no characters, no UI, no text --ar 16:9
```

### 2.5 第4关：末日废土（赤红废土）

**主题色**: 焦黑 `#4e342e`、暗红路径 `#5d4037`、红雾

| 素材 | 描述 |
|------|------|
| `bg_wasteland_far` | 远景：红色"眼睛"夕阳 + 断裂地平线 + 火山灰云 |
| `bg_wasteland_mid` | 中景：废墟城市剪影 + 报废车辆 + 浓烟柱 |

**AI 提示词**:
```
Post-apocalyptic wasteland landscape, blood-red sun forming an eye shape in the sky, broken city skyline ruins, rising smoke columns, scattered wrecked vehicles, cracked asphalt ground, volcanic ash clouds, deep crimson (#4a0000) and charcoal black tones, oppressive red haze, stylized game background, dark atmospheric, 1920x1080, no characters, no UI, no text --ar 16:9
```

### 2.6 第5关：深渊裂隙（虚空深渊）

**主题色**: 深紫 `#1a0033`、紫黑路径 `#311b92`、暗夜

| 素材 | 描述 |
|------|------|
| `bg_abyss_far` | 远景：虚空星云 + 漂浮岩石岛 + 紫色能量裂隙 |
| `bg_abyss_mid` | 中景：深渊边缘锯齿地形 + 紫晶簇 + 能量光柱 |

**AI 提示词**:
```
Cosmic void abyss landscape, floating rock islands in purple nebula space, jagged rift edges, glowing violet crystal clusters, crackling purple energy fissures in the ground, ethereal light beams from below, deep indigo (#1a0033) and ultraviolet tones, otherworldly dark atmosphere, stylized game background, dark atmospheric, 1920x1080, no characters, no UI, no text --ar 16:9
```

---

## 3. UI 装饰素材

### 3.1 卡牌外框

**规格**: 120×168px 卡牌底框 + 稀有度边框

| 素材 | 描述 | 用途 |
|------|------|------|
| `card_frame_common` | 灰色金属边框，简洁无装饰 | 普通卡 |
| `card_frame_rare` | 蓝色魔法纹边框，微光符文 | 稀有卡 |
| `card_frame_epic` | 紫色暗纹边框，能量流动线 | 史诗卡 |
| `card_frame_legendary` | 金色华丽边框，光芒四射 | 传说卡 |

**稀有度色值参考**（来自 `LayoutConstants.ts`）:
- Common: `#ffffff`（白）
- Rare: `#2196f3`（蓝）
- Epic: `#9c27b0`（紫）
- Legendary: `#ffc107`（金）

**AI 提示词（通用卡框）**:
```
Dark fantasy card frame border, ornate metal trim, [rarity color] glowing runes, dark inner panel (#0d1b2a), 120x168 pixels vertical card layout, stylized fantasy UI element, game interface, clean edges, transparent outer area, centered --ar 5:7
```

### 3.2 HUD 装饰条

**规格**: 1920×36px（顶部HUD） + 可平铺

| 素材 | 描述 |
|------|------|
| `hud_bar_top` | 顶部信息栏暗色金属底纹，左右两端装饰 |
| `hud_divider` | 竖线分隔符，用于 HUD 元素间 |

**AI 提示词**:
```
Dark fantasy UI panel header bar, horizontal, metallic dark steel texture (#0d1b2a), subtle edge highlights, thin gold line bottom border, 1920x36 pixels, game HUD element, clean, minimal decoration, seamless horizontal --ar 53:1
```

### 3.3 面板背景

**规格**: 可平铺纹理，或 512×512 切片

| 素材 | 描述 | 用途 |
|------|------|------|
| `panel_bg_dark` | 暗色羊皮纸/金属质感 | 塔信息面板、暂停菜单 |
| `panel_bg_gold` | 金色边框面板 | 胜利/抽卡界面 |

**AI 提示词**:
```
Dark fantasy UI panel background, seamless texture, dark aged parchment or brushed metal (#1a1a2e base), subtle geometric pattern, very dark and understated, noble dark tone, 512x512 seamless tile, game UI element, no text, no icons --ar 1:1 --tile
```

### 3.4 按钮素材

**规格**: 可变宽 × 42px 高（建议 200×84 @2x）

| 素材 | 描述 |
|------|------|
| `btn_green` | 绿色确认按钮（升级/开始/继续） |
| `btn_red` | 红色按钮（回收/退出/取消） |
| `btn_yellow` | 黄色按钮（重开） |
| `btn_blue` | 蓝色按钮（再抽一次/速度切换） |
| `btn_small_grey` | 灰色小按钮（暂停/图鉴入口） |

**AI 提示词**:
```
Dark fantasy UI button, rounded rectangular, [color] metallic gradient, beveled edges, subtle inner glow, 200x84 pixels, game UI element, centered, clean, no text --ar 5:2
```

---

## 4. 卡牌美术素材

### 4.1 规格

| 属性 | 值 |
|------|-----|
| 插画区域 | 96×80px（卡面内顶部区域） |
| 风格 | 暗色背景 + 单位剪影/象征物 + 主题色强调 |
| 格式 | PNG 透明背景（或暗底不透明） |
| 色板 | 与对应单位 YAML 配置的 color 值一致 |

### 4.2 塔卡（10 张）

| 卡牌 | 颜色 | 核心视觉元素 |
|------|------|------------|
| `card_art_arrow_tower` | `#4fc3f7` 青 | 弓臂+箭矢剪影，飞行箭矢轨迹 |
| `card_art_ballista_tower` | `#78909c` 灰 | 重型弩机正面，穿透箭矢效果 |
| `card_art_cannon_tower` | `#ff8a65` 橙 | 圆形炮管+爆炸火光 |
| `card_art_laser_tower` | `#00e5ff` 青 | 晶体+激光束，光点环绕 |
| `card_art_bat_tower` | `#7c4dff` 紫 | 蝙蝠翅膀+红色核心眼 |
| `card_art_missile_tower` | `#d32f2f` 红 | 导弹发射架+飞行导弹+尾焰 |
| `card_art_ice_tower` | `#81d4fa` 浅蓝 | 冰晶+雪花+霜雾 |
| `card_art_fire_tower` | `#ff5722` 深橙红 | 火焰叠层+火星 |
| `card_art_poison_tower` | `#4caf50` 绿 | 毒囊+绿色毒液滴 |
| `card_art_lightning_tower` | `#fff176` 黄 | 天线+电弧+雷电火花 |

**AI 提示词模板（塔卡）**:
```
Dark fantasy card illustration, [tower description], [color] energy glow, dark background (#0d1b2a), stylized game icon, 96x80 pixels, centered composition, clean silhouette, game art, no text, no UI frame --ar 6:5
```

### 4.3 士兵卡（7 张）

| 卡牌 | 颜色 | 核心视觉元素 |
|------|------|------------|
| `card_art_shield_guard` | `#4dd0e1` 青 | 蓝色塔盾+短剑 |
| `card_art_archer` | `#66bb6a` 绿 | 绿色兜帽+拉弓姿势 |
| `card_art_mage` | `#9c27b0` 紫 | 紫色法杖+魔法光效 |
| `card_art_priest` | `#eeeeee` 白 | 白色长袍+金色十字架/法杖光芒 |
| `card_art_swordsman` | `#e57373` 红 | 长剑+攻击姿势 |
| `card_art_engineer` | `#ffa726` 橙 | 扳手+安全帽 |
| `card_art_assassin` | `#ab47bc` 紫 | 匕首+兜帽暗影 |

### 4.4 机关卡（4 张）

| 卡牌 | 颜色 | 核心视觉元素 |
|------|------|------------|
| `card_art_spike_trap` | `#757575` 灰 | 三根地刺从地面弹出 |
| `card_art_bear_trap` | `#8d6e63` 棕 | 金属夹子张开 |
| `card_art_tar_pit` | `#424242` 深灰 | 粘稠黑色焦油坑 |
| `card_art_boulder` | `#78909c` 灰蓝 | 巨大落石+裂纹 |

### 4.5 技能卡（4 张）

| 卡牌 | 核心视觉元素 |
|------|------------|
| `card_art_fireball` | 燃烧火球+火焰尾迹 |
| `card_art_arrow_rain` | 多支箭矢从天而降 |
| `card_art_blizzard` | 暴风雪+冰晶漩涡 |
| `card_art_bomb` | 炸弹+引信火花 |

### 4.6 奥术卡（5 张）

| 卡牌 | 核心视觉元素 |
|------|------------|
| `card_art_emergency_shield` | 水晶被蓝色护盾包裹 |
| `card_art_arrow_boost` | 箭矢被绿色能量强化 |
| `card_art_shield_boost` | 盾牌被金色光芒加固 |
| `card_art_gold_rush` | 金币堆+闪光 |
| `card_art_speed_boost` | 风之靴/疾跑效果 |

### 4.7 卡图 AI 提示词（30 张完整版）

#### 塔卡（10 张）

**箭塔**:
```
Fantasy tower defense card art: an arrow tower with twin bow arms and a glowing arrow tip pointing upward, cyan (#4fc3f7) magical energy flowing along the bowstring, 2 small floating diamond particles, dark background, stylized game icon, 96x80 pixels, centered composition, no text --ar 6:5
```

**弩塔**:
```
Fantasy tower defense card art: a heavy ballista siege weapon, wide crossbow arms glowing with blue (#2196f3) energy, a massive glowing blue bolt loaded and ready to fire, blue-white gradient energy pulse along the arms, faint blue gear details rotating around the base, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**炮塔**:
```
Fantasy tower defense card art: a circular black cannon barrel, orange (#ff8a65) explosion muzzle flash, thick armored plating on the base, smoke rings rising from the barrel, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**激光塔**:
```
Fantasy tower defense card art: a cyan crystal (#00e5ff) atop a technological base, a continuous purple laser beam firing upward, 3 orbiting light points, a glowing white core pulsing, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**蝙蝠塔**:
```
Fantasy tower defense card art: a gothic tower with large bat wings (#7c4dff purple), a glowing red eye at the center, 2 small bat silhouettes orbiting around, dark mystical atmosphere, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**导弹塔**:
```
Fantasy tower defense card art: a missile launch platform, 2 tilted launch tubes, a missile flying upward with orange thruster flame and blue exhaust trail, yellow warning light blinking, radar dish scanning, red (#d32f2f) military aesthetic, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**冰塔**:
```
Fantasy tower defense card art: a crystalline ice tower (#81d4fa light blue), jagged ice shards forming the body, frost mist radiating outward, 4 snowflake particles falling around it, cold ethereal glow, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**火塔**:
```
Fantasy tower defense card art: a tower made of layered flames, bright orange-red (#ff5722) fire triangles decreasing in size upward, 5 ember sparks floating upward, warm orange glow at the base, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**毒塔**:
```
Fantasy tower defense card art: a biological poison tower, a central green (#4caf50) venom sac, two smaller poison glands on the sides, toxic green droplets dripping from the bottom, sickly green mist aura, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**电塔**:
```
Fantasy tower defense card art: a tesla coil tower, a central copper antenna rod, a glowing yellow (#fff176) tesla coil at the top with arcing electricity, lightning sparks jumping from the coil, faint yellow electric corona pulse, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

#### 士兵卡（7 张）

**盾卫**:
```
Fantasy tower defense card art: a shield-bearing soldier, large cyan (#4dd0e1) tower shield with a blue diamond emblem, short sword held ready, sturdy armored stance, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**弓手**:
```
Fantasy tower defense card art: an archer in a green hood (#66bb6a), drawing a wooden longbow, arrow aimed and ready to loose, agile stance, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**法师**:
```
Fantasy tower defense card art: a mage in a pointed wizard hat, holding a purple (#9c27b0) magical staff with a glowing crystal tip, arcane energy swirling, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**牧师**:
```
Fantasy tower defense card art: a priest in flowing white robes (#eeeeee), holding a golden staff with a radiant cross-shaped light, healing aura emanating, serene pose, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**剑士**:
```
Fantasy tower defense card art: a swordsman in a battle-ready stance, a long steel blade gleaming red (#e57373 highlights), dynamic slashing pose, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**工程师**:
```
Fantasy tower defense card art: an engineer wearing an orange (#ffa726) hard hat, holding a large wrench, mechanical gears floating nearby, ready-to-build pose, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**刺客**:
```
Fantasy tower defense card art: a shadowy assassin in a dark hood, twin daggers glowing purple (#ab47bc), stealthy crouching pose, faint smoke around the figure, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

#### 机关卡（4 张）

**地刺**:
```
Fantasy tower defense card art: three sharp grey (#757575) metal spikes bursting upward from the ground, dirt and debris flying, trap mechanism visible below, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**捕兽夹**:
```
Fantasy tower defense card art: a brown (#8d6e63) metal bear trap, two diamond-shaped jaws wide open with jagged teeth, central trigger plate with saw-tooth edge, ready to snap shut, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**焦油坑**:
```
Fantasy tower defense card art: a pool of thick black (#424242) tar, bubbling surface with viscous ripples, dark inner circle showing depth, sticky tendrils reaching up, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**巨石**:
```
Fantasy tower defense card art: a massive grey-blue (#78909c) boulder, deep cracks running across its surface, imposing and immovable presence, small fragments at the base, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

#### 技能卡（4 张）

**火球术**:
```
Fantasy tower defense card art: a massive fireball in mid-flight, orange and yellow flames spiraling, trailing smoke and embers, explosive energy, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**剑雨**:
```
Fantasy tower defense card art: a rain of arrows falling from above, multiple arrow silhouettes angled downward, metallic arrowheads gleaming, dark stormy sky background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**暴风雪**:
```
Fantasy tower defense card art: a fierce blizzard vortex, swirling snow and ice crystals, diamond-shaped ice shards in the wind, cold blue-white color palette, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**炸弹**:
```
Fantasy tower defense card art: a round black bomb with a lit fuse, sparks flying from the burning fuse tip, imminent explosion energy, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

#### 奥术卡（5 张）

**紧急防护**:
```
Fantasy tower defense card art: a red crystal (#ff1744) surrounded by a glowing blue protective shield bubble, energy barrier shimmering with hexagonal patterns, defensive ward, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**箭术精通**:
```
Fantasy tower defense card art: a single arrow being empowered by green (#66bb6a) magical energy, glowing runes along the arrow shaft, power-up effect, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**坚韧守护**:
```
Fantasy tower defense card art: a shield radiating golden (#ffc107) protective light, reinforced edges glowing, unbreakable ward, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**淘金热**:
```
Fantasy tower defense card art: a pile of gold coins sparkling with golden light (#ffd54f), coins mid-bounce, wealth and prosperity, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

**疾风步**:
```
Fantasy tower defense card art: a pair of boots surrounded by swirling wind currents, cyan speed lines, swift movement effect, dark background, stylized game icon, 96x80 pixels, no text --ar 6:5
```

---

## 5. 特效纹理素材

### 5.1 粒子精灵图

当前所有粒子为简单几何体（圆/三角/菱形）。用纹理精灵替换可大幅提升表现力。

| 素材 | 描述 | 规格 | 用途 |
|------|------|------|------|
| `particle_glow_soft` | 柔光圆形粒子 | 64×64 RGBA | 通用光点、爆炸辉光 |
| `particle_spark` | 十字星芒粒子 | 32×32 RGBA | 电击、暴击效果 |
| `particle_smoke` | 烟雾粒子 | 64×64 RGBA | 炮塔烟雾、爆炸余烬 |
| `particle_fire` | 火焰粒子 | 32×32 RGBA | 火塔、火球术 |
| `particle_ice` | 冰晶碎片 | 32×32 RGBA | 冰塔、冰冻效果 |
| `particle_lightning` | 电光粒子 | 48×16 RGBA | 电塔、闪电效果 |
| `particle_poison` | 毒气泡粒子 | 32×32 RGBA | 毒塔、中毒效果 |
| `particle_blood` | 血迹粒子 | 16×16 RGBA | 受击血迹 |

**AI 提示词**:
```
2D game particle sprite, [type], isolated on transparent background, 64x64 pixels, game VFX element, stylized, clean edges, no background --ar 1:1
```

### 5.2 爆炸/冲击纹理

| 素材 | 描述 | 规格 | 用途 |
|------|------|------|------|
| `fx_explosion_orange` | 橙红色爆炸环 | 128×128 | 炮塔/导弹爆炸 |
| `fx_explosion_fire` | 火焰爆炸 | 128×128 | 火球术、火焰范围 |
| `fx_explosion_ice` | 冰霜爆发 | 128×128 | 冰系技能 |
| `fx_explosion_poison` | 毒雾爆发 | 128×128 | 毒系范围 |
| `fx_shockwave_ring` | 冲击波环 | 256×256 | Boss 技能、超级爆炸 |
| `fx_lightning_bolt` | 闪电束 | 256×32 | 闪电链效果 |
| `fx_laser_beam` | 激光束 | 256×16 | 激光塔光束 |
| `fx_magic_circle` | 魔法阵 | 128×128 | 技能释放点、Buff 区域 |

**AI 提示词模板**:
```
2D game explosion sprite, [type], circular, isolated on transparent background, 128x128 pixels, stylized, game VFX, clean edges, no background --ar 1:1
```

---

## 6. 图标素材

### 6.1 资源图标

| 素材 | 描述 | 规格 |
|------|------|------|
| `icon_crystal_hp` | 水晶/HP 图标 | 32×32 |
| `icon_gold_coin` | 金币图标 | 32×32 |
| `icon_wave` | 波次图标 | 24×24 |
| `icon_enemy_count` | 敌军计数图标 | 24×24 |
| `icon_weather` | 天气图标 | 24×24 |
| `icon_timer` | 倒计时图标 | 24×24 |

### 6.2 控制图标

| 素材 | 描述 | 规格 |
|------|------|------|
| `icon_play` | 开始/跳过 | 24×24 |
| `icon_pause` | 暂停 | 24×24 |
| `icon_speed_1x` | 1倍速 | 24×24 |
| `icon_speed_2x` | 2倍速 | 24×24 |
| `icon_encyclopedia` | 卡牌图鉴 | 24×24 |
| `icon_enemy_codex` | 敌人图鉴 | 24×24 |

### 6.3 状态图标

| 素材 | 描述 | 规格 | 用途 |
|------|------|------|------|
| `status_frozen` | 冻结状态 | 16×16 | 冰冻标记 |
| `status_slow` | 减速状态 | 16×16 | 减速标记 |
| `status_stun` | 眩晕状态 | 16×16 | 眩晕标记 |
| `status_poison` | 中毒状态 | 16×16 | 中毒标记 |
| `status_burn` | 灼烧状态 | 16×16 | 灼烧标记 |
| `status_elite` | 精英标记 | 16×16 | 精英怪头顶 |
| `status_boss` | Boss 标记 | 20×20 | Boss 头顶 |

### 6.4 伤害类型图标

| 素材 | 描述 | 规格 |
|------|------|------|
| `dmgtype_physical` | 物理伤害 | 16×16 |
| `dmgtype_magic` | 魔法伤害 | 16×16 |
| `dmgtype_true` | 真实伤害 | 16×16 |

**AI 提示词（图标通用）**:
```
Dark fantasy game UI icon, [description], flat design, clean silhouette, [size] pixels, dark background contrast, gold or [color] accent, game interface icon, no text --ar 1:1
```

---

## 7. 场景装饰物 Sprite

### 7.1 第1关「绿野仙踪」装饰物

| 素材 | 描述 | 规格 |
|------|------|------|
| `decor_tree_oak` | 橡树 | 64×96 |
| `decor_bush_green` | 绿色灌木丛 | 48×32 |
| `decor_flowers` | 野花丛 | 32×24 |
| `decor_grass_tuft` | 草丛簇 | 24×16 |

### 7.2 第2关「沙漠虫潮」装饰物

| 素材 | 描述 | 规格 |
|------|------|------|
| `decor_rock_sandstone` | 砂岩岩石 | 48×40 |
| `decor_cactus` | 仙人掌 | 24×56 |
| `decor_bones` | 动物枯骨 | 40×24 |
| `decor_sand_dune_small` | 小沙丘 | 64×32 |

### 7.3 第3关「黑暗古堡」装饰物

| 素材 | 描述 | 规格 |
|------|------|------|
| `decor_pillar_broken` | 断裂石柱 | 24×64 |
| `decor_brazier` | 火盆 | 32×48 |
| `decor_rubble` | 碎石堆 | 40×24 |
| `decor_dead_tree` | 枯树 | 32×64 |

### 7.4 第4关「末日废土」装饰物

| 素材 | 描述 | 规格 |
|------|------|------|
| `decor_wrecked_car` | 报废汽车 | 64×32 |
| `decor_pipe` | 断裂管道 | 48×16 |
| `decor_barrel` | 油桶 | 24×32 |
| `decor_debris` | 金属碎片堆 | 40×24 |

### 7.5 第5关「深渊裂隙」装饰物

| 素材 | 描述 | 规格 |
|------|------|------|
| `decor_floating_rock` | 漂浮岩石 | 48×48 |
| `decor_crystal_cluster` | 紫色晶簇 | 32×40 |
| `decor_rift_crack` | 地面裂隙 | 64×16 |
| `decor_void_spark` | 虚空光点 | 16×16 |

**AI 提示词（装饰物通用）**:
```
Dark fantasy game decoration sprite, [description], stylized, dark silhouette with [color] accent highlights, [size] pixels, game prop, isolated on transparent background, isometric or side view --ar 1:1
```

---

## 8. 全屏覆盖层素材

### 8.1 关卡选择界面主题背景

**规格**: 1920×1080

| 素材 | 描述 |
|------|------|
| `menu_bg_meadow` | 草原主题菜单背景 — 远山+树冠+藤蔓+柔和绿光 |
| `menu_bg_desert` | 沙漠主题菜单背景 — 沙丘+热浪+仙人掌+金色尘粒 |
| `menu_bg_castle` | 古堡主题菜单背景 — 古堡轮廓+残月+蝙蝠+冷灰蓝暗光 |
| `menu_bg_wasteland` | 废土主题菜单背景 — 断裂地平线+废车+红色余烬 |
| `menu_bg_abyss` | 深渊主题菜单背景 — 裂隙光柱+漂浮石+紫晶簇 |

### 8.2 胜利/失败界面元素

**规格**: 1920×1080 覆盖层

| 素材 | 描述 |
|------|------|
| `victory_laurel` | 金色月桂花环装饰（VICTORY 文字两侧） |
| `victory_star_gold` | 金色星星（评定用，48×48） |
| `victory_star_grey` | 灰色星星（未点亮，48×48） |
| `victory_ribbon` | 胜利彩带背景装饰 |
| `defeat_crack` | 屏幕碎裂纹理（失败画面用） |

---

## 9. AI 生成提示词编写指南

### 9.1 通用规则

```
风格关键词（始终包含）:
"dark fantasy", "stylized", "game art", "clean silhouette", "no text", "no UI"

色彩原则:
- 暗色基底（#0d1b2a 或 #1a1a2e）
- 单位/物体使用高饱和主题色突出
- 避免过度写实，保持风格化

格式规范:
- 卡片/图标: "--ar 1:1" 或 "--ar 6:5"
- 背景: "--ar 16:9"
- 粒子/特效: 透明背景 "transparent background"

推荐工具:
- Midjourney (--ar, --style)
- Stable Diffusion (配合 ControlNet)
- DALL-E 3
```

### 9.2 后处理步骤

1. **去背景**: 使用 AI 工具或 Photoshop 移除背景（图标/粒子/装饰物）
2. **统一调色**: 所有素材套用同一 LUT/色调曲线确保色调一致
3. **缩放适配**: 统一缩放到目标分辨率，必要时使用 AI 放大工具
4. **边缘优化**: 确保非透明像素边缘无白边/锯齿
5. **格式输出**: 保存为 PNG（需透明）或 WebP（不透明）

### 9.3 调色参考

游戏中已定义的关键色值（保持一致性）:

| 类别 | 色值 |
|------|------|
| UI 底色 | `#0d1b2a` / `#1a1a2e` |
| UI 面板 | `#1a2332` / `#2b3038` |
| 金/传说 | `#ffc107` / `#ffd54f` |
| 蓝/稀有 | `#2196f3` |
| 紫/史诗 | `#9c27b0` |
| 确认绿 | `#4caf50` / `#2e7d32` |
| 危险红 | `#c62828` / `#e53935` |
| 血条绿 | `#4caf50` |
| 血条黄 | `#ffc107` |
| 血条红 | `#f44336` |
| 玩家阵营蓝 | `#42a5f5` |
| 敌人阵营红 | `#ef5350` |

---

## 10. 素材优先级与实施路线

### 10.1 优先级分级

| 优先级 | 类别 | 素材数 | 预期效果 |
|--------|------|--------|---------|
| **P0 核心** | 关卡背景图（5张） | 5 | 极大提升场景氛围，全屏可见 |
| **P0 核心** | 卡牌插画（30张） | 30 | 核心 UI 辨识度，玩家高频交互 |
| **P1 重要** | 特效精灵图 | ~16 | 战斗表现力提升明显 |
| **P1 重要** | UI 图标（资源+控制+状态） | ~25 | UI 精致度提升 |
| **P2 增强** | 卡牌外框（4张） | 4 | 稀有度视觉区分 |
| **P2 增强** | 菜单背景图（5张） | 5 | 关卡选择界面品质 |
| **P3 锦上添花** | 场景装饰物（20+） | 20+ | 场景丰富度，需要代码接入 |
| **P3 锦上添花** | 地形瓦片纹理 | ~15 | 地面质感，需要大量集成工作 |

### 10.2 实施路线建议

```
Phase 1 - 视觉核心（1-2天）
├── 生成 5 张关卡背景图 → 替换纯色渐变
├── 生成 30 张卡牌插画 → 替换卡面纯几何预览
└── 生成 4 张卡牌外框 → 稀有度视觉区分

Phase 2 - 战斗表现（1天）
├── 生成 16 张特效精灵 → 替换粒子几何体
├── 生成 8 张爆炸纹 → 替换简单爆炸环
└── 生成 UI 图标集 → 替换 emoji 文本图标

Phase 3 - 场景增强（1天）
├── 生成 5 张菜单背景图 → 关卡选择界面
├── 生成 20+ 场景装饰物 → 丰富棋盘场景
└── 生成地形瓦片纹理 → 增强地面质感
```

### 10.3 素材总览表

| 类别 | 数量 | 预估 AI 生成轮次 |
|------|------|-----------------|
| 关卡战斗背景 | 5 | 5-10 次 |
| 卡牌插画 | 30 | 30-60 次 |
| 卡牌外框 | 4 | 4-8 次 |
| UI 面板/HUD | 5 | 5-10 次 |
| UI 按钮 | 6 | 6-12 次 |
| 粒子精灵 | 8 | 8-16 次 |
| 爆炸纹理 | 8 | 8-16 次 |
| 资源/控制图标 | 14 | 14-28 次 |
| 状态图标 | 7 | 7-14 次 |
| 菜单背景图 | 5 | 5-10 次 |
| 场景装饰物 | 20 | 20-40 次 |
| 胜利/失败界面 | 6 | 6-12 次 |
| **合计** | **~118** | **~120-240 次** |

---

## 11. 技术集成要点

### 11.1 文件存放

```
public/
├── assets/
│   ├── backgrounds/     # 关卡背景图 (bg_*.png)
│   ├── cards/           # 卡牌插画 (card_art_*.png)
│   ├── ui/              # UI 元素 (frames/, panels/, buttons/, icons/)
│   ├── particles/       # 粒子精灵图 (particle_*.png)
│   ├── effects/         # 爆炸/冲击纹理 (fx_*.png)
│   ├── decorations/     # 场景装饰物 (decor_*.png)
│   └── screens/         # 全屏覆盖层 (menu_bg_*, victory_*)
```

### 11.2 渲染集成

游戏当前为 Canvas 2D 命令缓冲渲染。图像素材可通过以下方式集成：

1. **`Renderer.push()` 新增 `image` 命令类型**: 在现有命令缓冲区中添加图像绘制命令，`drawCommand()` 时调用 `ctx.drawImage()`
2. **图片预加载**: 使用 `Image()` 对象在关卡/场景初始化时预加载
3. **z-index**: 背景图 → z=0 之前绘制；装饰物 → z=1；UI → z=100+；粒子 → 按现有系统分层

> 详见 `design/06-technical.md` 和 `src/render/Renderer.ts` 了解现有命令缓冲架构。

### 11.3 性能考量

- 背景图为 1920×1080 全分辨率，建议使用 WebP 压缩（目标 <200KB/张）
- 粒子精灵建议使用纹理图集（spritesheet）减少 drawImage 调用次数
- 场景装饰物建议限制每屏数量（≤20 个）

---

> **版本**: v1.0
> **创建日期**: 2026-06-07
> **后续**: 确认优先级后，按 §10 路线逐阶段生成和集成素材
