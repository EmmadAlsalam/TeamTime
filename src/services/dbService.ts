import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  onSnapshot,
  Timestamp,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import type { UserProfile } from './authService';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  department?: string;
  assignedTo: string[];
  createdBy: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

export interface DepartmentItem {
  id: string;
  name: string;
  description?: string;
  createdAt?: Timestamp;
}

export const DEFAULT_DEPARTMENTS: string[] = [
  'Mottagning',
  'Inlagring',
  'Plock',
  'Pack',
  'Utlastning',
  'Returer',
  'Inventering',
  'Ledning',
  'Övrigt'
];

export interface TimeLog {
  id: string;
  userId: string;
  taskId: string;
  type: 'start' | 'end' | 'switch';
  timestamp: Timestamp;
}

export interface Message {
  id: string;
  fromId: string;
  toId: string;
  content: string;
  read: boolean;
  timestamp: Timestamp;
}

export interface DailyReport {
  id: string;
  userId: string;
  date: string;
  mood: 'good' | 'bad' | 'ok';
  summary: string;
  timestamp: Timestamp;
}

export interface TaskHistory {
  id: string;
  taskId: string;
  taskTitle: string;
  performedBy: string;
  type: 'created' | 'updated' | 'deleted' | 'status_change' | 'assignment_change';
  details: string;
  timestamp: Timestamp;
}

