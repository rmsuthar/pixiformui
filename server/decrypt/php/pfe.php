<?php
/**
 * PFE1 decryptor for PHP 8.1+ (ext-openssl).  NOTE: not executed in this repo's CI
 * environment; run `npm run test:pfe` on a machine with PHP to verify.
 *
 *   $pt = pfe_open_envelope($envelope, [$kid => $key], "$challenge|$field");
 *   try { hash_password($pt); } finally { sodium_memzero($pt); }   // or overwrite
 */
declare(strict_types=1);

const PFE_INFO = 'pixiform/pfe1/aes-256-gcm';
const PFE_ENVELOPE = '/^pfe1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{87})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22,1400})$/D';
const PFE_P256_SPKI_PREFIX = '3059301306072a8648ce3d020106082a8648ce3d030107034200';

final class PfeException extends RuntimeException {}

function pfe_b64u_decode(string $s): string {
    $d = base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true);
    if ($d === false) throw new PfeException('malformed envelope');
    return $d;
}

/** @return array{0: OpenSSLAsymmetricKey, 1: string} key and key id */
function pfe_load_key(string $pem): array {
    $key = openssl_pkey_get_private($pem);
    if ($key === false) throw new PfeException('bad key');
    $d = openssl_pkey_get_details($key);
    if (($d['ec']['curve_name'] ?? '') !== 'prime256v1') throw new PfeException('key must be P-256');
    $spkiDer = pfe_b64u_decode(strtr(preg_replace('/-----[^-]+-----|\s/', '', $d['key']), '+/', '-_'));
    $kid = substr(rtrim(strtr(base64_encode(hash('sha256', $spkiDer, true)), '+/', '-_'), '='), 0, 16);
    return [$key, $kid];
}

/** @param array<string, OpenSSLAsymmetricKey> $keys */
function pfe_open_envelope(string $envelope, array $keys, string $context): string {
    if (!preg_match(PFE_ENVELOPE, $envelope, $m)) throw new PfeException('malformed envelope');
    [, $kid, $epkB64, $ivB64, $ctB64] = $m;
    $priv = $keys[$kid] ?? throw new PfeException('unknown key id');
    $epk = pfe_b64u_decode($epkB64);
    $iv = pfe_b64u_decode($ivB64);
    $ct = pfe_b64u_decode($ctB64);
    if (strlen($epk) !== 65 || $epk[0] !== "\x04" || strlen($iv) !== 12 || strlen($ct) < 17) throw new PfeException('malformed envelope');

    $spki = hex2bin(PFE_P256_SPKI_PREFIX) . $epk;
    $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
    $peer = openssl_pkey_get_public($pem); // OpenSSL validates the point
    if ($peer === false) throw new PfeException('invalid ephemeral key');
    $shared = openssl_pkey_derive($peer, $priv, 32);
    if ($shared === false) throw new PfeException('invalid ephemeral key');

    $key = hash_hkdf('sha256', $shared, 32, PFE_INFO, $epk);
    $aad = "pfe1.$kid.$epkB64.$ivB64|$context";
    $pt = openssl_decrypt(substr($ct, 0, -16), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, substr($ct, -16), $aad);
    if ($pt === false) throw new PfeException('decryption failed');
    return $pt;
}

if (PHP_SAPI === 'cli' && realpath($argv[0] ?? '') === __FILE__) { // php pfe.php vectors.json
    $data = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
    [$key, $kid] = pfe_load_key($data['privateKeyPem']);
    $bad = [];
    foreach ($data['vectors'] as $v) {
        try { $got = bin2hex(pfe_open_envelope($v['envelope'], [$kid => $key], $v['context'])); }
        catch (PfeException) { $got = null; }
        if ($got !== $v['expect']) $bad[] = $v['name'];
    }
    echo $bad ? 'FAIL ' . implode(',', $bad) . "\n" : "PASS\n";
}
