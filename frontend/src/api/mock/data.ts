import type {
  Project,
  SheetData,
  SheetSettings,
  SheetSettingsResponse,
  Glossary,
  StyleGuide,
  ReviewReport,
  TranslationJob,
  JobHistoryEntry,
} from '../../types'

export const mockProjects: Project[] = [
  {
    id: 'opal_app',
    name: 'Opal App',
    description: 'Mobile puzzle game localization',
    sheetCount: 3,
    lastTranslatedAt: '2026-02-20T10:30:00Z',
    createdAt: '2026-01-15T09:00:00Z',
  },
  {
    id: 'ruby_rpg',
    name: 'Ruby RPG',
    description: 'Fantasy RPG dialogue translation',
    sheetCount: 5,
    lastTranslatedAt: null,
    createdAt: '2026-02-10T14:00:00Z',
  },
]

export const mockSheetNames: Record<string, string[]> = {
  opal_app: ['UI', 'Dialogues', 'Items'],
  ruby_rpg: ['MainQuest', 'SideQuest', 'UI', 'Skills', 'Items'],
}

export const mockSheetData: Record<string, SheetData> = {
  'opal_app/UI': {
    sheetName: 'UI',
    headers: ['key', 'English(en)', 'Japanese(ja)', 'Korean(ko)'],
    languages: [
      { code: 'en', label: 'English', isSource: true },
      { code: 'ja', label: 'Japanese', isSource: false },
      { code: 'ko', label: 'Korean', isSource: false },
    ],
    rows: [
      { key: 'btn_start', en: 'Start Game', ja: 'ゲームスタート', ko: '게임 시작' },
      { key: 'btn_settings', en: 'Settings', ja: '設定', ko: '설정' },
      { key: 'btn_quit', en: 'Quit', ja: '終了', ko: '종료' },
      { key: 'msg_welcome', en: 'Welcome, {0}!', ja: 'ようこそ、{0}！', ko: '환영합니다, {0}!' },
      { key: 'msg_level_up', en: 'Level Up! You reached level {0}', ja: 'レベルアップ！レベル{0}に到達', ko: '' },
      { key: 'msg_game_over', en: 'Game Over', ja: '', ko: '' },
      { key: 'lbl_score', en: 'Score: {0}', ja: 'スコア: {0}', ko: '점수: {0}' },
      { key: 'lbl_time', en: 'Time Left', ja: '残り時間', ko: '남은 시간' },
    ],
  },
  'opal_app/Dialogues': {
    sheetName: 'Dialogues',
    headers: ['key', 'English(en)', 'Japanese(ja)', 'Korean(ko)'],
    languages: [
      { code: 'en', label: 'English', isSource: true },
      { code: 'ja', label: 'Japanese', isSource: false },
      { code: 'ko', label: 'Korean', isSource: false },
    ],
    rows: [
      { key: 'npc_01_greeting', en: 'Hello, adventurer!', ja: 'こんにちは、冒険者！', ko: '안녕, 모험가!' },
      { key: 'npc_01_quest', en: 'Can you help me find {0}?', ja: '{0}を探すのを手伝ってくれる？', ko: '' },
    ],
  },
  'opal_app/Items': {
    sheetName: 'Items',
    headers: ['key', 'English(en)', 'Japanese(ja)', 'Korean(ko)'],
    languages: [
      { code: 'en', label: 'English', isSource: true },
      { code: 'ja', label: 'Japanese', isSource: false },
      { code: 'ko', label: 'Korean', isSource: false },
    ],
    rows: [
      { key: 'item_sword', en: 'Iron Sword', ja: '鉄の剣', ko: '철검' },
      { key: 'item_shield', en: 'Wooden Shield', ja: '木の盾', ko: '' },
    ],
  },
}

export const mockProjectDefaults: Record<string, SheetSettings> = {
  opal_app: {
    sourceLanguage: 'en',
    translationStyle: '',
    characterLimit: null,
    glossaryOverride: '',
    instructions: '',
  },
}

export const mockSheetSettings: Record<string, SheetSettings> = {
  'opal_app/UI': {
    sourceLanguage: null,
    translationStyle: 'casual',
    characterLimit: 30,
    glossaryOverride: null,
    instructions: 'Keep UI strings short and punchy.',
  },
}

export const mockGlossary: Record<string, Glossary> = {
  opal_app: {
    projectId: 'opal_app',
    entries: [
      { id: '1', source: 'Level Up', target: 'レベルアップ', context: 'Game progression', language: 'ja' },
      { id: '2', source: 'Level Up', target: '레벨업', context: 'Game progression', language: 'ko' },
      { id: '3', source: 'Score', target: 'スコア', context: 'Points display', language: 'ja' },
      { id: '4', source: 'Score', target: '점수', context: 'Points display', language: 'ko' },
    ],
  },
}

