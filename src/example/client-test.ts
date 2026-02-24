import { SdkClient } from "../../dist";
import { Api } from "./sample_schema";

const client = new SdkClient(Api, {
  baseUrl: "http://localhost:3000",
  token: () => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("authToken");
    }
    return null;
  },
  onRequestError: (error) => {
    console.error("Request error:", error.status);
  },
});

(async () => {
  const { data, error } = await client.greetings.greetingsList();
  console.log("Greetings List:", { data, error });
})();
