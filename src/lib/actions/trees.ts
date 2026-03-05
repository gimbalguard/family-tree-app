import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  deleteDoc,
  writeBatch,
  getDoc,
  updateDoc,
  limit,
  type Firestore,
} from 'firebase/firestore';
import type { FamilyTree, Person, Relationship, CanvasPosition } from '../types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Tree Actions
export async function createTree(db: Firestore, {
  treeName,
  userId,
}: {
  treeName: string;
  userId: string;
}) {
  try {
    const docRef = await addDoc(collection(db, 'users', userId, 'familyTrees'), {
      treeName,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const newTree = {
      id: docRef.id,
      treeName,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    return { success: true, data: newTree as any };
  } catch (error: any) {
    const permissionError = new FirestorePermissionError({
      path: `users/${userId}/familyTrees`,
      operation: 'create',
      requestResourceData: { treeName, userId }
    });
    errorEmitter.emit('permission-error', permissionError);
    return { success: false, error: permissionError.message };
  }
}

export async function getTreesForUser(db: Firestore, userId: string): Promise<FamilyTree[]> {
  const q = query(collection(db, 'users', userId, 'familyTrees'));
  const querySnapshot = await getDocs(q);
  const trees: FamilyTree[] = [];

  for (const doc of querySnapshot.docs) {
    const treeData = { id: doc.id, ...doc.data() } as FamilyTree;
    trees.push(treeData);
  }
  return trees;
}

export async function getTreeDetails(db: Firestore, userId: string, treeId: string): Promise<FamilyTree | null> {
  const docRef = doc(db, 'users', userId, 'familyTrees', treeId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as FamilyTree;
  }
  return null;
}

export async function deleteTree(db: Firestore, { userId, treeId }: { userId: string, treeId: string }) {
  try {
    const batch = writeBatch(db);
    const treeDocRef = doc(db, 'users', userId, 'familyTrees', treeId);

    const collectionsToDelete = ['people', 'relationships', 'canvasPositions'];
    for (const coll of collectionsToDelete) {
      const subCollectionRef = collection(db, 'users', userId, 'familyTrees', treeId, coll);
      const snapshot = await getDocs(subCollectionRef);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
    }

    batch.delete(treeDocRef);

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    const permissionError = new FirestorePermissionError({ path: `users/${userId}/familyTrees/${treeId}`, operation: 'delete' });
    errorEmitter.emit('permission-error', permissionError);
    console.error("Error deleting tree:", error);
    return { success: false, error: 'Failed to delete tree and associated data.' };
  }
}

// Person Actions
export async function getPeople(db: Firestore, userId: string, treeId: string): Promise<Person[]> {
  const q = query(collection(db, 'users', userId, 'familyTrees', treeId, 'people'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));
}

export async function addPerson(db: Firestore, { personData, userId, treeId }: { personData: Omit<Person, 'id' | 'createdAt' | 'updatedAt' | 'treeId' | 'userId'>, userId: string, treeId: string }) {
  try {
    const data = { ...personData, userId, treeId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    const docRef = await addDoc(collection(db, 'users', userId, 'familyTrees', treeId, 'people'), data);
    return { success: true, data: { id: docRef.id, ...personData, userId, treeId } as Person };
  } catch (error: any) {
    const permissionError = new FirestorePermissionError({ path: `users/${userId}/familyTrees/${treeId}/people`, operation: 'create', requestResourceData: personData });
    errorEmitter.emit('permission-error', permissionError);
    return { success: false, error: permissionError.message };
  }
}

export async function updatePerson(db: Firestore, { personData, userId, treeId }: { personData: Person, userId: string, treeId: string }) {
  try {
    const docRef = doc(db, 'users', userId, 'familyTrees', treeId, 'people', personData.id);
    const dataToUpdate = { ...personData, updatedAt: serverTimestamp() };
    await updateDoc(docRef, dataToUpdate);
    return { success: true, data: personData };
  } catch (error: any) {
    const permissionError = new FirestorePermissionError({ path: `users/${userId}/familyTrees/${treeId}/people/${personData.id}`, operation: 'update', requestResourceData: personData });
    errorEmitter.emit('permission-error', permissionError);
    return { success: false, error: permissionError.message };
  }
}

export async function checkForDuplicate(db: Firestore, { personData, userId, treeId }: { personData: Omit<Person, 'id' | 'createdAt' | 'updatedAt' | 'treeId' | 'userId'>, userId: string, treeId: string }) {
  const q = query(collection(db, 'users', userId, 'familyTrees', treeId, 'people'),
    where("firstName", "==", personData.firstName),
    where("lastName", "==", personData.lastName),
    where("birthDate", "==", personData.birthDate || null),
    limit(1)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}


// Relationship Actions
export async function getRelationships(db: Firestore, userId: string, treeId: string): Promise<Relationship[]> {
  const q = query(collection(db, 'users', userId, 'familyTrees', treeId, 'relationships'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Relationship));
}

export async function addRelationship(db: Firestore, { relData, userId, treeId }: { relData: Omit<Relationship, 'id' | 'treeId' | 'userId'>, userId: string, treeId: string }) {
  const data = { ...relData, userId, treeId };
  try {
    const docRef = await addDoc(collection(db, 'users', userId, 'familyTrees', treeId, 'relationships'), data);
    return { success: true, data: { id: docRef.id, ...data } as Relationship };
  } catch (error: any) {
    const permissionError = new FirestorePermissionError({
      path: `users/${userId}/familyTrees/${treeId}/relationships`,
      operation: 'create',
      requestResourceData: data,
    });
    errorEmitter.emit('permission-error', permissionError);
    return { success: false, error: permissionError.message };
  }
}

// Canvas Position Actions
export async function getCanvasPositions(db: Firestore, userId: string, treeId: string): Promise<CanvasPosition[]> {
  const q = query(collection(db, 'users', userId, 'familyTrees', treeId, 'canvasPositions'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CanvasPosition));
}

export async function updateCanvasPosition(db: Firestore, { posData, userId, treeId }: { posData: Omit<CanvasPosition, 'id' | 'updatedAt' | 'treeId' | 'userId'>, userId: string, treeId: string }) {
  try {
    const q = query(collection(db, 'users', userId, 'familyTrees', treeId, 'canvasPositions'),
      where("personId", "==", posData.personId),
      limit(1)
    );
    const snapshot = await getDocs(q);

    const dataToSave = {
      ...posData,
      userId,
      treeId,
      updatedAt: serverTimestamp()
    };

    if (snapshot.empty) {
      await addDoc(collection(db, 'users', userId, 'familyTrees', treeId, 'canvasPositions'), dataToSave);
    } else {
      const docRef = snapshot.docs[0].ref;
      await updateDoc(docRef, { x: posData.x, y: posData.y, updatedAt: serverTimestamp() });
    }
    return { success: true };
  } catch (error: any) {
    const permissionError = new FirestorePermissionError({ path: `users/${userId}/familyTrees/${treeId}/canvasPositions`, operation: 'write', requestResourceData: posData });
    errorEmitter.emit('permission-error', permissionError);
    return { success: false, error: permissionError.message };
  }
}
