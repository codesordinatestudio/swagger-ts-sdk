# Swagger TypeScript SDK

A TypeScript SDK generated from Swagger/OpenAPI specifications, providing a type-safe way to interact with REST APIs.

## Installation

```bash
npm install swagger-ts-sdk
# or
bun add swagger-ts-sdk
```

## Quick Start

```typescript
import { SdkClient } from "swagger-ts-sdk";
import { Api } from "./your-api-schema";

const client = new SdkClient(Api, {
  baseUrl: "https://api.example.com",
});

(async () => {
  const { data, error, status } = await client.greetings.greetingsList();
  
  if (error) {
    console.error("Request failed:", error);
    return;
  }
  
  console.log("Success:", data);
})();
```

## SdkClient API

### Constructor

```typescript
new SdkClient<T>(ApiClass, options)
```

#### Parameters

- `ApiClass` - The generated API class from your Swagger schema
- `options` - Configuration object with the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `baseUrl` | `string` | Yes | The base URL for all API requests |
| `token` | `SdkToken` | No | Bearer token for authentication. Can be a static string or a function that returns the token dynamically. |
| `onRequestError` | `(error: SdkError) => void` | No | Callback triggered when a request fails |
| `timeout` | `number` | No | Request timeout in milliseconds. If set, the request will be aborted after the specified duration. |

### Response Format

All API methods return a standardized response object:

```typescript
{
  data: T | null;         // The response data on success
  error: string | null;   // Error message on failure
  status: number | null;  // HTTP status code
  abort: () => void;      // Function to abort the request
}
```

## SdkError Type

The `SdkError` type represents an error response from the API. It is passed to the `onRequestError` callback when a request fails.

```typescript
export type SdkError<E = unknown> = {
  /** Always null for error responses */
  data: null;
  /** The error data from the API response */
  error: E;
  /** HTTP status code */
  status: number;
  /** Whether the request was successful (always false for errors) */
  ok: boolean;
  /** HTTP status text */
  statusText: string;
  /** Response headers */
  headers: Headers;
  /** Optional body content */
  body?: any;
};
```

### Importing SdkError

```typescript
import { SdkClient, SdkError } from "swagger-ts-sdk";
```

## Examples

### Basic GET Request

```typescript
import { SdkClient } from "swagger-ts-sdk";
import { Api } from "./your-api-schema";

const client = new SdkClient(Api, {
  baseUrl: "https://api.example.com",
});

// Get a list of items
const { data, error, status } = await client.items.itemsList();

if (error) {
  console.error(`Error (${status}):`, error);
} else {
  console.log("Items:", data);
}
```

### POST Request with Data

```typescript
const { data, error, status } = await client.users.usersCreate({
  body: {
    name: "John Doe",
    email: "john@example.com",
  },
});
```

### Using Authentication Token

```typescript
const client = new SdkClient(Api, {
  baseUrl: "https://api.example.com",
  token: "your-bearer-token",
});
```

### Dynamic Token (localStorage/sessionStorage)

If your token is stored in localStorage or sessionStorage and may change during the session, pass a function instead of a static string. The function will be called before each request to get the current token.

```typescript
const client = new SdkClient(Api, {
  baseUrl: "https://api.example.com",
  token: () => {
    // Retrieve token from localStorage/sessionStorage for each request
    return localStorage.getItem("authToken");
    // Or use sessionStorage:
    // return sessionStorage.getItem("authToken");
  },
});
```

This is useful when:
- The token may expire and be refreshed during the session
- You want to avoid storing the token in memory
- Multiple tabs might update the token

### Error Callback

```typescript
const client = new SdkClient(Api, {
  baseUrl: "https://api.example.com",
  onRequestError: (error: SdkError) => {
    console.error("Request failed!");
    console.error("Status:", error.status);
    console.error("Error:", error.error);
    console.error("Status Text:", error.statusText);
    
    // Send to error tracking service
    // sendToSentry(error);
  },
});
```

### Request Timeout

Set a timeout in milliseconds to automatically abort requests that take too long.

```typescript
const client = new SdkClient(Api, {
  baseUrl: "https://api.example.com",
  timeout: 5000, // 5 seconds
});

// If the request takes longer than 5 seconds, it will be aborted
const { data, error, status } = await client.items.itemsList();

if (error === "Request failed" && status === 0) {
  console.error("Request timed out");
}
```

### Abort Request

Each request returns an `abort` function that you can call to cancel the request at any time.

```typescript
const client = new SdkClient(Api, {
  baseUrl: "https://api.example.com",
});

// Make a request and get the abort function
const request = client.items.itemsList();
const { data, error, status, abort } = await request;

// Or destructured:
const { abort: cancelRequest } = await client.items.itemsList();

// Cancel the request if needed
cancelRequest();

// Or using the abort function from the response
const response = await client.users.usersList();
response.abort(); // Cancel the request
```

**Note:** Once a request is aborted, the response will have `error: "Request aborted"` and `status: 0`.

### Nested API Endpoints

The SDK supports nested API structures:

```typescript
// For APIs with nested endpoints like api.auth.loginCreate
const { data, error } = await client.auth.loginCreate({
  body: {
    username: "user",
    password: "pass",
  },
});
```

## Type Safety

The SDK provides full type safety for:

- Request parameters
- Request body
- Response data
- Error types

```typescript
// Full type inference
const { data, error, status } = await client.users.usersGetById("123");

// data is typed as User | null
// error is typed as string | null
// status is typed as number | null
```

## License

MIT
