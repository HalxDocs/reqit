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
	
	    static createFrom(source: any = {}) {
	        return new Header(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	        this.enabled = source["enabled"];
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
	export class ResponseResult {
	    status: string;
	    statusCode: number;
	    headers: Record<string, string>;
	    body: string;
	    timingMs: number;
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
	        this.timingMs = source["timingMs"];
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
	
	    static createFrom(source: any = {}) {
	        return new HistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.payload = this.convertValues(source["payload"], RequestPayload);
	        this.response = this.convertValues(source["response"], ResponseResult);
	        this.createdAt = source["createdAt"];
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

