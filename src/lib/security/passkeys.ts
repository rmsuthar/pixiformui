/**
 * Passkeys (WebAuthn) for PixiFormUI apps: thin, dependency-free helpers that convert
 * between your server's JSON and the browser's binary WebAuthn API.
 *
 *   const { options } = await (await secureSubmit('/api/passkey/register/options', { username })).json();
 *   const credential = await createPasskey(options);           // prompts Face ID / fingerprint / PIN
 *   await secureSubmit('/api/passkey/register/verify', { credential });
 *
 *   const { options } = await (await secureSubmit('/api/passkey/login/options', {})).json();
 *   const credential = await getPasskey(options);              // or { mediation: 'conditional' }
 *   await secureSubmit('/api/passkey/login/verify', { credential });
 *
 * Passkey suggestions in a username field: give the field autocomplete: 'username webauthn' and
 * start getPasskey(options, { mediation: 'conditional', signal }) when the page loads.
 * The server must verify everything (see server/webauthn.ts for a reference implementation).
 */
import { b64uDecode, b64uEncode } from './envelope';

type B64u = string;

/** PublicKeyCredentialCreationOptions with binary fields as base64url (the JSON servers send). */
export interface PasskeyCreationOptionsJSON {
  challenge: B64u;
  rp: { id?: string; name: string };
  user: { id: B64u; name: string; displayName: string };
  pubKeyCredParams: { type: 'public-key'; alg: number }[];
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  excludeCredentials?: { type: 'public-key'; id: B64u; transports?: string[] }[];
}

/** PublicKeyCredentialRequestOptions with binary fields as base64url. */
export interface PasskeyRequestOptionsJSON {
  challenge: B64u;
  rpId?: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: { type: 'public-key'; id: B64u; transports?: string[] }[];
}

/** What to POST back to the server after createPasskey(). */
export interface PasskeyRegistrationJSON {
  id: B64u;
  rawId: B64u;
  type: 'public-key';
  authenticatorAttachment: string | null;
  response: { clientDataJSON: B64u; attestationObject: B64u; transports: string[] };
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
}

/** What to POST back to the server after getPasskey(). */
export interface PasskeyAuthenticationJSON {
  id: B64u;
  rawId: B64u;
  type: 'public-key';
  authenticatorAttachment: string | null;
  response: { clientDataJSON: B64u; authenticatorData: B64u; signature: B64u; userHandle: B64u | null };
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
}

const bytes = (buf: ArrayBuffer | null): B64u | null => (buf ? b64uEncode(new Uint8Array(buf)) : null);
const descriptors = (list?: { type: 'public-key'; id: B64u; transports?: string[] }[]) =>
  list?.map((c) => ({ type: c.type, id: b64uDecode(c.id), transports: c.transports as AuthenticatorTransport[] | undefined }));

/** True when the browser supports passkeys (WebAuthn). */
export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function' && !!navigator.credentials;
}

/** True when the browser can offer passkeys inside a field's autofill suggestions (conditional UI). */
export async function passkeyAutofillAvailable(): Promise<boolean> {
  if (!passkeysSupported()) return false;
  const PKC = window.PublicKeyCredential as typeof PublicKeyCredential & { isConditionalMediationAvailable?: () => Promise<boolean> };
  try {
    return (await PKC.isConditionalMediationAvailable?.()) ?? false;
  } catch {
    return false;
  }
}

/** Creates a passkey (registration). Prompts the user; throws DOMException on cancel/timeout. */
export async function createPasskey(options: PasskeyCreationOptionsJSON, signal?: AbortSignal): Promise<PasskeyRegistrationJSON> {
  if (!passkeysSupported()) throw new Error('Passkeys are not supported in this browser.');
  const cred = (await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: b64uDecode(options.challenge),
      user: { ...options.user, id: b64uDecode(options.user.id) },
      excludeCredentials: descriptors(options.excludeCredentials),
    },
    signal,
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('No passkey was created.');
  const r = cred.response as AuthenticatorAttestationResponse;
  return {
    id: cred.id,
    rawId: bytes(cred.rawId)!,
    type: 'public-key',
    authenticatorAttachment: cred.authenticatorAttachment ?? null,
    response: {
      clientDataJSON: bytes(r.clientDataJSON)!,
      attestationObject: bytes(r.attestationObject)!,
      transports: typeof r.getTransports === 'function' ? r.getTransports() : [],
    },
    clientExtensionResults: cred.getClientExtensionResults(),
  };
}

/**
 * Signs in with a passkey. With `mediation: 'conditional'` the browser waits and offers passkeys
 * in the suggestions of a field whose autocomplete includes "webauthn" (abort it with `signal`
 * before starting a modal request).
 */
export async function getPasskey(
  options: PasskeyRequestOptionsJSON,
  opts: { mediation?: CredentialMediationRequirement; signal?: AbortSignal } = {},
): Promise<PasskeyAuthenticationJSON> {
  if (!passkeysSupported()) throw new Error('Passkeys are not supported in this browser.');
  const cred = (await navigator.credentials.get({
    publicKey: { ...options, challenge: b64uDecode(options.challenge), allowCredentials: descriptors(options.allowCredentials) },
    mediation: opts.mediation,
    signal: opts.signal,
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('No passkey was selected.');
  const r = cred.response as AuthenticatorAssertionResponse;
  return {
    id: cred.id,
    rawId: bytes(cred.rawId)!,
    type: 'public-key',
    authenticatorAttachment: cred.authenticatorAttachment ?? null,
    response: {
      clientDataJSON: bytes(r.clientDataJSON)!,
      authenticatorData: bytes(r.authenticatorData)!,
      signature: bytes(r.signature)!,
      userHandle: bytes(r.userHandle),
    },
    clientExtensionResults: cred.getClientExtensionResults(),
  };
}

/** A short, user-facing message for WebAuthn errors (cancelled, timed out, not allowed…). */
export function passkeyErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'NotAllowedError') return 'The passkey request was cancelled or timed out.';
  if (name === 'InvalidStateError') return 'This device already has a passkey for this account.';
  if (name === 'SecurityError') return 'Passkeys need a secure (HTTPS) page on the right domain.';
  if (name === 'AbortError') return 'The passkey request was replaced by another one.';
  return (err as Error)?.message || 'Passkey request failed.';
}
