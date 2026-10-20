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
export async function syncCompanyToFirestore(profile: CompanyProfile, customOwnerId?: string) {
  const uid = customOwnerId || auth.currentUser?.uid;
  if (!uid) return;
  const cleanRut = (profile.rut || '').trim();
  const companyDocId = cleanRut ? cleanRut.replace(/[^a-zA-Z0-9_-]/g, '_') : `comp_${uid}`;
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
    await setDoc(doc(db, 'companies', companyDocId), compPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
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
