export async function verifyWechatSignature({
  token,
  signature,
  timestamp,
  nonce
}) {
  if (!token || !signature || !timestamp || !nonce) return false;

  const value = [token, timestamp, nonce].sort().join("");
  const digest = await sha1Hex(value);
  return digest === signature;
}

export function parseWechatXml(xml) {
  return {
    ToUserName: readCdata(xml, "ToUserName"),
    FromUserName: readCdata(xml, "FromUserName"),
    CreateTime: readText(xml, "CreateTime"),
    MsgType: readCdata(xml, "MsgType"),
    Content: decodeXml(readCdata(xml, "Content")),
    MsgId: readText(xml, "MsgId")
  };
}

export function replyTextXml({ toUser, fromUser, content }) {
  return [
    "<xml>",
    `<ToUserName><![CDATA[${escapeCdata(toUser)}]]></ToUserName>`,
    `<FromUserName><![CDATA[${escapeCdata(fromUser)}]]></FromUserName>`,
    `<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>`,
    "<MsgType><![CDATA[text]]></MsgType>",
    `<Content><![CDATA[${escapeCdata(content)}]]></Content>`,
    "</xml>"
  ].join("");
}

async function sha1Hex(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function readCdata(xml, tag) {
  const cdata = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`).exec(xml);
  if (cdata) return cdata[1];
  return readText(xml, tag);
}

function readText(xml, tag) {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return match ? match[1].trim() : "";
}

function decodeXml(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function escapeCdata(value) {
  return String(value).replaceAll("]]>", "]]]]><![CDATA[>");
}
