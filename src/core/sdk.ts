type SdkClientConstructor = new <T extends object>(
  ApiClass: new (config: { baseUrl: string; baseApiParams?: any }) => T,
  options: {
    baseUrl: string;
    /** Token to attach to every request as Bearer auth. */
    token?: string;
  },
) => T;

export const SdkClient = class<T extends object> {
  constructor(
    ApiClass: new (config: { baseUrl: string; baseApiParams?: any }) => T,
    options: { baseUrl: string; token?: string },
  ) {
    const { baseUrl, token } = options;

    const api = new ApiClass({
      baseUrl,
      baseApiParams: {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      },
    });

    if (token && "setSecurityData" in (api as any)) {
      (api as any).setSecurityData(token);
    }

    // Wrap responses to match expected format
    return new Proxy(api, {
      get(target, prop: string | symbol) {
        const value = target[prop as keyof typeof target];

        if (typeof value === "object" && value !== null) {
          // Wrap nested API methods (like api.auth.loginCreate)
          return new Proxy(value, {
            get(nestedTarget, nestedProp: string | symbol) {
              const method = nestedTarget[nestedProp as keyof typeof nestedTarget];

              if (typeof method === "function") {
                return async (...args: any[]) => {
                  try {
                    const response = await (method as any).apply(nestedTarget, args);
                    return {
                      data: response.data,
                      error: null,
                      status: response.status,
                    };
                  } catch (err: any) {
                    return {
                      data: null,
                      error: err?.error?.message || err?.message || "Request failed",
                      status: err?.status || null,
                    };
                  }
                };
              }
              return method;
            },
          });
        }

        return value;
      },
    });
  }
} as unknown as SdkClientConstructor;
