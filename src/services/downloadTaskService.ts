import { doc, getDocs, setDoc, collection, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DownloadTask } from '../types';
import { handleFirestoreError, OperationType } from './firestoreStatus';

export async function fetchDownloadTasks(uid: string): Promise<DownloadTask[]> {
  const path = `users/${uid}/downloads`;
  try {
    const collRef = collection(db, 'users', uid, 'downloads');
    const snapshot = await getDocs(collRef);
    const tasks: DownloadTask[] = [];
    snapshot.forEach(docSnap => {
      tasks.push(docSnap.data() as DownloadTask);
    });
    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveDownloadTask(uid: string, task: DownloadTask): Promise<void> {
  const path = `users/${uid}/downloads/${task.id}`;
  try {
    const docRef = doc(db, 'users', uid, 'downloads', task.id);
    await setDoc(docRef, task, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateDownloadTaskProgress(
  uid: string,
  taskId: string,
  progress: number,
  status: DownloadTask['status'],
  size = '0 MB'
): Promise<void> {
  const path = `users/${uid}/downloads/${taskId}`;
  try {
    const docRef = doc(db, 'users', uid, 'downloads', taskId);
    await setDoc(docRef, { progress, status, size }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDownloadTask(uid: string, taskId: string): Promise<void> {
  const path = `users/${uid}/downloads/${taskId}`;
  try {
    const docRef = doc(db, 'users', uid, 'downloads', taskId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
