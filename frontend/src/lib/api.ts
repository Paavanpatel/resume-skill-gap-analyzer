/**
 * API client for communicating with the FastAPI backend.
 *
 * Centralizes all HTTP calls, auth token management, and error handling.
 * All components import from here rather than calling fetch/axios directly.
 */

import axios, { AxiosError } from "axios";
import type { LoginRequest, LoginResponse, RegisterRequest, User } from "@/types/auth";
import type {
  AdvisorResponse,
  AnalysisHistoryItem,
  AnalysisResult,
  AnalysisStatusResponse,
  AnalysisSubmitResponse,
  ResumeUploadResponse,
  RoadmapResponse,
} from "@/types/analysis";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // Send httpOnly cookies with every request
});

// ── Token helpers ───────────────────────────────────────────
// Access token: stored in localStorage (needed for Authorization header)
// Refresh token: httpOnly cookie set by the backend (never accessible to JS)

export function getStoredTokens() {
  if (typeof window === "undefined") return null;
  const access = localStorage.getItem("access_token");
  return access ? { access } : null;
}

export function storeTokens(access: string) {
  localStorage.setItem("access_token", access);
  // Refresh token is now an httpOnly cookie — no localStorage storage needed
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
}

// ── Request interceptor: attach JWT token ───────────────────

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401 ───────────────

let isRefreshing = false;
let failedQueue: { resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = [];

function processQueue(error: unknown) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(undefined)));
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry auth endpoints
      if (originalRequest.url?.includes("/auth/")) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token is sent automatically via httpOnly cookie
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        storeTokens(data.access_token);
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth API ────────────────────────────────────────────────

export async function register(data: RegisterRequest): Promise<User> {
  const res = await apiClient.post("/auth/register", data);
  return res.data;
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await apiClient.post("/auth/login", data);
  return res.data;
}

export async function logout(): Promise<void> {
  try {
    // Refresh token is sent via httpOnly cookie automatically
    await apiClient.post("/auth/logout");
  } catch {
    // Best-effort logout
  }
  clearTokens();
}

export async function getMe(): Promise<User> {
  const res = await apiClient.get("/auth/me");
  return res.data;
}

// ── Resume API ──────────────────────────────────────────────

export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiClient.post("/resume/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function listResumes(): Promise<ResumeUploadResponse[]> {
  const res = await apiClient.get("/resume/");
  return res.data;
}

// ── Analysis API ────────────────────────────────────────────

export async function submitAnalysis(
  resumeId: string,
  jobDescription: string,
  jobTitle?: string,
  jobCompany?: string
): Promise<AnalysisSubmitResponse> {
  const res = await apiClient.post(`/analysis/${resumeId}`, {
    job_description: jobDescription,
    job_title: jobTitle || null,
    job_company: jobCompany || null,
  });
  return res.data;
}

export async function getAnalysisStatus(
  analysisId: string
): Promise<AnalysisStatusResponse> {
  const res = await apiClient.get(`/analysis/${analysisId}/status`);
  return res.data;
}

export async function getAnalysisResult(
  analysisId: string
): Promise<AnalysisResult> {
  const res = await apiClient.get(`/analysis/${analysisId}`);
  return res.data;
}

export async function getAnalysisHistory(): Promise<AnalysisHistoryItem[]> {
  const res = await apiClient.get("/analysis/history");
  return res.data.analyses;
}

// ── Insights API (Phase 9) ──────────────────────────────────

export async function generateRoadmap(analysisId: string): Promise<RoadmapResponse> {
  const res = await apiClient.post(`/insights/${analysisId}/roadmap`);
  return res.data;
}

export async function getRoadmap(analysisId: string): Promise<RoadmapResponse> {
  const res = await apiClient.get(`/insights/${analysisId}/roadmap`);
  return res.data;
}

export async function generateAdvisorRewrites(analysisId: string): Promise<AdvisorResponse> {
  const res = await apiClient.post(`/insights/${analysisId}/advisor`);
  return res.data;
}

// ── Error helper ────────────────────────────────────────────

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data?.error?.message) return data.error.message;
    if (error.response?.status === 429) return "Too many requests. Please wait a moment.";
    if (error.response?.status === 413) return "File is too large.";
  }
  return "Something went wrong. Please try again.";
}
