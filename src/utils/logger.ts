export function logInfo(message: string, meta?: unknown) {
  if (meta === undefined) {
    // eslint-disable-next-line no-console
    console.log(`[书签卡片] ${message}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[书签卡片] ${message}`, meta);
}

export function logError(message: string, error?: unknown) {
  if (error === undefined) {
    // eslint-disable-next-line no-console
    console.error(`[书签卡片] ${message}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.error(`[书签卡片] ${message}`, error);
}


