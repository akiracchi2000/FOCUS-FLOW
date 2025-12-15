// Firebase Configuration
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, setDoc, doc, updateDoc, deleteDoc, onSnapshot, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// TODO: Replace the following with your app's Firebase project configuration
// You can get this from the Firebase Console -> Project Settings -> General -> Your Apps -> SDK Setup and Configuration (Config)
const firebaseConfig = {
    apiKey: "AIzaSyDcWXqPMoC0sHfQxMqp3hYOm9WlH0V4OW0",
    authDomain: "focus-and-flow-dae6d.firebaseapp.com",
    projectId: "focus-and-flow-dae6d",
    storageBucket: "focus-and-flow-dae6d.firebasestorage.app",
    messagingSenderId: "405455188678",
    appId: "1:405455188678:web:9b71e55895f211ba40ddc7",
    measurementId: "G-6EENEVK4PF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// Enable offline persistence
// This allows the app to work offline and sync when back online
try {
    enableIndexedDbPersistence(db)
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Firebase Persistence failed: Multiple tabs open');
            } else if (err.code == 'unimplemented') {
                console.warn('Firebase Persistence not supported by browser');
            }
        });
} catch (e) {
    console.log("Persistence setup error (may be already enabled):", e);
}

export { db, collection, addDoc, setDoc, doc, updateDoc, deleteDoc, onSnapshot };
