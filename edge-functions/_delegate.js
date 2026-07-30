import app from "../src/index.js";

export default function onRequest(context) {
  return app.fetch(context.request, context.env || {});
}

export function onRequestGet(context) {
  return onRequest(context);
}

export function onRequestPost(context) {
  return onRequest(context);
}
