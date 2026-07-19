import { md5 } from "./hash.js";
import { postForm, currentTimestamp } from "./http.js";

export async function convertTaobaoLink(content, env) {
  const required = [
    "TAOBAO_APP_KEY",
    "TAOBAO_APP_SECRET",
    "TAOBAO_ADZONE_ID"
  ];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    return {
      ok: false,
      platform: "淘宝",
      message: [
        "已识别到淘宝/天猫链接。",
        "但淘宝转链环境变量还没配置：",
        missing.join(", "),
        "配置后我会自动调用淘宝联盟转链接口。"
      ].join("\n")
    };
  }

  const common = {
    method: "taobao.tbk.dg.general.link.convert",
    app_key: env.TAOBAO_APP_KEY,
    timestamp: currentTimestamp(),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    adzone_id: env.TAOBAO_ADZONE_ID,
    material_id: content
  };
  const params = {
    ...common,
    sign: topSign(common, env.TAOBAO_APP_SECRET)
  };

  try {
    const response = await postForm(env.TAOBAO_API_URL || "https://eco.taobao.com/router/rest", params);
    if (!response.ok) {
      return apiError("淘宝", `HTTP ${response.status}`);
    }

    const converted = pickTaobaoResult(response.data);
    if (!converted) {
      return apiError("淘宝", JSON.stringify(response.data).slice(0, 400));
    }

    return {
      ok: true,
      platform: "淘宝",
      shortUrl: converted.shortUrl,
      taoPassword: converted.taoPassword,
      couponUrl: converted.couponUrl,
      note: converted.note
    };
  } catch (error) {
    return apiError("淘宝", error instanceof Error ? error.message : String(error));
  }
}

function topSign(params, secret) {
  const content = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return md5(`${secret}${content}${secret}`).toUpperCase();
}

function pickTaobaoResult(data) {
  const response = data?.tbk_dg_general_link_convert_response;
  const results = response?.results?.publisher_order_dto || response?.results?.n_tbk_item || response?.results;
  const first = Array.isArray(results) ? results[0] : results;
  if (!first) return null;

  return {
    shortUrl: first.short_url || first.click_url || first.coupon_short_url || first.item_url,
    taoPassword: first.tpwd || first.tao_password,
    couponUrl: first.coupon_click_url || first.coupon_url,
    note: first.title || "淘宝联盟返回成功"
  };
}

function apiError(platform, detail) {
  return {
    ok: false,
    platform,
    message: [
      `${platform}转链失败。`,
      "请检查联盟接口权限、PID/推广位和商品链接是否有效。",
      `错误：${detail}`
    ].join("\n")
  };
}
