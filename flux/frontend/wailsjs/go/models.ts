export namespace cookies {
	
	export class CookieInfo {
	    domain: string;
	    name: string;
	    value: string;
	    expires: string;
	    httpOnly: boolean;
	    secure: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CookieInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.domain = source["domain"];
	        this.name = source["name"];
	        this.value = source["value"];
	        this.expires = source["expires"];
	        this.httpOnly = source["httpOnly"];
	        this.secure = source["secure"];
	    }
	}

}

export namespace environments {
	
	export class Snapshot {
	    active: string;
	    environments: models.Environment[];
	
	    static createFrom(source: any = {}) {
	        return new Snapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.active = source["active"];
	        this.environments = this.convertValues(source["environments"], models.Environment);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace git {
	
	export class CommitInfo {
	    hash: string;
	    message: string;
	    author: string;
	    when: string;
	
	    static createFrom(source: any = {}) {
	        return new CommitInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hash = source["hash"];
	        this.message = source["message"];
	        this.author = source["author"];
	        this.when = source["when"];
	    }
	}
	export class Contributor {
	    name: string;
	    email: string;
	    commits: number;
	    lastSeen: string;
	
	    static createFrom(source: any = {}) {
	        return new Contributor(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.email = source["email"];
	        this.commits = source["commits"];
	        this.lastSeen = source["lastSeen"];
	    }
	}

}

export namespace main {
	
	export class ExportMarkdownOpts {
	    includeHeaders: boolean;
	    includeBody: boolean;
	    includeExamples: boolean;
	    baseUrl: string;
	    timestamp: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ExportMarkdownOpts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.includeHeaders = source["includeHeaders"];
	        this.includeBody = source["includeBody"];
	        this.includeExamples = source["includeExamples"];
	        this.baseUrl = source["baseUrl"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class GitStatus {
	    initialised: boolean;
	    hasChanges: boolean;
	    currentBranch: string;
	    remoteUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new GitStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.initialised = source["initialised"];
	        this.hasChanges = source["hasChanges"];
	        this.currentBranch = source["currentBranch"];
	        this.remoteUrl = source["remoteUrl"];
	    }
	}
	export class MockStatus {
	    running: boolean;
	    port: number;
	    routeCount: number;
	    baseUrl: string;
	    routes: string[];
	
	    static createFrom(source: any = {}) {
	        return new MockStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.port = source["port"];
	        this.routeCount = source["routeCount"];
	        this.baseUrl = source["baseUrl"];
	        this.routes = source["routes"];
	    }
	}

}

export namespace models {
	
	export class Assertion {
	    type: string;
	    target: string;
	    value?: string;
	    script?: string;
	    statusCode?: number;
	    maxTimingMs?: number;
	    bodyContains?: string;
	
	    static createFrom(source: any = {}) {
	        return new Assertion(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.target = source["target"];
	        this.value = source["value"];
	        this.script = source["script"];
	        this.statusCode = source["statusCode"];
	        this.maxTimingMs = source["maxTimingMs"];
	        this.bodyContains = source["bodyContains"];
	    }
	}
	export class ExtractRule {
	    id: string;
	    type: string;
	    source: string;
	    target: string;
	
	    static createFrom(source: any = {}) {
	        return new ExtractRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.source = source["source"];
	        this.target = source["target"];
	    }
	}
	export class PreSetVar {
	    id: string;
	    key: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new PreSetVar(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.key = source["key"];
	        this.value = source["value"];
	    }
	}
	export class MockOverride {
	    enabled: boolean;
	    statusCode: number;
	    delayMs: number;
	    body: string;
	
	    static createFrom(source: any = {}) {
	        return new MockOverride(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.statusCode = source["statusCode"];
	        this.delayMs = source["delayMs"];
	        this.body = source["body"];
	    }
	}
	export class SavedResponse {
	    statusCode: number;
	    headers: Record<string, string>;
	    body: string;
	    capturedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new SavedResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.statusCode = source["statusCode"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	        this.capturedAt = source["capturedAt"];
	    }
	}
	export class Header {
	    key: string;
	    value: string;
	    enabled: boolean;
	    valueType?: string;
	
	    static createFrom(source: any = {}) {
	        return new Header(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	        this.enabled = source["enabled"];
	        this.valueType = source["valueType"];
	    }
	}
	export class RequestPayload {
	    method: string;
	    url: string;
	    headers: Header[];
	    params: Header[];
	    bodyType: string;
	    body: string;
	    bodyForm: Header[];
	    authType: string;
	    authValue: string;
	    specPath: string;
	    graphqlQuery: string;
	    graphqlVariables: string;
	    preScript: string;
	    postScript: string;
	    grpcService?: string;
	    grpcMethod?: string;
	    mqttTopic?: string;
	    soapAction?: string;
	    soapVersion?: string;
	
	    static createFrom(source: any = {}) {
	        return new RequestPayload(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.url = source["url"];
	        this.headers = this.convertValues(source["headers"], Header);
	        this.params = this.convertValues(source["params"], Header);
	        this.bodyType = source["bodyType"];
	        this.body = source["body"];
	        this.bodyForm = this.convertValues(source["bodyForm"], Header);
	        this.authType = source["authType"];
	        this.authValue = source["authValue"];
	        this.specPath = source["specPath"];
	        this.graphqlQuery = source["graphqlQuery"];
	        this.graphqlVariables = source["graphqlVariables"];
	        this.preScript = source["preScript"];
	        this.postScript = source["postScript"];
	        this.grpcService = source["grpcService"];
	        this.grpcMethod = source["grpcMethod"];
	        this.mqttTopic = source["mqttTopic"];
	        this.soapAction = source["soapAction"];
	        this.soapVersion = source["soapVersion"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SavedRequest {
	    id: string;
	    name: string;
	    collectionId: string;
	    payload: RequestPayload;
	    createdAt: string;
	    savedResponse?: SavedResponse;
	    mockOverride?: MockOverride;
	    preSetVars?: PreSetVar[];
	    extractRules?: ExtractRule[];
	
	    static createFrom(source: any = {}) {
	        return new SavedRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.collectionId = source["collectionId"];
	        this.payload = this.convertValues(source["payload"], RequestPayload);
	        this.createdAt = source["createdAt"];
	        this.savedResponse = this.convertValues(source["savedResponse"], SavedResponse);
	        this.mockOverride = this.convertValues(source["mockOverride"], MockOverride);
	        this.preSetVars = this.convertValues(source["preSetVars"], PreSetVar);
	        this.extractRules = this.convertValues(source["extractRules"], ExtractRule);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Collection {
	    id: string;
	    name: string;
	    spec?: string;
	    requests: SavedRequest[];
	
	    static createFrom(source: any = {}) {
	        return new Collection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.spec = source["spec"];
	        this.requests = this.convertValues(source["requests"], SavedRequest);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RequestRunResult {
	    requestId: string;
	    requestName: string;
	    passed: boolean;
	    statusCode: number;
	    statusText: string;
	    timingMs: number;
	    sizeBytes: number;
	    error: string;
	    assertionErrors: string[];
	    retries?: number;
	    skipped?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RequestRunResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requestId = source["requestId"];
	        this.requestName = source["requestName"];
	        this.passed = source["passed"];
	        this.statusCode = source["statusCode"];
	        this.statusText = source["statusText"];
	        this.timingMs = source["timingMs"];
	        this.sizeBytes = source["sizeBytes"];
	        this.error = source["error"];
	        this.assertionErrors = source["assertionErrors"];
	        this.retries = source["retries"];
	        this.skipped = source["skipped"];
	    }
	}
	export class CollectionRunResult {
	    collectionId: string;
	    collectionName: string;
	    results: RequestRunResult[];
	    passed: number;
	    failed: number;
	    skipped: number;
	    total: number;
	    durationMs: number;
	
	    static createFrom(source: any = {}) {
	        return new CollectionRunResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.collectionId = source["collectionId"];
	        this.collectionName = source["collectionName"];
	        this.results = this.convertValues(source["results"], RequestRunResult);
	        this.passed = source["passed"];
	        this.failed = source["failed"];
	        this.skipped = source["skipped"];
	        this.total = source["total"];
	        this.durationMs = source["durationMs"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CookieSummary {
	    name: string;
	    value: string;
	    domain: string;
	    expires: string;
	    httpOnly: boolean;
	    secure: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CookieSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.value = source["value"];
	        this.domain = source["domain"];
	        this.expires = source["expires"];
	        this.httpOnly = source["httpOnly"];
	        this.secure = source["secure"];
	    }
	}
	export class EnvVar {
	    key: string;
	    value: string;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new EnvVar(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	        this.enabled = source["enabled"];
	    }
	}
	export class Environment {
	    id: string;
	    name: string;
	    vars: EnvVar[];
	
	    static createFrom(source: any = {}) {
	        return new Environment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.vars = this.convertValues(source["vars"], EnvVar);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class GRPCResponse {
	    statusCode: number;
	    body: string;
	    error?: string;
	    durationMs: number;
	    headers: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new GRPCResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.statusCode = source["statusCode"];
	        this.body = source["body"];
	        this.error = source["error"];
	        this.durationMs = source["durationMs"];
	        this.headers = source["headers"];
	    }
	}
	
	export class ValidationError {
	    layer: string;
	    field: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new ValidationError(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.layer = source["layer"];
	        this.field = source["field"];
	        this.message = source["message"];
	    }
	}
	export class ValidationResult {
	    valid: boolean;
	    errors: ValidationError[];
	    skipReason: string;
	    endpoint: string;
	    method: string;
	
	    static createFrom(source: any = {}) {
	        return new ValidationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.valid = source["valid"];
	        this.errors = this.convertValues(source["errors"], ValidationError);
	        this.skipReason = source["skipReason"];
	        this.endpoint = source["endpoint"];
	        this.method = source["method"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TimingBreakdown {
	    dnsLookupMs: number;
	    tcpConnectMs: number;
	    tlsHandshakeMs: number;
	    ttfbMs: number;
	    downloadMs: number;
	    totalMs: number;
	
	    static createFrom(source: any = {}) {
	        return new TimingBreakdown(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dnsLookupMs = source["dnsLookupMs"];
	        this.tcpConnectMs = source["tcpConnectMs"];
	        this.tlsHandshakeMs = source["tlsHandshakeMs"];
	        this.ttfbMs = source["ttfbMs"];
	        this.downloadMs = source["downloadMs"];
	        this.totalMs = source["totalMs"];
	    }
	}
	export class ResponseResult {
	    status: string;
	    statusCode: number;
	    headers: Record<string, string>;
	    body: string;
	    bodyIsBase64: boolean;
	    timingMs: number;
	    timing?: TimingBreakdown;
	    sizeBytes: number;
	    error: string;
	    cookies: CookieSummary[];
	    validation?: ValidationResult;
	
	    static createFrom(source: any = {}) {
	        return new ResponseResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.statusCode = source["statusCode"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	        this.bodyIsBase64 = source["bodyIsBase64"];
	        this.timingMs = source["timingMs"];
	        this.timing = this.convertValues(source["timing"], TimingBreakdown);
	        this.sizeBytes = source["sizeBytes"];
	        this.error = source["error"];
	        this.cookies = this.convertValues(source["cookies"], CookieSummary);
	        this.validation = this.convertValues(source["validation"], ValidationResult);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HistoryEntry {
	    id: string;
	    payload: RequestPayload;
	    response: ResponseResult;
	    createdAt: string;
	    tags?: string[];
	    favorite: boolean;
	
	    static createFrom(source: any = {}) {
	        return new HistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.payload = this.convertValues(source["payload"], RequestPayload);
	        this.response = this.convertValues(source["response"], ResponseResult);
	        this.createdAt = source["createdAt"];
	        this.tags = source["tags"];
	        this.favorite = source["favorite"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class JWTDecoded {
	    header: Record<string, any>;
	    claims: Record<string, any>;
	    valid: boolean;
	    expired: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new JWTDecoded(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.header = source["header"];
	        this.claims = source["claims"];
	        this.valid = source["valid"];
	        this.expired = source["expired"];
	        this.error = source["error"];
	    }
	}
	export class LoadTestConfig {
	    request: RequestPayload;
	    vus: number;
	    durationSec: number;
	    rampUpSec: number;
	    iterations: number;
	    env?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new LoadTestConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.request = this.convertValues(source["request"], RequestPayload);
	        this.vus = source["vus"];
	        this.durationSec = source["durationSec"];
	        this.rampUpSec = source["rampUpSec"];
	        this.iterations = source["iterations"];
	        this.env = source["env"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LoadTestSample {
	    timestampMs: number;
	    statusCode: number;
	    timingMs: number;
	    sizeBytes: number;
	    error: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LoadTestSample(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timestampMs = source["timestampMs"];
	        this.statusCode = source["statusCode"];
	        this.timingMs = source["timingMs"];
	        this.sizeBytes = source["sizeBytes"];
	        this.error = source["error"];
	    }
	}
	export class LoadTestResult {
	    config: LoadTestConfig;
	    samples: LoadTestSample[];
	    totalReqs: number;
	    passed: number;
	    failed: number;
	    avgTimingMs: number;
	    p50TimingMs: number;
	    p95TimingMs: number;
	    p99TimingMs: number;
	    durationMs: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new LoadTestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.config = this.convertValues(source["config"], LoadTestConfig);
	        this.samples = this.convertValues(source["samples"], LoadTestSample);
	        this.totalReqs = source["totalReqs"];
	        this.passed = source["passed"];
	        this.failed = source["failed"];
	        this.avgTimingMs = source["avgTimingMs"];
	        this.p50TimingMs = source["p50TimingMs"];
	        this.p95TimingMs = source["p95TimingMs"];
	        this.p99TimingMs = source["p99TimingMs"];
	        this.durationMs = source["durationMs"];
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class OAuth2TokenResponse {
	    accessToken: string;
	    refreshToken: string;
	    tokenType: string;
	    expiresIn: number;
	    expiresAt: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new OAuth2TokenResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accessToken = source["accessToken"];
	        this.refreshToken = source["refreshToken"];
	        this.tokenType = source["tokenType"];
	        this.expiresIn = source["expiresIn"];
	        this.expiresAt = source["expiresAt"];
	        this.error = source["error"];
	    }
	}
	
	
	
	
	export class RunnerRequest {
	    id: string;
	    name: string;
	    payload: RequestPayload;
	    preSetVars?: PreSetVar[];
	    extractRules?: ExtractRule[];
	    assertions?: Assertion[];
	    retries?: number;
	    condition?: string;
	
	    static createFrom(source: any = {}) {
	        return new RunnerRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.payload = this.convertValues(source["payload"], RequestPayload);
	        this.preSetVars = this.convertValues(source["preSetVars"], PreSetVar);
	        this.extractRules = this.convertValues(source["extractRules"], ExtractRule);
	        this.assertions = this.convertValues(source["assertions"], Assertion);
	        this.retries = source["retries"];
	        this.condition = source["condition"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RunnerConfig {
	    requests: RunnerRequest[];
	    env?: Record<string, string>;
	    maxConcurrent?: number;
	    concurrency?: number;
	    rampUp?: number;
	    iterations?: number;
	    retryDelayMs?: number;
	
	    static createFrom(source: any = {}) {
	        return new RunnerConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requests = this.convertValues(source["requests"], RunnerRequest);
	        this.env = source["env"];
	        this.maxConcurrent = source["maxConcurrent"];
	        this.concurrency = source["concurrency"];
	        this.rampUp = source["rampUp"];
	        this.iterations = source["iterations"];
	        this.retryDelayMs = source["retryDelayMs"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class SocketMessage {
	    timestamp: number;
	    direction: string;
	    body: string;
	
	    static createFrom(source: any = {}) {
	        return new SocketMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timestamp = source["timestamp"];
	        this.direction = source["direction"];
	        this.body = source["body"];
	    }
	}
	export class SocketState {
	    status: string;
	    protocol: string;
	    url: string;
	    messages: SocketMessage[];
	
	    static createFrom(source: any = {}) {
	        return new SocketState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.protocol = source["protocol"];
	        this.url = source["url"];
	        this.messages = this.convertValues(source["messages"], SocketMessage);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TestGroup {
	    id: string;
	    name: string;
	    requestId: string;
	    assertions: Assertion[];
	    children?: TestGroup[];
	
	    static createFrom(source: any = {}) {
	        return new TestGroup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.requestId = source["requestId"];
	        this.assertions = this.convertValues(source["assertions"], Assertion);
	        this.children = this.convertValues(source["children"], TestGroup);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TestSuite {
	    id: string;
	    name: string;
	    description?: string;
	    groups: TestGroup[];
	    collectionId?: string;
	
	    static createFrom(source: any = {}) {
	        return new TestSuite(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.groups = this.convertValues(source["groups"], TestGroup);
	        this.collectionId = source["collectionId"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	

}

export namespace mqtt {
	
	export class Message {
	    topic: string;
	    payload: string;
	    qos: number;
	    receivedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Message(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.topic = source["topic"];
	        this.payload = source["payload"];
	        this.qos = source["qos"];
	        this.receivedAt = source["receivedAt"];
	    }
	}

}

export namespace profile {
	
	export class Profile {
	    userId: string;
	    name: string;
	    email: string;
	    createdAt: string;
	    lastSeenAt: string;
	    launchCount: number;
	    requestCount: number;
	
	    static createFrom(source: any = {}) {
	        return new Profile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.userId = source["userId"];
	        this.name = source["name"];
	        this.email = source["email"];
	        this.createdAt = source["createdAt"];
	        this.lastSeenAt = source["lastSeenAt"];
	        this.launchCount = source["launchCount"];
	        this.requestCount = source["requestCount"];
	    }
	}

}

export namespace updater {
	
	export class UpdateInfo {
	    version: string;
	    downloadUrl: string;
	    releaseUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.downloadUrl = source["downloadUrl"];
	        this.releaseUrl = source["releaseUrl"];
	    }
	}

}

export namespace workspaces {
	
	export class Info {
	    id: string;
	    name: string;
	    description: string;
	    color: string;
	    dataDir: string;
	    createdAt: string;
	    lastOpenedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Info(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.color = source["color"];
	        this.dataDir = source["dataDir"];
	        this.createdAt = source["createdAt"];
	        this.lastOpenedAt = source["lastOpenedAt"];
	    }
	}

}

