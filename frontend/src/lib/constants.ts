export const QUERY_KEYS = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  sheets: (projectId: string) => ['sheets', projectId] as const,
  sheetData: (projectId: string, sheetName: string) =>
    ['sheetData', projectId, sheetName] as const,
  sheetSettings: (projectId: string, sheetName: string) =>
    ['sheetSettings', projectId, sheetName] as const,
  glossary: (projectId: string) => ['glossary', projectId] as const,
  styleGuide: (projectId: string) => ['styleGuide', projectId] as const,
  job: (jobId: string) => ['job', jobId] as const,
  review: (projectId: string, sheetName: string) =>
    ['review', projectId, sheetName] as const,
  jobHistory: (projectId: string) => ['jobHistory', projectId] as const,
} as const
