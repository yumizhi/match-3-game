# 三消原型 / Match-3 Prototype

一个使用 `HTML + CSS + Vanilla JavaScript` 构建的三消游戏原型，无外部依赖，可直接在浏览器中运行。

This is a playable match-3 prototype built with `HTML + CSS + Vanilla JavaScript`, with no external libraries.

---

## 中文说明

### 1. 项目简介

这是一个“角色充能 + 自动技能 + 动态难度”的三消原型，核心目标是实现可玩回合循环和可扩展的模块化代码结构。

主要特性：

- 8x8 棋盘，4 种方块类型（`A/B/C/D`）。
- 左侧 4 名角色，按方块类型充能。
- 角色能量满后自动释放技能，也支持手动点击技能按钮触发。
- 支持 `无限模式` 与 `关卡模式`（目标分 + 步数限制）。
- 支持连锁消除（Combo）与连击倍率计分。
- 5 连及以上触发“同色清场”特殊效果。
- 交换失败回退并抖动反馈。
- 消除、下落、生成、同色清场、飘分等动画。
- 死局自动检测并触发洗牌动画。
- 内置 WebAudio 音效（交换、命中、技能、洗牌、胜负）。
- 分层命中特效（冲击环 + 火花 + 飘分）。
- 难度切换（轻松/标准/困难）影响充能速度和随机连锁概率。
- 采用冷灰渐变背景 + 柔和毛玻璃面板 + 莫兰迪棋子配色的低干扰视觉风格。
- 技能就绪态使用 Shimmer 反光动画，替代高强度呼吸灯。
- 连击横幅与飘分降权并缩短停留，让注意力集中在棋盘上。

---

### 2. 技术栈

- `HTML`
- `CSS`
- `Vanilla JavaScript (ES Modules)`
- 无第三方库

---

### 3. 快速开始

#### 3.1 启动方式（推荐）

由于项目使用 ES Module，建议用本地静态服务器启动，不要直接双击 `index.html`（`file://`）。

```bash
cd /Users/lappland/Match-3-Game
python3 -m http.server 5500
```

浏览器访问：

