'use server';
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
} from 'firebase/firestore';
import { db } from '../firebase';
import type { FamilyTree, Person, Relationship, CanvasPosition } from '../types';

// Tree Actions
export async function createTree({
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
    return { error: error.message };
  }
}

export async function getTreesForUser(userId: string): Promise<FamilyTree[]> {
  const q = query(collection(db, 'users', userId, 'familyTrees'));
  const querySnapshot = await getDocs(q);
  const trees: FamilyTree[] = [];

  for (const doc of querySnapshot.docs) {
    const treeData = { id: doc.id, ...doc.data() } as FamilyTree;
    
    // These counts can be performance intensive. For now, we get basic tree info.
    // In a production app, these would be better managed with counters updated by cloud functions.
    // const peopleQuery = query(collection(db, 'users', userId, 'familyTrees', doc.id, 'people'));
    // const peopleSnapshot = await getDocs(peopleQuery);
    // treeData.personCount = peopleSnapshot.size;
    
    // const relsQuery = query(collection(db, 'users', userId, 'familyTrees', doc.id, 'relationships'));
    // const relsSnapshot = await getDocs(relsQuery);
    // treeData.relationshipCount = relsSnapshot.size;

    trees.push(treeData);
  }
  return trees;
}

export async function getTreeDetails(userId: string, treeId: string): Promise<FamilyTree | null> {
    const docRef = doc(db, 'users', userId, 'familyTrees', treeId);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as FamilyTree;
    }
    return null;
}

export async function deleteTree({userId, treeId}: {userId: string, treeId: string}) {
  try {
    const batch = writeBatch(db);
    const treeDocRef = doc(db, 'users', userId, 'familyTrees', treeId);

    // This is a simplified cascade delete. For very large trees, a more robust solution
    // like a Firebase Extension for cleanup would be recommended.
    const collectionsToDelete = ['people', 'relationships', 'canvasPositions'];
    for (const coll of collectionsToDelete) {
        const subCollectionRef = collection(db, 'users', userId, 'familyTrees', treeId, coll);
        const snapshot = await getDocs(subCollectionRef);
        snapshot.docs.forEach((d) => batch.delete(d.ref));
    }

    // Note: This does not handle nested subcollections like `socialLinks`.
    // A complete solution would require recursively deleting those as well.

    batch.delete(treeDocRef);
    
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting tree:", error);
    return { error: 'Failed to delete tree and associated data.' };
  }
}

// Person Actions
export async function getPeople(userId: string, treeId: string): Promise<Person[]> {
    const q = query(collection(db, 'users', userId, 'familyTrees', treeId, 'people'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));
}

export async function addPerson({personData, userId, treeId}: {personData: Omit<Person, 'id' | 'createdAt' | 'updatedAt' | 'treeId' | 'userId'>, userId: string, treeId: string}) {
    try {
        const docRef = await addDoc(collection(db, 'users', userId, 'familyTrees', treeId, 'people'), {
            ...personData,
            userId,
            treeId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return { success: true, data: { id: docRef.id, ...personData, userId, treeId } as Person };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function updatePerson({personData, userId, treeId}: {personData: Person, userId: string, treeId: string}) {
     try {
        const docRef = doc(db, 'users', userId, 'familyTrees', treeId, 'people', personData.id);
        await updateDoc(docRef, { ...personData, updatedAt: serverTimestamp() });
        return { success: true, data: personData };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function checkForDuplicate({personData, userId, treeId}: {personData: Omit<Person, 'id'|'createdAt'|'updatedAt'|'treeId'|'userId'>, userId: string, treeId: string}) {
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
export async function getRelationships(userId: string, treeId: string): Promise<Relationship[]> {
    const q = query(collection(db, 'users', userId, 'familyTrees', treeId, 'relationships'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Relationship));
}

export async function addRelationship({relData, userId, treeId}: {relData: Omit<Relationship, 'id' | 'treeId' | 'userId'>, userId: string, treeId: string}) {
    try {
        const docRef = await addDoc(collection(db, 'users', userId, 'familyTrees', treeId, 'relationships'), {
            ...relData,
            userId,
            treeId,
        });
        return { success: true, data: { id: docRef.id, ...relData, userId, treeId } as Relationship };
    } catch (error: any) {
        return { error: error.message };
    }
}

// Canvas Position Actions
export async function getCanvasPositions(userId: string, treeId: string): Promise<CanvasPosition[]> {
    const q = query(collection(db, 'users', userId, 'familyTrees', treeId, 'canvasPositions'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CanvasPosition));
}

export async function updateCanvasPosition({posData, userId, treeId}: {posData: Omit<CanvasPosition, 'id'|'updatedAt'|'treeId'|'userId'>, userId: string, treeId: string}) {
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

        if(snapshot.empty) {
            await addDoc(collection(db, 'users', userId, 'familyTrees', treeId, 'canvasPositions'), dataToSave);
        } else {
            const docRef = snapshot.docs[0].ref;
            await updateDoc(docRef, { x: posData.x, y: posData.y, updatedAt: serverTimestamp() });
        }
        return { success: true };
    } catch (error: any) {
        return { error: error.message };
    }
}
