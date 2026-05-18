"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isGraduate: boolean;
  class?: string;
};

type Ctx = {
  user: AppUser | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

async function fetchUserDoc(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u: User | null) => {
      if (!u) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const data = await fetchUserDoc(u.uid);
        setUser({
          uid: u.uid,
          email: u.email,
          displayName: (data?.displayName as string) || u.displayName,
          photoURL: (data?.photoURL as string) || u.photoURL,
          isGraduate: !!data?.isGraduate,
          class: (data?.class as string) || undefined,
        });
      } catch (err) {
        // Firestore offline / rules blocked — fall back to auth-only profile.
        // eslint-disable-next-line no-console
        console.warn("[auth] fetchUserDoc failed:", err);
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

  const logout = () => signOut(auth);

  return (
    <AuthCtx.Provider value={{ user, loading, signInEmail, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
