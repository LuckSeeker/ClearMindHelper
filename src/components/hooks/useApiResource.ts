import { useState, useCallback, useEffect } from "react";

interface ApiError {
  code?: string;
  message?: string;
}

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

interface UseApiResourceResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  errorCode: string | null;
  refetch: () => Promise<void>;
  setData: (data: T | null) => void;
}

interface UseApiResourceOptions {
  method?: string;
  body?: Json;
}

export function useApiResource<T>(url: string, options?: UseApiResourceOptions): UseApiResourceResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const fetchResource = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const res = await fetch(url, {
        method: options?.method || "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });
      if (!res.ok) {
        let code = null;
        try {
          const data: { error?: ApiError } = await res.json();
          code = data?.error?.code || null;
          setError(data?.error?.message || "Błąd pobierania danych");
        } catch {
          setError("Błąd pobierania danych");
        }
        setErrorCode(code || String(res.status));
        return;
      }
      const data: T = await res.json();
      setData(data);
    } catch {
      setError("Błąd pobierania danych");
      setErrorCode("FETCH_ERROR");
    } finally {
      setLoading(false);
    }
  }, [url, options?.method, options?.body]);

  // Fetch data on mount and when url/options change
  useEffect(() => {
    fetchResource();
  }, [url, options?.method, options?.body]);

  return { data, isLoading, error, errorCode, refetch: fetchResource, setData };
}
