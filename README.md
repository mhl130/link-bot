# 公众号淘宝/京东转链机器人

个人订阅号自动回复项目。用户给公众号发送淘宝、天猫或京东商品链接，Cloudflare Workers 接收微信消息推送，调用联盟转链接口后返回推广链接。

第一版功能：

- 支持微信公众号明文模式消息推送。
- 支持淘宝/天猫链接识别，预留淘宝联盟转链调用。
- 支持京东链接识别，预留京东联盟转链调用。
- 抖音链接会识别，但当前没有抖音联盟接口权限时只回复暂不支持。
- 不使用数据库，适合个人免费部署。

## 项目路径

```bash
cd /Users/mac1/codex/淘宝客/link-bot
```

## 需要准备

- 微信公众号：能打开“配置消息推送”，可填写 URL、Token、EncodingAESKey。
- 淘宝联盟：`AppKey`、`AppSecret`、`adzone_id`，可选 `PID`。
- 京东联盟：`appKey`、`appSecret`、`siteId`，可选 `positionId`、`PID`。
- Cloudflare 账号。

> 你现在可以先不填淘宝/京东密钥。没填时，公众号会回复“已识别但环境变量未配置”，不会崩溃。

## 本地安装

```bash
npm install
```

本地检查：

```bash
npm run check
```

## Cloudflare 部署

登录 Cloudflare：

```bash
npx wrangler login
```

设置公众号 Token。这个值自己定，后面公众号后台也填同一个：

```bash
npx wrangler secret put WECHAT_TOKEN
```

如果暂时不接真实转链，可以先跳过下面淘宝/京东配置。

淘宝：

```bash
npx wrangler secret put TAOBAO_APP_KEY
npx wrangler secret put TAOBAO_APP_SECRET
npx wrangler secret put TAOBAO_ADZONE_ID
npx wrangler secret put TAOBAO_PID
```

京东：

```bash
npx wrangler secret put JD_APP_KEY
npx wrangler secret put JD_APP_SECRET
npx wrangler secret put JD_SITE_ID
npx wrangler secret put JD_POSITION_ID
npx wrangler secret put JD_PID
```

部署：

```bash
npm run deploy
```

部署成功后会得到类似：

```text
https://link-bot.你的账号.workers.dev
```

公众号后台填写：

```text
URL: https://link-bot.你的账号.workers.dev/wechat
Token: 和 WECHAT_TOKEN 一样
EncodingAESKey: 点随机生成
消息加解密方式: 明文模式
```

提交通过后，给公众号发送商品链接即可测试。

## 国内链路备选：EdgeOne Pages Functions

如果 `workers.dev` 能打开 `/debug`，但公众号就是不自动回复，常见原因是微信服务器到 `workers.dev` 的链路不稳定。项目已经加了 `functions/` 目录，可以直接作为 EdgeOne Pages Functions 项目部署。

如果你控制台里看到的是 **EdgeOne Makers**，它可能使用 `edge-functions/` 目录。项目也已经同时加了 `edge-functions/`，两种目录都能复用同一套后端逻辑。

部署思路：

1. 把本项目推到 GitHub 仓库。
2. 在 EdgeOne Pages 新建项目，选择这个 GitHub 仓库。
3. 构建命令留空或使用：

```bash
npm run check
```

4. 输出目录可留空。
5. 如果有函数目录选项：
   - EdgeOne Pages 填 `functions`
   - EdgeOne Makers 填 `edge-functions`
6. 在 EdgeOne 环境变量里配置：

```text
WECHAT_TOKEN=123456
TAOBAO_APP_KEY=
TAOBAO_APP_SECRET=
TAOBAO_ADZONE_ID=
TAOBAO_PID=
JD_APP_KEY=
JD_APP_SECRET=
JD_SITE_ID=
JD_POSITION_ID=
JD_PID=
```

7. 部署后拿到 EdgeOne 给的 HTTPS 域名，把公众号后台 URL 改成：

```text
https://你的-edgeone域名/wechat
```

Token、明文模式、XML 保持不变。

## 没有自动回复怎么排查

1. 先确认 Worker 在线，把下面地址换成你的 Worker 域名：

```text
https://你的-worker地址/health
```

正常会返回：

```json
{
  "ok": true,
  "service": "link-bot",
  "wechatPath": "/wechat"
}
```

2. 确认 `WECHAT_TOKEN` 已经设置成功：

```text
https://你的-worker地址/debug?token=你在公众号后台填的Token
```

正常会看到：

```json
{
  "ok": true,
  "env": {
    "WECHAT_TOKEN": true
  }
}
```

3. 测试回复逻辑：

```text
https://你的-worker地址/wechat-test?token=你在公众号后台填的Token&msg=测试
```

正常会返回：

```json
{
  "ok": true,
  "input": "测试",
  "reply": "请直接发送商品链接。\n支持：淘宝/天猫、京东。\n暂不支持：抖音。"
}
```

4. 看实时日志：

```bash
npx wrangler tail link-bot --format pretty
```

然后给公众号发一条文字消息。正常应该看到：

```text
wechat_message_signature verified: true
wechat_message msgType: text
```

5. 如果日志里完全没有请求，说明公众号没有把消息推到 Worker。检查公众号后台：

```text
URL 必须是：https://你的-worker地址/wechat
Token 必须和 WECHAT_TOKEN 完全一致
消息加解密方式必须是：明文模式
配置必须已经启用
```

6. 如果日志里 `verified: false`，说明 Token 不一致，重新设置：

```bash
npx wrangler secret put WECHAT_TOKEN
npm run deploy
```

然后公众号后台也填同一个 Token。

## 回复示例

淘宝/天猫：

```text
淘宝转链成功
链接：https://...
淘口令：￥...￥
优惠券：https://...
```

京东：

```text
京东转链成功
链接：https://...
```

抖音：

```text
已识别到抖音链接，但当前未配置抖音电商联盟接口，暂不支持抖音转链。
```

## 重要说明

- GitHub Pages 不能运行这个项目，因为它需要后端接口接收微信 POST 消息。
- GitHub 可以用来存代码，Cloudflare Workers 用来运行服务。
- 不要把联盟 `AppSecret` 写进代码或 `wrangler.toml`。
- 公众号第一版用明文模式，后续如果要兼容安全模式，需要再加 AES 消息解密。
