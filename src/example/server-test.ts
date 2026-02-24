import { builder, ServerInit, ServerUtils, t } from "@codesordinatestudio/lucent";

builder.register({
  path: "/greetings",
  method: "GET",
  responseSchema: t.Object({
    message: t.String(),
  }),
  handler: async () => {
    return { message: "Hello, world!" };
  },
});

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    return ServerInit(req, {
      apiTitle: "Example API",
      apiVersion: "1.0.0",
    });
  },
});

ServerUtils.logger.info(`Server started in http://${server.hostname}:${server.port}`);
