// Firebase wrapper
import { state } from "../state.js";

export async function setDoc(docRef, data) {
  // TODO: replace with Firebase SDK call
  console.log("Firestore setDoc", docRef, data);
}

export function doc(db, ...path) {
  return path.join("/");
}
