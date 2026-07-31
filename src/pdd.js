import { md5 } from "./hash.js";
import { postForm } from "./http.js";
import { extractFirstUrl } from "./platform.js";

const PDD_METHOD = "pdd.ddk.goods.promotion.url.generate";

export async function convertPddLink(content, env) {
  const required = [
    "PDD_CLIENT_ID",
    "PDD_CLIENT_SECRET",
    "PDD_PID"
  ];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    return {
      ok: false,
      platform: "拼多多",
      message: [
        "已识别到拼多多链接。",
        "但拼多多转链环境变量还没配置：",
        missing.join(", "),
        "配置后我会自动调用多多进宝转链接口。"
      ].join("\n")
    };
  }

  const goodsId = extractPddGoodsId(content);
  if (!goodsId) {
    return {
      ok: false,
      platform: "拼多多",
      message: [
        "已识别到拼多多链接。",
        "但没有找到商品 goods_id。",
        "请发送带 goods_id 参数的拼多多商品链接。"
      ].join("\n")
    };
  }

  const common = {
    type: env.PDD_METHOD || PDD_METHOD,
    client_id: env.PDD_CLIENT_ID,
    timestamp: Math.floor(Date.now() / 1000),
    data_type: "JSON",
    p_id: env.PDD_PID,
    goods_id_list: `[${goodsId}]`,
    generate_short_url: true,
    custom_parameters: env.PDD_CUSTOM_PARAMETERS || undefined
  };
  const params = {
    ...common,
    sign: pddSign(common, env.PDD_CLIENT_SECRET)
  };

  try {
    const response = await postForm(env.PDD_API_URL || "https://gw-api.pinduoduo.com/api/router", params);
    if (!response.ok) {
      return apiError(`HTTP ${response.status}`);
    }

    const converted = pickPddResult(response.data);
    if (!converted.ok) {
      return apiError(converted.message || JSON.stringify(response.data).slice(0, 400));
    }

    return {
      ok: true,
      platform: "拼多多",
      shortUrl: converted.shortUrl,
      couponUrl: converted.couponUrl,
      note: converted.note
    };
  } catch (error) {
    return apiError(error instanceof Error ? error.message : String(error));
  }
}

export function extractPddGoodsId(content) {
  const url = extractFirstUrl(content);
  const source = url || content;
  const direct = /(?:goods_id|goodsId)=([0-9]+)/i.exec(source);
  if (direct) return direct[1];

  try {
    const parsed = new URL(source);
    return parsed.searchParams.get("goods_id") ||
      parsed.searchParams.get("goodsId") ||
      "";
  } catch {
    return "";
  }
}

export function pddSign(params, secret) {
  const content = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return md5(`${secret}${content}${secret}`).toUpperCase();
}

export function pickPddResult(data) {
  if (!data) {
    return { ok: false, message: "拼多多接口未返回 JSON" };
  }

  const error = data.error_response || data.errorResponse;
  if (error) {
    return {
      ok: false,
      message: error.error_msg || error.sub_msg || error.msg || JSON.stringify(error)
    };
  }

  const response = data.goods_promotion_url_generate_response ||
    data.goodsPromotionUrlGenerateResponse;
  const list = response?.goods_promotion_url_list ||
    response?.goodsPromotionUrlList ||
    response?.url_list ||
    response?.urlList;
  const first = Array.isArray(list) ? list[0] : list;
  if (!first) {
    return {
      ok: false,
      message: JSON.stringify(data).slice(0, 400)
    };
  }

  const shortUrl = first.mobile_short_url ||
    first.mobileShortUrl ||
    first.short_url ||
    first.shortUrl ||
    first.mobile_url ||
    first.mobileUrl ||
    first.url ||
    first.schema_url ||
    first.schemaUrl;
  if (!shortUrl) {
    return {
      ok: false,
      message: JSON.stringify(first).slice(0, 400)
    };
  }

  return {
    ok: true,
    shortUrl,
    couponUrl: first.short_url || first.shortUrl || first.url || "",
    note: "拼多多返回成功"
  };
}

function apiError(detail) {
  return {
    ok: false,
    platform: "拼多多",
    message: [
      "拼多多转链失败。",
      "请检查多多进宝接口权限、client_id/client_secret、PID 和商品链接是否有效。",
      `错误：${detail}`
    ].join("\n")
  };
}
