export namespace models {
	
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
	    }
	}

}

