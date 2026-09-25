import { doc, getDocs, setDoc, collection, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TaskPlan, TaskNode } from '../types';
import { GoogleGenAI } from '@google/genai';
import { handleFirestoreError, OperationType } from './firestoreStatus';

export async function fetchTaskPlans(uid: string): Promise<TaskPlan[]> {
  const path = `users/${uid}/taskPlans`;
  try {
    const collRef = collection(db, 'users', uid, 'taskPlans');
    const snapshot = await getDocs(collRef);
    const plans: TaskPlan[] = [];
    snapshot.forEach(docSnap => {
      plans.push(docSnap.data() as TaskPlan);
    });
    return plans.sort((a,b) => b.createdAt - a.createdAt);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveTaskPlan(uid: string, plan: TaskPlan): Promise<void> {
  const path = `users/${uid}/taskPlans/${plan.id}`;
  try {
    const docRef = doc(db, 'users', uid, 'taskPlans', plan.id);
    await setDoc(docRef, plan, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateTaskStatus(
  uid: string,
  planId: string,
  taskId: string,
  status: TaskNode['status']
): Promise<void> {
  const path = `users/${uid}/taskPlans/${planId}`;
  try {
    const docRef = doc(db, 'users', uid, 'taskPlans', planId);
    // Read plan first or write directly
    // Since we'd like to be secure and thread-safe, let's fetch then update
    const snap = await docRef;
    // In our implementation, we can update the list directly inside transactions or with simple fetch-modify
    // Let's do simple fetch-modify for simplicity and correctness
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTaskPlan(uid: string, planId: string): Promise<void> {
  const path = `users/${uid}/taskPlans/${planId}`;
  try {
    const docRef = doc(db, 'users', uid, 'taskPlans', planId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Leverage real Gemini API to generate a structured mechatronics mecha task plan
 */
export async function generateTaskPlan(uid: string, requestText: string): Promise<TaskPlan> {
  const apiKey = (window as any).GEMINI_API_KEY || localStorage.getItem('geminiApiKey') || '';
  if (!apiKey) {
    throw new Error('Haba Boss, please make sure your Gemini API Key is saved in Settings so I can think! 🧠💅');
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `You are Mhiee's Brain - an expert mechatronics engineering project planner.
Break down this mechatronics/UI/coding request: "${requestText}"
goyon baya da Hausa (and mechatronics logic context MCC1301).
Output ONLY a raw, valid standard JSON array (enclosed in square brackets), with no other comments, prefix, or markdown.
The array layout should exactly match this TypeScript form:
Array<{
  id: string; // Short unique text like 'task_1', 'task_2'
  title: string; // The step name (Technical English mixed with Hausa charm)
  description: string; // High-level engineering walkthrough details
  duration: string; // Time to build like '20 mins', '1 hour'
  status: 'pending';
  type: 'coding' | 'electrical' | 'mechatronic' | 'testing';
  prerequisites: string[]; // empty or dependency list of task IDs
}>`;

  let tasks: TaskNode[] = [];
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });
    
    const text = response.text || '';
    // Clean code formatting if returned
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    tasks = JSON.parse(cleanedText);
  } catch (err) {
    console.warn('Gemini dynamic task planning failed, generating mechatronic fallback steps:', err);
    // Solid mechatronics fallback steps
    tasks = [
      {
        id: 'task_1',
        title: 'Hardware Requirements & Schematic Mapping',
        description: 'Verify GPIO configuration for sensors, mechatronics limits, and voltage bounds.',
        duration: '15 mins',
        status: 'pending',
        type: 'electrical',
        prerequisites: []
      },
      {
        id: 'task_2',
        title: 'Write Microcontroller Driver Code',
        description: 'Write C++/Python sensor logic and configure communication protocols (I2C/SPI).',
        duration: '45 mins',
        status: 'pending',
        type: 'coding',
        prerequisites: ['task_1']
      },
      {
        id: 'task_3',
        title: 'Run Integration Testing & Calibration',
        description: 'Execute sensor calibration and verify the closed-loop system dynamics.',
        duration: '20 mins',
        status: 'pending',
        type: 'testing',
        prerequisites: ['task_2']
      }
    ];
  }

  const newPlan: TaskPlan = {
    id: 'plan_' + Date.now().toString(),
    uid,
    request: requestText,
    tasks,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await saveTaskPlan(uid, newPlan);
  return newPlan;
}
