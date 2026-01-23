const https = require('http');

const options = { timeout: 5000 };

const services = [
    { name: 'Gateway', port: 4000, path: '/health', expectedStatus: 200 },
    { name: 'User Service', port: 3001, path: '/health', expectedStatus: 200 },
    { name: 'Interaction Service', port: 3457, path: '/health', expectedStatus: 200 }, // UPDATED PORT
    { name: 'Subscription Service', port: 3009, path: '/health', expectedStatus: 200 }, // UPDATED PORT
    { name: 'Communication Service', port: 3006, path: '/health', expectedStatus: 200 }, // UPDATED PORT
    { name: 'Notification Service', port: 3004, path: '/health', expectedStatus: 200 }  // UPDATED PORT
];

const HOST = '51.20.160.210';

async function checkService(service) {
    return new Promise((resolve) => {
        const req = https.get(`http://${HOST}:${service.port}${service.path}`, options, (res) => {
            if (res.statusCode === service.expectedStatus) {
                console.log(`✅ ${service.name}: UP (Status ${res.statusCode})`);
                resolve(true);
            } else {
                console.log(`⚠️  ${service.name}: REACHABLE but returning ${res.statusCode}`);
                resolve(true);
            }
        });

        req.on('error', (e) => {
            console.log(`❌ ${service.name}: DOWN (${e.message})`);
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            console.log(`❌ ${service.name}: TIMEOUT`);
            resolve(false);
        });
    });
}

async function run() {
    console.log(`Testing Connectivity to ${HOST} (Master-BE Ports)...`);
    console.log('---------------------------------------------------');

    const results = await Promise.all(services.map(checkService));
    const successCount = results.filter(r => r).length;

    console.log('---------------------------------------------------');
    console.log(`Result: ${successCount}/${services.length} services reachable.`);
}

run();
