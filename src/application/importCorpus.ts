import type { PdnTextEncoding } from '../corpus/encoding';
import type { ImportWorkerMessage } from '../workers/import.worker';

export interface ImportProgress {
  parsed: number;
  imported: number;
  skipped: number;
  errors: number;
  games?: number;
  positions?: number;
  encoding?: PdnTextEncoding;
  lastError?: string;
  done: boolean;
}

export function importCorpusFile(
  file: File,
  onProgress: (progress: ImportProgress) => void,
): Promise<ImportProgress> {
  return runImport({ type: 'import-file', file }, onProgress);
}

export function importCorpusText(
  text: string,
  onProgress: (progress: ImportProgress) => void,
): Promise<ImportProgress> {
  return runImport({ type: 'import-text', text }, onProgress);
}

function runImport(
  request: { type: 'import-file'; file: File } | { type: 'import-text'; text: string },
  onProgress: (progress: ImportProgress) => void,
): Promise<ImportProgress> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/import.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (event: MessageEvent<ImportWorkerMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress({ ...message, done: false });
        return;
      }

      if (message.type === 'done') {
        const progress: ImportProgress = { ...message, done: true };
        onProgress(progress);
        worker.terminate();
        resolve(progress);
        return;
      }

      worker.terminate();
      reject(new Error(message.message));
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'Ошибка фонового импорта корпуса.'));
    };

    worker.postMessage(request);
  });
}
