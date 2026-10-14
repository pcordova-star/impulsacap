import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, testConnection } from '../firebase';
import { CompanyProfile, FormulationOutput, BlindAuditResult, CompanyUser } from '../types/funds';
import { SavedApplication } from './storage';

/**
 * Initializes Firestore connection check
 */
export async function initFirebaseService() {
  await testConnection();
}

/**
 * Sync user profile to Firestore
 */
export async function syncUserProfileToFirestore(user: CompanyUser) {
  if (!auth.currentUser) return;
  const path = `users/${auth.currentUser.uid}`;
  try {
    await setDoc(doc(db, 'users', auth.currentUser.uid), {
      email: auth.currentUser.email || user.email,
      displayName: auth.currentUser.displayName || user.representativeName || user.companyName,
      companyName: user.companyName,
      companyRut: user.rut,
      phone: user.phone || '',
      role: 'company',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Sync company profile to Firestore
 */
export async function syncCompanyToFirestore(profile: CompanyProfile, customOwnerId?: string) {
  const uid = customOwnerId || auth.currentUser?.uid;
  if (!uid) return;
  const companyDocId = profile.rut ? profile.rut.replace(/[^a-zA-Z0-9]/g, '_') : `comp_${uid}`;
  const path = `companies/${companyDocId}`;
  try {
    await setDoc(doc(db, 'companies', companyDocId), {
      ownerId: uid,
      rut: profile.rut || '',
      companyName: profile.companyName || 'Mi Empresa SpA',
      companyType: profile.companyType || 'spa',
      sector: profile.sector || 'Tecnología e Innovación',
      region: profile.region || 'Región Metropolitana',
      salesBracket: profile.salesBracket || 'menor_60m',
      annualSalesCLP: Number(profile.annualSalesCLP) || 0,
      isFemaleLed: Boolean(profile.isFemaleLed),
      femaleEquityPct: Number(profile.femaleEquityPct) || 0,
      trlStage: profile.trlStage || 'mvp_validado',
      taxFolderUploaded: Boolean(profile.taxFolderUploaded),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Sync application / postulation to Firestore
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
      fundName: appData.name || 'Postulación a Fondo',
      companyName: appData.profile.companyName || '',
      companyRut: appData.profile.rut || '',
      status: 'draft',
      notes: appData.notes || '',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Sync uploaded tax folder record to Firestore
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
      fileSize: taxInfo.fileSize || 1024,
      companyRut: taxInfo.companyRut || '',
      status: 'verified',
      summary: taxInfo.summary.slice(0, 950),
      f29Periods: taxInfo.f29Periods || 12,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
