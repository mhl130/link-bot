import worker from "../src/index.js";

export default function onRequest(context) {
  return worker.fetch(context.request, context.env || {});
}

export function onRequestGet(context) {
  return onRequest(context);
}

export function onRequestPost(context) {
  return onRequest(context);
}
