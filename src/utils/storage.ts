import { CompanyProfile, FormulationOutput, BlindAuditResult, CompanyUser } from '../types/funds';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export interface SavedApplication {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  fundId: string;
  profile: CompanyProfile;
  formulation: FormulationOutput | null;
  auditResult: BlindAuditResult | null;
  docStatuses: Record<string, boolean>;
  notes?: string;
}

// Generates a clean profile strictly for the specified user or guest (no invented sample data)
export const getCleanDefaultProfile = (user?: CompanyUser | null): CompanyProfile => {
  if (user) {
    return {
      companyName: user.companyName?.trim() || '',
      rut: user.rut?.trim() || '',
      companyType: 'spa',
      monthsActive: null,
      salesBracket: '',
      annualSalesCLP: null,
      sector: '',
      region: '',
      city: '',
      isFemaleLed: false,
      femaleEquityPct: 0,
      trlStage: '',
      innovationLevel: 'incremental',
      projectSummary: '',
      coreTech: '',
      customerValidationCount: 0,
      taxFolderUploaded: false
    };
  }

  // Unauthenticated guest preview - completely clean, no leak, no invented data
  return {
    companyName: '',
    rut: '',
    companyType: 'spa',
    monthsActive: null,
    salesBracket: '',
    annualSalesCLP: null,
    sector: '',
    region: '',
    city: '',
    isFemaleLed: false,
    femaleEquityPct: 0,
    trlStage: '',
    innovationLevel: 'incremental',
    projectSummary: '',
    coreTech: '',
    customerValidationCount: 0,
    taxFolderUploaded: false
  };
};

// Helper to get storage keys scoped to the current Firebase Auth user ID or guest
const getUserKey = (baseKey: string, explicitUserId?: string): string => {
  const userId = explicitUserId || auth.currentUser?.uid;
  if (!userId) {
    return `impulsacap_guest_${baseKey}`;
  }
  return `impulsacap_${userId}_${baseKey}`;
};

/**
 * Get active user based on Firebase auth.currentUser and cached metadata
 */
export const getCurrentUser = (): CompanyUser | null => {
  const fbUser = auth.currentUser;
  if (!fbUser) return null;

  let cached: Partial<CompanyUser> = {};
  try {
    const raw = localStorage.getItem(`impulsacap_user_meta_${fbUser.uid}`);
    if (raw) cached = JSON.parse(raw);
  } catch (e) {
    console.error('Error reading user metadata cache', e);
  }

  return {
    id: fbUser.uid,
    email: fbUser.email || '',
    companyName: cached.companyName || fbUser.displayName || '',
    rut: cached.rut || '',
    phone: cached.phone || '',
    representativeName: cached.representativeName || fbUser.displayName || '',
    createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
    lastLogin: new Date().toISOString()
  };
};

/**
 * Cache user metadata in localStorage associated with Firebase UID
 */
export const setCurrentUser = (user: CompanyUser | null): void => {
  if (user && user.id) {
    try {
      localStorage.setItem(`impulsacap_user_meta_${user.id}`, JSON.stringify(user));
    } catch (e) {
      console.error('Error caching user metadata', e);
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('impulsacap_auth_changed', { detail: user }));
  }
};

/**
 * Logout current company session via Firebase Auth
 */
export const logoutCompanyUser = async (): Promise<void> => {
  try {
    const uid = auth.currentUser?.uid;
    if (uid) {
      localStorage.removeItem(`impulsacap_user_meta_${uid}`);
    }
    await signOut(auth);
  } catch (e) {
    console.error('Error signing out with Firebase Auth', e);
  }
};

// Backward-compatibility no-op for any leftover calls
export const repairAllRegisteredCompanyProfiles = (): void => {};

// ==========================================
// USER-SCOPED STORAGE FOR PRIVATE COMPANY DATA (LOCAL CACHE BY FIREBASE UID)
// ==========================================

export const saveActiveProfile = (profile: CompanyProfile, userId?: string): void => {
  try {
    const key = getUserKey('profile', userId);
    localStorage.setItem(key, JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving profile to localStorage', e);
  }
};

export const loadActiveProfile = (defaultProfile?: CompanyProfile, explicitUserId?: string): CompanyProfile => {
  try {
    const targetUserId = explicitUserId || auth.currentUser?.uid;
    if (!targetUserId) {
      return getCleanDefaultProfile(null);
    }
    const key = getUserKey('profile', targetUserId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: CompanyProfile = JSON.parse(raw);
      return { ...defaultProfile, ...parsed };
    } else {
      const initial = defaultProfile || getCleanDefaultProfile(getCurrentUser());
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
  } catch (e) {
    console.error('Error reading profile from localStorage', e);
  }
  return defaultProfile || getCleanDefaultProfile(null);
};

export const saveActiveFormulation = (formulation: FormulationOutput | null, userId?: string): void => {
  try {
    const key = getUserKey('formulation', userId);
    if (formulation) {
      localStorage.setItem(key, JSON.stringify(formulation));
    } else {
      localStorage.removeItem(key);
    }
  } catch (e) {
    console.error('Error saving formulation', e);
  }
};

export const loadActiveFormulation = (userId?: string): FormulationOutput | null => {
  try {
    const key = getUserKey('formulation', userId);
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading formulation', e);
  }
  return null;
};

export const saveActiveAudit = (audit: BlindAuditResult | null, userId?: string): void => {
  try {
    const key = getUserKey('audit', userId);
    if (audit) {
      localStorage.setItem(key, JSON.stringify(audit));
    } else {
      localStorage.removeItem(key);
    }
  } catch (e) {
    console.error('Error saving audit', e);
  }
};

export const loadActiveAudit = (userId?: string): BlindAuditResult | null => {
  try {
    const key = getUserKey('audit', userId);
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading audit', e);
  }
  return null;
};

export const saveSavedApplications = (apps: SavedApplication[], userId?: string): void => {
  try {
    const key = getUserKey('applications', userId);
    localStorage.setItem(key, JSON.stringify(apps));
  } catch (e) {
    console.error('Error saving applications', e);
  }
};

export const loadSavedApplications = (userId?: string): SavedApplication[] => {
  try {
    const key = getUserKey('applications', userId);
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading applications', e);
  }
  return [];
};

export const saveDocStatuses = (docs: Record<string, boolean>, userId?: string): void => {
  try {
    const key = getUserKey('docs', userId);
    localStorage.setItem(key, JSON.stringify(docs));
  } catch (e) {
    console.error('Error saving doc statuses', e);
  }
};

export const loadDocStatuses = (userId?: string): Record<string, boolean> => {
  try {
    const key = getUserKey('docs', userId);
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading doc statuses', e);
  }
  return {
    f29_sii: false,
    estatuto_res: false,
    deuda_tgr: false,
    previsional_f30: false,
    carta_interes_loi: false,
  };
};
