const express = require('express');
const fetch = require('node-fetch'); // Using node-fetch v2 for CommonJS
const cors = require('cors'); // To handle CORS between Live Server and this proxy

const app = express();
const port = 3001; // Port for our local proxy server

// --- ERPNext Configuration ---
// IMPORTANT: These are now on your server-side proxy, not in the browser
const ERPNEXT_API_BASE = 'https://inventories.erpnext.com/api/resource';
const API_KEY = "4605af3327d4a26"; // Your ERPNext API Key
const API_SECRET = "ba94e560788e762"; // Your ERPNext API Secret
// --- End ERPNext Configuration ---

// Middleware
app.use(cors({ origin: 'http://127.0.0.1:5500' })); // Allow requests from Live Server origin
app.use(express.json()); // To parse JSON request bodies for PUT/POST
// app.use(express.text()); // To handle other body types if necessary

// Create a new router to handle all requests to /erpnext-api
const apiProxyRouter = express.Router();

// All requests to paths under /erpnext-api will be handled by this router
// Changed '*' to '/*' for a more standard wildcard match within the router
apiProxyRouter.all('/*', async (req, res) => {
    // req.url will contain the path and query string after /erpnext-api
    // e.g., if original request is /erpnext-api/Item/ITM001?fields=name,
    // req.url will be /Item/ITM001?fields=name
    const erpNextPathAndQuery = req.url; 

    // Construct the full URL for ERPNext
    // ERPNEXT_API_BASE does not have a trailing slash
    // req.url starts with a slash, e.g. /Item/ITM001
    const erpNextUrl = `${ERPNEXT_API_BASE}${erpNextPathAndQuery}`;

    console.log(`Proxying request: ${req.method} ${erpNextUrl}`);
    // For debugging, you can uncomment the line below to see the body received by the proxy
    // console.log(`Original req.body received by proxy:`, req.body);

    const headers = {
        'Accept': 'application/json',
        'Authorization': `Token ${API_KEY}:${API_SECRET}`
    };
    
    // Set Content-Type for methods that typically have a body
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const options = {
            method: req.method,
            headers: headers,
        };

        // Add body for methods that have it (POST, PUT, PATCH), ensuring it's stringified
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
            options.body = JSON.stringify(req.body);
            // For debugging, you can uncomment the line below to see the body sent to ERPNext
            // console.log(`Sending body to ERPNext: ${options.body}`);
        }
        
        const erpResponse = await fetch(erpNextUrl, options);
        const responseData = await erpResponse.text(); // Get raw text to forward
        
        // For debugging, you can uncomment the lines below
        // console.log(`ERPNext response status: ${erpResponse.status}`);
        // console.log(`ERPNext response data (raw, first 200 chars): ${responseData.substring(0, 200)}...`);

        // Forward ERPNext's status code and relevant headers
        res.status(erpResponse.status);
        const contentType = erpResponse.headers.get('content-type');
        if (contentType) { // Corrected: Added parentheses for the if condition
            res.setHeader('Content-Type', contentType);
        }
        // Forward other headers if needed, e.g., erpResponse.headers.forEach((value, name) => res.setHeader(name, value));
        
        res.send(responseData);

    } catch (error) {
        console.error('Proxy Error:', error);
        // Send a more informative error response to the client
        res.status(500).json({ 
            error: 'Proxy server failed to connect to ERPNext or process the request.', 
            details: error.message,
            erpNextUrlAttempted: erpNextUrl
        });
    }
});

// Mount the proxy router at the /erpnext-api path
app.use('/erpnext-api', apiProxyRouter);

app.listen(port, () => {
    console.log(`Node.js proxy server listening at http://localhost:${port}`);
    console.log('Allowed origin for CORS (Live Server): http://127.0.0.1:5500');
    console.log(`Proxying requests from http://localhost:${port}/erpnext-api/* to ${ERPNEXT_API_BASE}`);
});
