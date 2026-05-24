import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { 
  type InsertAptitudeResult, 
  type InsertInterviewResult, 
  type InsertGdResult, 
  type InsertResumeResult 
} from "@shared/schema";
import {
  type StartInterviewRequest,
  type StartInterviewResponse,
  type AnswerRequest,
  type AnswerResponse,
  type TeachMeRequest,
  type TeachMeResponse,
  type StartGDRequest,
  type StartGDResponse,
  type GDMessageRequest,
  type GDMessageResponse,
  type GDFeedbackRequest,
  type GDFeedbackResponse,
  type GDEndRequest,
  type GDEndResponse,
  type AptitudeQuestionsResponse,
  type SubmitAptitudeReq,
  type SubmitAptitudeResponse,
  type ResumeUploadResponse,
  type DashboardStatsResponse
} from "../types/api-types";
import { auth } from "@/firebase";

import { API_BASE_URL } from "@/lib/config";

// Helper for API calls with Firebase authentication
async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  // Prepend base URL if path starts with /api or other backend endpoints
  const fullUrl = (url.startsWith("/api") || url.startsWith("/chat") || url.startsWith("/stt") || url.startsWith("/tts") || url.startsWith("/resume"))
    ? `${API_BASE_URL}${url}`
    : url;
  
  // Get Firebase ID token if user is authenticated
  let headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {})
  };
  
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn("⚠️ Failed to get Firebase token:", error);
  }
  
  console.log("🔵 API Call:", { method: options?.method || "GET", url, fullUrl, hasToken: !!headers['Authorization'] });
    
  try {
    const res = await fetch(fullUrl, {
      ...options,
      headers,
    });
    
    console.log("🟢 API Response:", { status: res.status, statusText: res.statusText, ok: res.ok });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: "Unknown error occurred" }));
      throw new Error(errorData.message || errorData.detail || res.statusText);
    }
    
    if (res.status === 204) return {} as T;
    const jsonData = await res.json();
    console.log("📦 API Data:", jsonData);
    return jsonData;
  } catch (error) {
    console.error("🔴 API Error:", error);
    throw error;
  }
}

// --- Aptitude Hooks ---

export function useAptitudeHistory(userId: string) {
  return useQuery({
    queryKey: [api.aptitude.list.path, userId],
    queryFn: () => apiCall<any[]>(buildUrl(api.aptitude.list.path, { userId })),
    enabled: !!userId,
  });
}

export function useAptitudeQuestions(topic: string, count: number = 20, aiPowered: boolean = false) {
  return useQuery({
    queryKey: ['aptitude', 'questions', topic, count, aiPowered],
    queryFn: () => apiCall<AptitudeQuestionsResponse>(`/api/aptitude/questions/${topic}?count=${count}&ai_powered=${aiPowered}`),
    enabled: !!topic,
  });
}

export function useCreateAptitudeResult() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: InsertAptitudeResult) => 
      apiCall<any>(api.aptitude.create.path, {
        method: api.aptitude.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.aptitude.list.path, data.userId] });
      toast({ title: "Result Saved", description: "Your performance has been recorded." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Save", description: error.message, variant: "destructive" });
    }
  });
}

export function useSubmitAptitudeTest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: SubmitAptitudeReq) =>
      apiCall<SubmitAptitudeResponse>("/api/aptitude/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.aptitude.list.path, variables.userId] });
    },
    onError: (error: Error) => {
      toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
    }
  });
}

// --- Interview Hooks ---

export function useInterviewHistory(userId: string) {
  return useQuery({
    queryKey: [api.interview.list.path, userId],
    queryFn: () => apiCall<any[]>(buildUrl(api.interview.list.path, { userId })),
    enabled: !!userId,
  });
}

