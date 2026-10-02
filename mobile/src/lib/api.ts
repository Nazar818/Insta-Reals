import { useMemo } from 'react';
import { useSession } from '../auth/session';
import { ApiClient } from './http';
export { API_BASE_URL, ApiClient, ApiError, errorMessage } from './http';

export function useApi() {
  const { getToken } = useSession();
  return useMemo(() => new ApiClient(getToken), [getToken]);
}
