import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, testConnection } from '../firebase';
import { CompanyProfile, CompanyUser } from '../types/funds';
import { SavedApplication } from './storage';

/**
 * Initializes Firestore connection check
 */
export async function initFirebaseService() {
  await testConnection();
}

/**
 * Sync user profile to Firestore at users/{uid}
 * Strictly complies with isValidUserProfile in firestore.rules
 */
export async function syncUserProfileToFirestore(user: CompanyUser) {
  const uid = auth.currentUser?.uid || user.id;
  if (!uid) return;
  const path = `users/${uid}`;
  try {
    const email = (auth.currentUser?.email || user.email || '').trim().toLowerCase().slice(0, 120);
    const displayName = (auth.currentUser?.displayName || user.representativeName || user.companyName || '').slice(0, 120);
    const companyName = (user.companyName || '').slice(0, 160);
    const companyRut = (user.rut || '').slice(0, 20);
    const phone = (user.phone || '').slice(0, 30);

    await setDoc(doc(db, 'users', uid), {
      email,
      displayName,
      companyName,
      companyRut,
      phone,
      role: 'company'
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Sync company profile to Firestore at companies/{companyId}
 * Strictly complies with isValidCompany in firestore.rules
 */
export async function syncCompanyToFirestore(profile: CompanyProfile, customOwnerId?: string, updatedAt?: string) {
  const uid = customOwnerId || auth.currentUser?.uid;
  if (!uid) return;
  const cleanRut = (profile.rut || '').trim();
  // Un documento fijo por usuario (antes dependía del RUT y cambiaba al corregirlo)
  const companyDocId = `comp_${uid}`;
  const path = `companies/${companyDocId}`;
  try {
    const compPayload: Record<string, any> = {
      ownerId: uid,
      rut: cleanRut.slice(0, 20),
      companyName: (profile.companyName || '').slice(0, 160),
      companyType: profile.companyType || 'spa',
      sector: (profile.sector || '').slice(0, 120),
      region: (profile.region || '').slice(0, 80),
      salesBracket: profile.salesBracket || '',
      isFemaleLed: Boolean(profile.isFemaleLed),
      trlStage: profile.trlStage || ''
    };
    if (typeof profile.annualSalesCLP === 'number') {
      compPayload.annualSalesCLP = profile.annualSalesCLP;
    }
    if (profile.projectProfile && typeof profile.projectProfile === 'object') {
      compPayload.projectProfile = {
        whatItDoes: (profile.projectProfile.whatItDoes || '').slice(0, 3000),
        problemAndTarget: (profile.projectProfile.problemAndTarget || '').slice(0, 3000),
        currentSolutionAndDiff: (profile.projectProfile.currentSolutionAndDiff || '').slice(0, 3000),
        currentProgress: (profile.projectProfile.currentProgress || '').slice(0, 3000),
        teamDetails: (profile.projectProfile.teamDetails || '').slice(0, 3000),
        businessModel: (profile.projectProfile.businessModel || '').slice(0, 3000),
        fundingPurpose: (profile.projectProfile.fundingPurpose || '').slice(0, 3000),
        websiteOrSocial: (profile.projectProfile.websiteOrSocial || '').slice(0, 500)
      };
    }
    // Perfil completo (carpeta tributaria, representante, cartas, etc.) para recuperarlo en cualquier dispositivo
    compPayload.profileData = sanitizeForFirestore(profile);
    compPayload.updatedAt = updatedAt || new Date().toISOString();
    await setDoc(doc(db, 'companies', companyDocId), compPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Crea la ficha de empresa solo si el usuario no tiene ninguna (registro o primer ingreso con Google).
 * Nunca reemplaza un perfil existente. Se guarda con fecha antigua para que cualquier perfil
 * guardado después (en el navegador o en Firestore) tenga prioridad.
 */
export async function seedCompanyIfMissing(profile: CompanyProfile, uid?: string) {
  const owner = uid || auth.currentUser?.uid;
  if (!owner) return;
  try {
    if ((await getDoc(doc(db, 'companies', `comp_${owner}`))).exists()) return;
    const legacy = await getDocs(query(collection(db, 'companies'), where('ownerId', '==', owner)));
    if (!legacy.empty) return;
    await syncCompanyToFirestore(profile, owner, '2000-01-01T00:00:00.000Z');
  } catch (error) {
    console.warn('No se pudo crear la ficha inicial de la empresa:', error);
  }
}

/** Quita undefined y funciones (Firestore no los acepta) y limita textos muy largos. */
function sanitizeForFirestore(value: any): any {
  return JSON.parse(JSON.stringify(value ?? {}, (_k, v) => (typeof v === 'string' && v.length > 20000 ? v.slice(0, 20000) : v)));
}

/**
 * Lee el perfil de empresa guardado en Firestore (el más reciente del usuario).
 * Incluye documentos antiguos (id por RUT, sin profileData): de esos se recuperan los campos básicos.
 */
export async function loadCompanyFromFirestore(uid: string): Promise<{ profile: Partial<CompanyProfile>; updatedAt: string } | null> {
  const snap = await getDocs(query(collection(db, 'companies'), where('ownerId', '==', uid)));
  if (snap.empty) return null;
  const docs = snap.docs.map(d => d.data() as any);
  docs.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const best = docs[0];
  if (best.profileData && typeof best.profileData === 'object') {
    return { profile: best.profileData as Partial<CompanyProfile>, updatedAt: String(best.updatedAt || '') };
  }
  const legacy: Partial<CompanyProfile> = {};
  (['companyName', 'rut', 'companyType', 'sector', 'region', 'salesBracket', 'annualSalesCLP', 'isFemaleLed', 'trlStage', 'projectProfile'] as const)
    .forEach(k => { if (best[k] !== undefined && best[k] !== '') (legacy as any)[k] = best[k]; });
  return { profile: legacy, updatedAt: String(best.updatedAt || '') };
}

/**
 * Sync application / postulation to Firestore at applications/{appId}
 */
export async function syncApplicationToFirestore(appData: SavedApplication, customOwnerId?: string) {
  const uid = customOwnerId || auth.currentUser?.uid;
  if (!uid) return;
  const appId = appData.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `applications/${appId}`;
  try {
    await setDoc(doc(db, 'applications', appId), {
      ownerId: uid,
      fundId: appData.fundId || 'semilla-inicia',
      fundName: (appData.name || 'Postulación a Fondo').slice(0, 160),
      companyName: (appData.profile.companyName || '').slice(0, 160),
      companyRut: (appData.profile.rut || '').slice(0, 20),
      status: 'draft',
      notes: (appData.notes || '').slice(0, 1000)
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Sync uploaded tax folder record to Firestore at tax_folders/{folderId}
 */
export async function syncTaxFolderToFirestore(taxInfo: {
  fileName: string;
  fileSize?: number;
  companyRut: string;
  summary: string;
  f29Periods?: number;
}, customOwnerId?: string) {
  const uid = customOwnerId || auth.currentUser?.uid;
  if (!uid) return;
  const folderId = `tax_${Date.now()}`;
  const path = `tax_folders/${folderId}`;
  try {
    await setDoc(doc(db, 'tax_folders', folderId), {
      ownerId: uid,
      fileName: taxInfo.fileName.slice(0, 180),
      companyRut: (taxInfo.companyRut || '').slice(0, 20),
      status: 'verified',
      summary: taxInfo.summary.slice(0, 950)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
