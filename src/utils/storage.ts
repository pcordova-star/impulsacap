import { CompanyProfile, FormulationOutput, BlindAuditResult, CompanyUser, AuthSession } from '../types/funds';

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

const STORAGE_KEY_USERS = 'impulsacap_registered_companies';
const STORAGE_KEY_CURRENT_SESSION = 'impulsacap_active_session';
const LEGACY_KEY_USERS = 'inki_registered_companies';
const LEGACY_KEY_SESSION = 'inki_active_session';

// Pre-seeded demo company for instant testing
const INITIAL_DEMO_USERS: CompanyUser[] = [
  {
    id: 'usr_omnisass',
    email: 'contacto@omnisass.cl',
    password: 'password123',
    companyName: 'OmniSaaS SpA',
    rut: '77.942.310-8',
    phone: '+56 9 8765 4321',
    representativeName: 'Camila Soto Valenzuela',
    createdAt: '2026-01-10T10:00:00Z',
    lastLogin: new Date().toISOString()
  },
  {
    id: 'usr_biotech',
    email: 'director@biotech-austral.cl',
    password: 'password123',
    companyName: 'BioTech Austral SpA',
    rut: '76.882.140-5',
    phone: '+56 9 7654 3210',
    representativeName: 'Dr. Matías Alarcón',
    createdAt: '2026-02-15T12:00:00Z',
    lastLogin: new Date().toISOString()
  }
];

// Generates a clean profile strictly for the specified user or guest
export const getCleanDefaultProfile = (user?: CompanyUser | null): CompanyProfile => {
  if (user) {
    if (user.id === 'usr_omnisass' || user.email === 'contacto@omnisass.cl') {
      return {
        companyName: 'OmniSaaS SpA',
        rut: '77.942.310-8',
        companyType: 'spa',
        monthsActive: 8,
        salesBracket: 'menor_60m',
        annualSalesCLP: 18000000,
        sector: 'Software SaaS, Inteligencia Artificial y Productividad B2B',
        region: 'Región Metropolitana',
        isFemaleLed: true,
        femaleEquityPct: 60,
        trlStage: 'mvp_validado',
        innovationLevel: 'tech_disruptive',
        projectSummary: 'Plataforma SaaS con algoritmos de IA predictiva que automatiza la conciliación operativa y logística para empresas medianas en Chile y Latam.',
        coreTech: 'Microservicios cloud, modelos LLM y análisis de datos en tiempo real.',
        customerValidationCount: 3
      };
    }

    if (user.id === 'usr_biotech' || user.email === 'director@biotech-austral.cl') {
      return {
        companyName: 'BioTech Austral SpA',
        rut: '76.882.140-5',
        companyType: 'spa',
        monthsActive: 14,
        salesBracket: 'menor_60m',
        annualSalesCLP: 32000000,
        sector: 'Biotecnología, Acuicultura y Sustentabilidad',
        region: 'Región de Los Lagos',
        isFemaleLed: false,
        femaleEquityPct: 0,
        trlStage: 'prototipo_lab',
        innovationLevel: 'tech_disruptive',
        projectSummary: 'Biopolímeros y soluciones microbiológicas para la industria acuícola austral.',
        coreTech: 'Biotecnología molecular y ensayos en laboratorio.',
        customerValidationCount: 2
      };
    }

    // Any registered company (e.g., tresna spa)
    return {
      companyName: user.companyName.trim() || 'Mi Empresa SpA',
      rut: user.rut?.trim() || '',
      companyType: 'spa',
      monthsActive: 6,
      salesBracket: 'menor_60m',
      annualSalesCLP: 15000000,
      sector: 'Tecnología, Innovación y Servicios',
      region: 'Región Metropolitana',
      isFemaleLed: false,
      femaleEquityPct: 0,
      trlStage: 'mvp_validado',
      innovationLevel: 'incremental',
      projectSummary: `Plataforma y proyecto de innovación desarrollado por ${user.companyName.trim() || 'la empresa'}.`,
      coreTech: 'Tecnología digital y desarrollo de soluciones.',
      customerValidationCount: 0
    };
  }

  // Unauthenticated guest preview - completely clean, no leak
  return {
    companyName: '',
    rut: '',
    companyType: 'spa',
    monthsActive: 6,
    salesBracket: 'menor_60m',
    annualSalesCLP: 0,
    sector: 'Tecnología, Innovación y Servicios',
    region: 'Región Metropolitana',
    isFemaleLed: false,
    femaleEquityPct: 0,
    trlStage: 'mvp_validado',
    innovationLevel: 'incremental',
    projectSummary: '',
    coreTech: '',
    customerValidationCount: 0,
    taxFolderUploaded: false
  };
};

