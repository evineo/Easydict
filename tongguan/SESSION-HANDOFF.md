# 通关达人 · 会话交接（给下一任 Agent）

> 来源会话：Cloud Agent `bc-01a1c539-7da6-7027-acdd-83da0e611b21`  
> 仓库：`evineo/Easydict`（主体是词典 App；通关达人代码仅在 `tongguan/`）  
> 交接日：2026-11-13  
> **请先读完本文再改代码。用户明确要求：未点名定稿前不要急着做新游戏烧 token。**

---

## 1. 一句话目标

做儿童 AI 素养产品「通关达人」（西游题材）：**学习知识 / 提升能力 / 完成任务** 三块。本会话聚焦 **提升能力 → 炼宝阁可玩游戏**，要求可玩性尽量接近爆款，且游戏必须对准可测能力。

---

## 2. 已锁定的产品口径（勿擅自改）

### 能力轴：5+1

| 定稿名 | 提升了 = | 备注 |
|---|---|---|
| 观察 | 干扰下找差异更快更准 | |
| 规则思维 | 从例子归纳规则并应用到新例 | 「逻辑思维」对外可统称，对内拆成规则+线索 |
| 线索推理 | 多约束下排除到唯一解 | |
| 证据检验 | 对照证据判断陈述并给出依据 | 学 AI 差异化核心 |
| 规划解题 | 目标+约束下排出步骤并完成 | |
| 口头表达（+1） | 更清楚完整地说出来 | 配音成片；外发需家长确认 |

**证明提升**：游戏高分 ≠ 真能力；靠 **换皮验功（近迁移）** + 主线差事复用。  
**双轨奖励**：段位 → 法宝更亮；灵力 → 验功/办事才涨。

### 结构

- **炼宝阁**：能力游戏单独板块（法宝/坐骑/灵兽收集壳）
- **说服守卫**：算一个真正好玩的；主归 **交涉类任务**，能力记账偏规划解题；不宜硬说成单一观察/批判
- 用户评价现状：**说服守卫算一个**；Claude 另做的一款「勉强」；法则沙盘「勉强」；火眼金睛「勉强」，UI 优化也只能小幅提升

---

## 3. Git / PR 现状

| 项 | 值 |
|---|---|
| 分支 | `cursor/fazhe-shapan-1b21` |
| Base | `main` |
| HEAD | `a64e0d3b`（`feat(tongguan): add 火眼金睛 observation hit prototype`） |
| PR | https://github.com/evineo/Easydict/pull/1 （OPEN） |
| 远端 | 与 `origin/cursor/fazhe-shapan-1b21` 已同步（交接时无未推送提交） |

**本地交接命令：**

```bash
git fetch origin
git checkout cursor/fazhe-shapan-1b21
git pull origin cursor/fazhe-shapan-1b21
```

---

## 4. 已交付代码与试玩

### 法则沙盘（规则思维）— `tongguan/fazhe/`

