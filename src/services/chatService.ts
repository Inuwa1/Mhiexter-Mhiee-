import { doc, setDoc, getDocs, collection, deleteDoc, query } from 'firebase/firestore';
import { db } from '../firebase';
import { ChatSession } from '../types';
import { get, set as idbSet } from 'idb-keyval';
import { handleFirestoreError, OperationType } from './firestoreStatus';

export async function saveSessionToCloud(uid: string, session: ChatSession): Promise<void> {
  const path = `users/${uid}/sessions/${session.id}`;
  try {
    const docRef = doc(db, 'users', uid, 'sessions', session.id);
    // Explicit shape validation mapping to schema
    const payload = {
      id: session.id,
      uid,
      title: session.title || 'Untitled Chat',
      messages: session.messages || [],
      updatedAt: session.updatedAt || Date.now(),
      isPinned: session.isPinned || false,
    };
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchSessionsFromCloud(uid: string): Promise<ChatSession[]> {
  const path = `users/${uid}/sessions`;
  try {
    const collRef = collection(db, 'users', uid, 'sessions');
    const snapshot = await getDocs(collRef);
    const results: ChatSession[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      results.push({
        id: docSnap.id,
        title: data.title,
        messages: data.messages || [],
        updatedAt: data.updatedAt,
        isPinned: data.isPinned || false,
      });
    });
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteSessionFromCloud(uid: string, sessionId: string): Promise<void> {
  const path = `users/${uid}/sessions/${sessionId}`;
  try {
    const docRef = doc(db, 'users', uid, 'sessions', sessionId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Sync IndexedDB chat history bidirectionally with Firestore
 */
export async function syncChatHistory(uid: string): Promise<ChatSession[]> {
  try {
    // 1. Load local IndexedDB chat history
    const localHistory: ChatSession[] = (await get('mhiee_chat_history')) || [];
    
    // 2. Load remote sessions from Firestore
    const remoteHistory = await fetchSessionsFromCloud(uid);
    
    // 3. Merge locally and remotely on session.id
    const sessionMap = new Map<string, ChatSession>();
    
    remoteHistory.forEach(remoteSess => {
      sessionMap.set(remoteSess.id, remoteSess);
    });
    
    localHistory.forEach(localSess => {
      const existing = sessionMap.get(localSess.id);
      if (!existing || localSess.updatedAt > existing.updatedAt) {
        // If local is newer or remote doesn't exist, use local
        sessionMap.set(localSess.id, localSess);
      }
    });
    
    const mergedHistory = Array.from(sessionMap.values()).sort((a,b) => b.updatedAt - a.updatedAt);
    
    // 4. Save back to IndexedDB
    await idbSet('mhiee_chat_history', mergedHistory);
    
    // 5. Upload updates to Firestore
    for (const session of mergedHistory) {
      await saveSessionToCloud(uid, session);
    }
    
    return mergedHistory;
  } catch (error) {
    console.error('Chat history sync aborted:', error);
    // Fallback to local
    return (await get('mhiee_chat_history')) || [];
  }
}
