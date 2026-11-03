import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("unitrack_admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getErrorMessage(err: unknown, fallback = "Request failed"): string {
  const axiosErr = err as {
    response?: { data?: { error?: string } };
    message?: string;
  };
  return axiosErr.response?.data?.error || axiosErr.message || fallback;
}