- 静态 HTML/CSS/JS；程序出题，不调模型
- 看例子 → 归纳法则 → 判新符
- Zip：`tongguan/fazhe-shapan.zip`
- 下载：https://raw.githubusercontent.com/evineo/Easydict/a64e0d3bdfb8dbb2d371d582ad054344e7baf973/tongguan/fazhe-shapan.zip
- 部署草稿：`wrangler.toml` + `.github/workflows/deploy-fazhe.yml` → 目标 `fazhe.aikid.cc.cd`（需仓库 Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`）
- Bot 发布说明：`tongguan/fazhe/GROKBOT-HANDOFF.md`、`DEPLOY.md`
- **状态**：可玩但用户评「勉强」；方案里建议降为辅线/验功题库，主推改为「变则试探」

### 火眼金睛（观察·找不同）— `tongguan/huoyan/`

- 抄爆款手感：永久圈、软心、无硬倒计时、连击、灯下黑向难度
- Zip：`tongguan/huoyan-jinjing.zip`
- 下载：https://raw.githubusercontent.com/evineo/Easydict/a64e0d3bdfb8dbb2d371d582ad054344e7baf973/tongguan/huoyan-jinjing.zip
- 本地曾用 `python3 -m http.server` 验证：开眼进关、点中计分正常
- Cursor Publish：曾提交 `huoyan-jinjing` 发布提案，**等用户在 Publish 对话框确认并选 Public**；未确认则未上公网
- **状态**：用户明确「就是找不同，谈不上可玩性很高」；方案中降为观察 **辅线**

### 仓库注意

- 通关达人挂在 **Easydict** 仓库里，不要改词典 App 代码除非用户要求
- Cloudflare MCP / aikid 直发此前多次受阻（集成或权限）；下载 zip / GitHub raw 是可用退路

---

## 5. 爆款调研结论（已成方案，未开工）

完整画布（下一任必读）：  
[通关达人 · 爆款游戏方案（调研）](https://cursor.com/canvas/store-e4f963d5-ba38-4071-a506-1f57a21f05a8/9af6205a-cf95-467d-abbf-9b1b1ea839f5)

**核心判断：** 找不同是微信/海外长尾广告盘，不是儿童 AI 产品的差异化爆款。应押「试探→反馈→换策略」和证据/推理类。

### 每类 2–3 款（摘要）

| 能力 | 主推 | 备选 | 现有 |
|---|---|---|---|
| 观察 | 闪配（Spot it!）/ 寻物花果山（Hidden Folks） | — | 火眼金睛→辅线 |
| 规则 | 变则试探 | 归类宝袋（SET） | 法则沙盘→弱化 |
| 线索推理 | 三言两语·案板 / 谁偷仙桃 | 河岸渡劫 | 空缺 |
| 证据检验 | 照妖镜 + AI胡说捕手 | 情报坊 | **应做招牌** |
| 规划 | **说动·刷本**（说服硬化）+ 塞车取经（Rush Hour） | 差事沙盘 | 说服守卫已验 |
| 表达 | 配音工坊 + 口令厨房（Prompt） | 诏书念法 | 空缺 |

### 建议优先级（用户尚未最终拍板 P0）

1. **P0**：说动刷本 → 照妖镜 → 推理探案（案板 **或** 仙桃二选一）  
2. **P1**：观察换赛道（闪配 **或** 寻物；勿再加码找不同）  
3. **P2**：塞车取经 · 配音工坊 · 口令厨房  
4. **P3**：AI胡说捕手 · 情报坊 · 变则试探  

**用户原话要求：** 先调研、形成方案；点名后再写细案；**不要急着做浪费 token。**

---

## 6. 相关历史画布（能力定稿）

- [能力种类评议](https://cursor.com/canvas/store-e4f963d5-ba38-4071-a506-1f57a21f05a8/4d13e655-0b92-4fbd-997f-704f720dff8b)
- [能力板块调整方案](https://cursor.com/canvas/store-e4f963d5-ba38-4071-a506-1f57a21f05a8/ae2ef60b-d335-4720-9b40-3b3668b660e0)
- [能力种类定稿建议](https://cursor.com/canvas/store-e4f963d5-ba38-4071-a506-1f57a21f05a8/6ddc3a60-dbf7-4cee-87d7-2f2cb19d5f72)
- [能力玩法库 · 说服守卫归属](https://cursor.com/canvas/store-e4f963d5-ba38-4071-a506-1f57a21f05a8/25f23cc5-efd9-4625-95ec-f313da53dad7)
- [能力专项游戏思路（早期）](https://cursor.com/canvas/store-e4f963d5-ba38-4071-a506-1f57a21f05a8/922e3b20-8ab3-4be9-ad30-b392459758aa)

---

## 7. 工作台 / 发布（运维侧，非产品）

- 用户想用 **Mac mini / 本地** 跑 Agent：需在仓库目录执行 `agent worker start --name "mac-mini"`；若机器可见但灰色，常见原因是 **`repos` 为空**（未在正确 git checkout 启动）
- 网页选本机：cursor.com/agents → My Machines；不是只开桌面 App
- 云→本地交接：优先 `git pull` 本分支；可选 Agents Window「Move to Local」
- 火眼金睛 Cursor App 发布：若用户要公网，提醒确认 Publish 且可见性选 **Public**

---

## 8. 下一任建议动作（按用户下一条消息）

| 若用户说… | 你做… |
|---|---|
| 拍板 P0 / 选推理或观察主推 | **只写细案**（关卡节奏、计分、西游皮），仍可先不动手 |
| 「做某某游戏」 | 再实现；优先静态可玩原型 + zip + 同分支 PR 更新 |
| 发布 aikid / 公网 | 查 CF token / Publish 确认 / 或 GitHub raw zip |
| 炼宝阁壳 / 段位灵力 | 产品壳，可与单款游戏并行但勿抢爆款内核 |

**默认不要：** 再堆找不同关卡；未确认就新开一款完整游戏；改 Easydict 词典主体。

---

## 9. 可贴给下一任的最短提示词

```
继续通关达人。仓库 evineo/Easydict，分支 cursor/fazhe-shapan-1b21，PR #1。
先读 tongguan/SESSION-HANDOFF.md 与画布「通关达人 · 爆款游戏方案（调研）」。
能力 5+1 与双轨已锁定。已有法则沙盘+火眼金睛（用户评勉强）；说服守卫算真正好玩。
未点名定稿前不要做新游戏；等我确认 P0（说动/照妖镜/推理择一）后再写细案或动手。
```