export function useStartInterview() {
  return useMutation({
    mutationFn: (data: StartInterviewRequest) =>
      apiCall<StartInterviewResponse>("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  });
}

export function useSubmitInterviewAnswer() {
  return useMutation({
    mutationFn: (data: AnswerRequest) =>
      apiCall<AnswerResponse>("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  });
}

export function useInterviewTeachMe() {
  return useMutation({
    mutationFn: (data: TeachMeRequest) =>
      apiCall<TeachMeResponse>("/api/interview/teach-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  });
}

export function useCreateInterviewResult() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: InsertInterviewResult) => 
      apiCall<any>(api.interview.create.path, {
        method: api.interview.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.interview.list.path, data.userId] });
    },
    onError: (error: Error) => {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    }
  });
}

// --- Group Discussion Hooks ---

export function useGdHistory(userId: string) {
  return useQuery({
    queryKey: [api.gd.list.path, userId],
    queryFn: () => apiCall<any[]>(buildUrl(api.gd.list.path, { userId })),
    enabled: !!userId,
  });
}

export function useStartGD() {
  return useMutation({
    mutationFn: (data: StartGDRequest) =>
      apiCall<StartGDResponse>("/api/gd/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  });
}

export function useSendGDMessage() {
  return useMutation({
    mutationFn: (data: GDMessageRequest) =>
      apiCall<GDMessageResponse>("/api/gd/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  });
}

export function useGDFeedback() {
  return useMutation({
    mutationFn: (data: GDFeedbackRequest) =>
      apiCall<GDFeedbackResponse>("/api/gd/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  });
}

export function useEndGD() {
  return useMutation({
    mutationFn: (data: GDEndRequest) =>
      apiCall<GDEndResponse>("/api/gd/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  });
}

export function useCreateGdResult() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: InsertGdResult) => 
      apiCall<any>(api.gd.create.path, {
        method: api.gd.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.gd.list.path, data.userId] });
      toast({ title: "Session Recorded", description: "GD session results have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Save", description: error.message, variant: "destructive" });
    }
  });
}

// --- GD Hooks ---


export function useUploadResume() {
  return useMutation({
    mutationFn: (formData: FormData) =>
      apiCall<ResumeUploadResponse>("/api/resume/upload", {
        method: "POST",
        body: formData,
      }),
  });
}

export function useCreateResumeResult() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: InsertResumeResult) => 
      apiCall<any>(api.resume.create.path, {
        method: api.resume.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.resume.list.path, data.userId] });
      toast({ title: "Analysis Saved", description: "Resume feedback recorded." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Save", description: error.message, variant: "destructive" });
    }
  });
}

// --- Dashboard Hooks ---

export function useDashboardStats(userId: string) {
  return useQuery({
    queryKey: ["/api/dashboard/stats", userId],
    queryFn: () => apiCall<DashboardStatsResponse>(`/api/dashboard/stats/${userId}`),
    enabled: !!userId,
  });
}

// --- Resume Hooks ---

export function useResumeHistory(userId: string) {
  return useQuery({
    queryKey: ["/api/resume/history", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await apiCall<any[]>(`/api/resume/history/${userId}`);
    },
    enabled: !!userId,
  });
}

// --- Performance Intelligence Engine Hooks ---

import { type PerformanceSummaryResponse, type TrajectoryResponse } from "../types/api-types";

export function usePerformanceSummary(userId: string) {
  return useQuery({
    queryKey: ["/api/interview/performance-summary", userId],
    queryFn: () => apiCall<PerformanceSummaryResponse>(`/api/interview/performance-summary/${userId}`),
    enabled: !!userId,
  });
}

export function useTrajectory(userId: string) {
  return useQuery({
    queryKey: ["/api/interview/trajectory", userId],
    queryFn: () => apiCall<TrajectoryResponse>(`/api/interview/trajectory/${userId}`),
    enabled: !!userId,
  });
}

// --- Coding Hooks ---

export function useCodingHistory(userId: string) {
  return useQuery({
    queryKey: ["/api/coding/history", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await apiCall<any[]>(`/api/coding/history/${userId}`);
    },
    enabled: !!userId,
  });
}
