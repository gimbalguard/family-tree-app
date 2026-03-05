'use server';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';

export async function signUp({
  email,
  password,
  username,
}: {
  email: string;
  password: string;
  username: string;
}) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    await updateProfile(user, { displayName: username });

    const userProfile: UserProfile = {
      uid: user.uid,
      username: username,
      createdAt: serverTimestamp() as any,
    };
    await setDoc(doc(db, 'users', user.uid), userProfile);

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function signIn({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function signOutUser() {
  try {
    await auth.signOut();
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
