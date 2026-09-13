const TAG_LINE = /^\s*\[[A-Za-z0-9_]+\s+"(?:\\.|[^"])*"\]\s*$/;

/**
 * Incremental counterpart of iterateGameSources(). It keeps only the current
 * game in memory and can therefore consume very large Blob/File inputs.
 */
export async function* iterateGameSourcesFromBlob(blob: Blob): AsyncGenerator<string> {
  const reader = blob.stream().getReader();
  const decoder = new TextDecoder();
  const splitter = new GameSourceSplitter();
  let pending = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });

      while (true) {
        const lineBreak = findLineBreak(pending);
        if (!lineBreak) break;
        const line = pending.slice(0, lineBreak.index);
        pending = pending.slice(lineBreak.index + lineBreak.length);
        const game = splitter.pushLine(line);
        if (game) yield game;
      }
    }

    pending += decoder.decode();
    if (pending.length > 0) {
      const game = splitter.pushLine(pending);
      if (game) yield game;
    }

    const finalGame = splitter.finish();
    if (finalGame) yield finalGame;
  } finally {
    reader.releaseLock();
  }
}

class GameSourceSplitter {
  private current: string[] = [];
  private hasHeader = false;
  private bodyStarted = false;
  private commentDepth = 0;

  pushLine(line: string): string | null {
    const isTag = this.commentDepth === 0 && TAG_LINE.test(line);
    let completed: string | null = null;

    if (isTag && this.hasHeader && this.bodyStarted) {
      completed = this.flush();
    }

    this.current.push(line);
    if (isTag) {
      this.hasHeader = true;
    } else if (this.hasHeader && line.trim()) {
      this.bodyStarted = true;
    }

    for (const char of line) {
      if (char === '{') this.commentDepth += 1;
      else if (char === '}' && this.commentDepth > 0) this.commentDepth -= 1;
    }

    return completed;
  }

  finish(): string | null {
    return this.flush();
  }

  private flush(): string | null {
    const value = this.current.join('\n').trim();
    this.current = [];
    this.hasHeader = false;
    this.bodyStarted = false;
    this.commentDepth = 0;
    return value || null;
  }
}

function findLineBreak(value: string): { index: number; length: number } | null {
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charCodeAt(index);
    if (char === 10) return { index, length: 1 };
    if (char === 13) {
      return { index, length: value.charCodeAt(index + 1) === 10 ? 2 : 1 };
    }
  }
  return null;
}
