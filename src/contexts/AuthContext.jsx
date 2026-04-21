import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { AuthContext } from "./auth-context";
import {
  AUTH_STORAGE_KEYS,
  LEGACY_EMPLOYEE_STORAGE_KEYS,
  normalizeStoredValue,
  writeStoredValue,
} from "../lib/authSessionStorage";

function normalizeValue(value) {
  return normalizeStoredValue(value);
}

function syncLegacyAuditStorage(employeeId) {
  for (const storageKey of LEGACY_EMPLOYEE_STORAGE_KEYS) {
    writeStoredValue(storageKey, employeeId);
  }
}

function clearLegacyAuditStorage() {
  for (const storageKey of LEGACY_EMPLOYEE_STORAGE_KEYS) {
    writeStoredValue(storageKey, null);
  }
}

function clearAuthStorage({ clearLegacyAudit = false } = {}) {
  writeStoredValue(AUTH_STORAGE_KEYS.userId, null);
  writeStoredValue(AUTH_STORAGE_KEYS.authUserId, null);
  writeStoredValue(AUTH_STORAGE_KEYS.employeeId, null);
  writeStoredValue(AUTH_STORAGE_KEYS.roleCode, null);
  writeStoredValue(AUTH_STORAGE_KEYS.authStatus, null);

  if (clearLegacyAudit) {
    clearLegacyAuditStorage();
  }
}

function syncAuthStorage(profile) {
  writeStoredValue(AUTH_STORAGE_KEYS.userId, profile?.user?.id);
  writeStoredValue(AUTH_STORAGE_KEYS.authUserId, profile?.authUserId);
  writeStoredValue(AUTH_STORAGE_KEYS.employeeId, profile?.employeeId);
  writeStoredValue(AUTH_STORAGE_KEYS.roleCode, profile?.role?.code);
  writeStoredValue(AUTH_STORAGE_KEYS.authStatus, profile?.status);

  if (profile?.employeeId) {
    syncLegacyAuditStorage(profile.employeeId);
  }
}

async function getAppUserProfile(authUserId) {
  const normalizedAuthUserId = normalizeValue(authUserId);
  if (!normalizedAuthUserId) {
    return null;
  }

  const { data, error } = await supabase
    .from("users")
    .select(
      `
        id,
        auth_user_id,
        email,
        username,
        status,
        employee_id,
        role_id,
        employees!users_employee_id_fkey (
          id,
          full_name,
          nick_name,
          email,
          is_active
        ),
        roles!users_role_id_fkey (
          id,
          code,
          name,
          is_active
        )
      `
    )
    .eq("auth_user_id", normalizedAuthUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    user: {
      id: data.id,
      username: data.username,
      email: data.email,
      status: data.status,
    },
    authUserId: data.auth_user_id,
    employeeId: data.employee_id,
    roleId: data.role_id,
    employee: data.employees
      ? {
          id: data.employees.id,
          fullName: data.employees.full_name,
          nickName: data.employees.nick_name,
          email: data.employees.email,
          isActive: data.employees.is_active,
        }
      : null,
    role: data.roles
      ? {
          id: data.roles.id,
          code: data.roles.code,
          name: data.roles.name,
          isActive: data.roles.is_active,
        }
      : null,
    status: data.status,
  };
}

function createState(overrides = {}) {
  return {
    status: "loading",
    isLoading: true,
    isSubmitting: false,
    session: null,
    authUser: null,
    profile: null,
    error: null,
    ...overrides,
  };
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(() => createState());

  useEffect(() => {
    let isActive = true;

    async function resolveSession(session) {
      const authUser = session?.user || null;

      if (!authUser) {
        if (!isActive) {
          return;
        }

        clearAuthStorage({ clearLegacyAudit: true });
        setAuthState(
          createState({
            status: "unauthenticated",
            isLoading: false,
            session: null,
            authUser: null,
            profile: null,
            error: null,
          })
        );
        return;
      }

      try {
        const profile = await getAppUserProfile(authUser.id);

        if (!isActive) {
          return;
        }

        if (!profile) {
          clearAuthStorage({ clearLegacyAudit: true });
          setAuthState(
            createState({
              status: "unlinked",
              isLoading: false,
              session,
              authUser,
              profile: null,
              error: "Akun login belum terhubung ke profil aplikasi.",
            })
          );
          return;
        }

        syncAuthStorage(profile);
        setAuthState(
          createState({
            status: "authenticated",
            isLoading: false,
            session,
            authUser,
            profile,
            error: null,
          })
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        clearAuthStorage({ clearLegacyAudit: true });
        setAuthState(
          createState({
            status: "error",
            isLoading: false,
            session,
            authUser,
            profile: null,
            error:
              error?.message ||
              "Gagal memuat profil pengguna dari database aplikasi.",
          })
        );
      }
    }

    async function bootstrapAuth() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        await resolveSession(session);
      } catch (error) {
        if (!isActive) {
          return;
        }

        clearAuthStorage({ clearLegacyAudit: true });
        setAuthState(
          createState({
            status: "error",
            isLoading: false,
            session: null,
            authUser: null,
            profile: null,
            error:
              error?.message || "Gagal memeriksa session autentikasi pengguna.",
          })
        );
      }
    }

    bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolveSession(session);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn({ email, password }) {
    const normalizedEmail = normalizeValue(email);
    const normalizedPassword = String(password || "");

    if (!normalizedEmail || !normalizedPassword) {
      throw new Error("Email dan password wajib diisi.");
    }

    setAuthState((currentState) => ({
      ...currentState,
      isSubmitting: true,
      error: null,
    }));

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setAuthState((currentState) => ({
        ...currentState,
        isSubmitting: false,
        error: error?.message || "Login gagal diproses.",
      }));
      throw error;
    }
  }

  async function signOut() {
    setAuthState((currentState) => ({
      ...currentState,
      isSubmitting: true,
      error: null,
    }));

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    } catch (error) {
      setAuthState((currentState) => ({
        ...currentState,
        isSubmitting: false,
        error: error?.message || "Logout gagal diproses.",
      }));
      throw error;
    }
  }

  const contextValue = useMemo(
    () => ({
      ...authState,
      isAuthenticated: authState.status === "authenticated",
      employeeId: authState.profile?.employeeId || null,
      roleCode: authState.profile?.role?.code || null,
      roleName: authState.profile?.role?.name || null,
      fullName: authState.profile?.employee?.fullName || null,
      username: authState.profile?.user?.username || null,
      signIn,
      signOut,
    }),
    [authState]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}
