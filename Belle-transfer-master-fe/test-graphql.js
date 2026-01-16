const fetch = require('node-fetch'); // NOTE: Assuming node environment. If node-fetch isn't available we use https core module.

// Fallback to https if node-fetch is not installed (likely valid in this env)
const http = require('http');

console.log('Testing GraphQL Endpoint: http://51.20.160.210:4000/graphql');

const query = JSON.stringify({
    query: `
    query {
      __typename
    }
  `
});

const options = {
    hostname: '51.20.160.210',
    port: 4000,
    path: '/graphql',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': query.length,
        'Origin': 'http://localhost:8081' // Simulate Expo app origin
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('BODY:', data);
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ GraphQL Endpoint is working!');
        } else {
            console.log('❌ GraphQL Endpoint returned error.');
        }
    });
});

req.on('error', (e) => {
    console.error(`❌ Network Error: ${e.message}`);
});

req.write(query);
req.end();
