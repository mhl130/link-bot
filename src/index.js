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
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return new Response("link-bot ok", { status: 200 });
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
  }
};

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

  if (!verified) {
    return new Response("invalid signature", { status: 403 });
  }

  const xml = await request.text();
  const message = parseWechatXml(xml);

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
