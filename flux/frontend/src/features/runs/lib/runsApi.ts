// Run receipts are produced by Go and shown in the desktop app. The Wails
// bridge is absent in a browser build, so every call degrades to an empty
// history instead of throwing during startup.

export type RunHeader = {
  name: string;
  value?: string;
  redacted?: boolean;
};

export type RunRequest = {
  method: string;
  url: string;
  headers?: RunHeader[] | null;
  params?: RunHeader[] | null;
  bodyType?: string;
  bodySha256?: string;
  bodyBytes?: number;
  bodyPreview?: string;
  authType?: string;
};

export type RunResponse = {
  status?: string;
  statusCode: number;
  headers?: Record<string, string> | null;
  bodySha256?: string;
  bodyBytes?: number;
  bodyPreview?: string;
  cookies?: number;
  error?: string;
};

export type RunResolution = {
  name: string;
  source: string;
};

export type RunTiming = {
  dnsLookupMs?: number;
  tcpConnectMs?: number;
  tlsHandshakeMs?: number;
  ttfbMs?: number;
  downloadMs?: number;
  totalMs?: number;
};

export type RunLoadTest = {
  vus: number;
  durationSec?: number;
  iterations?: number;
  totalReqs: number;
  passed: number;
  failed: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  durationMs: number;
  error?: string;
};

export type RunValidationError = {
  layer: string;
  field: string;
  message: string;
};

export type RunValidation = {
  valid: boolean;
  errors?: RunValidationError[] | null;
  skipReason?: string;
};

export type RunReceipt = {
  version: number;
  id: string;
  kind: string;
  time: string;
  source: string;
  session?: string;
  environment?: string;
  workspace?: string;
  request: RunRequest;
  resolution?: RunResolution[] | null;
  response: RunResponse;
  timing?: RunTiming | null;
  validation?: RunValidation | null;
  prevHash?: string;
  hash?: string;
  keyId?: string;
  signature?: string;
  loadTest?: RunLoadTest | null;
};

export type RunVerifyReport = {
  Checked: number;
  Signed: number;
  Unsigned: number;
};

type Bridge = {
  ListRuns: (limit: number) => Promise<RunReceipt[]>;
  GetRun: (id: string) => Promise<RunReceipt>;
  VerifyRuns: () => Promise<RunVerifyReport>;
};

function bridge(): Bridge | null {
  const w = window as unknown as { go?: { main?: { App?: Partial<Bridge> } } };
  const app = w.go?.main?.App;
  if (!app || !app.ListRuns || !app.GetRun || !app.VerifyRuns) return null;
  return app as Bridge;
}

export async function listRuns(limit = 200): Promise<RunReceipt[]> {
  const b = bridge();
  if (!b) return [];
  const runs = await b.ListRuns(limit);
  return Array.isArray(runs) ? runs : [];
}

export async function getRun(id: string): Promise<RunReceipt | null> {
  const b = bridge();
  if (!b) return null;
  return b.GetRun(id);
}

export async function verifyRuns(): Promise<RunVerifyReport | null> {
  const b = bridge();
  if (!b) return null;
  return b.VerifyRuns();
}
