import { api } from './client'
import type { SheetSettings, Glossary, GlossaryEntry, StyleGuide, ReviewReport } from '../types'

// Sheet Settings
export function fetchSheetSettings(projectId: string, sheetName: string) {
  return api<SheetSettings>(
    'GET',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/settings`,
  )
}

export function updateSheetSettings(projectId: string, sheetName: string, settings: SheetSettings) {
  return api<SheetSettings>(
    'PUT',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/settings`,
    settings,
  )
}

// Glossary
export function fetchGlossary(projectId: string) {
  return api<Glossary>('GET', `/api/projects/${projectId}/glossary`)
}

export function addGlossaryEntry(projectId: string, entry: Omit<GlossaryEntry, 'id'>) {
  return api<GlossaryEntry>('POST', `/api/projects/${projectId}/glossary`, entry)
}

export function updateGlossaryEntry(projectId: string, entryId: string, entry: Partial<GlossaryEntry>) {
  return api<GlossaryEntry>('PUT', `/api/projects/${projectId}/glossary/${entryId}`, entry)
}

export function deleteGlossaryEntry(projectId: string, entryId: string) {
  return api<{ ok: boolean }>('DELETE', `/api/projects/${projectId}/glossary/${entryId}`)
}

// Style Guide
export function fetchStyleGuide(projectId: string) {
  return api<StyleGuide>('GET', `/api/projects/${projectId}/style-guide`)
}

export function updateStyleGuide(projectId: string, guide: StyleGuide) {
  return api<StyleGuide>('PUT', `/api/projects/${projectId}/style-guide`, guide)
}

// Review Report
export function fetchReviewReport(projectId: string, sheetName: string) {
  return api<ReviewReport | null>(
    'GET',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/review`,
  )
}
