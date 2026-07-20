export namespace agentlens {
	
	export class LintResult {
	    ruleId: string;
	    ruleName: string;
	    severity: string;
	    message: string;
	    fixSuggestion: string;
	
	    static createFrom(source: any = {}) {
	        return new LintResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ruleId = source["ruleId"];
	        this.ruleName = source["ruleName"];
	        this.severity = source["severity"];
	        this.message = source["message"];
	        this.fixSuggestion = source["fixSuggestion"];
	    }
	}
	export class ToolScore {
	    toolName: string;
	    requestId: string;
	    score: number;
	    results: LintResult[];
	    errorCount: number;
	    warningCount: number;
	    infoCount: number;
	
	    static createFrom(source: any = {}) {
	        return new ToolScore(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.toolName = source["toolName"];
	        this.requestId = source["requestId"];
	        this.score = source["score"];
	        this.results = this.convertValues(source["results"], LintResult);
	        this.errorCount = source["errorCount"];
	        this.warningCount = source["warningCount"];
	        this.infoCount = source["infoCount"];
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
	export class CollectionScore {
	    score: number;
	    toolCount: number;
	    exposedCount: number;
	    tools: ToolScore[];
	    errors: number;
	    warnings: number;
	    infos: number;
	
	    static createFrom(source: any = {}) {
	        return new CollectionScore(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.score = source["score"];
	        this.toolCount = source["toolCount"];
	        this.exposedCount = source["exposedCount"];
	        this.tools = this.convertValues(source["tools"], ToolScore);
	        this.errors = source["errors"];
	        this.warnings = source["warnings"];
	        this.infos = source["infos"];
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
	export class EvalRunResult {
	    taskIndex: number;
	    prompt: string;
	    expectTool: string;
	    expectArgs?: Record<string, any>;
	    actualTool: string;
	    actualArgs?: Record<string, any>;
	    toolMatch: boolean;
	    argsMatch: boolean;
	    passed: boolean;
	    latencyMs: number;
	    error?: string;
	    timestamp: string;
	
	    static createFrom(source: any = {}) {
	        return new EvalRunResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.taskIndex = source["taskIndex"];
	        this.prompt = source["prompt"];
	        this.expectTool = source["expectTool"];
	        this.expectArgs = source["expectArgs"];
	        this.actualTool = source["actualTool"];
	        this.actualArgs = source["actualArgs"];
	        this.toolMatch = source["toolMatch"];
	        this.argsMatch = source["argsMatch"];
	        this.passed = source["passed"];
	        this.latencyMs = source["latencyMs"];
	        this.error = source["error"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class EvalTaskResult {
	    taskIndex: number;
	    prompt: string;
	    runs: EvalRunResult[];
	    passRate: number;
	    passed: boolean;
	
	    static createFrom(source: any = {}) {
	        return new EvalTaskResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.taskIndex = source["taskIndex"];
	        this.prompt = source["prompt"];
	        this.runs = this.convertValues(source["runs"], EvalRunResult);
	        this.passRate = source["passRate"];
	        this.passed = source["passed"];
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
	export class EvalSuiteResult {
	    suiteName: string;
	    provider: string;
	    model: string;
	    tasks: EvalTaskResult[];
	    totalRuns: number;
	    totalPassed: number;
	    passRate: number;
	    score: number;
	    startedAt: string;
	    finishedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new EvalSuiteResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.suiteName = source["suiteName"];
	        this.provider = source["provider"];
	        this.model = source["model"];
	        this.tasks = this.convertValues(source["tasks"], EvalTaskResult);
	        this.totalRuns = source["totalRuns"];
	        this.totalPassed = source["totalPassed"];
	        this.passRate = source["passRate"];
	        this.score = source["score"];
	        this.startedAt = source["startedAt"];
	        this.finishedAt = source["finishedAt"];
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
	
	export class ExportResult {
	    outputDir: string;
	    files: string[];
	    tools: number;
	
	    static createFrom(source: any = {}) {
	        return new ExportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.outputDir = source["outputDir"];
	        this.files = source["files"];
	        this.tools = source["tools"];
	    }
	}
	
	export class ToolParam {
	    name: string;
	    in: string;
	    type: string;
	    required: boolean;
	    description: string;
	    enum?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ToolParam(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.in = source["in"];
	        this.type = source["type"];
	        this.required = source["required"];
	        this.description = source["description"];
	        this.enum = source["enum"];
	    }
	}
	export class ToolDefinition {
	    requestId: string;
	    requestName: string;
	    folder: string;
	    name: string;
	    description: string;
	    method: string;
	    path: string;
	    inputSchema: Record<string, any>;
	    parameters: ToolParam[];
	    deprecated: boolean;
	    destructive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ToolDefinition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requestId = source["requestId"];
	        this.requestName = source["requestName"];
	        this.folder = source["folder"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.method = source["method"];
	        this.path = source["path"];
	        this.inputSchema = source["inputSchema"];
	        this.parameters = this.convertValues(source["parameters"], ToolParam);
	        this.deprecated = source["deprecated"];
	        this.destructive = source["destructive"];
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
	export class DiffEntry {
	    path: string;
	    added: number;
	    deleted: number;
	
	    static createFrom(source: any = {}) {
	        return new DiffEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.added = source["added"];
	        this.deleted = source["deleted"];
	    }
	}
	export class StashEntry {
	    index: number;
	    ref: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new StashEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.ref = source["ref"];
	        this.message = source["message"];
	    }
	}

}

export namespace interceptor {
	
	export class CapturedRequest {
	    id: string;
	    method: string;
	    url: string;
	    headers: Record<string, string>;
	    body: string;
	    timestamp: number;
	    tabUrl: string;
	    tabTitle: string;
	
	    static createFrom(source: any = {}) {
	        return new CapturedRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.method = source["method"];
	        this.url = source["url"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	        this.timestamp = source["timestamp"];
	        this.tabUrl = source["tabUrl"];
	        this.tabTitle = source["tabTitle"];
	    }
	}

}

export namespace main {
	
	export class AISettingsResult {
	    enabled: boolean;
	    provider: string;
	    apiKey: string;
	    baseUrl: string;
	    model: string;
	
	    static createFrom(source: any = {}) {
	        return new AISettingsResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.provider = source["provider"];
	        this.apiKey = source["apiKey"];
	        this.baseUrl = source["baseUrl"];
	        this.model = source["model"];
	    }
	}
	export class ExportHTMLDocsOpts {
	    includeHeaders: boolean;
	    includeBody: boolean;
	    includeExamples: boolean;
	    baseUrl: string;
	    timestamp: boolean;
	    darkMode: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ExportHTMLDocsOpts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.includeHeaders = source["includeHeaders"];
	        this.includeBody = source["includeBody"];
	        this.includeExamples = source["includeExamples"];
	        this.baseUrl = source["baseUrl"];
	        this.timestamp = source["timestamp"];
	        this.darkMode = source["darkMode"];
	    }
	}
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
	    autoSync: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GitStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.initialised = source["initialised"];
	        this.hasChanges = source["hasChanges"];
	        this.currentBranch = source["currentBranch"];
	        this.remoteUrl = source["remoteUrl"];
	        this.autoSync = source["autoSync"];
	    }
	}
	export class InterceptorStatus {
	    running: boolean;
	    port: number;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new InterceptorStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.port = source["port"];
	        this.count = source["count"];
	    }
	}
	export class MockStatus {
	    running: boolean;
	    port: number;
	    routeCount: number;
	    baseUrl: string;
	    routes: string[];
	    recording: boolean;
	
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
	        this.recording = source["recording"];
	    }
	}
	export class RegistryPushResult {
	    url: string;
	
	    static createFrom(source: any = {}) {
	        return new RegistryPushResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	    }
	}
	export class TelemetryConfig {
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TelemetryConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
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
	    notes?: string;
	    grpcService?: string;
	    grpcMethod?: string;
	    mqttTopic?: string;
	    soapAction?: string;
	    soapVersion?: string;
	    clientCert?: string;
	    clientKey?: string;
	    timeout?: number;
	
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
	        this.notes = source["notes"];
	        this.grpcService = source["grpcService"];
	        this.grpcMethod = source["grpcMethod"];
	        this.mqttTopic = source["mqttTopic"];
	        this.soapAction = source["soapAction"];
	        this.soapVersion = source["soapVersion"];
	        this.clientCert = source["clientCert"];
	        this.clientKey = source["clientKey"];
	        this.timeout = source["timeout"];
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
	    notes?: string;
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
	        this.notes = source["notes"];
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
	export class Collection {
	    id: string;
	    name: string;
	    description?: string;
	    spec?: string;
	    public?: boolean;
	    variables?: EnvVar[];
	    requests: SavedRequest[];
	
	    static createFrom(source: any = {}) {
	        return new Collection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.spec = source["spec"];
	        this.public = source["public"];
	        this.variables = this.convertValues(source["variables"], EnvVar);
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
	
	
	
	export class SocketIOConnectRequest {
	    url: string;
	    cookies: string;
	    headers: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new SocketIOConnectRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.cookies = source["cookies"];
	        this.headers = source["headers"];
	    }
	}
	export class SocketMessage {
	    timestamp: number;
	    direction: string;
	    body: string;
	    eventType?: string;
	    eventId?: string;
	    retry?: number;
	
	    static createFrom(source: any = {}) {
	        return new SocketMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timestamp = source["timestamp"];
	        this.direction = source["direction"];
	        this.body = source["body"];
	        this.eventType = source["eventType"];
	        this.eventId = source["eventId"];
	        this.retry = source["retry"];
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

export namespace openapi {
	
	export class EndpointSummary {
	    method: string;
	    path: string;
	    summary: string;
	    description?: string;
	
	    static createFrom(source: any = {}) {
	        return new EndpointSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.path = source["path"];
	        this.summary = source["summary"];
	        this.description = source["description"];
	    }
	}
	export class ImportResult {
	    collections: models.Collection[];
	    endpoints: number;
	    specTitle: string;
	    specVersion: string;
	
	    static createFrom(source: any = {}) {
	        return new ImportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.collections = this.convertValues(source["collections"], models.Collection);
	        this.endpoints = source["endpoints"];
	        this.specTitle = source["specTitle"];
	        this.specVersion = source["specVersion"];
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

export namespace plugin {
	
	export class Hooks {
	    authProvider?: string;
	    visualizer?: string;
	    codegen?: string;
	    preRequest?: string;
	    postRequest?: string;
	    mockRule?: string;
	
	    static createFrom(source: any = {}) {
	        return new Hooks(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.authProvider = source["authProvider"];
	        this.visualizer = source["visualizer"];
	        this.codegen = source["codegen"];
	        this.preRequest = source["preRequest"];
	        this.postRequest = source["postRequest"];
	        this.mockRule = source["mockRule"];
	    }
	}
	export class Manifest {
	    name: string;
	    version: string;
	    description?: string;
	    author?: string;
	    hooks: Hooks;
	
	    static createFrom(source: any = {}) {
	        return new Manifest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.version = source["version"];
	        this.description = source["description"];
	        this.author = source["author"];
	        this.hooks = this.convertValues(source["hooks"], Hooks);
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
	export class RegisteredPlugin {
	    manifest: Manifest;
	    dir: string;
	
	    static createFrom(source: any = {}) {
	        return new RegisteredPlugin(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.manifest = this.convertValues(source["manifest"], Manifest);
	        this.dir = source["dir"];
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

export namespace profile {
	
	export class Badge {
	    id: string;
	    name: string;
	    description: string;
	    icon: string;
	    earnedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Badge(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.icon = source["icon"];
	        this.earnedAt = source["earnedAt"];
	    }
	}
	export class UserProject {
	    name: string;
	    description?: string;
	    url?: string;
	    liveUrl?: string;
	    techStack?: string[];
	    imageUrl?: string;
	
	    static createFrom(source: any = {}) {
	        return new UserProject(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.url = source["url"];
	        this.liveUrl = source["liveUrl"];
	        this.techStack = source["techStack"];
	        this.imageUrl = source["imageUrl"];
	    }
	}
	export class ProjectRef {
	    name: string;
	    description?: string;
	    requestCount: number;
	    testCount: number;
	    protocols?: string[];
	    hasSpec: boolean;
	    public: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ProjectRef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.requestCount = source["requestCount"];
	        this.testCount = source["testCount"];
	        this.protocols = source["protocols"];
	        this.hasSpec = source["hasSpec"];
	        this.public = source["public"];
	    }
	}
	export class SocialLink {
	    type: string;
	    url: string;
	
	    static createFrom(source: any = {}) {
	        return new SocialLink(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.url = source["url"];
	    }
	}
	export class DevStats {
	    collectionsCreated: number;
	    requestsSent: number;
	    assertionsWritten: number;
	    specsAuthored: number;
	    mockServersCreated: number;
	    contractPassRate: number;
	    protocolsUsed: string[];
	    authTypesUsed: string[];
	
	    static createFrom(source: any = {}) {
	        return new DevStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.collectionsCreated = source["collectionsCreated"];
	        this.requestsSent = source["requestsSent"];
	        this.assertionsWritten = source["assertionsWritten"];
	        this.specsAuthored = source["specsAuthored"];
	        this.mockServersCreated = source["mockServersCreated"];
	        this.contractPassRate = source["contractPassRate"];
	        this.protocolsUsed = source["protocolsUsed"];
	        this.authTypesUsed = source["authTypesUsed"];
	    }
	}
	export class Link {
	    label: string;
	    url: string;
	
	    static createFrom(source: any = {}) {
	        return new Link(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.url = source["url"];
	    }
	}
	export class DevProfile {
	    username: string;
	    displayName: string;
	    bio: string;
	    avatarUrl?: string;
	    links?: Link[];
	    location?: string;
	    company?: string;
	    badges?: Badge[];
	    stats: DevStats;
	    skills?: string[];
	    socialLinks?: SocialLink[];
	    githubUsername?: string;
	    projects?: ProjectRef[];
	    userProjects?: UserProject[];
	    public: boolean;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new DevProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.username = source["username"];
	        this.displayName = source["displayName"];
	        this.bio = source["bio"];
	        this.avatarUrl = source["avatarUrl"];
	        this.links = this.convertValues(source["links"], Link);
	        this.location = source["location"];
	        this.company = source["company"];
	        this.badges = this.convertValues(source["badges"], Badge);
	        this.stats = this.convertValues(source["stats"], DevStats);
	        this.skills = source["skills"];
	        this.socialLinks = this.convertValues(source["socialLinks"], SocialLink);
	        this.githubUsername = source["githubUsername"];
	        this.projects = this.convertValues(source["projects"], ProjectRef);
	        this.userProjects = this.convertValues(source["userProjects"], UserProject);
	        this.public = source["public"];
	        this.updatedAt = source["updatedAt"];
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
	
	export class PublicProfile {
	    username: string;
	    displayName: string;
	    bio: string;
	    avatarUrl?: string;
	    links?: Link[];
	    location?: string;
	    company?: string;
	    badges?: Badge[];
	    stats: DevStats;
	    projects?: ProjectRef[];
	    userProjects?: UserProject[];
	    skills?: string[];
	    socialLinks?: SocialLink[];
	    githubUsername?: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PublicProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.username = source["username"];
	        this.displayName = source["displayName"];
	        this.bio = source["bio"];
	        this.avatarUrl = source["avatarUrl"];
	        this.links = this.convertValues(source["links"], Link);
	        this.location = source["location"];
	        this.company = source["company"];
	        this.badges = this.convertValues(source["badges"], Badge);
	        this.stats = this.convertValues(source["stats"], DevStats);
	        this.projects = this.convertValues(source["projects"], ProjectRef);
	        this.userProjects = this.convertValues(source["userProjects"], UserProject);
	        this.skills = source["skills"];
	        this.socialLinks = this.convertValues(source["socialLinks"], SocialLink);
	        this.githubUsername = source["githubUsername"];
	        this.updatedAt = source["updatedAt"];
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

export namespace scheduler {
	
	export class ScheduledRun {
	    id: string;
	    collectionId: string;
	    name: string;
	    cronExpr: string;
	    enabled: boolean;
	    lastRunAt?: string;
	    nextRunAt?: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ScheduledRun(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.collectionId = source["collectionId"];
	        this.name = source["name"];
	        this.cronExpr = source["cronExpr"];
	        this.enabled = source["enabled"];
	        this.lastRunAt = source["lastRunAt"];
	        this.nextRunAt = source["nextRunAt"];
	        this.createdAt = source["createdAt"];
	    }
	}

}

export namespace schema {
	
	export class FieldChange {
	    field: string;
	    oldValue?: string;
	    newValue?: string;
	    kind: string;
	
	    static createFrom(source: any = {}) {
	        return new FieldChange(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.field = source["field"];
	        this.oldValue = source["oldValue"];
	        this.newValue = source["newValue"];
	        this.kind = source["kind"];
	    }
	}
	export class EndpointDrift {
	    method: string;
	    path: string;
	    detail?: string;
	    changes?: FieldChange[];
	
	    static createFrom(source: any = {}) {
	        return new EndpointDrift(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.path = source["path"];
	        this.detail = source["detail"];
	        this.changes = this.convertValues(source["changes"], FieldChange);
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
	export class Drift {
	    oldVersion: string;
	    newVersion: string;
	    added: EndpointDrift[];
	    removed: EndpointDrift[];
	    changed: EndpointDrift[];
	    summary: string;
	
	    static createFrom(source: any = {}) {
	        return new Drift(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.oldVersion = source["oldVersion"];
	        this.newVersion = source["newVersion"];
	        this.added = this.convertValues(source["added"], EndpointDrift);
	        this.removed = this.convertValues(source["removed"], EndpointDrift);
	        this.changed = this.convertValues(source["changed"], EndpointDrift);
	        this.summary = source["summary"];
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

export namespace telemetry {
	
	export class Event {
	    type: string;
	    name: string;
	    ts: number;
	    metadata?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new Event(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.name = source["name"];
	        this.ts = source["ts"];
	        this.metadata = source["metadata"];
	    }
	}

}

export namespace updater {
	
	export class PlatformAsset {
	    url: string;
	    sha256: string;
	
	    static createFrom(source: any = {}) {
	        return new PlatformAsset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.sha256 = source["sha256"];
	    }
	}
	export class UpdateManifest {
	    version: string;
	    notes: string;
	    pub_date: string;
	    platforms: Record<string, PlatformAsset>;
	
	    static createFrom(source: any = {}) {
	        return new UpdateManifest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.notes = source["notes"];
	        this.pub_date = source["pub_date"];
	        this.platforms = this.convertValues(source["platforms"], PlatformAsset, true);
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