- [http://localhost:5500/index.html](http://localhost:5500/index.html)

#### 3.2 常见问题

- 页面只有 UI 壳子、棋盘不显示：
  - 原因通常是直接用 `file://` 打开，模块脚本被限制。
  - 解决：按上面方式使用本地服务器。

---

### 4. 目录结构

```text
Match-3-Game/
├── index.html        # 页面结构（角色面板、棋盘、工具栏）
├── style.css         # 视觉样式与动画
├── game.js           # 主流程、渲染、交互、难度、回合状态机
├── board.js          # 棋盘/匹配/下落/生成/特殊匹配工具
├── characters.js     # 角色数据与充能逻辑
├── skills.js         # 技能定义与技能执行
└── score.js          # 分数与连击倍率
```

---

### 5. 玩法与规则

#### 5.1 模式说明

- 无限模式：
  - 无步数限制，持续挑战更高分。
- 关卡模式：
  - 在限定步数内达到目标分。
  - 步数耗尽且未达标则失败。

#### 5.2 基础规则

- 点击两个相邻方块进行交换。
- 仅当交换后能形成匹配时交换生效，否则回退并抖动提示。
- 横向或纵向连续 `>=3` 个同类型方块即消除。
- 消除后方块下落并在顶部生成新方块，支持连锁。

#### 5.3 特殊规则（5 连）

- 若某次匹配中出现连续 `>=5`，触发“同色清场”：
  - 清除当前棋盘上所有与该连消类型相同的方块。
  - 播放棋盘高亮与特殊消除动画。
  - 额外清除部分也参与计分与充能。

#### 5.4 计分规则

- 每个被清除方块基础分：`10`。
- 连击倍率：
  - `Combo 1` -> `x1`
  - `Combo 2` -> `x1.5`
  - `Combo 3+` -> `x2`
- 每次消除会在棋盘上显示飘分（含倍率），同色清场会显示特殊标识。

#### 5.5 角色充能与技能

- 方块类型对应角色：
  - `A -> 角色1（战士）`
  - `B -> 角色2（法师）`
  - `C -> 角色3（游侠）`
  - `D -> 角色4（刺客）`
- 角色能量上限：`100`。
- 能量满后：
  - 自动施放技能。
  - 施放后能量重置为 `0`。

4 个技能：

- 角色1：十字爆破（随机 1 行 + 1 列）
- 角色2：行列清除（随机 1 行或 1 列）
- 角色3：范围爆破（随机 3x3）
- 角色4：随机五消（随机移除 5 格）

---

### 6. 难度系统

难度在顶部工具栏切换，切换时会重开一局。

- 轻松：
  - 每块充能 `+4`
  - `antiComboLevel = 0`（更随机，连锁更多）
- 标准（默认）：
  - 每块充能 `+3`
  - `antiComboLevel = 1`
- 困难：
  - 每块充能 `+2`
  - `antiComboLevel = 2`（更强抑制随机连锁）

`antiComboLevel` 会影响新方块生成策略，降低“凭空自动连消”的概率。

---

### 7. 视觉与动画反馈（2026-03）

- 全局主题：`#F8FAFC -> #F1F5F9` 冷灰渐变，降低饱和度与视觉疲劳。
- 面板风格：半透明毛玻璃（`--panel-bg: rgba(255,255,255,0.4)`）+ `blur(24px)` + 细白边。
- 棋子风格：莫兰迪低饱和配色，哑光质感（轻底部阴影 + 极浅顶部高光）。
- 选中态：使用 `scale(1.05)` + 柔和阴影，不使用高亮发光描边。
- 消除/生成：更干脆的缩放淡出与短时生成动画，减少拖泥带水。
- 控件统一：按钮与下拉统一 `12px` 圆角，hover 仅做轻微亮度与阴影变化。
- 技能就绪态：使用 Shimmer 反光动画，不再使用脉冲呼吸灯。
- 连击提示：`combo-banner` 与 `score-pop` 降低视觉权重并缩短停留时长。
- 动画曲线：统一为 `cubic-bezier(0.2, 0.8, 0.2, 1)`，移除回弹感。
- 程序化音效（WebAudio）与命中特效分层（环形冲击 + 火花粒子）保留。

---

### 8. 代码架构（模块职责）

- `board.js`
  - 棋盘生成、交换、匹配检测、重力下落、生成补齐
  - 5 连类型检测：`findLongMatchTypes`
  - 同色清场移除：`removeTilesByTypes`

- `characters.js`
  - 角色数据创建
  - 充能映射与充能接口（支持按难度动态传入每块充能值）
  - 技能后能量重置

- `skills.js`
  - 技能效果函数
  - 技能配置映射（便于扩展）
  - `activateSkill(characterId, board)` 统一入口

- `score.js`
  - 分数状态
  - 连击倍率函数
  - 分数累计与连击重置

- `game.js`
  - 回合状态机（交换 -> 消除 -> 下落 -> 连锁）
  - 自动技能处理队列
  - 难度切换与重开逻辑
  - DOM 渲染、动画协同、飘分显示

---

### 9. 可调参数（调参入口）

如果你想继续调平衡，建议从这些位置开始：

- 难度参数：
  - `game.js` 中 `DIFFICULTY_CONFIGS`
  - 主要字段：`energyPerTile`、`antiComboLevel`
- 动画时长：
  - `game.js` 中 `ANIMATION_MS`
- 动画停留时长：
  - `game.js` 中 `showScorePopup` / `showComboBanner` 的 `setTimeout`
- 计分基础值：
  - `score.js` 中 `POINTS_PER_TILE`
- 棋盘规模/方块类型：
  - `board.js` 中 `BOARD_SIZE`、`TILE_TYPES`
- 技能效果：
  - `skills.js` 中 4 个 `apply...` 函数
- 全局视觉主题：
  - `style.css` 中 `:root` 变量（如 `--bg-start`、`--bg-end`、`--panel-bg`、`--accent`）
- 棋子颜色与质感：
  - `style.css` 中 `--tile-a-1 ~ --tile-d-2` 与 `.tile` 样式
- 交互动效曲线：
  - `style.css` 中 `--ease-smooth` 与关键帧（`buttonShimmer`、`comboBannerIn`、`scorePopFloat`）

---

### 10. 已知限制与后续建议

当前是原型版本，暂未包含：

- 更丰富的关卡编排（多关卡目标与任务类型）
- 更高级的音效资源与多层 VFX 美术资产
- 数据持久化（本地最高分、设置记忆）
- 更完善的无障碍支持（高对比模式、键盘完整操作）

推荐下一步：

1. 增加多关卡配置（章节、目标类型、奖励）。
2. 增加死局提示文案与“手动洗牌道具”。
3. 接入真实音效资源（打击/技能/胜负 BGM）。
4. 增加本地存档（难度偏好、最高分、关卡进度）。

---

## English README

### 1. Overview

This project is a playable match-3 prototype with character energy, auto-cast skills, and adjustable difficulty.

Highlights:

- 8x8 board with 4 tile types (`A/B/C/D`)
- 4 vertical character cards with energy bars and skills
- Auto-cast skills when energy reaches 100 (manual click is also supported)
- Two modes: `Endless` and `Level` (target score + move limit)
- Cascading match resolution with combo multipliers
- Special rule: any 5+ run triggers board-wide same-type clear
- Invalid swap rollback with shake feedback
- Animated remove/fall/spawn/special-clear/score-pop effects
- Deadlock detection with automatic reshuffle animation
- Layered hit FX (ring + sparks + score popup)
- Built-in WebAudio SFX (swap/hit/skill/reshuffle/win-lose)
- Difficulty presets affecting both energy pace and random cascade tendency
- Refined low-distraction visual language: cool gray gradient + frosted panels + muted Morandi tiles
- Skill-ready buttons now use a shimmer pass instead of pulse glow
- Combo banner and score popups were de-emphasized for stronger board focus

---

### 2. Tech Stack

- `HTML`
- `CSS`
- `Vanilla JavaScript (ES Modules)`
- No external libraries

---

### 3. Run Locally

Use a local static server (recommended for ES modules):

```bash
cd /Users/lappland/Match-3-Game
python3 -m http.server 5500
```

Open:

- [http://localhost:5500/index.html](http://localhost:5500/index.html)

Troubleshooting:

- If you only see static UI and no board logic, you probably opened via `file://`.
- Open via `http://localhost` instead.

---

### 4. Project Structure

```text
Match-3-Game/
├── index.html
├── style.css
├── game.js
├── board.js
├── characters.js
├── skills.js
└── score.js
```

---

### 5. Core Rules

- Swap two adjacent tiles.
- Swap is valid only if it creates at least one match; otherwise it reverts.
- Match `>=3` horizontally or vertically to clear.
- Cleared spaces collapse via gravity; new tiles spawn from the top.
- Cascades are processed until stable.

Mode rules:

- Endless mode:
  - No move limit. Keep pushing your high score.
- Level mode:
  - Reach target score before moves run out.
  - If moves are exhausted before target, the level fails.

Special rule:

- If a run of `>=5` appears in the current match phase, all tiles of that type currently on the board are cleared as a bonus (with dedicated FX).

---

### 6. Scoring

- Base score per removed tile: `10`
- Combo multiplier:
  - `Combo 1` -> `x1`
  - `Combo 2` -> `x1.5`
  - `Combo 3+` -> `x2`
- Floating score popups are shown per clear event.
- Bonus same-type board clear shows a tagged popup.

---

### 7. Energy and Skills

Tile-to-character mapping:

- `A -> Character 1 (Warrior)`
- `B -> Character 2 (Mage)`
- `C -> Character 3 (Ranger)`
- `D -> Character 4 (Rogue)`

Energy:

- Max energy is `100`
- Characters auto-cast when full
- Energy resets to `0` after skill activation

Skills:

- Character 1: random cross clear (one row + one column)
- Character 2: random row OR random column clear
- Character 3: random 3x3 area clear
- Character 4: randomly clear 5 tiles

---

### 8. Difficulty System

Difficulty can be switched from the top toolbar and immediately resets the run.

- Easy:
  - `energyPerTile = 4`
  - `antiComboLevel = 0` (more random cascades)
- Normal (default):
  - `energyPerTile = 3`
  - `antiComboLevel = 1`
- Hard:
  - `energyPerTile = 2`
  - `antiComboLevel = 2` (stronger anti-cascade spawning)

`antiComboLevel` changes spawn behavior to reduce accidental auto-matches.

---

### 9. Module Responsibilities

- `board.js`
  - board generation, swap, match find, gravity, spawn
  - long-run detection (`findLongMatchTypes`)
  - same-type board clear (`removeTilesByTypes`)

- `characters.js`
  - character state factory
  - tile-based energy charging
  - energy reset after skill

- `skills.js`
  - all skill effect functions
  - skill registry and activation entry

- `score.js`
  - score state and combo multipliers
  - score accumulation / combo reset

- `game.js`
  - async turn flow and cascade loop
  - auto-skill queue
  - difficulty controls and restart flow
  - rendering and animation orchestration

---

### 10. Tuning Guide

Common balancing entry points:

- `game.js` -> `DIFFICULTY_CONFIGS`
- `game.js` -> `ANIMATION_MS`
- `game.js` -> popup/banner timeout in `showScorePopup` / `showComboBanner`
- `score.js` -> `POINTS_PER_TILE`
- `board.js` -> `BOARD_SIZE`, `TILE_TYPES`
- `skills.js` -> `apply...` skill functions
- `style.css` -> global theme tokens in `:root` (`--bg-*`, `--panel-*`, `--accent`, `--tile-*`)
- `style.css` -> motion token `--ease-smooth` and keyframes (`buttonShimmer`, `comboBannerIn`, `scorePopFloat`)

---

### 11. Current Limitations

This is still a prototype. It does not yet include:

- richer level progression (multi-level campaigns and objective variants)
- polished art/audio assets beyond procedural effects
- persistence (best score / settings memory)
- complete accessibility options (high-contrast mode, full keyboard flow)

---

## License
This project is licensed under the Apache License 2.0.  
