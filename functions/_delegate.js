import app from "../src/index.js";

export function onRequest(context) {
  return app.fetch(context.request, context.env);
}
