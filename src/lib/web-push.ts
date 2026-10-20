import crypto, { type JsonWebKey } from "node:crypto";

export type VapidKeyPair = {
  publicKey: string;
  privateKeyJwk: JsonWebKey;
};

export type PushSubscriptionTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushNotificationPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

const ALLOWED_PUSH_HOST_SUFFIXES = [
  ".googleapis.com",
  ".google.com",
  ".push.services.mozilla.com",
  ".mozilla.com",
  ".push.apple.com",
  ".notify.windows.com",
  ".wns.windows.com",
  ".samsungosp.com",
  ".dbankcloud.cn",
] as const;

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function fromBase64Flexible(input: string): Buffer {
  const normalized = input.trim().replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padLength), "base64");
}

export function generateVapidKeyPair(): VapidKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const pubJwk = publicKey.export({ format: "jwk" });
  const privJwk = privateKey.export({ format: "jwk" });

  if (!pubJwk.x || !pubJwk.y) {
    throw new Error("Không thể khởi tạo khóa VAPID.");
  }

  const uncompressedPub = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(pubJwk.x, "base64url"),
    Buffer.from(pubJwk.y, "base64url"),
  ]);

  return {
    publicKey: toBase64Url(uncompressedPub),
    privateKeyJwk: privJwk,
  };
}

export function validatePushEndpoint(endpoint: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("Địa chỉ nhận thông báo đẩy không hợp lệ.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Địa chỉ nhận thông báo đẩy bắt buộc dùng giao thức HTTPS.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Địa chỉ nhận thông báo đẩy không được chứa thông tin xác thực.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Địa chỉ máy chủ thông báo đẩy không được phép.");
  }

  const isAllowedDomain = ALLOWED_PUSH_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix),
  );
  if (!isAllowedDomain) {
    throw new Error("Nhà cung cấp dịch vụ thông báo đẩy không nằm trong danh sách hỗ trợ.");
  }

  return parsed;
}

export function createVapidAuthorizationHeader(
  endpointUrl: URL,
  vapid: VapidKeyPair,
  subject = "mailto:support@felixwise.io.vn",
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: nowSeconds + 12 * 60 * 60,
    sub: subject,
  };

  const encodedHeader = toBase64Url(Buffer.from(JSON.stringify(header), "utf8"));
  const encodedPayload = toBase64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = crypto.createPrivateKey({
    key: vapid.privateKeyJwk,
    format: "jwk",
  });

  const signature = crypto.sign("sha256", Buffer.from(signingInput, "utf8"), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });

  const jwt = `${signingInput}.${toBase64Url(signature)}`;
  return `vapid t=${jwt}, k=${vapid.publicKey}`;
}

export function encryptWebPushPayload(
  payloadText: string,
  p256dhBase64: string,
  authBase64: string,
): Buffer {
  const uaPublicKey = fromBase64Flexible(p256dhBase64);
  const authSecret = fromBase64Flexible(authBase64);

  if (uaPublicKey.length !== 65 || uaPublicKey[0] !== 0x04) {
    throw new Error("Khóa công khai thiết bị (p256dh) không hợp lệ.");
  }
  if (authSecret.length < 16) {
    throw new Error("Mã xác thực thiết bị (auth) không hợp lệ.");
  }

  const ecdh = crypto.createECDH("prime256v1");
  const asPublicKey = ecdh.generateKeys();
  const sharedSecret = ecdh.computeSecret(uaPublicKey);
  const salt = crypto.randomBytes(16);

  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "ascii"),
    uaPublicKey,
    asPublicKey,
  ]);
  const ikm = Buffer.from(
    crypto.hkdfSync("sha256", sharedSecret, authSecret, keyInfo, 32),
  );

  const cekInfo = Buffer.from("Content-Encoding: aes128gcm\0", "ascii");
  const nonceInfo = Buffer.from("Content-Encoding: nonce\0", "ascii");
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, cekInfo, 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, nonceInfo, 12));

  const paddedPlaintext = Buffer.concat([
    Buffer.from(payloadText, "utf8"),
    Buffer.from([0x02]),
  ]);

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([
    cipher.update(paddedPlaintext),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  const header = Buffer.alloc(21 + asPublicKey.length);
  salt.copy(header, 0, 0, 16);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublicKey.length, 20);
  asPublicKey.copy(header, 21);

  return Buffer.concat([header, encrypted]);
}

export async function sendWebPushMessage(
  subscription: PushSubscriptionTarget,
  payload: PushNotificationPayload,
  vapid: VapidKeyPair,
): Promise<{ ok: boolean; status: number; expired: boolean }> {
  const endpointUrl = validatePushEndpoint(subscription.endpoint);
  const bodyBuffer = encryptWebPushPayload(
    JSON.stringify(payload),
    subscription.p256dh,
    subscription.auth,
  );
  const authorization = createVapidAuthorizationHeader(
    endpointUrl,
    vapid,
    process.env.VAPID_SUBJECT || "mailto:support@felixwise.io.vn",
  );

  const response = await fetch(endpointUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "Content-Length": String(bodyBuffer.length),
      TTL: "86400",
      Urgency: "high",
    },
    body: new Uint8Array(bodyBuffer),
  });

  const expired = response.status === 404 || response.status === 410;
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    expired,
  };
}
