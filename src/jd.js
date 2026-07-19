import { md5 } from "./hash.js";
import { postForm, currentTimestamp } from "./http.js";
import { extractFirstUrl } from "./platform.js";

export async function convertJdLink(content, env) {
  const required = [
    "JD_APP_KEY",
    "JD_APP_SECRET",
    "JD_SITE_ID"
  ];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    return {
      ok: false,
      platform: "京东",
      message: [
        "已识别到京东链接。",
        "但京东转链环境变量还没配置：",
        missing.join(", "),
        "配置后我会自动调用京东联盟转链接口。"
      ].join("\n")
    };
  }

  const materialId = extractFirstUrl(content) || content;
  const paramJson = {
    promotionCodeReq: {
      materialId,
      siteId: env.JD_SITE_ID,
      positionId: env.JD_POSITION_ID ? Number(env.JD_POSITION_ID) : undefined,
      sceneId: env.JD_SCENE_ID ? Number(env.JD_SCENE_ID) : undefined
    }
  };

  const common = {
    app_key: env.JD_APP_KEY,
    method: "jd.union.open.promotion.common.get",
    timestamp: currentTimestamp(),
    format: "json",
    v: "1.0",
    sign_method: "md5",
    "360buy_param_json": JSON.stringify(paramJson)
  };
  const params = {
    ...common,
    sign: jdSign(common, env.JD_APP_SECRET)
  };

  try {
    const response = await postForm(env.JD_API_URL || "https://api.jd.com/routerjson", params);
    if (!response.ok) {
      return apiError("京东", `HTTP ${response.status}`);
    }

    const converted = pickJdResult(response.data);
    if (!converted.ok) {
      return apiError("京东", converted.message || JSON.stringify(response.data).slice(0, 400));
    }

    return {
      ok: true,
      platform: "京东",
      shortUrl: converted.shortUrl,
      note: converted.note
    };
  } catch (error) {
    return apiError("京东", error instanceof Error ? error.message : String(error));
  }
}

function jdSign(params, secret) {
  const content = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return md5(`${secret}${content}${secret}`).toUpperCase();
}

function pickJdResult(data) {
  const response = data?.jd_union_open_promotion_common_get_response ||
    data?.jd_union_open_promotion_common_get_responce;
  const raw = response?.result || response?.getResult;
  const result = typeof raw === "string" ? safeJson(raw) : raw;
  const payload = result?.data || result;
  if (!result || result.code !== 200 || !payload) {
    return {
      ok: false,
      code: result?.code,
      message: result?.message || response?.msg || "京东接口未返回有效结果"
    };
  }

  const shortUrl = payload.shortURL || payload.shortUrl || payload.clickURL || payload.clickUrl;
  if (!shortUrl) {
    return {
      ok: false,
      code: result.code,
      message: result.message || "京东接口未返回推广链接"
    };
  }

  return {
    ok: true,
    shortUrl,
    note: payload.message || "京东联盟返回成功"
  };
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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
