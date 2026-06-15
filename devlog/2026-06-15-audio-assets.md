## 实现：补齐主题胜利 BGM 资源

### 需求

检查所有音效资源是否存在，缺失时从开源音效库补齐，并把音效资源列表补充到设计文档。

### 检查结果

- `src/utils/Sound.ts` 声明 70 个 SFX key，`public/sfx/` 对应 70 个 `.ogg` 文件，未发现缺失。
- `src/utils/Music.ts` 声明 19 个 BGM key，其中 `battle_snow`、`battle_lava` 复用已有战斗曲；实际缺失 5 个主题胜利 BGM 文件。

### 改动

| 文件 | 改动 |
|------|------|
| `public/bgm/victory_meadow.ogg` | 新增第 1 关主题胜利曲，来源 OpenGameArt CC0 |
| `public/bgm/victory_desert.ogg` | 新增第 2 关主题胜利曲，来源 OpenGameArt CC0 |
| `public/bgm/victory_castle.ogg` | 新增第 3 关主题胜利曲，来源 OpenGameArt CC0 |
| `public/bgm/victory_waste.ogg` | 新增第 4 关主题胜利曲，来源 OpenGameArt CC0 |
| `public/bgm/victory_abyss.ogg` | 新增第 5 关主题胜利曲，来源 OpenGameArt CC0 |
| `public/bgm/CREDITS.md` | 补充 5 条主题胜利 BGM 来源与许可证 |
| `design/07-audio.md` | 更新 SFX/BGM 资源覆盖、主题胜利 BGM 清单、版权与文件统计 |

### 验证结果

- 脚本比对 `SFX_PATH` 与 `BGM_PATH` 后确认：SFX missing=0，BGM missing=0。
- `file public/bgm/victory_*.ogg` 确认新增文件均为 Ogg/Vorbis 音频。
