export namespace models {
	
	export class Session {
	    id: string;
	    user_id: string;
	    node_id: string;
	    protocol: string;
	    client_ip: string;
	    tunnel_ip: string;
	    status: string;
	    // Go type: time
	    connected_at: any;
	    bytes_sent: number;
	    bytes_received: number;
	    data_used_gb: number;
	    latency: number;
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.user_id = source["user_id"];
	        this.node_id = source["node_id"];
	        this.protocol = source["protocol"];
	        this.client_ip = source["client_ip"];
	        this.tunnel_ip = source["tunnel_ip"];
	        this.status = source["status"];
	        this.connected_at = this.convertValues(source["connected_at"], null);
	        this.bytes_sent = source["bytes_sent"];
	        this.bytes_received = source["bytes_received"];
	        this.data_used_gb = source["data_used_gb"];
	        this.latency = source["latency"];
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
	export class User {
	    id: string;
	    email: string;
	    username: string;
	    full_name: string;
	    subscription_tier: string;
	    // Go type: time
	    subscription_expiry: any;
	    is_active: boolean;
	    is_admin: boolean;
	
	    static createFrom(source: any = {}) {
	        return new User(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.email = source["email"];
	        this.username = source["username"];
	        this.full_name = source["full_name"];
	        this.subscription_tier = source["subscription_tier"];
	        this.subscription_expiry = this.convertValues(source["subscription_expiry"], null);
	        this.is_active = source["is_active"];
	        this.is_admin = source["is_admin"];
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
	export class VPNNode {
	    id: string;
	    name: string;
	    hostname: string;
	    country: string;
	    country_code: string;
	    city: string;
	    public_ip: string;
	    latitude: number;
	    longitude: number;
	    status: string;
	    is_active: boolean;
	    load_score: number;
	    latency: number;
	    current_connections: number;
	    max_connections: number;
	    supports_wireguard: boolean;
	    supports_openvpn: boolean;
	    wireguard_port: number;
	    openvpn_port: number;
	    // Go type: time
	    last_heartbeat: any;
	
	    static createFrom(source: any = {}) {
	        return new VPNNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.hostname = source["hostname"];
	        this.country = source["country"];
	        this.country_code = source["country_code"];
	        this.city = source["city"];
	        this.public_ip = source["public_ip"];
	        this.latitude = source["latitude"];
	        this.longitude = source["longitude"];
	        this.status = source["status"];
	        this.is_active = source["is_active"];
	        this.load_score = source["load_score"];
	        this.latency = source["latency"];
	        this.current_connections = source["current_connections"];
	        this.max_connections = source["max_connections"];
	        this.supports_wireguard = source["supports_wireguard"];
	        this.supports_openvpn = source["supports_openvpn"];
	        this.wireguard_port = source["wireguard_port"];
	        this.openvpn_port = source["openvpn_port"];
	        this.last_heartbeat = this.convertValues(source["last_heartbeat"], null);
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

