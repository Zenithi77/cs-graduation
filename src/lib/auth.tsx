"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { auth, googleProvider, db } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isGraduate: boolean;
};

type Ctx = {
  user: AppUser | null;
  loading: boolean;
  signInEmail: (e: string, p: string) => Promise<void>;
  signUpEmail: (e: string, p: string, name: string, isGraduate: boolean) => Promise<void>;
  signInGoogle: (isGraduate?: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

async function ensureUserDoc(u: User, opts?: { displayName?: string; isGraduate?: boolean }) {
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: u.uid,
      email: u.email,
      displayName: opts?.displayName ?? u.displayName ?? "",
      photoURL: u.photoURL ?? "",
      isGraduate: opts?.isGraduate ?? false,
      bio: "",
      createdAt: serverTimestamp(),
    });
  }
  const after = await getDoc(ref);
  return after.data();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const data = await ensureUserDoc(u);
        setUser({
          uid: u.uid,
          email: u.email,
          displayName: (data?.displayName as string) || u.displayName,
          photoURL: (data?.photoURL as string) || u.photoURL,
          isGraduate: !!data?.isGraduate,
        });
      } catch (err) {
        // Firestore offline / rules blocked — fall back to auth-only profile.
        // eslint-disable-next-line no-console
        console.warn("[auth] ensureUserDoc failed:", err);
        setUser({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          isGraduate: false,
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpEmail = async (email: string, password: string, name: string, isGraduate: boolean) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    await ensureUserDoc(cred.user, { displayName: name, isGraduate });
  };

  const signInGoogle = async (isGraduate = false) => {
    const cred = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(cred.user, { isGraduate });
  };

  const logout = () => signOut(auth);

  return (
    <AuthCtx.Provider value={{ user, loading, signInEmail, signUpEmail, signInGoogle, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
