import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { upsertUserProfile } from "../services/adminService";
import { isPrimaryAdminEmail } from "../config/admin";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  authIssue: string;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAdmin: false,
  authIssue: "",
});

function checkAdminEmail(user: User | null) {
  return isPrimaryAdminEmail(user?.email);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authIssue, setAuthIssue] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setLoading(false);
        setAuthIssue("");

        if (nextUser) {
          upsertUserProfile(nextUser, checkAdminEmail(nextUser)).catch((error) => {
            console.error("Failed to sync user profile:", error);
          });
        }
      },
      () => {
        setAuthIssue("Session check failed. Please login again to continue.");
        setUser(null);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: checkAdminEmail(user),
      authIssue,
    }),
    [authIssue, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
