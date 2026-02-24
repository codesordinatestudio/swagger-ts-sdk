import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { SdkClient, SdkError, SdkToken } from "./sdk";

/**
 * Mock API class to simulate a generated SDK API
 */
class MockApiClass {
  baseUrl: string;
  baseApiParams: any;

  constructor(config: { baseUrl: string; baseApiParams?: any; securityWorker?: any; customFetch?: any }) {
    this.baseUrl = config.baseUrl;
    this.baseApiParams = config.baseApiParams;
  }

  // Mock nested endpoint (e.g., api.users.getUser)
  users = {
    getUser: async (params: { id: string; signal?: AbortSignal }) => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        data: { id: params.id, name: "John Doe" },
        status: 200,
      };
    },
    createUser: async (params: { name: string; signal?: AbortSignal }) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        data: { id: "123", name: params.name },
        status: 201,
      };
    },
  };

  // Mock auth endpoint
  auth = {
    login: async (params: { username: string; password: string; signal?: AbortSignal }) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        data: { token: "mock-token-123", user: { id: "1" } },
        status: 200,
      };
    },
  };
}

describe("SdkClient", () => {
  describe("initialization", () => {
    test("should create an SDK client with base URL", () => {
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
      });

      expect(sdk).toBeDefined();
      expect((sdk as any).baseUrl).toBe("https://api.example.com");
    });

    test("should create an SDK client with all options", () => {
      const onRequestError = mock(() => {});
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
        token: "static-token",
        onRequestError,
        timeout: 5000,
      });

      expect(sdk).toBeDefined();
    });

    test("should accept empty options", () => {
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
      });

      expect(sdk).toBeDefined();
    });
  });

  describe("token handling", () => {
    test("should handle static string token", () => {
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
        token: "my-static-token",
      });

      expect(sdk).toBeDefined();
    });

    test("should handle function-based token", () => {
      const tokenFn = mock(() => "dynamic-token");
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
        token: tokenFn,
      });

      expect(sdk).toBeDefined();
      expect(tokenFn).toHaveBeenCalled();
    });

    test("should handle token function returning undefined", () => {
      const tokenFn = mock(() => undefined);
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
        token: tokenFn,
      });

      expect(sdk).toBeDefined();
      expect(tokenFn).toHaveBeenCalled();
    });

    test("should handle empty token", () => {
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
        token: "",
      });

      expect(sdk).toBeDefined();
    });

    test("should handle undefined token", () => {
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
        token: undefined,
      });

      expect(sdk).toBeDefined();
    });
  });

  describe("API requests", () => {
    test("should make a successful request and return wrapped response", async () => {
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
      });

      const response = await (sdk as any).users.getUser({ id: "123" });

      expect(response).toEqual({
        data: { id: "123", name: "John Doe" },
        error: null,
        status: 200,
        abort: expect.any(Function),
      });
    });

    test("should return data from successful response", async () => {
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
      });

      const response = await (sdk as any).users.createUser({ name: "Jane" });

      expect(response.data).toEqual({ id: "123", name: "Jane" });
      expect(response.error).toBeNull();
      expect(response.status).toBe(201);
    });

    test("should support nested API endpoints", async () => {
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
      });

      const loginResponse = await (sdk as any).auth.login({
        username: "testuser",
        password: "password",
      });

      expect(loginResponse.data).toEqual({
        token: "mock-token-123",
        user: { id: "1" },
      });
      expect(loginResponse.status).toBe(200);
    });
  });

  describe("timeout functionality", () => {
    test("should abort request on timeout", async () => {
      class SlowApiClass {
        constructor(config: any) {}

        users = {
          getUser: async (params: { id: string; signal?: AbortSignal }) => {
            return new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                resolve({
                  data: { id: params.id },
                  status: 200,
                });
              }, 1000);

              if (params.signal) {
                if (params.signal.aborted) {
                  clearTimeout(timeoutId);
                  reject(new DOMException("Aborted", "AbortError"));
                } else {
                  params.signal.addEventListener("abort", () => {
                    clearTimeout(timeoutId);
                    reject(new DOMException("Aborted", "AbortError"));
                  });
                }
              }
            });
          },
        };
      }

      const sdk = new SdkClient(SlowApiClass, {
        baseUrl: "https://api.example.com",
        timeout: 50,
      });

      const response = await (sdk as any).users.getUser({ id: "123" });

      expect(response.data).toBeNull();
      expect(response.error).toBe("Request aborted");
      expect(response.status).toBe(0);
    });

    test("should complete request if timeout is not reached", async () => {
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
        timeout: 5000,
      });

      const response = await (sdk as any).users.getUser({ id: "123" });

      expect(response.data).toEqual({ id: "123", name: "John Doe" });
      expect(response.error).toBeNull();
    });
  });

  describe("abort functionality", () => {
    test("should return abort function in response", async () => {
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
      });

      const response = await (sdk as any).users.getUser({ id: "123" });

      expect(response.abort).toBeDefined();
      expect(typeof response.abort).toBe("function");
    });

    test("should allow manual abort of request", async () => {
      class AbortableApiClass {
        constructor(config: any) {}

        users = {
          getUser: async (params: { id: string; signal?: AbortSignal }) => {
            return new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                resolve({
                  data: { id: params.id },
                  status: 200,
                });
              }, 1000);

              if (params.signal) {
                if (params.signal.aborted) {
                  clearTimeout(timeoutId);
                  reject(new DOMException("Aborted", "AbortError"));
                } else {
                  params.signal.addEventListener("abort", () => {
                    clearTimeout(timeoutId);
                    reject(new DOMException("Aborted", "AbortError"));
                  });
                }
              }
            });
          },
        };
      }

      const sdk = new SdkClient(AbortableApiClass, {
        baseUrl: "https://api.example.com",
      });

      const responsePromise = (sdk as any).users.getUser({ id: "123" }) as any;

      // Abort function is attached to the promise itself
      setTimeout(() => {
        if (responsePromise.abort) {
          responsePromise.abort();
        }
      }, 50);

      const response = await responsePromise;

      expect(response.data).toBeNull();
      expect(response.error).toBe("Request aborted");
      expect(response.status).toBe(0);
    });
  });

  describe("error handling", () => {
    test("should handle API errors and return error response", async () => {
      class ErrorApiClass {
        constructor(config: any) {}

        users = {
          getUser: async (params: { id: string; signal?: AbortSignal }) => {
            throw {
              error: { message: "User not found" },
              status: 404,
            };
          },
        };
      }

      const onRequestError = mock(() => {});
      const sdk = new SdkClient(ErrorApiClass, {
        baseUrl: "https://api.example.com",
        onRequestError,
      });

      const response = await (sdk as any).users.getUser({ id: "999" });

      expect(response.data).toBeNull();
      expect(response.error).toBe("User not found");
      expect(response.status).toBe(404);
    });

    test("should handle generic errors", async () => {
      class ErrorApiClass {
        constructor(config: any) {}

        users = {
          getUser: async (params: { id: string; signal?: AbortSignal }) => {
            throw new Error("Network error");
          },
        };
      }

      const onRequestError = mock(() => {});
      const sdk = new SdkClient(ErrorApiClass, {
        baseUrl: "https://api.example.com",
        onRequestError,
      });

      const response = await (sdk as any).users.getUser({ id: "123" });

      expect(response.data).toBeNull();
      expect(response.error).toBe("Network error");
      expect(onRequestError).toHaveBeenCalled();
    });

    test("should handle errors without status code", async () => {
      class ErrorApiClass {
        constructor(config: any) {}

        users = {
          getUser: async (params: { id: string; signal?: AbortSignal }) => {
            throw new Error("Unknown error");
          },
        };
      }

      const sdk = new SdkClient(ErrorApiClass, {
        baseUrl: "https://api.example.com",
      });

      const response = await (sdk as any).users.getUser({ id: "123" });

      expect(response.data).toBeNull();
      expect(response.error).toBe("Unknown error");
      expect(response.status).toBeNull();
    });

    test("should call onRequestError callback when error occurs", async () => {
      class ErrorApiClass {
        constructor(config: any) {}

        users = {
          getUser: async (params: { id: string; signal?: AbortSignal }) => {
            throw {
              error: { message: "Server error" },
              status: 500,
            };
          },
        };
      }

      const onRequestError = mock(() => {});
      const sdk = new SdkClient(ErrorApiClass, {
        baseUrl: "https://api.example.com",
        onRequestError,
      });

      await (sdk as any).users.getUser({ id: "123" });

      expect(onRequestError).toHaveBeenCalled();
    });

    test("should not call onRequestError for abort errors", async () => {
      class SlowApiClass {
        constructor(config: any) {}

        users = {
          getUser: async (params: { id: string; signal?: AbortSignal }) => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return {
              data: { id: params.id },
              status: 200,
            };
          },
        };
      }

      const onRequestError = mock(() => {});
      const sdk = new SdkClient(SlowApiClass, {
        baseUrl: "https://api.example.com",
        timeout: 10,
        onRequestError,
      });

      await (sdk as any).users.getUser({ id: "123" });

      expect(onRequestError).not.toHaveBeenCalled();
    });
  });

  describe("response structure", () => {
    test("should always return object with expected properties", async () => {
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
      });

      const response = await (sdk as any).users.getUser({ id: "123" });

      expect(response).toHaveProperty("data");
      expect(response).toHaveProperty("error");
      expect(response).toHaveProperty("status");
      expect(response).toHaveProperty("abort");
    });

    test("should return null data on error", async () => {
      class ErrorApiClass {
        constructor(config: any) {}

        users = {
          getUser: async () => {
            throw new Error("Failed");
          },
        };
      }

      const sdk = new SdkClient(ErrorApiClass, {
        baseUrl: "https://api.example.com",
      });

      const response = await (sdk as any).users.getUser({ id: "123" });

      expect(response.data).toBeNull();
    });

    test("should return 0 status for aborted requests", async () => {
      class SlowApiClass {
        constructor(config: any) {}

        users = {
          getUser: async (params: { id: string; signal?: AbortSignal }) => {
            return new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                resolve({ data: { id: params.id }, status: 200 });
              }, 1000);

              if (params.signal) {
                if (params.signal.aborted) {
                  clearTimeout(timeoutId);
                  reject(new DOMException("Aborted", "AbortError"));
                } else {
                  params.signal.addEventListener("abort", () => {
                    clearTimeout(timeoutId);
                    reject(new DOMException("Aborted", "AbortError"));
                  });
                }
              }
            });
          },
        };
      }

      const sdk = new SdkClient(SlowApiClass, {
        baseUrl: "https://api.example.com",
        timeout: 10,
      });

      const response = await (sdk as any).users.getUser({ id: "123" });

      expect(response.status).toBe(0);
    });
  });

  describe("edge cases", () => {
    test("should handle request without params", async () => {
      class NoParamsApiClass {
        constructor(config: any) {}

        health = {
          check: async () => {
            return { data: { status: "ok" }, status: 200 };
          },
        };
      }

      const sdk = new SdkClient(NoParamsApiClass, {
        baseUrl: "https://api.example.com",
      });

      const response = await (sdk as any).health.check();

      expect(response.data).toEqual({ status: "ok" });
    });

    test("should pass signal to API method", async () => {
      class SignalCheckApiClass {
        constructor(config: any) {}

        users = {
          getUser: async (params: { id: string; signal?: AbortSignal }) => {
            expect(params.signal).toBeDefined();
            expect(params.signal).toBeInstanceOf(AbortSignal);
            return { data: { id: params.id }, status: 200 };
          },
        };
      }

      const sdk = new SdkClient(SignalCheckApiClass, {
        baseUrl: "https://api.example.com",
      });

      await (sdk as any).users.getUser({ id: "123" });
    });

    test("should handle very long timeout", async () => {
      const sdk = new SdkClient(MockApiClass, {
        baseUrl: "https://api.example.com",
        timeout: 999999,
      });

      const response = await (sdk as any).users.getUser({ id: "123" });

      expect(response.data).toEqual({ id: "123", name: "John Doe" });
    });
  });
});

describe("SdkError type", () => {
  test("should have correct structure", () => {
    const error: SdkError = {
      data: null,
      error: { message: "Error occurred" },
      status: 500,
      ok: false,
      statusText: "Internal Server Error",
      headers: new Headers(),
    };

    expect(error.data).toBeNull();
    expect(error.error).toEqual({ message: "Error occurred" });
    expect(error.status).toBe(500);
    expect(error.ok).toBe(false);
    expect(error.headers).toBeInstanceOf(Headers);
  });
});

describe("SdkToken type", () => {
  test("should accept string token", () => {
    const token: SdkToken = "my-token";
    expect(token).toBe("my-token");
  });

  test("should accept function token", () => {
    const tokenFn: SdkToken = () => "dynamic-token";
    expect(tokenFn()).toBe("dynamic-token");
  });

  test("should accept function returning undefined", () => {
    const tokenFn: SdkToken = () => undefined;
    expect(tokenFn()).toBeUndefined();
  });
});
