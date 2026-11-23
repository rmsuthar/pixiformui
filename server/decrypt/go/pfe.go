// PFE1 decryptor for Go 1.24+ (standard library only).
//
//	plaintext, err := OpenEnvelope(envelope, priv, challenge+"|"+field)
//	defer clear(plaintext)
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/hkdf"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"regexp"
)

const pfeInfo = "pixiform/pfe1/aes-256-gcm"

var envelopeRe = regexp.MustCompile(`^pfe1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{87})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22,})$`) // RE2 caps repeats at 1000; max length checked below

var ErrPfe = errors.New("pfe: cannot open envelope")

// LoadKey parses a PKCS#8 PEM P-256 key and returns it with its key id.
func LoadKey(pemText string) (*ecdh.PrivateKey, string, error) {
	block, _ := pem.Decode([]byte(pemText))
	if block == nil {
		return nil, "", errors.New("pfe: bad PEM")
	}
	k, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, "", err
	}
	ek, ok := k.(*ecdsa.PrivateKey)
	if !ok {
		return nil, "", errors.New("pfe: not an EC key")
	}
	priv, err := ek.ECDH()
	if err != nil || priv.Curve() != ecdh.P256() {
		return nil, "", errors.New("pfe: key must be P-256")
	}
	spki, err := x509.MarshalPKIXPublicKey(&ek.PublicKey)
	if err != nil {
		return nil, "", err
	}
	sum := sha256.Sum256(spki)
	return priv, base64.RawURLEncoding.EncodeToString(sum[:])[:16], nil
}

// OpenEnvelope decrypts a PFE1 envelope. keys maps key id -> private key.
func OpenEnvelope(envelope string, keys map[string]*ecdh.PrivateKey, context string) ([]byte, error) {
	m := envelopeRe.FindStringSubmatch(envelope)
	if m == nil || len(m[4]) > 1400 {
		return nil, ErrPfe
	}
	kid, epkB64, ivB64, ctB64 := m[1], m[2], m[3], m[4]
	priv, ok := keys[kid]
	if !ok {
		return nil, ErrPfe
	}
	b64 := base64.RawURLEncoding
	epk, e1 := b64.DecodeString(epkB64)
	iv, e2 := b64.DecodeString(ivB64)
	ct, e3 := b64.DecodeString(ctB64)
	if e1 != nil || e2 != nil || e3 != nil || len(epk) != 65 || len(iv) != 12 || len(ct) < 17 {
		return nil, ErrPfe
	}
	peer, err := ecdh.P256().NewPublicKey(epk) // validates the point
	if err != nil {
		return nil, ErrPfe
	}
	shared, err := priv.ECDH(peer)
	if err != nil {
		return nil, ErrPfe
	}
	defer clear(shared)
	key, err := hkdf.Key(sha256.New, shared, epk, pfeInfo, 32)
	if err != nil {
		return nil, ErrPfe
	}
	defer clear(key)
	block, _ := aes.NewCipher(key)
	gcm, _ := cipher.NewGCM(block)
	aad := []byte("pfe1." + kid + "." + epkB64 + "." + ivB64 + "|" + context)
	pt, err := gcm.Open(nil, iv, ct, aad)
	if err != nil {
		return nil, ErrPfe
	}
	return pt, nil
}
