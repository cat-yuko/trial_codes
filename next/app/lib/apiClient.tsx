import type { ResponseData } from "@/app/types/response";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: any;
  auth?: boolean;
};

// カスタムAPIエラークラス
export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export const apiClient = async <T = ResponseData> (
  endpoint: string,
  options: RequestOptions = {},
  retry = true
): Promise<T> => {
  const {
    method = "GET",
    headers = {},
    body,
    auth = true, // cookie-based認証が前提の場合
  } = options;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    // cookieベース場合は必須
    credentials: "include",
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);

  if (!res.ok) {
    // 認証付きのリクエストで401が出たら、自動でリフレッシュ
    if (
      auth &&
      res.status === 401 &&
      retry &&
      endpoint !== "/token/" &&
      endpoint !== "/token/refresh/"
    ) {
      try {
        await apiClient(
          "/token/refresh/",
          { method: "POST", auth: true },
          false
        );
        // トークン更新後、リトライ
        return await apiClient(endpoint, options, false);
      } catch {
        // トークンリフレッシュ失敗したら続行
      }
    }

    const errorData = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      errorData.detail || `API Error ${res.status}: ${res.statusText}`
    );
  }

  return res.json() as Promise<T>;
};
