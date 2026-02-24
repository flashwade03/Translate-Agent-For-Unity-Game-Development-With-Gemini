import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addLanguage, deleteLanguage } from '../api/sheets'
import { QUERY_KEYS } from '../lib/constants'

export function useLanguages(projectId: string, sheetName: string) {
  const queryClient = useQueryClient()

  const addMutation = useMutation({
    mutationFn: ({ code, label }: { code: string; label: string }) =>
      addLanguage(projectId, sheetName, code, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sheetData(projectId, sheetName) })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (code: string) => deleteLanguage(projectId, sheetName, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sheetData(projectId, sheetName) })
    },
  })

  return { addMutation, deleteMutation }
}
