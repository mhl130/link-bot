import assert from "node:assert/strict";
import { detectPlatform, extractFirstUrl } from "../src/platform.js";
import { md5 } from "../src/hash.js";
import {
  parseWechatXml,
  replyTextXml,
  verifyWechatSignature
} from "../src/wechat.js";

assert.equal(md5(""), "d41d8cd98f00b204e9800998ecf8427e");
assert.equal(md5("abc"), "900150983cd24fb0d6963f7d28e17f72");

assert.equal(detectPlatform("https://item.taobao.com/item.htm?id=1"), "taobao");
assert.equal(detectPlatform("￥abc123￥"), "taobao");
assert.equal(detectPlatform("https://item.jd.com/100.html"), "jd");
assert.equal(detectPlatform("https://v.douyin.com/abc/"), "douyin");
assert.equal(detectPlatform("hello"), "unknown");

assert.equal(
  extractFirstUrl("帮我转 https://item.jd.com/100.html，谢谢"),
  "https://item.jd.com/100.html"
);

const sampleXml = [
  "<xml>",
  "<ToUserName><![CDATA[gh_test]]></ToUserName>",
  "<FromUserName><![CDATA[o_user]]></FromUserName>",
  "<CreateTime>1700000000</CreateTime>",
  "<MsgType><![CDATA[text]]></MsgType>",
  "<Content><![CDATA[https://item.jd.com/100.html]]></Content>",
  "<MsgId>1</MsgId>",
  "</xml>"
].join("");

const message = parseWechatXml(sampleXml);
assert.equal(message.ToUserName, "gh_test");
assert.equal(message.FromUserName, "o_user");
assert.equal(message.MsgType, "text");
assert.equal(message.Content, "https://item.jd.com/100.html");

const reply = replyTextXml({
  toUser: "o_user",
  fromUser: "gh_test",
  content: "转链成功"
});
assert.match(reply, /<ToUserName><!\[CDATA\[o_user\]\]><\/ToUserName>/);
assert.match(reply, /<Content><!\[CDATA\[转链成功\]\]><\/Content>/);

const signatureOk = await verifyWechatSignature({
  token: "token",
  timestamp: "123",
  nonce: "456",
  signature: "8779cd22a93aad0cb09babdc953a6d114bbf1c53"
});
assert.equal(signatureOk, true);

console.log("All tests passed.");
