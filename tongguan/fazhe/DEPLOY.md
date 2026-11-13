# 发布到 aikid.cc.cd

目标地址：`https://fazhe.aikid.cc.cd/`

## Bot / CI 发布（推荐）

仓库 Secrets 需要：

- `CLOUDFLARE_API_TOKEN`（Workers 编辑权限）
- `CLOUDFLARE_ACCOUNT_ID`

然后任选：

1. GitHub Actions：推送 `tongguan/fazhe/**` 或手动 Run workflow `Deploy 法则沙盘 to aikid`
2. 本机 / bot：

```bash
cd tongguan/fazhe
npx wrangler deploy
```

首次还需在 Cloudflare Dashboard 把 `fazhe.aikid.cc.cd` 指到该 Worker（若 `[[routes]]` 自动绑定失败）。

## 与现网 tongguan 的关系

现网 `https://tongguan.aikid.cc.cd`（说服守卫）保持不动。法则沙盘走子域 `fazhe.`，避免覆盖。
