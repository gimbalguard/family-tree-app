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
    const docRef = await addDoc(collection(db, 'familyTrees'), {
      treeName,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true, data: { id: docRef.id, treeName } };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getTreesForUser(userId: string): Promise<FamilyTree[]> {
  const q = query(collection(db, 'familyTrees'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  const trees: FamilyTree[] = [];

  for (const doc of querySnapshot.docs) {
    const treeData = { id: doc.id, ...doc.data() } as FamilyTree;
    
    const peopleQuery = query(collection(db, "people"), where("treeId", "==", doc.id));
    const peopleSnapshot = await getDocs(peopleQuery);
    treeData.personCount = peopleSnapshot.size;
    
    const relsQuery = query(collection(db, "relationships"), where("treeId", "==", doc.id));
    const relsSnapshot = await getDocs(relsQuery);
    treeData.relationshipCount = relsSnapshot.size;

    trees.push(treeData);
  }
  return trees;
}

export async function getTreeDetails(treeId: string): Promise<FamilyTree | null> {
    const docRef = doc(db, 'familyTrees', treeId);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as FamilyTree;
    }
    return null;
}

export async function deleteTree(treeId: string) {
  try {
    const batch = writeBatch(db);

    const treeDocRef = doc(db, 'familyTrees', treeId);
    batch.delete(treeDocRef);

    const collectionsToDelete = ['people', 'relationships', 'canvasPositions', 'socialLinks'];
    for (const coll of collectionsToDelete) {
        let q;
        if (coll === 'socialLinks') {
             const peopleSnapshot = await getDocs(query(collection(db, 'people'), where('treeId', '==', treeId)));
             const personIds = peopleSnapshot.docs.map(d => d.id);
             if(personIds.length > 0) {
                // Firestore 'in' query has a limit of 30
                for (let i = 0; i < personIds.length; i += 30) {
                    const chunk = personIds.slice(i, i + 30);
                    q = query(collection(db, 'socialLinks'), where('personId', 'in', chunk));
                    const snapshot = await getDocs(q);
                    snapshot.docs.forEach((d) => batch.delete(d.ref));
                }
             }
        } else {
            q = query(collection(db, coll), where('treeId', '==', treeId));
            const snapshot = await getDocs(q);
            snapshot.docs.forEach((d) => batch.delete(d.ref));
        }
    }
    
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting tree:", error);
    return { error: 'Failed to delete tree and associated data.' };
  }
}

// Person Actions
export async function getPeople(treeId: string): Promise<Person[]> {
    const q = query(collection(db, "people"), where("treeId", "==", treeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));
}

export async function addPerson(personData: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
        const docRef = await addDoc(collection(db, "people"), {
            ...personData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return { success: true, data: { id: docRef.id, ...personData } as Person };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function updatePerson(personData: Person) {
     try {
        const docRef = doc(db, "people", personData.id);
        await updateDoc(docRef, { ...personData, updatedAt: serverTimestamp() });
        return { success: true, data: personData };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function checkForDuplicate(personData: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) {
    const q = query(collection(db, "people"), 
        where("treeId", "==", personData.treeId),
        where("firstName", "==", personData.firstName),
        where("lastName", "==", personData.lastName),
        where("birthDate", "==", personData.birthDate || null),
        limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
}


// Relationship Actions
export async function getRelationships(treeId: string): Promise<Relationship[]> {
    const q = query(collection(db, "relationships"), where("treeId", "==", treeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Relationship));
}

export async function addRelationship(relData: Omit<Relationship, 'id'>) {
    try {
        const docRef = await addDoc(collection(db, "relationships"), relData);
        return { success: true, data: { id: docRef.id, ...relData } as Relationship };
    } catch (error: any) {
        return { error: error.message };
    }
}

// Canvas Position Actions
export async function getCanvasPositions(treeId: string): Promise<CanvasPosition[]> {
    const q = query(collection(db, "canvasPositions"), where("treeId", "==", treeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CanvasPosition));
}

export async function updateCanvasPosition(posData: Omit<CanvasPosition, 'id'>) {
    try {
        const q = query(collection(db, "canvasPositions"), 
            where("treeId", "==", posData.treeId),
            where("personId", "==", posData.personId),
            limit(1)
        );
        const snapshot = await getDocs(q);

        if(snapshot.empty) {
            await addDoc(collection(db, "canvasPositions"), posData);
        } else {
            const docRef = snapshot.docs[0].ref;
            await updateDoc(docRef, { x: posData.x, y: posData.y });
        }
        return { success: true };
    } catch (error: any) {
        return { error: error.message };
    }
}
