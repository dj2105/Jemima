// /src/lib/seedUnsealer.js
//
// Example: encrypting a seed payload (run in a browser console or Node >=20)
// ------------------------------------------------------------------------
// const encoder = new TextEncoder();
// const STATIC_SALT = "jemimas-asking::seed-salt";
// async function seal(seedJson, roomCode, hostUid) {
//   const data = encoder.encode(JSON.stringify(seedJson));
//   const material = encoder.encode(`${roomCode}${hostUid}${STATIC_SALT}`);
//   const digest = await crypto.subtle.digest("SHA-256", material);
//   const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt"]);
//   const iv = crypto.getRandomValues(new Uint8Array(12));
//   const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
//   const blob = new Uint8Array(iv.byteLength + sealed.byteLength);
//   blob.set(iv, 0);
//   blob.set(new Uint8Array(sealed), iv.byteLength);
//   return new Blob([blob], { type: "application/octet-stream" });
// }
// ------------------------------------------------------------------------
// The host uploads the resulting blob (.sealed). The functions below derive
// the same key and decrypt the payload entirely in-memory.

const STATIC_SALT = "jemimas-asking::seed-salt";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getCrypto() {
  const c = globalThis.crypto || globalThis.msCrypto;
  if (!c || !c.subtle) {
    throw new Error("Web Crypto API is required to unseal game files.");
  }
  return c;
}

function base64ToArrayBuffer(b64) {
  const clean = String(b64 || "").trim();
  if (!clean) throw new Error("Empty game file payload.");
  const dataPart = clean.includes(",") ? clean.split(",").pop() : clean;
  try {
    if (typeof atob === "function") {
      const bin = atob(dataPart);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes.buffer;
    }
  } catch (err) {
    throw new Error("Game file is not valid base64 data.");
  }
  try {
    const buf = Buffer.from(dataPart, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch (err) {
    throw new Error("Game file is not valid base64 data.");
  }
}

async function normaliseToArrayBuffer(file) {
  if (!file) throw new Error("No game file provided.");
  if (file instanceof ArrayBuffer) return file;
  if (ArrayBuffer.isView(file)) return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  if (typeof file === "string") return base64ToArrayBuffer(file);
  if (typeof Blob !== "undefined" && file instanceof Blob) {
    return await file.arrayBuffer();
  }
  if (file?.arrayBuffer instanceof Function) {
    return await file.arrayBuffer();
  }
  throw new Error("Unsupported game file type.");
}

async function deriveKey(roomCode, hostUid) {
  const code = String(roomCode || "").trim().toUpperCase();
  const uid = String(hostUid || "").trim();
  if (!code || !uid) throw new Error("Room code or host identity missing.");
  const crypto = getCrypto();
  // Combine the dynamic identifiers with the static salt, then hash via SHA-256 to obtain 256 bits of key material.
  const material = encoder.encode(`${code}${uid}${STATIC_SALT}`);
  const digest = await crypto.subtle.digest("SHA-256", material);
  // Import the digest as an AES-GCM key for decryption only.
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["decrypt"]);
}

export async function unsealSeed(file, roomCode, hostUid) {
  const crypto = getCrypto();
  const key = await deriveKey(roomCode, hostUid);
  const payload = await normaliseToArrayBuffer(file);
  if (payload.byteLength <= 12) {
    throw new Error("Game file is too short or missing its IV.");
  }
  const iv = new Uint8Array(payload.slice(0, 12));
  const ciphertext = payload.slice(12);
  let decrypted;
  try {
    // AES-GCM decrypt using the IV prepended to the payload; the mode verifies integrity via its built-in authentication tag.
    decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  } catch (err) {
    throw new Error("Failed to decrypt game file. Check the room code and host account.");
  }
  let parsed;
  try {
    const json = decoder.decode(decrypted);
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error("Decrypted game file is not valid JSON.");
  }
  if (typeof parsed !== "object" || !parsed) {
    throw new Error("Game file payload is malformed.");
  }
  return parsed;
}

export default unsealSeed;
