export type AuthProviderLabel = 'Google' | 'Apple';

interface SafeAuthErrorOptions {
  providerLabel?: AuthProviderLabel;
}

interface AuthErrorShape {
  code?: unknown;
  message?: unknown;
}

const PASSWORD_ERROR_BY_CODE: Readonly<Record<string, string>> = {
  invalid_credentials: 'Invalid email or password. Please try again.',
  email_not_confirmed: 'Your email address is not confirmed. Contact your administrator.',
  over_email_send_rate_limit: 'Too many sign-in attempts. Wait a few minutes, then try again.',
  over_request_rate_limit: 'Too many sign-in attempts. Wait a few minutes, then try again.',
};

const PASSWORD_ERROR_BY_MESSAGE: Readonly<Record<string, string>> = {
  'authentication is not configured.': 'Sign-in is not available for this deployment. Contact your administrator.',
  'email not confirmed': 'Your email address is not confirmed. Contact your administrator.',
  'invalid login credentials': 'Invalid email or password. Please try again.',
  'too many requests': 'Too many sign-in attempts. Wait a few minutes, then try again.',
};

function readAuthError(error: unknown): { code: string; message: string } {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) {
    return { code: '', message: '' };
  }

  const candidate = error as AuthErrorShape;
  return {
    code: typeof candidate.code === 'string' ? candidate.code.trim().toLowerCase() : '',
    message: typeof candidate.message === 'string' ? candidate.message.trim().toLowerCase() : '',
  };
}

/**
 * Convert provider errors to an explicit allowlist of safe copy. Unknown
 * upstream messages can contain account identifiers, tenant details, or
 * diagnostics and must never be rendered to the user.
 */
export function getSafeAuthErrorMessage(
  error: unknown,
  options: SafeAuthErrorOptions = {},
): string {
  const { code, message } = readAuthError(error);

  if (!options.providerLabel) {
    const approvedMessage = PASSWORD_ERROR_BY_CODE[code] ?? PASSWORD_ERROR_BY_MESSAGE[message];
    if (approvedMessage) return approvedMessage;
  }

  if (options.providerLabel) {
    return `Could not sign in with ${options.providerLabel}. Please try again or contact your administrator.`;
  }

  return 'Could not sign in. Please try again or contact your administrator.';
}
