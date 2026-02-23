export interface SheetSettings {
  projectId: string
  sheetName: string
  sourceLanguage: string
  translationStyle: string
  characterLimit: number | null
  glossaryOverride: boolean
  instructions: string
}