// Helper to get storage keys scoped to the current or specified user
const getUserKey = (baseKey: string, explicitUserId?: string): string => {
  const current = getCurrentUser();
  const userId = explicitUserId || current?.id;
  if (!userId) {
    return `impulsacap_guest_${baseKey}`;
  }
  return `impulsacap_${userId}_${baseKey}`;
};

/**
 * Get all registered company accounts from storage
 */
export const getRegisteredUsers = (): CompanyUser[] => {
  try {
    let raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_KEY_USERS);
    }
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(INITIAL_DEMO_USERS));
      return INITIAL_DEMO_USERS;
    }
    const parsed: CompanyUser[] = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_DEMO_USERS;
  } catch (e) {
    console.error('Error reading registered users', e);
    return INITIAL_DEMO_USERS;
  }
};

/**
 * Get active user session
 */
export const getCurrentUser = (): CompanyUser | null => {
  try {
    let raw = localStorage.getItem(STORAGE_KEY_CURRENT_SESSION);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_KEY_SESSION);
    }
    if (raw) {
      const session: AuthSession = JSON.parse(raw);
      return session.user || null;
    }
  } catch (e) {
    console.error('Error reading current user session', e);
  }
  return null;
};

/**
 * Register a new company account with email and password
 */
export const registerCompanyUser = (data: {
  email: string;
  password: string;
  companyName: string;
  rut: string;
  phone?: string;
  representativeName?: string;
}): { success: boolean; user?: CompanyUser; error?: string } => {
  try {
    const users = getRegisteredUsers();
    const cleanEmail = data.email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Ingresa un correo electrónico válido.' };
    }

    if (!data.password || data.password.length < 6) {
      return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'Ya existe una empresa registrada con este correo electrónico. Inicia sesión.' };
    }

    const cleanCompanyName = data.companyName.trim() || 'Mi Empresa SpA';
    const cleanRut = data.rut?.trim() || '';

    const newUser: CompanyUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: cleanEmail,
      password: data.password,
      companyName: cleanCompanyName,
      rut: cleanRut,
      phone: data.phone?.trim() || '',
      representativeName: data.representativeName?.trim() || '',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));

    // 1. Initialize clean private profile specifically for this new user
    const initialProfile: CompanyProfile = getCleanDefaultProfile(newUser);
    saveActiveProfile(initialProfile, newUser.id);

    // 2. Ensure no leftover formulation or audit is attached to this new company
    saveActiveFormulation(null, newUser.id);
    saveActiveAudit(null, newUser.id);

    // 3. Log the user in
    setCurrentUser(newUser);

    return { success: true, user: newUser };
  } catch (e: any) {
    return { success: false, error: e.message || 'Error registrando la empresa' };
  }
};

/**
 * Login with email and password
 */
export const loginCompanyUser = (
  email: string, 
  password: string
): { success: boolean; user?: CompanyUser; error?: string } => {
  try {
    const users = getRegisteredUsers();
    const cleanEmail = email.trim().toLowerCase();

    const found = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!found) {
      return { 
        success: false, 
        error: 'No encontramos ninguna empresa registrada con ese correo. Verifica tus datos o crea una cuenta.' 
      };
    }

    if (found.password && found.password !== password) {
      return { 
        success: false, 
        error: 'Contraseña incorrecta. Por favor vuelve a intentarlo.' 
      };
    }

    // Update last login
    found.lastLogin = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));

    // Ensure their profile is repaired if it previously contained OmniSaaS
    repairProfileForUser(found);

    setCurrentUser(found);
    return { success: true, user: found };
  } catch (e: any) {
    return { success: false, error: e.message || 'Error al iniciar sesión' };
  }
};

/**
 * Save current active user session
 */
export const setCurrentUser = (user: CompanyUser | null): void => {
  try {
    if (user) {
      const session: AuthSession = {
        user,
        token: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        loginAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY_CURRENT_SESSION, JSON.stringify(session));
      localStorage.removeItem(LEGACY_KEY_SESSION);
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_SESSION);
      localStorage.removeItem(LEGACY_KEY_SESSION);
    }
    // Dispatch custom event for real-time reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('impulsacap_auth_changed', { detail: user }));
      window.dispatchEvent(new CustomEvent('inki_auth_changed', { detail: user }));
    }
  } catch (e) {
    console.error('Error setting current user session', e);
  }
};

/**
 * Logout current company session
 */
