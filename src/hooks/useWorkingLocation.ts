import { useWorkingLocationContext } from '../context/WorkingLocationContext';
import type { Location } from '../types/database';

/**
 * The location the current user operates on. Staff use their own;
 * superadmin picks one via the header switcher (defaults to the
 * production hub, Central).
 */
export function useWorkingLocation(): { location: Location | null; loading: boolean } {
  const { location, loading } = useWorkingLocationContext();
  return { location, loading };
}
