const URL_PATTERN = /(https?:\/\/[^\s<>"'，。！？、）)]+)/i;

export function extractFirstUrl(text) {
  const match = URL_PATTERN.exec(text);
  if (!match) return "";
  return match[1].replace(/[，。！？、）)]$/, "");
}

export function detectPlatform(text) {
  const normalized = text.toLowerCase();

  if (/(taobao\.com|tmall\.com|tb\.cn|m\.tb\.cn|s\.click\.taobao\.com|淘口令|￥[^￥]+￥)/i.test(text)) {
    return "taobao";
  }

  if (/(jd\.com|3\.cn|u\.jd\.com|jingxi\.com)/i.test(normalized)) {
    return "jd";
  }

  if (/(vip\.com|vipshop\.com|t\.vip\.com|mst\.vip\.com|唯品会)/i.test(normalized)) {
    return "vip";
  }

  if (/(pinduoduo\.com|yangkeduo\.com|pdd\.com|拼多多)/i.test(normalized)) {
    return "pdd";
  }

  if (/(douyin\.com|iesdouyin\.com|snssdk\.com|抖音)/i.test(normalized)) {
    return "douyin";
  }

  return "unknown";
}
