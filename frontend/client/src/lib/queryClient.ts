import { QueryClient, QueryFunction } from "@tanstack/react-query";

import { API_BASE_URL } from "./config";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // If url starts with /api or /chat, prepend base URL
  const fullUrl = (url.startsWith("/api") || url.startsWith("/chat") || url.startsWith("/stt") || url.startsWith("/tts") || url.startsWith("/resume")) 
    ? `${API_BASE_URL}${url}` 
    : url;

  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    // credentials: "include", // Removed for simple local CORS, add back if cookie auth needed later
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/");
    const fullUrl = (url.startsWith("/api") || url.startsWith("/chat") || url.startsWith("/stt") || url.startsWith("/tts") || url.startsWith("/resume")) 
      ? `${API_BASE_URL}${url}` 
      : url;

    const res = await fetch(fullUrl);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: 2,              // Retry up to 2 times (handles Render cold-start timeouts)
      retryDelay: 3000,     // Wait 3 seconds between retries
    },
    mutations: {
      retry: 1,             // Retry mutations once on failure
      retryDelay: 2000,
    },
  },
});
