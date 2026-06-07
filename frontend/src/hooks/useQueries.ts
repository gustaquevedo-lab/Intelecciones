import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

// 1. Stats hook
export function useStats(district?: string | null, listId?: string | number | null) {
  return useQuery({
    queryKey: ['stats', 'command', district, listId],
    queryFn: async () => {
      const res = await api.get('/stats/command', {
        params: { district, listId }
      });
      return res.data;
    },
    staleTime: 15 * 1000, // 15 seconds
  });
}

// 2. Captures hook
export function useCaptures(page = 1, perPage = 50, listId?: string | number) {
  return useQuery({
    queryKey: ['captures', page, perPage, listId],
    queryFn: async () => {
      const res = await api.get('/captures', {
        params: { page, perPage, listId }
      });
      return res.data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

// 3. Padrino full report hook
export function usePadrinoReport(id: number | string | undefined) {
  return useQuery({
    queryKey: ['padrinos', id, 'full-report'],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/structure/padrinos/${id}/full-report`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 60 * 1000, // 60 seconds
  });
}

// 4. My Team Reports hook
export function useMyTeamReports(role?: string, listId?: string | number) {
  return useQuery({
    queryKey: ['my-team', 'reports', role, listId],
    queryFn: async () => {
      const res = await api.get('/my-team/reports', {
        params: { role, listId }
      });
      return res.data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

// 5. Dia D Coverage hook
export function useCoverage(district?: string | null) {
  return useQuery({
    queryKey: ['diad', 'coverage', district],
    queryFn: async () => {
      const res = await api.get('/diad/coverage', {
        params: { district }
      });
      return res.data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

// 6. Users hook
export function useUsers(parentId?: string | number, roleFilter?: string) {
  return useQuery({
    queryKey: ['users', parentId, roleFilter],
    queryFn: async () => {
      const res = await api.get('/users', {
        params: { parent_id: parentId, role: roleFilter }
      });
      return res.data;
    },
    staleTime: 120 * 1000, // 2 minutes
  });
}

// 7. Voting Locations / Locales hook
export function useLocales(district?: string | null) {
  return useQuery({
    queryKey: ['locales', district],
    queryFn: async () => {
      const res = await api.get('/locales', {
        params: { district }
      });
      return res.data;
    },
    staleTime: 300 * 1000, // 5 minutes
  });
}

// 8. Dia D Results hook
export function useDiadResults(district?: string | null) {
  return useQuery({
    queryKey: ['diad', 'results', district],
    queryFn: async () => {
      const res = await api.get('/diad/results', {
        params: { district }
      });
      return res.data;
    },
    staleTime: 30 * 1000,
  });
}

// 9. Dia D Actas hook
export function useDiadActas(district?: string | null) {
  return useQuery({
    queryKey: ['diad', 'actas', district],
    queryFn: async () => {
      const res = await api.get('/diad/actas', {
        params: { district }
      });
      return res.data;
    },
    staleTime: 30 * 1000,
  });
}

// 10. Dia D Members hook
export function useDiadMembers(district?: string | null) {
  return useQuery({
    queryKey: ['diad', 'members', district],
    queryFn: async () => {
      const res = await api.get('/diad/members', {
        params: { district }
      });
      return res.data;
    },
    staleTime: 0, // Always refetch — members change in real time during Dia D
  });
}

// 11. Logistics Clusters hook
export function useLogisticsClusters(district?: string | null) {
  return useQuery({
    queryKey: ['logistics', 'clusters', district],
    queryFn: async () => {
      const res = await api.get('/logistics/clusters', {
        params: { district }
      });
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}

// 12. Dia D Voter Participation Summary hook
export function useParticipationSummary(district?: string | null) {
  return useQuery({
    queryKey: ['diad', 'participation-summary', district],
    queryFn: async () => {
      const res = await api.get('/diad/participation-summary', {
        params: { district }
      });
      return res.data;
    },
    staleTime: 15 * 1000, // Refresh every 15 seconds during Dia D
  });
}