export const logoutCompanyUser = (): void => {
  setCurrentUser(null);
};

// ==========================================
// USER-SCOPED STORAGE FOR PRIVATE COMPANY DATA
// ==========================================

export const saveActiveProfile = (profile: CompanyProfile, userId?: string): void => {
  try {
    const key = getUserKey('profile', userId);
    localStorage.setItem(key, JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving profile to localStorage', e);
  }
};

/**
 * Repair a specific user's stored profile if it got corrupted with OmniSaaS data
 */
export const repairProfileForUser = (user: CompanyUser): void => {
  if (!user || user.id === 'usr_omnisass') return;
  try {
    const key = `inki_${user.id}_profile`;
    const raw = localStorage.getItem(key);
    let profile: CompanyProfile;
    if (raw) {
      profile = JSON.parse(raw);
    } else {
      profile = getCleanDefaultProfile(user);
    }

    let changed = false;
    if (!profile.companyName || profile.companyName === 'OmniSaaS SpA' || profile.companyName === 'Mi Empresa SpA') {
      profile.companyName = user.companyName;
      changed = true;
    }
    if (user.rut && (!profile.rut || profile.rut === '77.942.310-8')) {
      profile.rut = user.rut;
      changed = true;
    }
    if (profile.projectSummary && profile.projectSummary.includes('OmniSaaS')) {
      profile.projectSummary = `Plataforma y proyecto de innovación desarrollado por ${user.companyName}.`;
      changed = true;
    }

    if (changed || !raw) {
      localStorage.setItem(key, JSON.stringify(profile));
    }
  } catch (e) {
    console.error('Error repairing user profile', e);
  }
};

/**
 * Self-healing routine: Scan all registered companies and repair any corrupted OmniSaaS data
 */
export const repairAllRegisteredCompanyProfiles = (): void => {
  try {
    const users = getRegisteredUsers();
    users.forEach(u => {
      if (u.id !== 'usr_omnisass') {
        repairProfileForUser(u);
      }
    });
  } catch (e) {
    console.error('Error running repairAllRegisteredCompanyProfiles', e);
  }
};

export const loadActiveProfile = (defaultProfile?: CompanyProfile, explicitUserId?: string): CompanyProfile => {
  try {
    const current = getCurrentUser();
    const targetUserId = explicitUserId || current?.id;

    // SECURITY ISOLATION: Unauthenticated guests must never see or load stored company data!
    if (!targetUserId) {
      return getCleanDefaultProfile(null);
    }

    const users = getRegisteredUsers();
    const matchedUser = users.find(u => u.id === targetUserId) || current;

    const baseDefault = defaultProfile || getCleanDefaultProfile(matchedUser);
    const key = getUserKey('profile', targetUserId);
    const raw = localStorage.getItem(key);

    if (raw) {
      const parsed: CompanyProfile = JSON.parse(raw);
      const combined: CompanyProfile = { ...baseDefault, ...parsed };

      // CRITICAL DATA ISOLATION GUARD:
      // A registered company must NEVER display OmniSaaS data unless they logged in as OmniSaaS!
      if (matchedUser && matchedUser.id !== 'usr_omnisass') {
        let needsSave = false;
        if (!combined.companyName || combined.companyName === 'OmniSaaS SpA' || combined.companyName === 'Mi Empresa SpA') {
          combined.companyName = matchedUser.companyName;
          needsSave = true;
        }
        if (matchedUser.rut && (!combined.rut || combined.rut === '77.942.310-8')) {
          combined.rut = matchedUser.rut;
          needsSave = true;
        }
        if (combined.projectSummary && combined.projectSummary.includes('OmniSaaS')) {
          combined.projectSummary = `Plataforma y proyecto de innovación desarrollado por ${matchedUser.companyName}.`;
          needsSave = true;
        }
        if (needsSave) {
          localStorage.setItem(key, JSON.stringify(combined));
        }
      }

      return combined;
    } else {
      const initial = getCleanDefaultProfile(matchedUser);
      if (targetUserId) {
        localStorage.setItem(key, JSON.stringify(initial));
      }
      return initial;
    }
  } catch (e) {
    console.error('Error reading profile from localStorage', e);
  }
  return defaultProfile || getCleanDefaultProfile();
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
    f29_sii: true,
    estatuto_res: true,
    deuda_tgr: false,
    previsional_f30: false,
    carta_interes_loi: false,
  };
};

// Auto-run repair on load to fix any corrupted browser cache immediately
if (typeof window !== 'undefined') {
  repairAllRegisteredCompanyProfiles();
}
