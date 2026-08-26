import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

// Validate connection to Firestore
async function testConnection() {
  try {
    // Specifically use getDocFromServer to bypass local cache and check real connectivity
    await getDocFromServer(doc(db, 'system', 'status'));
    console.log("Firestore connection verified successfully.");
  } catch (error: any) {
    console.error("Firestore connectivity test failed:", error.message);
    if (error.message.includes('the client is offline') || error.code === 'unavailable') {
      console.error("The Firestore backend is currently unreachable. This may be a network issue or missing project setup.");
    }
  }
}

testConnection();
