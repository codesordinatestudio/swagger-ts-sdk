/**
 * Error type returned when an API request fails.
 * Contains the error data, status code, and other response properties.
 */
export type SdkError<E = unknown> = {
  data: null;
  error: E;
  status: number;
  ok: boolean;
  statusText: string;
  headers: Headers;
  body?: any;
};

/**
 * Token type that can be either a static string or a function that returns the token.
 * Use a function to retrieve the token dynamically from localStorage/sessionStorage
 * for each request.
 */
export type SdkToken = string | (() => string | undefined);

type SdkClientConstructor = new <T extends object>(
  ApiClass: new (config: { baseUrl: string; baseApiParams?: any; securityWorker?: any; customFetch?: any }) => T,
  options: {
    baseUrl: string;
    /**
     * Token to attach to every request as Bearer auth.
     * Can be a static string or a function that returns the token.
     * Use a function to retrieve the token dynamically from localStorage/sessionStorage
     * for each request.
     */
    token?: SdkToken;
    /** Callback triggered when a request error occurs. */
    onRequestError?: (error: SdkError) => void;
    /**
     * Request timeout in milliseconds.
     * If set, the request will be aborted after the specified duration.
     */
    timeout?: number;
  },
) => T;

export const SdkClient = class<T extends object> {
  constructor(
    ApiClass: new (config: { baseUrl: string; baseApiParams?: any; securityWorker?: any; customFetch?: any }) => T,
    options: { baseUrl: string; token?: SdkToken; onRequestError?: (error: SdkError) => void; timeout?: number },
  ) {
    const { baseUrl, token, onRequestError, timeout } = options;

    // Convert token to a function for consistent handling
    const getToken = typeof token === "function" ? token : token ? () => token : () => undefined;

    const api = new ApiClass({
      baseUrl,
      baseApiParams: {
        headers: {
          ...(token && { Authorization: `Bearer ${getToken()}` }),
        },
      },
      securityWorker: async () => {
        const currentToken = getToken();
        return currentToken ? { headers: { Authorization: `Bearer ${currentToken}` } } : {};
      },
    });

    const staticToken = typeof token === "string" ? token : undefined;
    if (staticToken && "setSecurityData" in (api as any)) {
      (api as any).setSecurityData(staticToken);
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
                  // Create AbortController for timeout and manual abort
                  const abortController = new AbortController();
                  let abortFn = abortController.abort.bind(abortController);

                  // Set up timeout if configured
                  let timeoutId: ReturnType<typeof setTimeout> | undefined;
                  if (timeout) {
                    timeoutId = setTimeout(() => {
                      abortController.abort();
                    }, timeout);
                  }

                  try {
                    // Create a unique cancelToken for this request
                    const cancelToken = Symbol("request-cancel");

                    // Pass the signal via the request params
                    const requestParams = args[0] || {};
                    const paramsWithSignal = {
                      ...requestParams,
                      signal: abortController.signal,
                    };

                    const response = await (method as any).apply(nestedTarget, [paramsWithSignal]);

                    // Clear timeout if request completed
                    if (timeoutId) {
                      clearTimeout(timeoutId);
                    }

                    return {
                      data: response.data,
                      error: null,
                      status: response.status,
                      abort: abortFn,
                    };
                  } catch (err: any) {
                    // Clear timeout if request failed
                    if (timeoutId) {
                      clearTimeout(timeoutId);
                    }

                    // Check if this was an abort error
                    if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
                      return {
                        data: null,
                        error: "Request aborted",
                        status: 0,
                        abort: abortFn,
                      };
                    }

                    if (onRequestError) {
                      onRequestError(err);
                    }
                    return {
                      data: null,
                      error: err?.error?.message || err?.message || "Request failed",
                      status: err?.status || null,
                      abort: abortFn,
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
