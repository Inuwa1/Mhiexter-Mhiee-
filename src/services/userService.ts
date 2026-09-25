import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserPreferences } from '../types';
import { handleFirestoreError, OperationType } from './firestoreStatus';

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createUserProfile(uid: string, displayName: string, email: string, photoURL: string, preferences: UserPreferences): Promise<UserProfile> {
  const path = `users/${uid}`;
  const now = Date.now();
  const profile: UserProfile = {
    uid,
    displayName: displayName || 'Anonymous Boss',
    email: email || '',
    photoURL: photoURL || '',
    createdAt: now,
    updatedAt: now,
    preferences,
  };
  try {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, profile, { merge: true });
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUserPreferences(uid: string, preferences: Partial<UserPreferences>): Promise<void> {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    const updatePayload: Record<string, any> = {};
    for (const [key, value] of Object.entries(preferences)) {
      updatePayload[`preferences.${key}`] = value;
    }
    updatePayload.updatedAt = Date.now();
    await updateDoc(docRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserSyncData(uid: string, key: 'bookmarks' | 'history' | 'credentials' | 'mechatronicsProjects', data: any[]): Promise<void> {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      [key]: data,
      updatedAt: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
