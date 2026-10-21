import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { AppConfig, Me } from "./types";

export function useMe() {
  const q = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("GET", "/api/auth/me"), staleTime: 15_000 });
  return { me: q.data, user: q.data?.user ?? null, loading: q.isLoading, refetch: q.refetch };
}

export function useConfig() {
  const q = useQuery({ queryKey: ["config"], queryFn: () => api<AppConfig>("GET", "/api/config"), staleTime: 5 * 60_000 });
  return q.data;
}

export function useInvalidateMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}
