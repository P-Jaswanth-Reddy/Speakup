import { z } from "zod";

// --- Users ---
export const insertUserSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  age: z.number().nullable().optional(),
  gender: z.string().nullable().optional(),
  occupation: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  firebaseUid: z.string().nullable().optional(),
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = InsertUser & { id: number; createdAt: string | null };

// --- Aptitude ---
export const insertAptitudeResultSchema = z.object({
  userId: z.string(),  // Firebase UID
  topic: z.string(),
  score: z.number(),
  totalQuestions: z.number(),
  accuracy: z.number().nullable().optional(),
  timeTaken: z.number().nullable().optional(),
});
export type InsertAptitudeResult = z.infer<typeof insertAptitudeResultSchema>;
export type AptitudeResult = InsertAptitudeResult & { id: number; createdAt: string | null };

// --- Interview ---
export const insertInterviewResultSchema = z.object({
  userId: z.string(),  // Firebase UID
  communicationScore: z.number().nullable().optional(),
  confidenceScore: z.number().nullable().optional(),
  relevanceScore: z.number().nullable().optional(),
  feedback: z.string().nullable().optional(),
});
export type InsertInterviewResult = z.infer<typeof insertInterviewResultSchema>;
export type InterviewResult = InsertInterviewResult & { id: number; createdAt: string | null };

// --- GD ---
export const insertGdResultSchema = z.object({
  userId: z.string(),  // Firebase UID
  topic: z.string(),
  duration: z.number().nullable().optional(),
  score: z.number().nullable().optional(),
});
export type InsertGdResult = z.infer<typeof insertGdResultSchema>;
export type GdResult = InsertGdResult & { id: number; createdAt: string | null };

// --- Resume ---
export const insertResumeResultSchema = z.object({
  userId: z.string(),  // Firebase UID
  atsScore: z.number().nullable().optional(),
  suggestions: z.array(z.string()).nullable().optional(),
  fileName: z.string().nullable().optional(),
});
export type InsertResumeResult = z.infer<typeof insertResumeResultSchema>;
export type ResumeResult = InsertResumeResult & { id: number; createdAt: string | null };

// --- Types for Updates ---
export type UpdateUser = Partial<InsertUser>;

// Mock Objects for Routes compatibility (since routes.ts uses users.$inferSelect)
// We will need to update routes.ts to verify it doesn't break.
// But mostly routes.ts used `z.custom<typeof users.$inferSelect>()`.
// I will need to update routes.ts as well to remove Drizzle references.

