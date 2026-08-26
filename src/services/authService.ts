import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  getAuth,
  updateEmail
} from 'firebase/auth';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

const VIRTUAL_DOMAIN = 'teamtimepro.app';
const VIRTUAL_PASSWORD = 'TeamTimeProSecretPassword123';

// Helper to get a secondary auth instance for managing users without session swap
const getSecondaryAuth = () => {
  const secondaryAppName = 'SecondaryAuthApp';
  let secondaryApp = getApps().find(app => app.name === secondaryAppName);
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  }
  return getAuth(secondaryApp);
};

export interface UserProfile {
  id: string;
  name: string;
  pin: string;
  role: 'admin' | 'employee';
  status: 'active' | 'inactive';
  department?: string;
  createdAt: any;
}

export const authService = {
  async loginWithPin(pin: string): Promise<UserProfile> {
    const email = `pin_${pin}@${VIRTUAL_DOMAIN}`;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, VIRTUAL_PASSWORD);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }
      
      const profile = userDoc.data() as UserProfile;
      if (profile.status === 'inactive') {
        await signOut(auth);
        throw new Error('Account is inactive');
      }
      
      return profile;
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        console.warn(`Unregistered or invalid PIN attempt for ${email}`);
        throw new Error('Pinkoden är inte registrerad eller felaktig. Kontrollera koden eller skapa ett konto.');
      }

      console.error('Login system error:', {
        errorCode: error.code,
        errorMessage: error.message,
        email
      });
      
      if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Systemfel: Inloggningsmetoden "E-post/lösenord" är inte aktiverad i Firebase Console.');
      }

      throw new Error('Inloggningsfel: ' + (error.message || 'Okänt fel'));
    }
  },

  async createUser(name: string, pin: string, role: 'admin' | 'employee' = 'employee', department?: string): Promise<void> {
    try {
      // Try to check if PIN is already taken (might fail due to permissions if system is not setup)
      const q = query(collection(db, 'users'), where('pin', '==', pin));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        throw new Error('Pinkoden används redan');
      }
    } catch (error: any) {
      // If it's a permission error, we assume it's the first admin being created
      // or we let Firebase throw the "email already exists" error later.
      if (error.code !== 'permission-denied') {
        throw error;
      }
    }

    const email = `pin_${pin}@${VIRTUAL_DOMAIN}`;
    const secondaryAuth = getSecondaryAuth();
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, VIRTUAL_PASSWORD);
      const uid = userCredential.user.uid;
      
      await setDoc(doc(db, 'users', uid), {
        id: uid,
        name,
        pin,
        role,
        department: department || '',
        status: 'active',
        createdAt: serverTimestamp()
      });
      
      // Sign out from secondary auth to avoid keeping many sessions
      await signOut(secondaryAuth);
      
      // Mark system as initialized using the main DB instance (which is fine since we are logged in as admin)
      await setDoc(doc(db, 'system', 'status'), { initialized: true }, { merge: true });
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        try {
          // Attempt to log in and repair profile
          const login = await signInWithEmailAndPassword(secondaryAuth, email, VIRTUAL_PASSWORD);
          await setDoc(doc(db, 'users', login.user.uid), {
            id: login.user.uid,
            name,
            pin,
            role,
            department: department || '',
            status: 'active',
            createdAt: serverTimestamp()
          }, { merge: true });
          await setDoc(doc(db, 'system', 'status'), { initialized: true }, { merge: true });
          await signOut(secondaryAuth);
          return;
        } catch (loginError: any) {
          throw new Error('Pinkoden finns redan i systemet men kunde inte aktiveras. Kontrollera lösenordsinställningar.');
        }
      }
      console.error('Create user error:', error);
      if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Systemfel: Inloggningsmetoden "E-post/lösenord" är inte aktiverad i Firebase Console.');
      }
      throw new Error(error.message || 'Kunde inte skapa användare');
    }
  },

  async bulkAddEmployees(employees: { name: string, pin: string, department: string }[]): Promise<void> {
    for (const emp of employees) {
      // Small pause to prevent hitting rate limits if too fast
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.createUser(emp.name, emp.pin, 'employee', emp.department);
    }
  },

  async logout(): Promise<void> {
    await signOut(auth);
  },

  async updateUserPin(userId: string, currentPin: string, newPin: string): Promise<void> {
    return this.updateUserFull(userId, currentPin, { pin: newPin });
  },

  async updateUserFull(
    userId: string,
    currentPin: string,
    updates: {
      name?: string;
      role?: 'admin' | 'employee';
      department?: string;
      pin?: string;
      status?: 'active' | 'inactive';
    }
  ): Promise<void> {
    const firestoreUpdates: Record<string, any> = {};
    if (updates.name !== undefined) firestoreUpdates.name = updates.name.trim();
    if (updates.role !== undefined) firestoreUpdates.role = updates.role;
    if (updates.department !== undefined) firestoreUpdates.department = updates.department;
    if (updates.status !== undefined) firestoreUpdates.status = updates.status;

    // If PIN is changing
    if (updates.pin && updates.pin !== currentPin) {
      if (updates.pin.length !== 4 || !/^\d+$/.test(updates.pin)) {
        throw new Error('Pinkoden måste bestå av exakt 4 siffror.');
      }

      // Check if new PIN is already taken by another user
      const q = query(collection(db, 'users'), where('pin', '==', updates.pin));
      const snapshot = await getDocs(q);
      if (!snapshot.empty && snapshot.docs.some(d => d.id !== userId)) {
        throw new Error('Den nya pinkoden används redan av en annan användare.');
      }

      const oldEmail = `pin_${currentPin}@${VIRTUAL_DOMAIN}`;
      const newEmail = `pin_${updates.pin}@${VIRTUAL_DOMAIN}`;
      const secondaryAuth = getSecondaryAuth();

      try {
        const userCredential = await signInWithEmailAndPassword(secondaryAuth, oldEmail, VIRTUAL_PASSWORD);
        await updateEmail(userCredential.user, newEmail);
        firestoreUpdates.pin = updates.pin;
      } catch (authErr: any) {
        console.warn('Update Auth email error (updating Firestore directly):', authErr);
        firestoreUpdates.pin = updates.pin;
      } finally {
        try { await signOut(secondaryAuth); } catch (e) {}
      }
    }

    if (Object.keys(firestoreUpdates).length > 0) {
      await updateDoc(doc(db, 'users', userId), firestoreUpdates);
    }
  },

  async deleteUser(userId: string, pin: string): Promise<void> {
    const email = `pin_${pin}@${VIRTUAL_DOMAIN}`;
    const secondaryAuth = getSecondaryAuth();
    
    try {
      // 1. Try to sign in to the user account to delete it from Auth
      try {
        const userCredential = await signInWithEmailAndPassword(secondaryAuth, email, VIRTUAL_PASSWORD);
        await userCredential.user.delete();
      } catch (authError: any) {
        // If user doesn't exist in Auth, that's okay, we'll still try to delete the Firestore doc
        console.warn('User not found in Auth or could not be deleted:', authError);
      }

      // 2. Delete the Firestore document (the admin's main session does this)
      // Note: AdminDashboard calls dbService.deleteUser which handles Firestore.
      // But we consolidate it here for a "hard delete".
      // We'll let the AdminDashboard call this new service method instead of dbService.
    } catch (error: any) {
      console.error('Hard delete error:', error);
      throw error;
    } finally {
      try { await signOut(secondaryAuth); } catch (e) {}
    }
  },

  onAuthChanged(callback: (user: UserProfile | null) => void) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          callback(userDoc.data() as UserProfile);
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  }
};
