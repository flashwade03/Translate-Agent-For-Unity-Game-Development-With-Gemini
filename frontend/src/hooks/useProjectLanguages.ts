import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchProjectLanguages, addProjectLanguage, deleteProjectLanguage } from '../api/languages'
import { QUERY_KEYS } from '../lib/constants'

export function useProjectLanguages(projectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.projectLanguages(projectId),
    queryFn: () => fetchProjectLanguages(projectId),
  })
}

export function useAddProjectLanguage(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ code, label }: { code: string; label: string }) =>
      addProjectLanguage(projectId, code, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectLanguages(projectId) })
    },
  })
}

export function useDeleteProjectLanguage(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => deleteProjectLanguage(projectId, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectLanguages(projectId) })
    },
  })
}
