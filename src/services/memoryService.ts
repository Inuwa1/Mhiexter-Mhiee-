import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MemoryItem } from '../types';
import { handleFirestoreError, OperationType } from './firestoreStatus';

export async function addMemory(
  uid: string,
  content: string,
  category: MemoryItem['category'],
  importance: number,
  tags: string[] = []
): Promise<MemoryItem> {
  const path = 'memories';
  const now = Date.now();
  const memory: MemoryItem = {
    uid,
    content,
    category,
    importance,
    createdAt: now,
    updatedAt: now,
    tags,
  };

  try {
    const docRef = await addDoc(collection(db, 'memories'), memory);
    return { ...memory, id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchMemories(uid: string): Promise<MemoryItem[]> {
  const path = 'memories';
  try {
    const q = query(collection(db, 'memories'), where('uid', '==', uid));
    const snapshot = await getDocs(q);
    const results: MemoryItem[] = [];
    snapshot.forEach(docSnap => {
      results.push({
        id: docSnap.id,
        ...(docSnap.data() as Omit<MemoryItem, 'id'>),
      });
    });
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateMemory(
  memoryId: string,
  changes: Partial<Omit<MemoryItem, 'id' | 'uid' | 'createdAt'>>
): Promise<void> {
  const path = `memories/${memoryId}`;
  try {
    const docRef = doc(db, 'memories', memoryId);
    await updateDoc(docRef, {
      ...changes,
      updatedAt: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMemory(memoryId: string): Promise<void> {
  const path = `memories/${memoryId}`;
  try {
    const docRef = doc(db, 'memories', memoryId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Perform a keyword-based long term search across memories to fetch relevant context
 */
export async function queryMemories(uid: string, searchTerm: string): Promise<MemoryItem[]> {
  try {
    const all = await fetchMemories(uid);
    if (!searchTerm.trim()) return all;
    
    const term = searchTerm.toLowerCase();
    return all.filter(mem => {
      const contentMatch = mem.content.toLowerCase().includes(term);
      const categoryMatch = mem.category.toLowerCase().includes(term);
      const tagMatch = mem.tags?.some(t => t.toLowerCase().includes(term)) || false;
      return contentMatch || categoryMatch || tagMatch;
    });
  } catch (error) {
    console.error('Failed to query memories:', error);
    return [];
  }
}
