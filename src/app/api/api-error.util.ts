export function extractApiErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as {
    error?: unknown;
    status?: number;
    message?: string;
  };

  if (typeof candidate?.error === 'string' && candidate.error.trim()) {
    return candidate.error.trim();
  }

  if (candidate?.error && typeof candidate.error === 'object') {
    const errorObject = candidate.error as {
      title?: string;
      detail?: string;
      message?: string;
      errors?: Record<string, string[]>;
    };

    if (typeof errorObject.detail === 'string' && errorObject.detail.trim()) {
      return errorObject.detail.trim();
    }

    if (typeof errorObject.title === 'string' && errorObject.title.trim()) {
      return errorObject.title.trim();
    }

    if (typeof errorObject.message === 'string' && errorObject.message.trim()) {
      return errorObject.message.trim();
    }

    const firstValidationMessage = Object.values(errorObject.errors ?? {})
      .flat()
      .find((item) => typeof item === 'string' && item.trim());

    if (firstValidationMessage) {
      return firstValidationMessage.trim();
    }
  }

  if (typeof candidate?.message === 'string' && candidate.message.trim()) {
    return candidate.message.trim();
  }

  return fallback;
}
