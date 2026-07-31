import assert from "node:assert/strict";
import { detectPlatform, extractFirstUrl } from "../src/platform.js";
import { hmacMd5, md5 } from "../src/hash.js";
import {
  extractPddGoodsId,
  resolvePddGoodsId,
  pddSign,
  pickPddResult
} from "../src/pdd.js";
import {
  parseWechatXml,
  replyTextXml,
  verifyWechatSignature
} from "../src/wechat.js";

assert.equal(md5(""), "d41d8cd98f00b204e9800998ecf8427e");
assert.equal(md5("abc"), "900150983cd24fb0d6963f7d28e17f72");
assert.equal(
  hmacMd5("key", "The quick brown fox jumps over the lazy dog"),
  "80070713463e7749b90c2dc24911e275"
);

assert.equal(detectPlatform("https://item.taobao.com/item.htm?id=1"), "taobao");
assert.equal(detectPlatform("￥abc123￥"), "taobao");
assert.equal(detectPlatform("https://item.jd.com/100.html"), "jd");
assert.equal(detectPlatform("https://m.vip.com/product-1.html"), "vip");
assert.equal(detectPlatform("https://mobile.yangkeduo.com/goods.html?goods_id=123"), "pdd");
assert.equal(detectPlatform("https://v.douyin.com/abc/"), "douyin");
assert.equal(detectPlatform("hello"), "unknown");

assert.equal(
  extractFirstUrl("帮我转 https://item.jd.com/100.html，谢谢"),
  "https://item.jd.com/100.html"
);
assert.equal(
  extractPddGoodsId("帮我转 https://mobile.yangkeduo.com/goods.html?goods_id=123456&foo=bar"),
  "123456"
);
assert.equal(extractPddGoodsId("https://example.com/no-goods-id"), "");
assert.equal(
  await resolvePddGoodsId("https://mobile.yangkeduo.com/goods2.html?ps=abc", async () => ({
    url: "https://mobile.yangkeduo.com/goods.html?goods_id=978556558455"
  })),
  "978556558455"
);
assert.equal(
  pddSign({
    client_id: "client",
    data_type: "JSON",
    timestamp: 1,
    type: "test"
  }, "secret"),
  "60530745E7422F73524A3D9C31FB2725"
);
assert.deepEqual(
  pickPddResult({
    goods_promotion_url_generate_response: {
      goods_promotion_url_list: [
        {
          short_url: "https://p.pinduoduo.com/demo",
          mobile_short_url: "https://mobile.yangkeduo.com/demo",
          we_app_info: { page_path: "pages/goods.html" }
        }
      ]
    }
  }),
  {
    ok: true,
    shortUrl: "https://mobile.yangkeduo.com/demo",
    couponUrl: "https://p.pinduoduo.com/demo",
    note: "拼多多返回成功"
  }
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
