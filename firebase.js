import {
  getApp,
  getApps,
  initializeApp
} from "./node_modules/firebase/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
  setPersistence
} from "./node_modules/firebase/firebase-auth.js";
import {
  getFirestore
} from "./node_modules/firebase/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1ndpHcajdgxdK6H5kDVu6dQ6NPuQ-oo0",
  authDomain: "bytecode-cfc75.firebaseapp.com",
  projectId: "bytecode-cfc75",
  storageBucket: "bytecode-cfc75.firebasestorage.app",
  messagingSenderId: "1028766224136",
  appId: "1:1028766224136:web:2b3404790bc183403166bd"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();
const defaultAdminEmails = new Set([
  "abirxxdbrine2024@gmail.com"
]);

googleProvider.setCustomParameters({
  prompt: "select_account"
});

githubProvider.setCustomParameters({
  allow_signup: "true"
});

await setPersistence(auth, browserLocalPersistence);

function isDefaultAdminEmail(email) {
  return defaultAdminEmails.has(String(email || "").trim().toLowerCase());
}

window.bytecodeFirebase = {
  app,
  auth,
  db,
  defaultAdminEmails,
  googleProvider,
  githubProvider,
  isDefaultAdminEmail,
  firebaseConfig
};

export {
  app,
  auth,
  db,
  defaultAdminEmails,
  firebaseConfig,
  githubProvider,
  isDefaultAdminEmail,
  googleProvider
};
