import JSZip from 'jszip';
import type { Network } from '../../shared/types';
import { isRelevantPath } from './parse';
import type { TextFile } from './types';

/**
 * Convierte lo que sube el usuario (uno o varios .zip y/o archivos sueltos)
 * en una lista de archivos de texto. Todo ocurre en memoria, en el navegador.
 */
export async function readUploads(files: File[], network: Network): Promise<TextFile[]> {
  const out: TextFile[] = [];
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter((e) => !e.dir && isRelevantPath(e.name, network));
      for (const entry of entries) out.push({ path: entry.name, text: await entry.async('string') });
    } else {
      out.push({ path: file.name, text: await file.text() });
    }
  }
  return out;
}
