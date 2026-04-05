import { loadAppConfig } from '../../config/appConfig';

interface VerificationEmailPayload {
  userId: string;
  email: string;
  verificationCode: string;
  locale?: string;
  requestId?: string;
}

const TEMPLATE_KEY = 'auth.email.verification';
const SERVICE_HEADER_VALUE = 'auth-service';

type FetchFunction = (input: string, init?: Record<string, unknown>) => Promise<any>;

function getFetchImplementation(): FetchFunction {
  const candidate = (globalThis as { fetch?: FetchFunction }).fetch;

  if (!candidate) {
    throw new Error('Fetch API is not available in the current runtime. Provide a compatible polyfill or upgrade Node.js.');
  }

  return candidate;
}

function buildEndpoint(baseUrl: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}internal/emails/send`;
}

export async function sendVerificationEmail(payload: VerificationEmailPayload): Promise<void> {
  const config = loadAppConfig();
  const fetchImpl = getFetchImplementation();
  const endpoint = buildEndpoint(config.notificationService.baseUrl);
  const locale = payload.locale ?? config.notificationService.defaultLocale;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-service-name': SERVICE_HEADER_VALUE,
  };

  if (payload.requestId) {
    headers['x-request-id'] = payload.requestId;
  }

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      templateKey: TEMPLATE_KEY,
      to: payload.email,
      locale,
      variables: {
        verificationCode: payload.verificationCode,
        userId: payload.userId,
      },
    }),
  });

  if (response?.ok) {
    return;
  }

  const status = typeof response?.status === 'number' ? response.status : 'unknown';
  let responseBody: string | undefined;

  try {
    if (typeof response?.text === 'function') {
      responseBody = await response.text();
    }
  } catch (error) {
    responseBody = undefined;
  }

  const details = responseBody ? ` Response body: ${responseBody}` : '';
  throw new Error(`Notification service responded with status ${status}.${details}`);
}
