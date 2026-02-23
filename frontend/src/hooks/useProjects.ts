import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchProjects, createProject } from '../api/projects'
import { QUERY_KEYS } from '../lib/constants'
import type { CreateProjectPayload } from '../types'

export function useProjects() {
  return useQuery({
    queryKey: QUERY_KEYS.projects,
    queryFn: fetchProjects,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => createProject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects })
    },
  })
}
