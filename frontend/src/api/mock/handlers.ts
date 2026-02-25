import {
  mockProjects,
  mockSheetNames,
  mockSheetData,
  mockProjectDefaults,
  mockSheetSettings,
  mockGlossary,
  mockStyleGuide,
  mockReviewReport,
  mockJobHistory,
  createMockJob,
  pollMockJob,
} from './data'
import type { CreateProjectPayload, SheetSettings, SheetSettingsResponse, GlossaryEntry, StyleGuide } from '../../types'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface MockRequest {
  method: Method
  path: string
  body?: unknown
}

function delay(ms = 300): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function match(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/')
  const pathParts = path.split('/')
  if (patternParts.length !== pathParts.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i])
    } else if (patternParts[i] !== pathParts[i]) {
      return null
    }
  }
  return params
}

export async function mockFetch(req: MockRequest): Promise<unknown> {
  await delay()
  const { method, path, body } = req
  let params: Record<string, string> | null

  // Projects
  if (method === 'GET' && path === '/api/projects') {
    return mockProjects
  }

  params = match('/api/projects/:projectId', path)
  if (params) {
    if (method === 'GET') {
      return mockProjects.find((p) => p.id === params!.projectId) || null
    }
  }

  if (method === 'POST' && path === '/api/projects') {
    const payload = body as CreateProjectPayload
    const newProject = {
      id: payload.name.toLowerCase().replace(/\s+/g, '_'),
      name: payload.name,
      description: payload.description,
      sheetCount: 0,
      lastTranslatedAt: null,
      createdAt: new Date().toISOString(),
    }
    mockProjects.push(newProject)
    return newProject
  }

  // Sheets
  params = match('/api/projects/:projectId/sheets', path)
  if (params && method === 'GET') {
    return mockSheetNames[params.projectId] || []
  }
  if (params && method === 'POST') {
    const { name } = body as { name: string }
    const names = mockSheetNames[params.projectId] || []
    if (names.includes(name)) {
      throw new Error('Sheet already exists')
    }
    names.push(name)
    mockSheetNames[params.projectId] = names
    // Copy headers from first existing sheet or default
    const firstKey = Object.keys(mockSheetData).find((k) => k.startsWith(`${params!.projectId}/`))
    const firstSheet = firstKey ? mockSheetData[firstKey] : null
    mockSheetData[`${params.projectId}/${name}`] = {
      sheetName: name,
      headers: firstSheet ? [...firstSheet.headers] : ['key'],
      languages: firstSheet ? firstSheet.languages.map((l) => ({ ...l })) : [],
      rows: [],
    }
    return { ok: true, name }
  }

  params = match('/api/projects/:projectId/sheets/:sheetName', path)
  if (params && method === 'DELETE') {
    const names = mockSheetNames[params.projectId] || []
    const key = `${params.projectId}/${params.sheetName}`
    const data = mockSheetData[key]
    const deletedKeys = data ? data.rows.length : 0
    mockSheetNames[params.projectId] = names.filter((n) => n !== params!.sheetName)
    delete mockSheetData[key]
    return { ok: true, deletedKeys }
  }
  if (params && method === 'GET') {
    const key = `${params.projectId}/${params.sheetName}`
    return mockSheetData[key] || null
  }

  params = match('/api/projects/:projectId/sheets/:sheetName/rows', path)
  if (params && method === 'POST') {
    const { key } = body as { key: string }
    const sheetKey = `${params.projectId}/${params.sheetName}`
    const data = mockSheetData[sheetKey]
    if (data) {
      if (data.rows.some((r) => r.key === key)) {
        throw new Error('Key already exists')
      }
      const newRow = { key } as Record<string, string> & { key: string }
      for (const lang of data.languages) {
        newRow[lang.code] = ''
      }
      data.rows.push(newRow)
    }
    return { ok: true, key }
  }
  if (params && method === 'PUT') {
    const key = `${params.projectId}/${params.sheetName}`
    const data = mockSheetData[key]
    if (data) {
      const updates = body as { key: string; langCode: string; value: string }[]
      for (const u of updates) {
        const row = data.rows.find((r) => r.key === u.key)
        if (row) row[u.langCode] = u.value
      }
    }
    return { ok: true }
  }

  if (params && method === 'DELETE') {
    const { keys } = body as { keys: string[] }
    const sheetKey = `${params.projectId}/${params.sheetName}`
    const data = mockSheetData[sheetKey]
    let deletedCount = 0
    if (data) {
      const keysSet = new Set(keys)
      const before = data.rows.length
      data.rows = data.rows.filter((r) => !keysSet.has(r.key))
      deletedCount = before - data.rows.length
    }
    return { ok: true, deletedCount }
  }
  // Sheet Settings
  params = match('/api/projects/:projectId/sheets/:sheetName/settings', path)
  if (params) {
    const key = `${params.projectId}/${params.sheetName}`
    const defaults: SheetSettings = mockProjectDefaults[params.projectId] || {
      sourceLanguage: 'en',
      translationStyle: '',
      characterLimit: null,
      glossaryOverride: '',
      instructions: '',
    }
    if (method === 'GET') {
      const settings: SheetSettings = mockSheetSettings[key] || {
        sourceLanguage: null,
        translationStyle: null,
        characterLimit: null,
        glossaryOverride: null,
        instructions: null,
      }
      return {
        projectId: params.projectId,
        sheetName: params.sheetName,
        settings,
        projectDefaults: defaults,
      } satisfies SheetSettingsResponse
    }
    if (method === 'PUT') {
      mockSheetSettings[key] = body as SheetSettings
      return {
        projectId: params.projectId,
        sheetName: params.sheetName,
        settings: mockSheetSettings[key],
        projectDefaults: defaults,
      } satisfies SheetSettingsResponse
    }
  }

  // Glossary
  params = match('/api/projects/:projectId/glossary', path)
  if (params) {
    if (method === 'GET') {
      return mockGlossary[params.projectId] || { projectId: params.projectId, entries: [] }
    }
    if (method === 'POST') {
      const entry = body as Omit<GlossaryEntry, 'id'>
      const glossary = mockGlossary[params.projectId] || { projectId: params.projectId, entries: [] }
      const newEntry = { ...entry, id: String(Date.now()) }
      glossary.entries.push(newEntry)
      mockGlossary[params.projectId] = glossary
      return newEntry
    }
  }

  params = match('/api/projects/:projectId/glossary/:entryId', path)
  if (params) {
    const glossary = mockGlossary[params.projectId]
    if (method === 'PUT' && glossary) {
      const idx = glossary.entries.findIndex((e) => e.id === params!.entryId)
      if (idx >= 0) {
        glossary.entries[idx] = { ...glossary.entries[idx], ...(body as Partial<GlossaryEntry>) }
        return glossary.entries[idx]
      }
    }
    if (method === 'DELETE' && glossary) {
      glossary.entries = glossary.entries.filter((e) => e.id !== params!.entryId)
      return { ok: true }
    }
  }

  // Style Guide
  params = match('/api/projects/:projectId/style-guide', path)
  if (params) {
    if (method === 'GET') {
      return mockStyleGuide[params.projectId] || {
        projectId: params.projectId,
        tone: '',
        formality: 'neutral',
        audience: '',
        rules: '',
        examples: '',
      }
    }
    if (method === 'PUT') {
      mockStyleGuide[params.projectId] = body as StyleGuide
      return mockStyleGuide[params.projectId]
    }
  }

  // Translation Jobs
  params = match('/api/projects/:projectId/sheets/:sheetName/jobs', path)
  if (params && method === 'POST') {
    const { type } = body as { type: string }
    const job = createMockJob(params.projectId, params.sheetName, type as 'translate_all' | 'update' | 'review')
    return job
  }

  params = match('/api/jobs/:jobId', path)
  if (params && method === 'GET') {
    return pollMockJob(params.jobId)
  }

  // Review Report
  params = match('/api/projects/:projectId/sheets/:sheetName/review', path)
  if (params && method === 'GET') {
    const key = `${params.projectId}/${params.sheetName}`
    return mockReviewReport[key] || null
  }

  // Job History
  params = match('/api/projects/:projectId/jobs', path)
  if (params && method === 'GET') {
    return mockJobHistory[params.projectId] || []
  }

  // Language Management
  params = match('/api/projects/:projectId/sheets/:sheetName/languages', path)
  if (params && method === 'POST') {
    const { code, label } = body as { code: string; label: string }
    const sheetKey = `${params.projectId}/${params.sheetName}`
    const data = mockSheetData[sheetKey]
    if (data) {
      const header = `${label}(${code})`
      if (!data.headers.includes(header)) {
        data.headers.push(header)
        data.languages.push({ code, label, isSource: false })
        for (const row of data.rows) {
          row[code] = ''
        }
      }
    }
    return { ok: true, code, label }
  }

  params = match('/api/projects/:projectId/sheets/:sheetName/languages/:code', path)
  if (params && method === 'DELETE') {
    const sheetKey = `${params.projectId}/${params.sheetName}`
    const data = mockSheetData[sheetKey]
    let deletedTranslations = 0
    if (data) {
      const langIdx = data.languages.findIndex((l) => l.code === params!.code)
      if (langIdx >= 0) {
        data.languages.splice(langIdx, 1)
        const headerIdx = data.headers.findIndex((h) => h.includes(`(${params!.code})`))
        if (headerIdx >= 0) data.headers.splice(headerIdx, 1)
        for (const row of data.rows) {
          if (row[params!.code]) deletedTranslations++
          delete row[params!.code]
        }
      }
    }
    return { ok: true, deletedTranslations }
  }

  console.warn(`[Mock] Unhandled: ${method} ${path}`)
  return null
}
