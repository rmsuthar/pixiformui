// PFE1 decryptor for Java 17+ (JCA only).  NOTE: not executed in this repo's CI
// environment; run `npm run test:pfe` on a machine with Java 17+ to verify.
//
//   byte[] pt = Pfe.open(envelope, Map.of(kid, key), challenge + "|" + field);
//   try { hash(pt); } finally { java.util.Arrays.fill(pt, (byte) 0); }

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.*;
import java.security.interfaces.ECPrivateKey;
import java.security.spec.*;
import java.util.*;
import java.util.regex.*;
import javax.crypto.*;
import javax.crypto.spec.*;

public final class Pfe {
    static final byte[] INFO = "pixiform/pfe1/aes-256-gcm".getBytes(StandardCharsets.UTF_8);
    static final Pattern ENVELOPE = Pattern.compile("^pfe1\\.([A-Za-z0-9_-]{16})\\.([A-Za-z0-9_-]{87})\\.([A-Za-z0-9_-]{16})\\.([A-Za-z0-9_-]{22,1400})$");
    static final byte[] P256_SPKI_PREFIX = HexFormat.of().parseHex("3059301306072a8648ce3d020106082a8648ce3d030107034200");

    public static final class PfeException extends Exception { PfeException(String m) { super(m); } }

    public record LoadedKey(PrivateKey key, String kid) {}

    public static LoadedKey loadKey(String pem) throws Exception {
        String b64 = pem.replaceAll("-----[^-]+-----|\\s", "");
        KeyFactory kf = KeyFactory.getInstance("EC");
        ECPrivateKey priv = (ECPrivateKey) kf.generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(b64)));
        // Derive the public point to compute the key id.
        KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
        g.initialize(new ECGenParameterSpec("secp256r1"));
        java.security.spec.ECPoint w = multiply(priv);
        PublicKey pub = kf.generatePublic(new ECPublicKeySpec(w, priv.getParams()));
        byte[] spki = pub.getEncoded();
        String kid = Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(spki)).substring(0, 16);
        return new LoadedKey(priv, kid);
    }

    public static byte[] open(String envelope, Map<String, PrivateKey> keys, String context) throws PfeException {
        Matcher m = ENVELOPE.matcher(envelope == null ? "" : envelope);
        if (!m.matches()) throw new PfeException("malformed envelope");
        String kid = m.group(1), epkB64 = m.group(2), ivB64 = m.group(3), ctB64 = m.group(4);
        PrivateKey priv = keys.get(kid);
        if (priv == null) throw new PfeException("unknown key id");
        Base64.Decoder d = Base64.getUrlDecoder();
        byte[] epk = d.decode(epkB64), iv = d.decode(ivB64), ct = d.decode(ctB64);
        if (epk.length != 65 || epk[0] != 4 || iv.length != 12 || ct.length < 17) throw new PfeException("malformed envelope");
        byte[] shared;
        try {
            byte[] spki = new byte[P256_SPKI_PREFIX.length + 65];
            System.arraycopy(P256_SPKI_PREFIX, 0, spki, 0, P256_SPKI_PREFIX.length);
            System.arraycopy(epk, 0, spki, P256_SPKI_PREFIX.length, 65);
            PublicKey peer = KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(spki));
            KeyAgreement ka = KeyAgreement.getInstance("ECDH");
            ka.init(priv);
            ka.doPhase(peer, true); // the provider validates the point
            shared = ka.generateSecret();
        } catch (GeneralSecurityException e) {
            throw new PfeException("invalid ephemeral key");
        }
        byte[] key = hkdfSha256(shared, epk, INFO, 32);
        Arrays.fill(shared, (byte) 0);
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            c.updateAAD(("pfe1." + kid + "." + epkB64 + "." + ivB64 + "|" + context).getBytes(StandardCharsets.UTF_8));
            return c.doFinal(ct);
        } catch (GeneralSecurityException e) {
            throw new PfeException("decryption failed");
        } finally {
            Arrays.fill(key, (byte) 0);
        }
    }

    static byte[] hkdfSha256(byte[] ikm, byte[] salt, byte[] info, int len) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(salt, "HmacSHA256"));
            byte[] prk = mac.doFinal(ikm);
            mac.init(new SecretKeySpec(prk, "HmacSHA256"));
            byte[] out = new byte[len], t = new byte[0];
            int pos = 0;
            for (int i = 1; pos < len; i++) {
                mac.update(t);
                mac.update(info);
                mac.update((byte) i);
                t = mac.doFinal();
                int n = Math.min(t.length, len - pos);
                System.arraycopy(t, 0, out, pos, n);
                pos += n;
            }
            Arrays.fill(prk, (byte) 0);
            return out;
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Computes the public point d*G using affine double-and-add (only used for the key id). */
    static java.security.spec.ECPoint multiply(ECPrivateKey k) {
        ECParameterSpec p = k.getParams();
        java.math.BigInteger prime = ((ECFieldFp) p.getCurve().getField()).getP(), a = p.getCurve().getA();
        java.security.spec.ECPoint r = java.security.spec.ECPoint.POINT_INFINITY, q = p.getGenerator();
        java.math.BigInteger s = k.getS();
        for (int i = s.bitLength() - 1; i >= 0; i--) {
            r = add(r, r, prime, a);
            if (s.testBit(i)) r = add(r, q, prime, a);
        }
        return r;
    }

    static java.security.spec.ECPoint add(java.security.spec.ECPoint p1, java.security.spec.ECPoint p2, java.math.BigInteger m, java.math.BigInteger a) {
        if (p1.equals(java.security.spec.ECPoint.POINT_INFINITY)) return p2;
        if (p2.equals(java.security.spec.ECPoint.POINT_INFINITY)) return p1;
        java.math.BigInteger x1 = p1.getAffineX(), y1 = p1.getAffineY(), x2 = p2.getAffineX(), y2 = p2.getAffineY(), l;
        if (x1.equals(x2)) {
            if (!y1.equals(y2) || y1.signum() == 0) return java.security.spec.ECPoint.POINT_INFINITY;
            l = x1.pow(2).multiply(java.math.BigInteger.valueOf(3)).add(a).multiply(y1.shiftLeft(1).modInverse(m)).mod(m);
        } else {
            l = y2.subtract(y1).multiply(x2.subtract(x1).modInverse(m)).mod(m);
        }
        java.math.BigInteger x3 = l.pow(2).subtract(x1).subtract(x2).mod(m);
        return new java.security.spec.ECPoint(x3, l.multiply(x1.subtract(x3)).subtract(y1).mod(m));
    }

    public static void main(String[] args) throws Exception { // java Pfe.java vectors.json
        String json = Files.readString(Path.of(args[0]));
        String pem = json.replaceAll("(?s).*\"privateKeyPem\":\\s*\"(.*?)\".*", "$1").replace("\\n", "\n");
        LoadedKey k = loadKey(pem);
        Matcher v = Pattern.compile("\"name\":\\s*\"(.*?)\",\\s*\"envelope\":\\s*\"(.*?)\",\\s*\"context\":\\s*\"(.*?)\",\\s*\"expect\":\\s*(null|\"(.*?)\")").matcher(json);
        List<String> bad = new ArrayList<>();
        while (v.find()) {
            String got;
            try { got = HexFormat.of().formatHex(open(v.group(2), Map.of(k.kid(), k.key()), v.group(3))); }
            catch (PfeException e) { got = null; }
            if (!Objects.equals(got, v.group(5))) bad.add(v.group(1));
        }
        System.out.println(bad.isEmpty() ? "PASS" : "FAIL " + String.join(",", bad));
    }
}