export const dbService = {
  // Tasks
  async createTask(data: Omit<Task, 'id' | 'createdAt'>, adminId: string) {
    const docRef = await addDoc(collection(db, 'tasks'), {
      ...data,
      createdAt: serverTimestamp()
    });
    
    await this.logTaskEvent({
      taskId: docRef.id,
      taskTitle: data.title,
      performedBy: adminId,
      type: 'created',
      details: 'Uppgift skapad'
    });

    return docRef;
  },

  async updateTask(id: string, data: Partial<Task>, adminId: string, oldTask?: Task) {
    let updateData = { ...data };
    if (data.status === 'completed') {
      updateData = {
        ...updateData,
        completedAt: serverTimestamp() as any
      };
    }
    
    await updateDoc(doc(db, 'tasks', id), updateData);

    // Dynamic logging
    if (data.status && oldTask && data.status !== oldTask.status) {
      await this.logTaskEvent({
        taskId: id,
        taskTitle: data.title || oldTask.title,
        performedBy: adminId,
        type: 'status_change',
        details: `Status ändrad från ${oldTask.status} till ${data.status}`
      });
    }

    if (data.assignedTo && oldTask) {
      await this.logTaskEvent({
        taskId: id,
        taskTitle: data.title || oldTask.title,
        performedBy: adminId,
        type: 'assignment_change',
        details: 'Tilldelning uppdaterad'
      });
    }

    if (data.title || data.description) {
       await this.logTaskEvent({
        taskId: id,
        taskTitle: data.title || oldTask?.title || 'Okänd',
        performedBy: adminId,
        type: 'updated',
        details: 'Uppgiftsdetaljer uppdaterade'
      });
    }
  },

  async deleteTask(id: string, taskTitle: string, adminId: string) {
    await deleteDoc(doc(db, 'tasks', id));
    await this.logTaskEvent({
      taskId: id,
      taskTitle: taskTitle,
      performedBy: adminId,
      type: 'deleted',
      details: 'Uppgift borttagen'
    });
  },

  async logTaskEvent(event: Omit<TaskHistory, 'id' | 'timestamp'>) {
    return await addDoc(collection(db, 'taskHistory'), {
      ...event,
      timestamp: serverTimestamp()
    });
  },

  subscribeToTaskHistory(callback: (history: TaskHistory[]) => void) {
    const q = query(collection(db, 'taskHistory'), orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskHistory));
      callback(history);
    }, (error) => {
      console.error("Task history subscription error:", error);
    });
  },

  subscribeToTasks(callback: (tasks: Task[]) => void) {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      callback(tasks);
    }, (error) => {
      console.error("Tasks subscription error:", error);
    });
  },

  // Time Logs
  async logTime(userId: string, taskId: string, type: 'start' | 'end' | 'switch') {
    return await addDoc(collection(db, 'timeLogs'), {
      userId,
      taskId,
      type,
      timestamp: serverTimestamp()
    });
  },

  subscribeToUserLogs(userId: string, callback: (logs: TimeLog[]) => void) {
    const q = query(
      collection(db, 'timeLogs'), 
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeLog));
      callback(logs);
    }, (error) => {
      console.error("User logs subscription error:", error);
    });
  },

  subscribeToAllLogs(callback: (logs: TimeLog[]) => void) {
    const q = query(collection(db, 'timeLogs'), orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeLog));
      callback(logs);
    }, (error) => {
      console.error("All logs subscription error:", error);
    });
  },

  // Messages
  async sendMessage(fromId: string, toId: string, content: string) {
    return await addDoc(collection(db, 'messages'), {
      fromId,
      toId,
      content,
      read: false,
      timestamp: serverTimestamp()
    });
  },

  subscribeToMyMessages(userId: string, callback: (messages: Message[]) => void) {
    const q = query(
      collection(db, 'messages'),
      where('toId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      callback(messages);
    }, (error) => {
      console.error("Messages subscription error:", error);
    });
  },

  async markMessageRead(id: string) {
    return await updateDoc(doc(db, 'messages', id), { read: true });
  },

  // Daily Reports
  async submitDailyReport(userId: string, mood: 'good' | 'bad' | 'ok', summary: string) {
    const date = new Date().toISOString().split('T')[0];
    return await addDoc(collection(db, 'dailyReports'), {
      userId,
      date,
      mood,
      summary,
      timestamp: serverTimestamp()
    });
  },

  subscribeToReports(callback: (reports: DailyReport[]) => void) {
    const q = query(collection(db, 'dailyReports'), orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyReport));
      callback(reports);
    }, (error) => {
      console.error("Reports subscription error:", error);
    });
  },

  async hasSubmittedReportToday(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'dailyReports'),
      where('userId', '==', userId),
      where('date', '==', today),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  },

  // User Management (Admin only usually)
  subscribeToUsers(callback: (users: any[]) => void) {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`Users snapshot updated: ${users.length} users found.`);
      callback(users);
    }, (error) => {
      console.error("Users snapshot error:", error);
    });
  },

  async updateUserStatus(userId: string, status: 'active' | 'inactive') {
    return await updateDoc(doc(db, 'users', userId), { status });
  },

  async updateUserDepartment(userId: string, department: string) {
    return await updateDoc(doc(db, 'users', userId), { department });
  },

  async updateUser(userId: string, data: Partial<UserProfile>) {
    return await updateDoc(doc(db, 'users', userId), data);
  },

  async deleteUser(userId: string) {
    try {
      return await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  },

  // Department Management (Admin)
  subscribeToDepartments(callback: (departments: DepartmentItem[]) => void) {
    const q = query(collection(db, 'departments'), orderBy('name', 'asc'));
    return onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // Seed default departments if collection is completely fresh
        try {
          for (const deptName of DEFAULT_DEPARTMENTS) {
            await addDoc(collection(db, 'departments'), {
              name: deptName,
              description: `Avdelning för ${deptName.toLowerCase()}`,
              createdAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.warn('Initial department seeding error (non-fatal):', e);
        }
        return;
      }
      const departments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DepartmentItem));
      callback(departments);
    }, (error) => {
      console.error("Departments snapshot error:", error);
    });
  },

  async createDepartment(name: string, description: string = '') {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Avdelningsnamn får inte vara tomt');

    // Check duplicate
    const q = query(collection(db, 'departments'), where('name', '==', trimmed));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      throw new Error(`En avdelning med namnet "${trimmed}" finns redan.`);
    }

    return await addDoc(collection(db, 'departments'), {
      name: trimmed,
      description: description.trim(),
      createdAt: serverTimestamp()
    });
  },

  async updateDepartment(id: string, oldName: string, newName: string, description: string = '') {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Avdelningsnamn får inte vara tomt');

    // Check duplicate if name changed
    if (trimmed !== oldName) {
      const q = query(collection(db, 'departments'), where('name', '==', trimmed));
      const snapshot = await getDocs(q);
      if (!snapshot.empty && snapshot.docs.some(d => d.id !== id)) {
        throw new Error(`En avdelning med namnet "${trimmed}" finns redan.`);
      }
    }

    await updateDoc(doc(db, 'departments', id), {
      name: trimmed,
      description: description.trim()
    });

    // Cascade update to users & tasks if name changed
    if (trimmed !== oldName) {
      try {
        const usersQ = query(collection(db, 'users'), where('department', '==', oldName));
        const usersSnap = await getDocs(usersQ);
        for (const userDoc of usersSnap.docs) {
          await updateDoc(userDoc.ref, { department: trimmed });
        }

        const tasksQ = query(collection(db, 'tasks'), where('department', '==', oldName));
        const tasksSnap = await getDocs(tasksQ);
        for (const taskDoc of tasksSnap.docs) {
          await updateDoc(taskDoc.ref, { department: trimmed });
        }
      } catch (cascadeErr) {
        console.warn('Cascade update error for department rename:', cascadeErr);
      }
    }
  },

  async deleteDepartment(id: string, name: string) {
    await deleteDoc(doc(db, 'departments', id));

    // Clear or update users and tasks attached to this deleted department
    try {
      const usersQ = query(collection(db, 'users'), where('department', '==', name));
      const usersSnap = await getDocs(usersQ);
      for (const userDoc of usersSnap.docs) {
        await updateDoc(userDoc.ref, { department: 'Övrigt' });
      }

      const tasksQ = query(collection(db, 'tasks'), where('department', '==', name));
      const tasksSnap = await getDocs(tasksQ);
      for (const taskDoc of tasksSnap.docs) {
        await updateDoc(taskDoc.ref, { department: 'Övrigt' });
      }
    } catch (e) {
      console.warn('Cascade department deletion cleanup error:', e);
    }
  }
};