export const mockStyleGuide: Record<string, StyleGuide> = {
  opal_app: {
    projectId: 'opal_app',
    tone: 'Friendly and encouraging',
    formality: 'casual',
    audience: 'Young adults (18-30)',
    rules: '- Use simple, clear language\n- Keep exclamations for achievements\n- Avoid jargon',
    examples: 'Good: "Awesome job!"\nBad: "Your performance metrics have been satisfactory."',
  },
}

export const mockReviewReport: Record<string, ReviewReport> = {
  'opal_app/UI': {
    projectId: 'opal_app',
    sheetName: 'UI',
    totalKeys: 8,
    reviewedKeys: 8,
    issues: [
      {
        id: 'r1',
        key: 'msg_level_up',
        language: 'ja',
        severity: 'warning',
        category: 'style',
        message: 'Translation uses formal tone, but style guide specifies casual.',
        suggestion: 'レベルアップ！レベル{0}になったよ！',
        original: 'Level Up! You reached level {0}',
        translated: 'レベルアップ！レベル{0}に到達',
      },
      {
        id: 'r2',
        key: 'msg_level_up',
        language: 'ko',
        severity: 'error',
        category: 'accuracy',
        message: 'Translation is missing.',
        original: 'Level Up! You reached level {0}',
        translated: '',
      },
      {
        id: 'r3',
        key: 'msg_game_over',
        language: 'ja',
        severity: 'error',
        category: 'accuracy',
        message: 'Translation is missing.',
        original: 'Game Over',
        translated: '',
      },
      {
        id: 'r4',
        key: 'msg_game_over',
        language: 'ko',
        severity: 'error',
        category: 'accuracy',
        message: 'Translation is missing.',
        original: 'Game Over',
        translated: '',
      },
      {
        id: 'r5',
        key: 'btn_start',
        language: 'ja',
        severity: 'info',
        category: 'terminology',
        message: 'Consider using glossary term for consistency.',
        original: 'Start Game',
        translated: 'ゲームスタート',
      },
    ],
    createdAt: '2026-02-21T15:00:00Z',
  },
}

export const mockJobHistory: Record<string, JobHistoryEntry[]> = {
  opal_app: [
    {
      jobId: 'hist_1',
      projectId: 'opal_app',
      sheetName: 'UI',
      type: 'translate_all',
      status: 'completed',
      totalKeys: 8,
      processedKeys: 8,
      createdAt: '2026-02-20T10:30:00Z',
      completedAt: '2026-02-20T10:32:15Z',
    },
    {
      jobId: 'hist_2',
      projectId: 'opal_app',
      sheetName: 'Dialogues',
      type: 'translate_all',
      status: 'completed',
      totalKeys: 2,
      processedKeys: 2,
      createdAt: '2026-02-20T10:35:00Z',
      completedAt: '2026-02-20T10:35:45Z',
    },
    {
      jobId: 'hist_3',
      projectId: 'opal_app',
      sheetName: 'UI',
      type: 'review',
      status: 'completed',
      totalKeys: 8,
      processedKeys: 8,
      createdAt: '2026-02-21T15:00:00Z',
      completedAt: '2026-02-21T15:02:30Z',
    },
    {
      jobId: 'hist_4',
      projectId: 'opal_app',
      sheetName: 'Items',
      type: 'translate_all',
      status: 'failed',
      totalKeys: 2,
      processedKeys: 1,
      error: 'API rate limit exceeded',
      createdAt: '2026-02-22T09:00:00Z',
      completedAt: '2026-02-22T09:01:10Z',
    },
  ],
  ruby_rpg: [],
}

// Job simulation state
let jobCounter = 0
let jobStore: Record<string, TranslationJob> = {}
let jobPollCounts: Record<string, number> = {}

export function createMockJob(projectId: string, sheetName: string, type: TranslationJob['type']): TranslationJob {
  const jobId = `job_${++jobCounter}`
  const job: TranslationJob = {
    jobId,
    projectId,
    sheetName,
    type,
    status: 'pending',
    progress: 0,
    totalKeys: 8,
    processedKeys: 0,
    createdAt: new Date().toISOString(),
  }
  jobStore[jobId] = job
  jobPollCounts[jobId] = 0
  return job
}

export function pollMockJob(jobId: string): TranslationJob | null {
  const job = jobStore[jobId]
  if (!job) return null

  const count = (jobPollCounts[jobId] || 0) + 1
  jobPollCounts[jobId] = count

  if (count === 1) {
    job.status = 'running'
    job.progress = 33
    job.processedKeys = 3
  } else if (count === 2) {
    job.status = 'running'
    job.progress = 66
    job.processedKeys = 5
  } else {
    job.status = 'completed'
    job.progress = 100
    job.processedKeys = job.totalKeys
  }

  return { ...job }
}
