// ============================================================
//  AUTH — Login con Google + gestión de sesión/usuario
// ============================================================
import { db, doc, getDoc, setDoc, updateDoc, Timestamp, auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from './firebase-config.js';

let currentUser = null;
let userProfile = null;
const listeners = [];

export function onUserReady(callback) {
  listeners.push(callback);
  if (currentUser) callback(currentUser, userProfile);
}

function notifyListeners() {
  listeners.forEach(cb => cb(currentUser, userProfile));
}

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error('Error en login:', err);
    throw err;
  }
}

export async function logout() {
  await signOut(auth);
  window.location.href = 'login.html';
}

export function getCurrentUser() { return currentUser; }
export function getUserProfile() { return userProfile; }
export function getUID() { return currentUser?.uid || null; }

// Crea o lee el perfil del usuario en Firestore (users/{uid})
async function ensureUserProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    userProfile = snap.data();
  } else {
    userProfile = {
      displayName: user.displayName || 'Mochi',
      email: user.email,
      photoURL: user.photoURL || '',
      customName: '',          // nombre personalizado, editable
      createdAt: Timestamp.now()
    };
    await setDoc(ref, userProfile);
  }
}

export async function updateDisplayName(newName) {
  if (!currentUser) return;
  await updateDoc(doc(db, 'users', currentUser.uid), { customName: newName });
  userProfile.customName = newName;
  notifyListeners();
}

export function getUserDisplayName() {
  if (!userProfile) return 'Mochi';
  return userProfile.customName?.trim() || userProfile.displayName || 'Mochi';
}

// Inicializa el observer de auth. Llamar una vez por página.
export function initAuth({ requireAuth = true, redirectIfAuthed = null } = {}) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        await ensureUserProfile(user);
        notifyListeners();
        if (redirectIfAuthed) window.location.href = redirectIfAuthed;
        resolve(user);
      } else {
        currentUser = null;
        userProfile = null;
        if (requireAuth) window.location.href = 'login.html';
        resolve(null);
      }
    });
  });
}