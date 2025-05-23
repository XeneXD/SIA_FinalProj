const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const port = 3001;

// --- ERPNext Configuration ---
const ERPNEXT_API_BASE = 'https://inventories.erpnext.com/api/resource';
const API_KEY = "4605af3327d4a26"; 
const API_SECRET = "ba94e560788e762"; 
// --- End ERPNext Configuration ---

// Middleware
app.use(cors({ origin: 'http://127.0.0.1:5500' }));
app.use(express.json());

// Simple middleware function that proxies all requests with /erpnext-api prefix
app.use((req, res, next) => {
  // Only process requests that start with /erpnext-api
  if (!req.url.startsWith('/erpnext-api/')) {
    return next();
  }
  // Extract the part after /erpnext-api/
  const path = req.url.substring('/erpnext-api/'.length);
  const erpNextUrl = `${ERPNEXT_API_BASE}/${path}`;
  
  console.log(`Proxying request: ${req.method} ${erpNextUrl}`);

  const headers = {
    'Accept': 'application/json',
    'Authorization': `Token ${API_KEY}:${API_SECRET}`
  };
  
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
  }

  const options = {
    method: req.method,
    headers: headers,
  };
  
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
    options.body = JSON.stringify(req.body);
    
    // Log more details for PUT and POST requests
    if (req.method === 'PUT' || req.method === 'POST') {
      console.log('Request body sent to ERPNext:');
      console.log(JSON.stringify(req.body, null, 2));
        // Add extra handling for Item updates
      if (path.startsWith('Item/') && req.method === 'PUT') {
        console.log('Detected Item update operation - special handling:');
        
        // Check for price field in the payload and ensure it's formatted correctly
        if (req.body.standard_rate !== undefined) {
          console.log(`Price update detected in Item doctype: ${req.body.standard_rate}`);
          console.log(`Price type: ${typeof req.body.standard_rate}`);
          
          // Ensure the price is a number with 2 decimal places for ERPNext
          if (typeof req.body.standard_rate === 'string') {
            req.body.standard_rate = parseFloat(parseFloat(req.body.standard_rate).toFixed(2));
            console.log(`Converted price to number: ${req.body.standard_rate}`);
          } else if (typeof req.body.standard_rate === 'number') {
            req.body.standard_rate = parseFloat(req.body.standard_rate.toFixed(2));
            console.log(`Formatted numeric price: ${req.body.standard_rate}`);
          }
          
          // Update the options.body with the corrected price
          options.body = JSON.stringify(req.body);
        }
      }
      
      // Handle Item Price doctype specifically for price updates
      if (path.startsWith('Item Price') && (req.method === 'PUT' || req.method === 'POST')) {
        console.log('Detected Item Price update operation:');
        
        if (req.body.price_list_rate !== undefined) {
          console.log(`Price rate update detected: ${req.body.price_list_rate}`);
          console.log(`Price rate type: ${typeof req.body.price_list_rate}`);
          
          // Ensure the price is a number with 2 decimal places
          if (typeof req.body.price_list_rate === 'string') {
            req.body.price_list_rate = parseFloat(parseFloat(req.body.price_list_rate).toFixed(2));
            console.log(`Converted price rate to number: ${req.body.price_list_rate}`);
          } else if (typeof req.body.price_list_rate === 'number') {
            req.body.price_list_rate = parseFloat(req.body.price_list_rate.toFixed(2));
            console.log(`Formatted numeric price rate: ${req.body.price_list_rate}`);
          }
          
          // Update the options.body with the corrected price
          options.body = JSON.stringify(req.body);
        }
      }
      
      console.log('Full request options:');
      console.log(JSON.stringify({
        url: erpNextUrl,
        method: options.method,
        headers: options.headers,
        body: JSON.parse(options.body) // Parse to make it readable
      }, null, 2));
    }
  }
    fetch(erpNextUrl, options)
    .then(erpResponse => {
      // Get the response content type
      const contentType = erpResponse.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      // Set the status code
      res.status(erpResponse.status);
      console.log(`ERPNext response status: ${erpResponse.status}`);
      
      // Enhanced logging for non-success responses
      if (!erpResponse.ok) {
        console.log(`ERPNext error response for ${req.method} ${erpNextUrl} (${erpResponse.status})`);
        // Add special handling for common error codes
        if (erpResponse.status === 404) {
          console.log('Resource not found in ERPNext');
        } else if (erpResponse.status === 403) {
          console.log('Permission denied in ERPNext - check API keys and permissions');
        } else if (erpResponse.status === 400) {
          console.log('Bad request - likely an issue with the payload format');
        }
      } else {
        console.log(`ERPNext successful response for ${req.method} ${erpNextUrl}`);
      }
      
      // Return response text
      return erpResponse.text();
    })
    .then(responseData => {
      // Try to parse as JSON for better logging, but still send original text
      try {
        const jsonData = JSON.parse(responseData);
        
        // For item updates, provide more detailed logging
        if (path.startsWith('Item/') && req.method === 'PUT') {
          console.log('Item update response data:', jsonData);
        }
        
        // Check for specific ERPNext error messages that might be in a 200 response
        if (jsonData.exc_type || jsonData.exception || jsonData._server_messages) {
          console.log('ERPNext returned an error in the response body:');
          console.log(jsonData.exc_type || jsonData.exception || jsonData._server_messages);
        }
      } catch (e) {
        // Not JSON or invalid JSON, just continue
        console.log('Response is not valid JSON');
      }
      
      res.send(responseData);
    })
    .catch(error => {
      console.error('Proxy Error:', error);
      res.status(500).json({ 
        error: 'Proxy server failed', 
        details: error.message,
        erpNextUrlAttempted: erpNextUrl
      });
    });
});

app.listen(port, () => {
  console.log(`Simple proxy server listening at http://localhost:${port}`);
  console.log('Allowed origin for CORS (Live Server): http://127.0.0.1:5500');
  console.log(`Proxying requests from http://localhost:${port}/erpnext-api/* to ${ERPNEXT_API_BASE}`);
});
