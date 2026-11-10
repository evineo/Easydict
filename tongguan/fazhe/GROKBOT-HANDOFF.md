# 交接给 Grokbot 主机器人：发布法则沙盘到 aikid

## 任务

把「法则沙盘」静态站发布到公网域名（aikid），给用户可玩。

## 产物

- 压缩包：同目录 `fazhe-shapan.zip`（解压后是 `fazhe/`）
- 源码分支：`cursor/fazhe-shapan-1b21`
- 路径：`tongguan/fazhe/`（`index.html` + `game.css` + `game.js`）
- PR：https://github.com/evineo/Easydict/pull/1

## 目标域名

优先（与现网说服守卫并列，不覆盖）：

- `https://fazhe.aikid.cc.cd/`

备选（若你习惯挂在现网站点下）：

- `https://tongguan.aikid.cc.cd/fazhe/`

现网 `https://tongguan.aikid.cc.cd`（说服守卫）不要动。

注意：当前 `fazhe.aikid.cc.cd` 已解析且返回 Basic Auth（realm「Aikid 闯关」）。发布时按你现有 aikid 部署方式处理认证/路由。

## 技术约束

- 纯静态前端，无模型、无密钥
- 本 Cloud Agent 的 Cloudflare MCP / wrangler 未登录，发不上去；改由你（Grokbot）用既有 aikid 发布通道部署

## 验收

打开目标 URL，能看到标题「法则沙盘」，可完成：看例子 → 判定 → 结算揭晓法则。
