// --- Shared Firebase init for all pages ---
const firebaseConfig = {
  apiKey: "AIzaSyC2Q7o_XeI-FFzO1W2K8FTyHtn84-4sINY",
  authDomain: "rcph-admin.firebaseapp.com",
  projectId: "rcph-admin",
  storageBucket: "rcph-admin.firebasestorage.app",
  messagingSenderId: "8400886293",
  appId: "1:8400886293:web:449919cafaae21ba358c1c",
  measurementId: "G-H6GVC7VZ88"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// expose for other scripts
window.auth = firebase.auth();
window.db   = firebase.firestore();