import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createVapidAuthorizationHeader,
  encryptWebPushPayload,
  generateVapidKeyPair,
  validatePushEndpoint,
} from "./web-push";

describe("web-push RFC 8291 & RFC 8292 utilities", () => {
  it("generates a valid P-256 VAPID keypair and signs a verifiable ES256 JWT", () => {
    const vapid = generateVapidKeyPair();
    const pubBytes = Buffer.from(vapid.publicKey, "base64url");
    expect(pubBytes.length).toBe(65);
    expect(pubBytes[0]).toBe(0x04);

    const endpoint = validatePushEndpoint(
      "https://fcm.googleapis.com/fcm/send/example-token",
    );
    const authHeader = createVapidAuthorizationHeader(
      endpoint,
      vapid,
      "mailto:support@felixwise.io.vn",
      1700000000,
    );

    expect(authHeader.startsWith("vapid t=")).toBe(true);
    expect(authHeader.endsWith(`, k=${vapid.publicKey}`)).toBe(true);

    const jwt = authHeader.slice("vapid t=".length).split(", k=")[0]!;
    const [headerB64, payloadB64, sigB64] = jwt.split(".");
    expect(headerB64).toBeTruthy();
    expect(payloadB64).toBeTruthy();
    expect(sigB64).toBeTruthy();

    const publicKey = crypto.createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: vapid.privateKeyJwk.x,
        y: vapid.privateKeyJwk.y,
      },
      format: "jwk",
    });

    const verified = crypto.verify(
      "sha256",
      Buffer.from(`${headerB64}.${payloadB64}`, "utf8"),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(sigB64!, "base64url"),
    );
    expect(verified).toBe(true);
  });

  it("blocks non-HTTPS, localhost, and untrusted SSRF push endpoints", () => {
    expect(() =>
      validatePushEndpoint("http://fcm.googleapis.com/fcm/send/token"),
    ).toThrow();
    expect(() =>
      validatePushEndpoint("https://localhost:3000/internal"),
    ).toThrow();
    expect(() =>
      validatePushEndpoint("https://127.0.0.1/internal"),
    ).toThrow();
    expect(() =>
      validatePushEndpoint("https://evil.example.com/push"),
    ).toThrow();

    expect(
      validatePushEndpoint("https://web.push.apple.com/Q12345").hostname,
    ).toBe("web.push.apple.com");
  });

  it("encrypts payload using RFC 8291 aes128gcm that the user agent can decrypt", () => {
    const uaEcdh = crypto.createECDH("prime256v1");
    const uaPublicKey = uaEcdh.generateKeys();
    const authSecret = crypto.randomBytes(16);

    const plaintext = JSON.stringify({
      title: "Felix nhắc ghi chi tiêu",
      body: "Hôm nay bạn đã ghi chi tiêu chưa?",
      url: "/overview?action=new-transaction",
    });

    const body = encryptWebPushPayload(
      plaintext,
      uaPublicKey.toString("base64url"),
      authSecret.toString("base64url"),
    );

    const salt = body.subarray(0, 16);
    const rs = body.readUInt32BE(16);
    const idlen = body.readUInt8(20);
    const asPublicKey = body.subarray(21, 21 + idlen);
    const ciphertextWithTag = body.subarray(21 + idlen);

    expect(rs).toBe(4096);
    expect(idlen).toBe(65);

    const sharedSecret = uaEcdh.computeSecret(asPublicKey);
    const keyInfo = Buffer.concat([
      Buffer.from("WebPush: info\0", "ascii"),
      uaPublicKey,
      asPublicKey,
    ]);
    const ikm = Buffer.from(
      crypto.hkdfSync("sha256", sharedSecret, authSecret, keyInfo, 32),
    );
    const cek = Buffer.from(
      crypto.hkdfSync(
        "sha256",
        ikm,
        salt,
        Buffer.from("Content-Encoding: aes128gcm\0", "ascii"),
        16,
      ),
    );
    const nonce = Buffer.from(
      crypto.hkdfSync(
        "sha256",
        ikm,
        salt,
        Buffer.from("Content-Encoding: nonce\0", "ascii"),
        12,
      ),
    );

    const ciphertext = ciphertextWithTag.subarray(
      0,
      ciphertextWithTag.length - 16,
    );
    const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
    const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    expect(decrypted[decrypted.length - 1]).toBe(0x02);
    expect(decrypted.subarray(0, decrypted.length - 1).toString("utf8")).toBe(
      plaintext,
    );
  });
});
