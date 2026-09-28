import { createHandler, type ApiEnv } from "./handler.ts";

export default {
  fetch(request: Request, env: ApiEnv) {
    return createHandler(env)(request);
  },
};
