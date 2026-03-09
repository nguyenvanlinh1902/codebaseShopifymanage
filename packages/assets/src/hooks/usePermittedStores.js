import {useAuth} from '../context/AuthContext';
import {useStores} from '../context/store-context';

/**
 * Returns stores filtered by user's assignedStores permission.
 * Admin sees all stores; non-admin sees only assigned stores.
 */
export function usePermittedStores() {
  const {user} = useAuth();
  const {stores: allStores, groups, loading, refetch} = useStores();
  const isAdmin = user?.role === 'admin';
  // Backend already filters stores by assignedStores for non-admin users.
  // Avoid double-filtering with potentially stale localStorage data.
  return {stores: allStores, allStores, groups, loading, refetch, isAdmin, user};
}
