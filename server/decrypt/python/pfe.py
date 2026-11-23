"""PFE1 decryptor for Python 3.9+.  pip install cryptography

    from pfe import open_envelope
    plaintext = open_envelope(envelope, private_key_pem, f"{challenge}|{field}")
    try:
        hash_password(plaintext)
    finally:
        plaintext[:] = b"\\0" * len(plaintext)   # returned as a bytearray so it can be wiped
"""
import base64
import re

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

INFO = b"pixiform/pfe1/aes-256-gcm"
_ENVELOPE = re.compile(r"^pfe1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{87})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22,1400})$")


class PfeError(Exception):
    pass


def _b64u(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def key_id(private_key) -> str:
    spki = private_key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    digest = hashes.Hash(hashes.SHA256())
    digest.update(spki)
    return base64.urlsafe_b64encode(digest.finalize()).decode().rstrip("=")[:16]


def open_envelope(envelope: str, private_key_pem: str, context: str, keys_by_kid=None) -> bytearray:
    m = _ENVELOPE.match(envelope or "")
    if not m:
        raise PfeError("malformed envelope")
    kid, epk_b64, iv_b64, ct_b64 = m.groups()
    if keys_by_kid is None:
        priv = serialization.load_pem_private_key(private_key_pem.encode(), password=None)
        keys_by_kid = {key_id(priv): priv}
    priv = keys_by_kid.get(kid)
    if priv is None or not isinstance(priv.curve, ec.SECP256R1):
        raise PfeError("unknown key id")
    epk, iv, ct = _b64u(epk_b64), _b64u(iv_b64), _b64u(ct_b64)
    if len(epk) != 65 or epk[0] != 4 or len(iv) != 12 or len(ct) < 17:
        raise PfeError("malformed envelope")
    try:
        peer = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), epk)  # validates the point
        shared = priv.exchange(ec.ECDH(), peer)
    except ValueError as e:
        raise PfeError("invalid ephemeral key") from e
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=epk, info=INFO).derive(shared)
    aad = f"pfe1.{kid}.{epk_b64}.{iv_b64}|{context}".encode()
    try:
        return bytearray(AESGCM(key).decrypt(iv, ct, aad))
    except Exception as e:
        raise PfeError("decryption failed") from e


if __name__ == "__main__":  # conformance test: python3 pfe.py vectors.json
    import json, sys

    data = json.load(open(sys.argv[1]))
    bad = []
    for v in data["vectors"]:
        try:
            got = open_envelope(v["envelope"], data["privateKeyPem"], v["context"]).hex()
        except PfeError:
            got = None
        if got != v["expect"]:
            bad.append(v["name"])
    print("FAIL " + ",".join(bad) if bad else "PASS")
