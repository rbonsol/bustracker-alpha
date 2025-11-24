import { BusTelemetry, FirebaseConfig } from '../types';
import { DEFAULT_CONFIG } from './firebaseConfig';
import * as firebaseApp from 'firebase/app';
import { getDatabase, ref, set, push } from 'firebase/database';

// Workaround for TypeScript error: Module '"firebase/app"' has no exported member ...
const { initializeApp, getApps, getApp } = firebaseApp as any;

let isMockMode = true;
let app: any = null;
let db: any = null;
let mockDb: BusTelemetry[] = [];

export const initializeFirebase = (config?: FirebaseConfig): string | null => {
  // Use provided config, or fallback to default if keys are missing/empty
  const finalConfig = {
    apiKey: config?.apiKey || DEFAULT_CONFIG.apiKey,
    authDomain: config?.authDomain || DEFAULT_CONFIG.authDomain,
    databaseURL: config?.databaseURL || DEFAULT_CONFIG.databaseURL,
    projectId: config?.projectId || DEFAULT_CONFIG.projectId,
    storageBucket: config?.storageBucket || DEFAULT_CONFIG.storageBucket,
    messagingSenderId: config?.messagingSenderId || DEFAULT_CONFIG.messagingSenderId,
    appId: config?.appId || DEFAULT_CONFIG.appId,
    measurementId: config?.measurementId || DEFAULT_CONFIG.measurementId
  };

  // Validation: Check for minimal required fields for Realtime DB
  if (finalConfig.databaseURL && finalConfig.apiKey) {
    try {
      console.log("Initializing Firebase Connection (Modular SDK) to:", finalConfig.databaseURL);
      
      // Check if app already initialized to avoid duplicate app errors
      if (getApps().length === 0) {
        app = initializeApp(finalConfig);
      } else {
        app = getApp();
      }
      
      // Get Database instance
      try {
        db = getDatabase(app);
      } catch (dbError: any) {
         // Specific catch for the "service not available" error to give better guidance
         console.error("Fatal: Firebase Database service failed to load.", dbError);
         throw new Error("Database Service Unavailable (Try Refreshing)");
      }
      
      isMockMode = false;
      console.log("Firebase initialized successfully.");
      return null; // No error
    } catch (e: any) {
      console.error("Firebase initialization failed:", e);
      isMockMode = true;
      return e.message || "Unknown Firebase Error";
    }
  } else {
    console.warn("No valid Firebase config found. Running in Offline/Mock Mode.");
    isMockMode = true;
    return "Missing Configuration";
  }
};

export const pushTelemetry = async (data: BusTelemetry): Promise<boolean> => {
  if (isMockMode) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    mockDb.push(data);
    console.log("[MockFirebase] Data stored locally:", data);
    return true;
  } else if (db) {
    try {
      // 1. Update the 'current' state of the vehicle (for live view)
      // Reference: vehicles/{deviceId}
      // V9 Syntax: set(ref(db, path), value)
      const vehicleRef = ref(db, 'vehicles/' + data.deviceId);
      await set(vehicleRef, data);

      // 2. Add to historical logs (for route replay)
      // Reference: history/{deviceId} (push creates a new unique key)
      // V9 Syntax: push(ref(db, path), value)
      const historyRef = ref(db, 'history/' + data.deviceId);
      await push(historyRef, data);
      
      console.log("[Firebase] Data sent successfully to", data.deviceId);
      return true;
    } catch (error: any) {
      console.error("Firebase Push Error:", error);
      // Log more details if it's a permission denied error
      if (error.code === 'PERMISSION_DENIED') {
        console.error("Check your Firebase Database Rules. They should be public for this demo.");
      }
      return false;
    }
  } else {
      console.error("Firebase is initialized but DB instance is null.");
      return false;
  }
};