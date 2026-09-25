import { doc, getDocs, setDoc, collection, deleteDoc, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Reminder } from '../types';
import { handleFirestoreError, OperationType } from './firestoreStatus';

export async function fetchReminders(uid: string): Promise<Reminder[]> {
  const path = `users/${uid}/reminders`;
  try {
    const collRef = collection(db, 'users', uid, 'reminders');
    const snapshot = await getDocs(collRef);
    const reminders: Reminder[] = [];
    snapshot.forEach(docSnap => {
      reminders.push(docSnap.data() as Reminder);
    });
    return reminders.sort((a, b) => a.remindAt - b.remindAt);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveReminder(uid: string, reminder: Reminder): Promise<void> {
  const path = `users/${uid}/reminders/${reminder.id}`;
  try {
    const docRef = doc(db, 'users', uid, 'reminders', reminder.id);
    await setDoc(docRef, reminder, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateReminderStatus(uid: string, reminderId: string, status: Reminder['status']): Promise<void> {
  const path = `users/${uid}/reminders/${reminderId}`;
  try {
    const docRef = doc(db, 'users', uid, 'reminders', reminderId);
    await updateDoc(docRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteReminder(uid: string, reminderId: string): Promise<void> {
  const path = `users/${uid}/reminders/${reminderId}`;
  try {
    const docRef = doc(db, 'users', uid, 'reminders', reminderId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
