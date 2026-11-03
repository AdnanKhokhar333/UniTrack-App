import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchMe, loginRequest } from "../api/auth";
import type {
  AuthUser,
  DriverProfile,
  MeResponse,
  StudentProfile,
} from "../types";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  driverProfile: DriverProfile | null;
  studentProfile: StudentProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<MeResponse | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "unitrack_token";
const USER_KEY = "unitrack_user";
const DRIVER_KEY = "unitrack_driver_profile";
const STUDENT_KEY = "unitrack_student_profile";

async function persistSession(opts: {
  token: string;
  user: AuthUser;
  driverProfile?: DriverProfile | null;
  studentProfile?: StudentProfile | null;
}) {
  await AsyncStorage.setItem(TOKEN_KEY, opts.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(opts.user));
  if (opts.driverProfile) {
    await AsyncStorage.setItem(DRIVER_KEY, JSON.stringify(opts.driverProfile));
  } else {
    await AsyncStorage.removeItem(DRIVER_KEY);
  }
  if (opts.studentProfile) {
    await AsyncStorage.setItem(
      STUDENT_KEY,
      JSON.stringify(opts.studentProfile)
    );
  } else {
    await AsyncStorage.removeItem(STUDENT_KEY);
  }
}

async function clearSession() {
  await AsyncStorage.multiRemove([
    TOKEN_KEY,
    USER_KEY,
    DRIVER_KEY,
    STUDENT_KEY,
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(
    null
  );
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const applyProfiles = useCallback(
    (
      nextUser: AuthUser,
      nextDriver?: DriverProfile | null,
      nextStudent?: StudentProfile | null
    ) => {
      setUser(nextUser);
      setDriverProfile(nextDriver ?? null);
      setStudentProfile(nextStudent ?? null);
    },
    []
  );

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser, storedDriver, storedStudent] =
          await Promise.all([
            AsyncStorage.getItem(TOKEN_KEY),
            AsyncStorage.getItem(USER_KEY),
            AsyncStorage.getItem(DRIVER_KEY),
            AsyncStorage.getItem(STUDENT_KEY),
          ]);

        if (!storedToken || !storedUser) {
          return;
        }

        const parsed = JSON.parse(storedUser) as AuthUser;
        if (parsed.role === "admin") {
          await clearSession();
          return;
        }

        setToken(storedToken);
        setUser(parsed);
        if (storedDriver) {
          setDriverProfile(JSON.parse(storedDriver) as DriverProfile);
        }
        if (storedStudent) {
          setStudentProfile(JSON.parse(storedStudent) as StudentProfile);
        }

        // Refresh profiles from /me so route_id / bus_id stay current
        try {
          const me = await fetchMe();
          if (me.user.role === "admin") {
            await clearSession();
            setToken(null);
            setUser(null);
            setDriverProfile(null);
            setStudentProfile(null);
            return;
          }
          applyProfiles(
            me.user,
            me.driver_profile ?? null,
            me.student_profile ?? null
          );
          await persistSession({
            token: storedToken,
            user: me.user,
            driverProfile: me.driver_profile ?? null,
            studentProfile: me.student_profile ?? null,
          });
        } catch {
          // Keep cached session if /me fails (offline / server down)
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [applyProfiles]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginRequest(email, password);
      if (data.user?.role === "admin") {
        throw new Error("Admins use the web dashboard, not the mobile app.");
      }
      await persistSession({
        token: data.access_token,
        user: data.user,
        driverProfile: data.driver_profile ?? null,
        studentProfile: data.student_profile ?? null,
      });
      setToken(data.access_token);
      applyProfiles(
        data.user,
        data.driver_profile ?? null,
        data.student_profile ?? null
      );
    },
    [applyProfiles]
  );

  const logout = useCallback(async () => {
    await clearSession();
    setToken(null);
    setUser(null);
    setDriverProfile(null);
    setStudentProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) return null;
    const me = await fetchMe();
    applyProfiles(
      me.user,
      me.driver_profile ?? null,
      me.student_profile ?? null
    );
    await persistSession({
      token,
      user: me.user,
      driverProfile: me.driver_profile ?? null,
      studentProfile: me.student_profile ?? null,
    });
    return me;
  }, [token, applyProfiles]);

  const value = useMemo(
    () => ({
      user,
      token,
      driverProfile,
      studentProfile,
      loading,
      login,
      logout,
      refreshProfile,
    }),
    [
      user,
      token,
      driverProfile,
      studentProfile,
      loading,
      login,
      logout,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
