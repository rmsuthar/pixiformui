// PFE1 decryptor for .NET 8+ (System.Security.Cryptography only).
//
//   byte[] pt = Pfe.Open(envelope, keysByKid, $"{challenge}|{field}");
//   try { Hash(pt); } finally { CryptographicOperations.ZeroMemory(pt); }
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

public static class Pfe
{
    const string Info = "pixiform/pfe1/aes-256-gcm";
    static readonly Regex Envelope = new(@"^pfe1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{87})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22,1400})$");

    public class PfeException : Exception { public PfeException(string m) : base(m) { } }

    public static (ECDiffieHellman key, string kid) LoadKey(string pem)
    {
        var key = ECDiffieHellman.Create();
        key.ImportFromPem(pem);
        if (key.ExportParameters(false).Curve.Oid.Value != ECCurve.NamedCurves.nistP256.Oid.Value)
            throw new PfeException("key must be P-256");
        var kid = B64uEncode(SHA256.HashData(key.ExportSubjectPublicKeyInfo()))[..16];
        return (key, kid);
    }

    public static byte[] Open(string envelope, IReadOnlyDictionary<string, ECDiffieHellman> keys, string context)
    {
        var m = Envelope.Match(envelope ?? "");
        if (!m.Success) throw new PfeException("malformed envelope");
        string kid = m.Groups[1].Value, epkB64 = m.Groups[2].Value, ivB64 = m.Groups[3].Value, ctB64 = m.Groups[4].Value;
        if (!keys.TryGetValue(kid, out var priv)) throw new PfeException("unknown key id");
        byte[] epk = B64uDecode(epkB64), iv = B64uDecode(ivB64), ct = B64uDecode(ctB64);
        if (epk.Length != 65 || epk[0] != 4 || iv.Length != 12 || ct.Length < 17) throw new PfeException("malformed envelope");

        byte[] shared;
        try
        {
            using var peer = ECDiffieHellman.Create(new ECParameters
            {
                Curve = ECCurve.NamedCurves.nistP256,
                Q = new ECPoint { X = epk[1..33], Y = epk[33..65] },
            }); // the platform validates the point
            shared = priv.DeriveRawSecretAgreement(peer.PublicKey);
        }
        catch (CryptographicException) { throw new PfeException("invalid ephemeral key"); }

        var key = HKDF.DeriveKey(HashAlgorithmName.SHA256, shared, 32, epk, Encoding.UTF8.GetBytes(Info));
        CryptographicOperations.ZeroMemory(shared);
        var aad = Encoding.UTF8.GetBytes($"pfe1.{kid}.{epkB64}.{ivB64}|{context}");
        var pt = new byte[ct.Length - 16];
        try
        {
            using var gcm = new AesGcm(key, 16);
            gcm.Decrypt(iv, ct.AsSpan(0, ct.Length - 16), ct.AsSpan(ct.Length - 16), pt, aad);
            return pt;
        }
        catch (CryptographicException) { throw new PfeException("decryption failed"); }
        finally { CryptographicOperations.ZeroMemory(key); }
    }

    static string B64uEncode(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    static byte[] B64uDecode(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
    }
}
