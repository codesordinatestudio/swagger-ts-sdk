import { generateApi } from "swagger-typescript-api";
import { resolve } from "node:path";

generateApi({
  url: "http://localhost:3000/openapi.json",
  output: resolve(process.cwd(), "./src/example/sample_schema"),
  fileName: "index.ts",
  httpClientType: "fetch",
  cleanOutput: true,
  generateUnionEnums: true,
  typePrefix: "SDK",
});
