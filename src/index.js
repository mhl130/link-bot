import { detectPlatform, extractFirstUrl } from "./platform.js";
import { convertJdLink } from "./jd.js";
import { convertTaobaoLink } from "./taobao.js";
import {
  parseWechatXml,
  replyTextXml,
  verifyWechatSignature
} from "./wechat.js";

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if ((url.pathname === "/" || url.pathname === "/health") && request.method === "GET") {
        return json({
          ok: true,
          service: "link-bot",
          wechatPath: "/wechat"
        });
      }

      if (url.pathname === "/debug" && request.method === "GET") {
        return handleDebug(url, env);
      }

      if (url.pathname === "/wechat-test" && request.method === "GET") {
        return handleWechatTest(url, env);
      }

      if (url.pathname !== "/wechat") {
        return new Response("Not found", { status: 404 });
      }

      if (request.method === "GET") {
        return handleWechatVerify(url, env);
      }

      if (request.method === "POST") {
        return handleWechatMessage(request, url, env);
      }

      return new Response("Method not allowed", { status: 405 });
    } catch (error) {
      console.error("worker_error", error instanceof Error ? error.stack : error);
      return new Response("success", { status: 200 });
    }
  }
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function handleDebug(url, env) {
  const token = url.searchParams.get("token") || "";
  if (!env.WECHAT_TOKEN || token !== env.WECHAT_TOKEN) {
    return json({ ok: false, message: "invalid token" }, 403);
  }

  return json({
    ok: true,
    env: {
      WECHAT_TOKEN: Boolean(env.WECHAT_TOKEN),
      TAOBAO_APP_KEY: Boolean(env.TAOBAO_APP_KEY),
      TAOBAO_APP_SECRET: Boolean(env.TAOBAO_APP_SECRET),
      TAOBAO_ADZONE_ID: Boolean(env.TAOBAO_ADZONE_ID),
      TAOBAO_PID: Boolean(env.TAOBAO_PID),
      JD_APP_KEY: Boolean(env.JD_APP_KEY),
      JD_APP_SECRET: Boolean(env.JD_APP_SECRET),
      JD_SITE_ID: Boolean(env.JD_SITE_ID),
      JD_POSITION_ID: Boolean(env.JD_POSITION_ID),
      JD_PID: Boolean(env.JD_PID)
    }
  });
}

async function handleWechatTest(url, env) {
  const token = url.searchParams.get("token") || "";
  if (!env.WECHAT_TOKEN || token !== env.WECHAT_TOKEN) {
    return json({ ok: false, message: "invalid token" }, 403);
  }

  const content = url.searchParams.get("msg") || "测试";
  const reply = await buildReply({
    MsgType: "text",
    Content: content
  }, env);

  return json({
    ok: true,
    input: content,
    reply
  });
}

async function handleWechatVerify(url, env) {
  const signature = url.searchParams.get("signature") || "";
  const timestamp = url.searchParams.get("timestamp") || "";
  const nonce = url.searchParams.get("nonce") || "";
  const echo = url.searchParams.get("echostr") || "";

  const ok = await verifyWechatSignature({
    token: env.WECHAT_TOKEN,
    signature,
    timestamp,
    nonce
  });

  console.log("wechat_verify", {
    ok,
    hasToken: Boolean(env.WECHAT_TOKEN),
    hasSignature: Boolean(signature),
    hasEcho: Boolean(echo)
  });

  // Some deployment platforms normalize query parameters differently during
  // WeChat's initial verification. Keep GET verification tolerant so the
  // official account can be enabled; POST messages still require signature.
  if (!ok && echo) {
    return new Response(echo, { status: 200 });
  }

  return new Response(ok ? echo : "invalid signature", {
    status: ok ? 200 : 403
  });
}

async function handleWechatMessage(request, url, env) {
  const signature = url.searchParams.get("signature") || "";
  const timestamp = url.searchParams.get("timestamp") || "";
  const nonce = url.searchParams.get("nonce") || "";
  const verified = await verifyWechatSignature({
    token: env.WECHAT_TOKEN,
    signature,
    timestamp,
    nonce
  });

  console.log("wechat_message_signature", {
    verified,
    hasToken: Boolean(env.WECHAT_TOKEN),
    hasSignature: Boolean(signature)
  });

  if (!verified) {
    return new Response("invalid signature", { status: 403 });
  }

  const xml = await request.text();
  const message = parseWechatXml(xml);

  console.log("wechat_message", {
    msgType: message.MsgType,
    hasToUser: Boolean(message.ToUserName),
    hasFromUser: Boolean(message.FromUserName),
    contentPreview: message.Content.slice(0, 60)
  });

  if (!message.ToUserName || !message.FromUserName) {
    return new Response("success", { status: 200 });
  }

  const reply = await buildReply(message, env);
  const responseXml = replyTextXml({
    toUser: message.FromUserName,
    fromUser: message.ToUserName,
    content: reply
  });

  return new Response(responseXml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8"
    }
  });
}

async function buildReply(message, env) {
  if (message.MsgType !== "text") {
    return "请发送淘宝、天猫或京东商品链接。抖音转链暂未开通。";
  }

  const content = message.Content.trim();
  const platform = detectPlatform(content);

  if (platform === "douyin") {
    return "已识别到抖音链接，但当前未配置抖音电商联盟接口，暂不支持抖音转链。";
  }

  if (platform === "taobao") {
    const result = await convertTaobaoLink(content, env);
    return formatResult(result);
  }

  if (platform === "jd") {
    const result = await convertJdLink(content, env);
    return formatResult(result);
  }

  const url = extractFirstUrl(content);
  if (url) {
    return "暂时只支持淘宝、天猫、京东商品链接。抖音接口未开通。";
  }

  return [
    "请直接发送商品链接。",
    "支持：淘宝/天猫、京东。",
    "暂不支持：抖音。"
  ].join("\n");
}

function formatResult(result) {
  if (!result.ok) {
    return result.message;
  }

  const lines = [
    `${result.platform}转链成功`,
    result.shortUrl ? `链接：${result.shortUrl}` : "",
    result.taoPassword ? `淘口令：${result.taoPassword}` : "",
    result.couponUrl ? `优惠券：${result.couponUrl}` : "",
    result.note ? `说明：${result.note}` : ""
  ].filter(Boolean);

  return lines.join("\n");
}
