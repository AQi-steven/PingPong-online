# 《乒乓》PING PONG — Digital Version of the Physical Board Game

> An online, non-commercial upgrade of the physical table-tennis card game 《乒乓》.
> Web client (`index.html`) + WebSocket multiplayer server (`server.js`). No build step, no CDN, works offline.

**English** | [中文](#中文说明)

---

## Description

An online remake of the physical card game 《乒乓》, where every card carries two table-tennis shot lines and the real skill lies in reading the incoming ball. The client is a single self-contained HTML file: it ships the 11 physical card types (the serve card `S` plus match cards `A`–`J`), the official 10×10 shot-connection table from the rulebook, and four play modes — 1v1 against AI, 4-player doubles (one human + three AI), two-player and four-player pass-and-play on one phone, and real-time multiplayer rooms over WebSocket. A legal shot must satisfy two checks at once: the incoming ball's position and spin curve (left/middle/right × straight/diagonal/curve/net-touch), **and** the official A–J 10×10 matrix — so a card whose two lines both qualify can be played either way, choosing which line takes the ball in and which sends it out. On top of that come two signature mechanics: **double-card smash** (pick two identical cards to smash and draw 2 extra) unlocked by an opponent's net-touch card, and **ask your partner for a card** in 4-player doubles, once per player per point. Scoring is configurable (11 / 7 / 5 points) with optional deuce mode and two AI skill levels.

## Features

- **11 physical card types** faithfully reproduced — serve card `S` (`右路直线发球`) plus match cards `A`–`J`, each drawn with its real two-shot-line artwork
- **Two-layer legality check** — shot position + trajectory curve **and** the official rulebook **10×10 A–J connection matrix**
- **4 game modes**
  - `1v1 vs AI` — one box (27 match cards), right-side straight serve
  - `4-player doubles (1 human + 3 AI)` — two boxes (54 cards), strict `A → C → B → D` receiving order
  - `2-player / 4-player pass-and-play on one phone` — hands revealed turn by turn
  - **Online rooms** — up to 4 phones, shared 4-digit room code, live state sync
- **Double-card smash (双牌扣杀)** — pick two identical cards to smash and draw 2; the opponent must then also play two identical cards to defend
- **Ask partner for a card (🤝要牌)** — once per player per point in doubles, blind request from your partner
- **Action B: discard 2, draw 2** — once per turn; the card played afterwards draws nothing extra
- **Loser serves next** — whoever lost the point takes the serve card `S` and serves straight from the right
- **Configurable match rules** — target score 11 / 7 / 5, deuce mode on/off, AI skill `省队高手` (pro) / `小区球友` (club-level)
- **Fully self-hosted** — Tailwind and all 8 webfont files are vendored locally, so the game renders identically offline and no request ever leaves your device
- **Pro-grade stars** — Ma Long, Zhang Jike, Fan Zhendong, Sun Yingsha and Wang Chuqin as playable avatars

## Quick Start

### Play locally (no server needed)

Open `index.html` in any modern browser — phone or desktop.

### Run the multiplayer server

```bash
npm install
node server.js
```

The server listens on port `8080` by default (`PORT=9000 node server.js` to change it) and serves the static client plus the WebSocket endpoint. For production, put `index.html` behind Nginx/Apache (or a TLS-terminating reverse proxy) and point players at it.

### Join a room

1. Open the site and switch to the **📱 多人联机房间** tab.
2. Host creates a room and reads out the 4-digit code.
3. Everyone else joins with the same code.
4. Fill empty seats with AI if needed, then the host starts the match.

Plain HTTP works with `ws://your-host:8080`; behind HTTPS use `wss://your-domain/ws`.

## Project Layout

```
index.html        # the whole game — client, rules, AI, renderer (single file)
server.js         # HTTP static host + WebSocket room/state relay (depends on: ws)
package.json
vendor/tailwind.js    # vendored, no CDN
vendor/fonts/*.woff2  # 8 self-hosted webfont files
```

## Notes on the physical game

This project is an online upgrade of the physical board game 《乒乓》. The original copyright belongs to the original designer; this repository is a personal, non-commercial adaptation. If you like the physical edition, it is available on Xiaohongshu at the store **游戏设计师新茂**.

The card artwork reproduced in the client follows the original rulebook's 11 card types and its official 10×10 shot-connection table.

---

# 中文说明

## 项目简介

线下桌游《乒乓》的线上改造版——每一张牌都对应两条真实乒乓球路，核心乐趣在于**读懂来球**。

客户端是**单个自包含 HTML 文件**，内置 11 种实体牌（发球牌 `S` + 比赛牌 `A`–`J`）、规则书里的**官方 10×10 拼接对应表**，以及 4 种对局模式：1 人单打 AI、4 人双打（1 人 + 3 AI）、2 人/4 人同手机轮流打、以及 **WebSocket 多人联机房间**。

合法出牌必须**同时通过两层校验**：来球的方位与轨迹弧度（左/中/右 × 直线/斜线/弧线/擦网折线），**以及**官方 A~J 10×10 对应表——所以一张牌的 2 条线都能接时，玩家可自由决定**哪条当入线、哪条当出线**。

此外还有两个招牌机制：**双牌扣杀**（对手打出擦网球后，选 2 张同名牌扣杀并补 2 张，对手必须也用 2 张同名牌接杀）、4 人双打的**【🤝要牌】**（每人每球 1 次，向搭档盲要 1 张牌）。赛制可调：**11 / 7 / 5 分制**、**鏖战赛点**开关、AI 球技两档（`省队高手` / `小区球友`）。

## 功能清单

- **11 种实体纸牌原貌还原**——发球牌 `S`（右路直线发球）+ 比赛牌 `A`–`J`，每张牌的两条球路按实牌绘制
- **双重拼接校验**——方位 + 轨迹弧度 **与** 官方规则书 **10×10 A~J 对应表**同时成立才算合法
- **4 种对局模式**
  - `1人单打 (打AI)`——1 盒 27 张 · 右路发球
  - `4人双打 (1人+3AI)`——2 盒 54 张，严格 `A → C → B → D` 顺序接球
  - `2人同手机对战` / `4人同手机双打`——一人一拍轮流看牌
  - **多人联机房间**——最多 4 部手机，4 位房间号同台，状态实时同步
- **双牌扣杀（补 2 张）**——凑齐 2 张同名牌发动，对手须以 2 张同牌接杀
- **【🤝要牌】**——4 人双打时每人每球 1 次，向搭档盲要 1 张牌
- **【🔄弃2换2】**——同回合限 1 次，换牌后打出的该拍不再额外摸牌
- **谁输谁发下一球**——失分方拿【发球牌(S)】从球台右侧发直线球
- **赛制可调**——11 / 7 / 5 分制、鏖战赛点开关、AI 球技两档
- **完全自托管**——Tailwind 与 8 个字体文件全部本地化，离线也能渲染，且不向外发起任何请求
- **国乒全明星**——马龙、张继科、樊振东、孙颖莎、王楚钦可出战

## 快速开始

### 本地直接玩

用手机或电脑浏览器打开 `index.html` 即可，无需服务端。

### 启动联机服务端

```bash
npm install
node server.js
```

默认监听 `8080` 端口（`PORT=9000 node server.js` 自定义），同时提供静态页面与 WebSocket 端点。正式部署建议把 `index.html` 放到 Nginx / Apache 静态目录（或做 TLS 反代）。

### 进房间

1. 打开页面，切换到 **📱 多人联机房间** 页签
2. 房主创建房间并报出 4 位房间号
3. 其余人输入相同房间号加入
4. 空位可由 AI 补齐，房主发起对局

纯 HTTP 用 `ws://你的服务器IP:8080`；配了 HTTPS 反代则填 `wss://你的域名/ws`。

## 目录结构

```
index.html        # 整个游戏——客户端、规则、AI、渲染（单文件）
server.js         # HTTP 静态服务 + WebSocket 房间/状态中继（依赖：ws）
package.json
vendor/tailwind.js    # 本地自托管，无 CDN
vendor/fonts/*.woff2  # 8 个自托管字体文件
```

## 关于实体版权

本项目是线下桌游《乒乓》的线上改造升级版，**原始版权归属原设计师**，本仓库为个人非商业改造。若喜欢线下实体版，可去小红书 **「游戏设计师新茂」** 店铺购买。
