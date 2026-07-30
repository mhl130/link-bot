import { hmacMd5 } from "./hash.js";
import { appendQuery } from "./http.js";
import { extractFirstUrl } from "./platform.js";

const VIP_SERVICE = "com.vip.adp.api.open.service.UnionUrlService";
const VIP_METHOD = "genByVIPUrl";
const VIP_VERSION = "1.0.0";

export async function convertVipLink(content, env) {
  const required = [
    "VIP_APP_KEY",
    "VIP_APP_SECRET",
    "VIP_CHAN_TAG"
  ];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    return {
      ok: false,
      platform: "唯品会",
      message: [
        "已识别到唯品会链接。",
        "但唯品会转链环境变量还没配置：",
        missing.join(", "),
        "配置后我会自动调用唯品会联盟转链接口。"
      ].join("\n")
    };
  }

  const vipUrl = extractFirstUrl(content) || content;
  const body = JSON.stringify({
    urlList: [vipUrl],
    chanTag: env.VIP_CHAN_TAG,
    requestId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
    statParam: env.VIP_STAT_PARAM || undefined,
    urlGenRequest: {
      genShortUrl: true,
      evokeQuickApp: true,
      realCall: true,
      platform: Number(env.VIP_PLATFORM || 1)
    }
  });

  const systemParams = {
    service: env.VIP_SERVICE || VIP_SERVICE,
    method: env.VIP_METHOD || VIP_METHOD,
    version: env.VIP_VERSION || VIP_VERSION,
    timestamp: Math.floor(Date.now() / 1000),
    format: "json",
    appKey: env.VIP_APP_KEY,
    accessToken: env.VIP_ACCESS_TOKEN || undefined
  };
  const signedParams = {
    ...systemParams,
    sign: vipSign(systemParams, body, env.VIP_APP_SECRET)
  };

  try {
    const response = await fetch(appendQuery(env.VIP_API_URL || "https://vop.vipapis.com", signedParams), {
      method: "POST",
      headers: {
        "content-type": "application/json;charset=UTF-8"
      },
      body
    });

    const text = await response.text();
    const data = safeJson(text);
    if (!response.ok) {
      return apiError(`HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    const converted = pickVipResult(data);
    if (!converted.ok) {
      return apiError(converted.message || text.slice(0, 400));
    }

    return {
      ok: true,
      platform: "唯品会",
      shortUrl: converted.shortUrl,
      couponUrl: converted.vipWxUrl,
      note: converted.note
    };
  } catch (error) {
    return apiError(error instanceof Error ? error.message : String(error));
  }
}

function vipSign(systemParams, body, secret) {
  const content = Object.keys(systemParams)
    .filter((key) => systemParams[key] !== undefined && systemParams[key] !== null && systemParams[key] !== "")
    .sort()
    .map((key) => `${key}${systemParams[key]}`)
    .join("");
  return hmacMd5(secret, `${content}${body}`).toUpperCase();
}

function pickVipResult(data) {
  if (!data) {
    return { ok: false, message: "唯品会接口未返回 JSON" };
  }

  const error = findFirst(data, ["errorMessage", "errorMsg", "msg", "message"]);
  const urls = collectUrlFields(data);
  const shortUrl = urls.url || urls.shortUrl || urls.noEvokeUrl || urls.longUrl || urls.ulUrl || urls.vipWxUrl;

  if (!shortUrl) {
    return {
      ok: false,
      message: error || JSON.stringify(data).slice(0, 400)
    };
  }

  return {
    ok: true,
    shortUrl,
    vipWxUrl: urls.vipWxUrl,
    note: error || "唯品会联盟返回成功"
  };
}

function collectUrlFields(value, output = {}) {
  if (!value || typeof value !== "object") return output;

  if (Array.isArray(value)) {
    for (const item of value) collectUrlFields(item, output);
    return output;
  }

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && /(url|link)/i.test(key) && /^https?:\/\//i.test(item)) {
      output[key] = item;
    } else if (item && typeof item === "object") {
      collectUrlFields(item, output);
    }
  }

  return output;
}

function findFirst(value, keys) {
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirst(item, keys);
      if (found) return found;
    }
    return "";
  }

  for (const key of keys) {
    if (typeof value[key] === "string" && value[key]) return value[key];
  }

  for (const item of Object.values(value)) {
    const found = findFirst(item, keys);
    if (found) return found;
  }
  return "";
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function apiError(detail) {
  return {
    ok: false,
    platform: "唯品会",
    message: [
      "唯品会转链失败。",
      "请检查唯品会联盟接口权限、AppKey/AppSecret、chanTag/PID 和链接是否有效。",
      `错误：${detail}`
    ].join("\n")
  };
}
