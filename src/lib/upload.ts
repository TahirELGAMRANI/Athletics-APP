import * as ImagePicker from 'expo-image-picker';

import { DOCS_BUCKET, supabase } from './supabase';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(b64: string) {
  const clean = b64.replace(/^data:[^,]+,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = B64.indexOf(clean[i + 2]);
    const d = B64.indexOf(clean[i + 3]);
    bytes[p++] = (a << 2) | (b >> 4);
    if (c >= 0 && i + 2 < clean.length) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0 && i + 3 < clean.length) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes.slice(0, p);
}

/** Let the user pick a photo (or take one) and upload it under <playerId>/. Returns the storage path or null if cancelled. */
export async function pickAndUpload(playerId: string, source: 'library' | 'camera' = 'library') {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, base64: true };
  let res: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission is required');
    res = await ImagePicker.launchCameraAsync(opts);
  } else {
    res = await ImagePicker.launchImageLibraryAsync(opts);
  }
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const contentType = asset.mimeType ?? 'image/jpeg';
  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  let body: Uint8Array | Blob;
  if (asset.base64) body = base64ToBytes(asset.base64);
  else body = await (await fetch(asset.uri)).blob();
  const path = `${playerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function signedUrls(paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(DOCS_BUCKET).createSignedUrls(paths, 60 * 60);
  const out: Record<string, string> = {};
  (data ?? []).forEach((d) => {
    if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  });
  return out;
}
