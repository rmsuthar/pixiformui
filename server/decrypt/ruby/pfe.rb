# PFE1 decryptor for Ruby 3+ (openssl gem 3+, OpenSSL 1.1.1+).
#
#   pt = Pfe.open_envelope(envelope, { kid => key }, "#{challenge}|#{field}")
#   begin; hash_password(pt); ensure; pt.replace("\0" * pt.bytesize); end
require "openssl"
require "base64"

module Pfe
  INFO = "pixiform/pfe1/aes-256-gcm"
  ENVELOPE = /\Apfe1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{87})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22,1400})\z/
  P256_SPKI_PREFIX = ["3059301306072a8648ce3d020106082a8648ce3d030107034200"].pack("H*")

  class Error < StandardError; end

  def self.load_key(pem)
    key = OpenSSL::PKey.read(pem)
    raise Error, "key must be P-256" unless key.is_a?(OpenSSL::PKey::EC) && key.group.curve_name == "prime256v1"
    kid = Base64.urlsafe_encode64(OpenSSL::Digest::SHA256.digest(key.public_to_der), padding: false)[0, 16]
    [key, kid]
  end

  def self.open_envelope(envelope, keys, context)
    m = ENVELOPE.match(envelope.to_s) or raise Error, "malformed envelope"
    kid, epk_b64, iv_b64, ct_b64 = m.captures
    priv = keys[kid] or raise Error, "unknown key id"
    epk = Base64.urlsafe_decode64(epk_b64)
    iv = Base64.urlsafe_decode64(iv_b64)
    ct = Base64.urlsafe_decode64(ct_b64)
    raise Error, "malformed envelope" unless epk.bytesize == 65 && epk.getbyte(0) == 4 && iv.bytesize == 12 && ct.bytesize >= 17
    begin
      peer = OpenSSL::PKey.read(P256_SPKI_PREFIX + epk) # rejects points not on the curve
      shared = priv.derive(peer)
    rescue OpenSSL::PKey::PKeyError, OpenSSL::PKey::ECError
      raise Error, "invalid ephemeral key"
    end
    key = OpenSSL::KDF.hkdf(shared, salt: epk, info: INFO, length: 32, hash: "SHA256")
    shared.replace("\0" * shared.bytesize)
    c = OpenSSL::Cipher.new("aes-256-gcm").decrypt
    c.key = key
    c.iv = iv
    c.auth_tag = ct.byteslice(-16, 16)
    c.auth_data = "pfe1.#{kid}.#{epk_b64}.#{iv_b64}|#{context}"
    c.update(ct.byteslice(0, ct.bytesize - 16)) + c.final
  rescue OpenSSL::Cipher::CipherError
    raise Error, "decryption failed"
  ensure
    key&.replace("\0" * key.bytesize)
  end
end

if __FILE__ == $PROGRAM_NAME # conformance test: ruby pfe.rb vectors.json
  require "json"
  data = JSON.parse(File.read(ARGV[0]))
  key, kid = Pfe.load_key(data["privateKeyPem"])
  bad = data["vectors"].reject do |v|
    got = begin
      Pfe.open_envelope(v["envelope"], { kid => key }, v["context"]).unpack1("H*")
    rescue Pfe::Error
      nil
    end
    got == v["expect"]
  end
  puts bad.empty? ? "PASS" : "FAIL #{bad.map { |v| v['name'] }.join(',')}"
end
