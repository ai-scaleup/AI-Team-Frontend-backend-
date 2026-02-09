
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== 'undefined') {
    const configStr = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
    if (configStr) {
        try {
            const firebaseConfig = JSON.parse(configStr);
            app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
            auth = getAuth(app);
            db = getFirestore(app);
        } catch (error) {
            console.error('Error initializing Firebase:', error);
        }
    } else {
        console.error('NEXT_PUBLIC_FIREBASE_CONFIG is not defined in environment variables.');
    }
} else {
    // Server-side initialization (avoiding errors during build/SSR if config is missing)
    const configStr = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
    if (configStr) {
        try {
            const firebaseConfig = JSON.parse(configStr);
            app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
            auth = getAuth(app);
            db = getFirestore(app);
        } catch (error) {
            console.error('Error initializing Firebase on server:', error);
        }
    }
}

export { app, auth, db };
