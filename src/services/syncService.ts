import { get, set as idbSet } from 'idb-keyval';
import { updateUserSyncData, fetchUserProfile } from './userService';

// Helper to merge arrays of objects on a specific unique property (e.g., 'id', 'url', 'title')
function mergeArrays<T>(local: T[], remote: T[], uniqueKey: keyof T): T[] {
  const mergedMap = new Map<any, T>();
  
  // Load remote first (remote is treated as source of truth for cloud sync)
  if (Array.isArray(remote)) {
    remote.forEach(item => {
      const k = item ? item[uniqueKey] : null;
      if (k) mergedMap.set(k, item);
    });
  }
  
  // Fill in local (add any items from local that don't exist remotely)
  if (Array.isArray(local)) {
    local.forEach(item => {
      const k = item ? item[uniqueKey] : null;
      if (k && !mergedMap.has(k)) mergedMap.set(k, item);
    });
  }
  
  return Array.from(mergedMap.values());
}

export async function syncCloudData(uid: string): Promise<void> {
  try {
    const profile = await fetchUserProfile(uid);
    if (!profile) return;

    // Keys mapping to synchronize
    const syncKeys = [
      { key: 'bookmarks', idbKey: 'mhiee_bookmarks', uniqueProperty: 'url' },
      { key: 'history', idbKey: 'mhiee_history', uniqueProperty: 'url' },
      { key: 'credentials', idbKey: 'mhiee_credentials', uniqueProperty: 'username' },
      { key: 'mechatronicsProjects', idbKey: 'mhiee_mechatronics_projects', uniqueProperty: 'id' }
    ] as const;

    for (const item of syncKeys) {
      // 1. Load local IndexedDB state
      const localData = (await get(item.idbKey)) || [];
      // 2. Load remote Firestore state
      const remoteData = (profile as any)[item.key] || [];

      // 3. Bidirectionally merge
      const merged = mergeArrays(localData, remoteData, item.uniqueProperty);

      // 4. Save merged state to local IndexedDB
      await idbSet(item.idbKey, merged);

      // 5. Save merged state back to Firestore
      await updateUserSyncData(uid, item.key, merged);
    }
  } catch (error) {
    console.error('Bidirectional Cloud Sync failed:', error);
  }
}

export async function uploadLocalUpdate(uid: string, key: 'bookmarks' | 'history' | 'credentials' | 'mechatronicsProjects', idbKey: string): Promise<void> {
  try {
    const localData = (await get(idbKey)) || [];
    await updateUserSyncData(uid, key, localData);
  } catch (error) {
    console.error(`Uploading cloud sync data for key ${key} failed:`, error);
  }
}
