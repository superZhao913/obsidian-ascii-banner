export function createFrontmatterStub(initial: Record<string, unknown> = {}) {
  const frontmatter = structuredClone(initial);
  return {
    frontmatter,
    fileManager: {
      async processFrontMatter(_file: unknown, callback: (frontmatter: Record<string, unknown>) => void) {
        callback(frontmatter);
      },
    },
  };
}

export function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}
