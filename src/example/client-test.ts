import { SdkClient } from "../../dist";
import { Api } from "./sample_schema";

const client = new SdkClient(Api, {
  baseUrl: "http://localhost:3000",
  onRequestError: (error) => {
    console.error("Request error:", error);
  },
});

(async () => {
  const { data, error } = await client.greetings.greetingsList();
  console.log("Greetings List:", { data, error });
})();
