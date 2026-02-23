export type IssueSeverity = 'error' | 'warning' | 'info'
export type IssueCategory = 'accuracy' | 'fluency' | 'terminology' | 'style' | 'placeholder' | 'length'

export interface ReviewIssue {
  id: string
  key: string
  language: string
  severity: IssueSeverity
  category: IssueCategory
  message: string
  suggestion?: string
  original: string
  translated: string
}

export interface ReviewReport {
  projectId: string
  sheetName: string
  totalKeys: number
  reviewedKeys: number
  issues: ReviewIssue[]
  createdAt: string
}

export interface ReviewStats {
  total: number
  errors: number
  warnings: number
  info: number
}
