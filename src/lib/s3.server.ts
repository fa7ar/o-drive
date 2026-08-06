/**
 * AWS SigV4 signer + S3-compatible operations (Amazon S3, Cloudflare R2).
 * Pure WebCrypto so it runs in the worker runtime with no SDK.
 */

const encoder = new TextEncoder();

const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

async function sha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? encoder.encode(data) : data;
  return hex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

async function hmac(
  key: Uint8Array<ArrayBufferLike>,
  data: string,
): Promise<Uint8Array<ArrayBufferLike>> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data)));
}

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function resolveS3Config(bundle: Record<string, string>, providerId: string): S3Config {
  const region = bundle["region"] || (providerId === "r2" ? "auto" : "us-east-1");
  const bucket = bundle["bucket"] ?? "";
  const endpoint =
    bundle["endpoint"] ||
    (providerId === "r2"
      ? `https://${bundle["accountId"] ?? "account"}.r2.cloudflarestorage.com`
      : `https://s3.${region}.amazonaws.com`);
  return {
    endpoint: endpoint.replace(/\/$/, ""),
    region,
    bucket,
    accessKeyId: bundle["accessKeyId"] ?? "",
    secretAccessKey: bundle["secretAccessKey"] ?? "",
  };
}

const encodeKey = (key: string) =>
  key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export async function s3Fetch(
  config: S3Config,
  input: {
    method: "GET" | "PUT" | "DELETE" | "HEAD";
    key?: string;
    query?: Record<string, string>;
    body?: Uint8Array;
    contentType?: string;
  },
): Promise<Response> {
  const url = new URL(`${config.endpoint}/${config.bucket}${input.key ? `/${encodeKey(input.key)}` : ""}`);
  const query = Object.entries(input.query ?? {}).sort(([a], [b]) => (a < b ? -1 : 1));
  for (const [key, value] of query) url.searchParams.set(key, value);

  const now = new Date();
  const amzDate = `${now.toISOString().replace(/[:-]|\.\d{3}/g, "")}`;
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256(input.body ?? "");

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (input.contentType) headers["content-type"] = input.contentType;

  const signedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaders.map((key) => `${key}:${headers[key]}\n`).join("");
  const canonicalQuery = query.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const canonicalRequest = [
    input.method,
    url.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders.join(";"),
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha256(canonicalRequest),
  ].join("\n");

  let key: Uint8Array<ArrayBufferLike> = encoder.encode(`AWS4${config.secretAccessKey}`);
  for (const part of [dateStamp, config.region, "s3", "aws4_request"]) key = await hmac(key, part);
  const signature = hex((await hmac(key, stringToSign)).buffer as ArrayBuffer);

  return fetch(url, {
    method: input.method,
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`,
    },
    ...(input.body ? { body: input.body as BodyInit } : {}),
  });
}

export interface S3Entry {
  key: string;
  size: number;
  modifiedAt: string;
  isPrefix: boolean;
}

const between = (xml: string, tag: string): string[] =>
  [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((match) => match[1] ?? "");

export async function s3List(config: S3Config, prefix: string): Promise<S3Entry[]> {
  const response = await s3Fetch(config, {
    method: "GET",
    query: { "list-type": "2", delimiter: "/", prefix, "max-keys": "1000" },
  });
  if (!response.ok) throw new Error(`S3 list failed (${response.status})`);
  const xml = await response.text();

  const entries: S3Entry[] = [];
  for (const block of between(xml, "CommonPrefixes")) {
    const key = between(block, "Prefix")[0];
    if (key) entries.push({ key, size: 0, modifiedAt: new Date().toISOString(), isPrefix: true });
  }
  for (const block of between(xml, "Contents")) {
    const key = between(block, "Key")[0];
    if (!key || key === prefix) continue;
    entries.push({
      key,
      size: Number(between(block, "Size")[0] ?? 0),
      modifiedAt: between(block, "LastModified")[0] ?? new Date().toISOString(),
      isPrefix: false,
    });
  }
  return entries;
}
