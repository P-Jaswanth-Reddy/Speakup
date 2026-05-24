import { z } from 'zod';
import { 
  insertUserSchema, 
  insertAptitudeResultSchema, 
  insertInterviewResultSchema, 
  insertGdResultSchema, 
  insertResumeResultSchema,
  type User,
  type AptitudeResult,
  type InterviewResult,
  type GdResult,
  type ResumeResult
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  users: {
    profile: {
      method: 'GET' as const,
      path: '/api/users/:id',
      responses: {
        200: z.custom<User>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/users/:id',
      input: insertUserSchema.partial().extend({
        age: z.coerce.number().optional(),
      }),
      responses: {
        200: z.custom<User>(),
        404: errorSchemas.notFound,
      },
    },
  },
  aptitude: {
    list: {
      method: 'GET' as const,
      path: '/api/aptitude/history/:userId',
      responses: {
        200: z.array(z.custom<AptitudeResult>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/aptitude',
      input: insertAptitudeResultSchema,
      responses: {
        201: z.custom<AptitudeResult>(),
        400: errorSchemas.validation,
      },
    },
    questions: {
      method: 'GET' as const,
      path: '/api/aptitude/questions/:topic',
      responses: {
        200: z.object({
            topic: z.string(),
            questions: z.array(z.any())
        }),
      },
    },
  },
  interview: {
    list: {
      method: 'GET' as const,
      path: '/api/interview/history/:userId',
      responses: {
        200: z.array(z.custom<InterviewResult>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/interview',
      input: insertInterviewResultSchema,
      responses: {
        201: z.custom<InterviewResult>(),
        400: errorSchemas.validation,
      },
    },
    start: {
      method: 'POST' as const,
      path: '/api/interview/start',
      input: z.object({ interviewType: z.string() }),
      responses: { 200: z.any() }
    },
    answer: {
      method: 'POST' as const,
      path: '/api/interview/answer',
      input: z.object({ questionNumber: z.number() }),
      responses: { 200: z.any() }
    },
    teachMe: {
      method: 'POST' as const,
      path: '/api/interview/teach-me',
      input: z.any(),
      responses: { 200: z.any() }
    },
  },
  gd: {
    list: {
      method: 'GET' as const,
      path: '/api/gd/history/:userId',
      responses: {
        200: z.array(z.custom<GdResult>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/gd',
      input: insertGdResultSchema,
      responses: {
        201: z.custom<GdResult>(),
        400: errorSchemas.validation,
      },
    },
    start: {
        method: 'POST' as const,
        path: '/api/gd/start',
        input: z.object({ topic: z.string(), difficulty: z.string() }),
        responses: { 200: z.any() }
    },
    message: {
        method: 'POST' as const,
        path: '/api/gd/message',
        input: z.any(),
        responses: { 200: z.any() }
    },
    feedback: {
        method: 'POST' as const,
        path: '/api/gd/feedback',
        input: z.any(),
        responses: { 200: z.any() }
    },
    end: {
        method: 'POST' as const,
        path: '/api/gd/end',
        input: z.any(),
        responses: { 200: z.any() }
    }
  },
  resume: {
    list: {
      method: 'GET' as const,
      path: '/api/resume/history/:userId',
      responses: {
        200: z.array(z.custom<ResumeResult>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/resume',
      input: insertResumeResultSchema,
      responses: {
        201: z.custom<ResumeResult>(),
        400: errorSchemas.validation,
      },
    },
    upload: {
        method: 'POST' as const,
        path: '/api/resume/upload',
        input: z.any(),
        responses: { 200: z.any() }
    }
  },
  dashboard: {
      stats: {
          method: 'GET' as const,
          path: '/api/dashboard/stats/:userId',
          responses: { 200: z.any() }
      }
  },
  ai: {
    chat: {
      method: 'POST' as const,
      path: '/api/ai/chat',
      input: z.object({
        message: z.string(),
        context: z.enum(['interview', 'gd']),
        history: z.array(z.object({
          role: z.enum(['user', 'bot']),
          text: z.string(),
        })).optional(),
      }),
      responses: {
        200: z.object({
          response: z.string(),
        }),
        400: errorSchemas.validation,
      },
    },
    analyze: {
      method: 'POST' as const,
      path: '/api/ai/analyze-resume',
      input: z.object({
        fileContent: z.string(), // Base64 or text
      }),
      responses: {
        200: z.object({
          atsScore: z.number(),
          suggestions: z.array(z.string()),
          parsedData: z.object({
            name: z.string(),
            email: z.string(),
            skills: z.array(z.string()),
            experience: z.string(),
            education: z.string(),
          }),
        }),
      },
    },
  },
};


export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
