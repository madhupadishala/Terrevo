import { createHandler, type ApiEnv } from "./handler.ts";
import { hardenApiResponse, resolveRequestId } from "../../../modules/security/src/index.ts";

export default {
  async fetch(request: Request, env: ApiEnv) {
    const requestId = resolveRequestId(request.headers.get("x-request-id"));
    const response = await createHandler(env)(request);
    return hardenApiResponse(response, requestId);
  },
};
