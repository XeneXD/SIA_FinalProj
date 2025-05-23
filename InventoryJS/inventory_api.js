// Helper function to extract the best display name from ERPNext data
function getBestProductName(product) {
  if (!product) return "Unknown Item";
  
  // Log all fields to understand what's available in ERPNext
  console.log("Product fields for naming:", {
    name: product.name,
    item_name: product.item_name,
    item_code: product.item_code,
    description: product.description ? product.description.substring(0, 30) : null
  });
  
  // First, ensure we have the minimum required fields
  // If fields are missing, derive them from what's available
  if (!product.item_code && product.name) {
    product.item_code = product.name;
  }
  
  if (!product.item_name) {
    // Try to use description first
    if (product.description) {
      product.item_name = product.description.split(' ').slice(0, 5).join(' ');
      if (product.description.length > product.item_name.length) {
        product.item_name += '...';
      }
    } else {
      // Fall back to item_code or name
      product.item_name = product.item_code || product.name || "Unnamed Item";
    }
  }
  
  // Priority order for naming:
  // 1. item_name (if present and different from item_code)
  // 2. description (first part)
  // 3. name (if different from item_code)
  // 4. item_code as fallback
  
  if (product.item_name && product.item_name !== product.item_code) {
    return product.item_name;
  }
  
  if (product.description) {
    const shortDesc = product.description.split(' ').slice(0, 4).join(' ');
    return shortDesc + (product.description.length > shortDesc.length ? '...' : '');
  }
  
  if (product.name && product.name !== product.item_code) {
    return product.name;
  }
  
  return product.item_code || product.name || "Unknown Item";
}

const API_BASE = 'http://localhost:3001/erpnext-api'; // Points to our local Node.js proxy

function getAuthHeaders() {
  // Authentication is now handled by the proxy server.
  // We still need to tell the proxy (and ERPNext via proxy) we're sending JSON.
  return {
    "Content-Type": "application/json",
    "Accept": "application/json" 
  };
}

async function fetchProducts() {
  // The path /Item is now part of the URL sent to the proxy
  // Add fields parameter to ensure we get all important fields including valuation_rate
  const url = `${API_BASE}/Item?fields=[\"*\"]&limit_page_length=20`; 
  console.log(`Fetching products from: ${url}`);
  
  try { // Added try block for better error handling of fetch itself
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    console.log('fetchProducts - Raw response status:', res.status, res.statusText);
    const responseText = await res.text(); // Get text first to avoid parsing errors if not JSON
    console.log('fetchProducts - Raw response text:', responseText);

    if (!res.ok) {
      console.error('fetchProducts - Fetch not successful:', res.status, responseText);
      // Try to parse as JSON for ERPNext error message, otherwise use text
      let errorMsg = responseText;
      try {
        const errorJson = JSON.parse(responseText);
        errorMsg = errorJson.message || errorJson.exception || responseText;
      } catch (e) {
        // Not JSON, use raw text
      }
      throw new Error(`Failed to fetch products (${res.status}): ${errorMsg}`);
    }
    
    const data = JSON.parse(responseText); // Parse after checking res.ok and logging
    console.log("fetchProducts - Parsed API Response (data):", data); 
    
    if (!data || !data.data) {
      console.warn("fetchProducts - API response is missing 'data' field or is null:", data);
      return []; // Return empty array if no data field
    }
    
    console.log("fetchProducts - data.data:", data.data);
    console.log(`fetchProducts - Number of products received from API: ${data.data ? data.data.length : 0}`);

    // CRITICAL FIX: Log valuation rate specifically to ensure we\'re getting it
    if (data && data.data && data.data.length > 0) {
      data.data.forEach(item => {
        console.log(`Item ${item.name || item.item_code} valuation_rate: ${item.valuation_rate}`);
      });
    }
    
    // If we have data, log the first item to understand its structure
    if (data && data.data && data.data.length > 0) {
      console.log("fetchProducts - Example product structure (first product):", data.data[0]);
      
      // Log specifically the fields we're interested in for naming and pricing
      console.log("Available item fields:", data.data.map(item => ({
        id: item.name,
        item_code: item.item_code,
        item_name: item.item_name,
        standard_rate: item.standard_rate,
        valuation_rate: item.valuation_rate,
        description: item.description ? item.description.substring(0, 30) + '...' : 'None'
      })));
        // Fetch prices for all products from Item Price
    try {
      console.log("Fetching prices for all products...");
      
      // Get all item prices from ERPNext
      const priceUrl = `${API_BASE}/Item Price?fields=["*"]&filters=[["price_list","=","Standard Selling"]]&limit_page_length=100`;
      console.log(`Fetching prices from: ${priceUrl}`);
      
      const priceRes = await fetch(priceUrl, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (priceRes.ok) {
        const priceData = await priceRes.json();
        console.log("Item Price data:", priceData);
        
        if (priceData && priceData.data && priceData.data.length > 0) {
          // Create a map of item_code to price
          const priceMap = {};
          priceData.data.forEach(price => {
            if (price.item_code) {
              priceMap[price.item_code] = parseFloat(price.price_list_rate).toFixed(2);
              console.log(`Price for ${price.item_code}: ${priceMap[price.item_code]}`);
            }
          });
          
          // Update prices in the product data
          data.data.forEach(product => {
            const itemCode = product.item_code || product.name;
            
            if (priceMap[itemCode]) {
              // If we found a price in Item Price, use it
              product.price_list_rate = parseFloat(priceMap[itemCode]);
              console.log(`Added Item Price for ${itemCode}: ${product.price_list_rate}`);
            } else if (product.valuation_rate !== undefined) {
              // If no Item Price but there's a valuation_rate, use it as fallback
              console.log(`No Item Price found for ${itemCode}, using valuation_rate: ${product.valuation_rate}`);
            } else {
              // If no price found anywhere, set to 0
              console.log(`No price found for ${itemCode}, setting to 0`);
              product.valuation_rate = 0;
            }
          });
        } else {
          console.log("No Item Price records found, falling back to valuation_rate");
        }
      } else {
        console.error(`Failed to fetch prices: ${priceRes.status} ${priceRes.statusText}`);
      }
    } catch (priceError) {
      console.error("Error fetching prices:", priceError);
    }
  }
  
  console.log("fetchProducts - Returning data.data");
  return data.data || [];
  } catch (error) {
    console.error('fetchProducts - Error during fetch operation:', error);
    // Propagate the error so inventory_main.js can catch it
    // Or return empty array to prevent breaking the rendering logic,
    // but ensure the error is visible in the UI or console.
    throw error; // Re-throwing to be caught by inventory_main.js
  }
}

async function fetchProductById(id) {
  // Add fields=["*"] to ensure we get all available fields from ERPNext
  const url = `${API_BASE}/Item/${encodeURIComponent(id)}?fields=["*"]`;
  console.log(`Fetching product details from: ${url}`);
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Error fetching product (${res.status}):`, errorText);
      throw new Error(`Failed to fetch product: ${res.statusText}`);
    }
    
    const data = await res.json();
    
    // Log the full product object to see all available fields
    if (data && data.data) {
      console.log("Full product data:", data.data);
      
      // If item_code is missing but name is present, use name as item_code
      if (!data.data.item_code && data.data.name) {
        data.data.item_code = data.data.name;
        console.log("Using name as item_code:", data.data.item_code);
      }
      
      // If item_name is missing, create a default one based on available fields
      if (!data.data.item_name) {
        if (data.data.description) {
          // Use first few words of description as item_name
          data.data.item_name = data.data.description.split(' ').slice(0, 5).join(' ');
          if (data.data.description.length > data.data.item_name.length) {
            data.data.item_name += '...';
          }
        } else {
          // Use item_code or name as item_name
          data.data.item_name = data.data.item_code || data.data.name || "Unnamed Item";
        }
        console.log("Created default item_name:", data.data.item_name);
      }
        // Always fetch current price from Item Price for consistency
      try {
        console.log('Fetching price data from Item Price...');
        const priceUrl = `${API_BASE}/Item Price?filters=[["item_code","=","${encodeURIComponent(id)}"],["price_list","=","Standard Selling"]]`;
        console.log(`Price fetch URL: ${priceUrl}`);
        
        const priceRes = await fetch(priceUrl, {
          method: 'GET',
          headers: getAuthHeaders()
        });
        
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          console.log('Price data response:', priceData);
          
          if (priceData && priceData.data && priceData.data.length > 0) {
            // Add price to the product data
            data.data.price_list_rate = parseFloat(priceData.data[0].price_list_rate);
            console.log(`Found price in Item Price: ${data.data.price_list_rate}`);
          } else {
            console.log('No price found in Item Price doctype');
            
            // If we have valuation_rate but no price_list_rate, add a note
            if (data.data.valuation_rate !== undefined) {
              console.log(`Using valuation_rate as fallback: ${data.data.valuation_rate}`);
            } else {
              console.log('No price information found for this item');
            }
          }
        }
      } catch (priceError) {
        console.error('Error fetching price data:', priceError);
      }
    }
    
    return data.data || null;
  } catch (error) {
    console.error('Error in fetchProductById:', error);
    throw error;
  }
}

// Fetch stock information for an item from ERPNext
async function fetchStockInfo(itemId) {
  // In ERPNext, stock information is stored in the "Bin" doctype
  const url = `${API_BASE}/Bin?filters=[["item_code","=","${encodeURIComponent(itemId)}"]]`;
  console.log(`Fetching stock info for item ${itemId} from ${url}`);
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    const data = await res.json();
    console.log("Stock info response:", data);
    
    // Check if we have valid data
    if (data && data.data && data.data.length > 0) {
      // Sum up quantities across all warehouses
      let totalQty = 0;
      data.data.forEach(bin => {
        totalQty += (bin.actual_qty || 0);
      });
      return totalQty;
    }
    
    return 0; // Default to 0 if no stock info found
  } catch (error) {
    console.error('Error fetching stock info:', error);
    return 0; // Default to 0 on error
  }
}

async function updateStockOnERP(itemId, quantity) {
  // In ERPNext, we need to create a Stock Entry to update inventory
  // This is a simplified version - in a real system, you'd need to create a proper Stock Entry
  // with source and target warehouses, valuation rates, etc.
  const url = `${API_BASE}/Stock Entry`;
  
  // We need to create a proper payload for a Stock Entry
  const payload = {
    doctype: "Stock Entry",
    stock_entry_type: "Material Receipt", // For adding stock
    to_warehouse: "Stores - WP", // Replace with your actual warehouse code
    items: [
      {
        item_code: itemId,
        qty: quantity,
        transfer_qty: quantity
      }
    ]
  };

  console.log(`Attempting to update stock for item ${itemId} to ${quantity}`);
    try {
    const res = await fetch(url, {
      method: 'POST', // For creating a new Stock Entry
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    
    console.log(`Update stock response status: ${res.status}`);
    
    if (!res.ok) {
      // Try to parse error from ERPNext if possible
      const errorData = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`ERPNext API Error (${res.status}): ${errorData.message || errorData.exception || 'Unknown error'}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Error updating stock on ERPNext:', error);
    // Re-throw or handle as needed, maybe return a specific error structure
    throw error; 
  }
}

// Create a new inventory item in ERPNext
async function createItem(itemData) {
  const url = `${API_BASE}/Item`;
  
  try {
    console.log(`Creating new item:`, itemData);
    console.log('Request payload:', JSON.stringify(itemData, null, 2));
    console.log('Request URL:', url);
    
    const res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(itemData)
    });
    
    console.log(`Create item response status: ${res.status}`);
    
    const responseText = await res.text();
    console.log('Raw response from ERPNext:', responseText);

    if (!res.ok) {
      const errorData = JSON.parse(responseText);
      throw new Error(`ERPNext API Error (${res.status}): ${errorData.message || errorData.exception || 'Unknown error'}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Error creating item:', error);
    throw error;
  }
}

// Update an existing inventory item in ERPNext
async function updateItem(itemId, itemData) {
  const url = `${API_BASE}/Item/${encodeURIComponent(itemId)}`;
  
  try {
    console.log(`Updating item ${itemId}:`, itemData);
    console.log(`Full update URL: ${url}`);
    
    // For ERPNext, we need to first fetch the existing item to preserve fields
    // that we don't want to change and to ensure we're using the correct structure
    const existingItem = await fetchProductById(itemId);
    if (!existingItem) {
      throw new Error(`Item with ID ${itemId} not found`);
    }
    
    // Preserve the original item_code (SKU) since it's a key identifier in ERPNext
    const originalItemCode = existingItem.item_code;    // Create a proper payload for ERPNext update
    // Be careful about fields that should not be changed
    const erpPayload = {
      // Preserve fields we don't want to overwrite if they exist
      ...existingItem,
      // Update the fields that we want to change
      item_name: itemData.item_name,
      description: itemData.description,
      item_group: itemData.item_group || existingItem.item_group || 'Products',
      // CRITICAL FIX: Update valuation_rate to match what's shown in ERPNext (400.00)
      // This ensures consistent price display throughout the application
      valuation_rate: parseFloat(parseFloat(itemData.valuation_rate || itemData.standard_rate).toFixed(2)),
      // Also update standard_rate for backward compatibility
      standard_rate: parseFloat(parseFloat(itemData.standard_rate || itemData.valuation_rate).toFixed(2)),
      // If we want to update the item_code, use a separate API call or handle it specially
      // For now, preserve the original to prevent errors
      item_code: originalItemCode
    };
    
    // Add special debug log for pricing fields
    console.log('Pricing fields before update:', {
      existing_standard_rate: existingItem.standard_rate,
      existing_valuation_rate: existingItem.valuation_rate,
      new_standard_rate: itemData.standard_rate,
      new_standard_rate_formatted: parseFloat(parseFloat(itemData.standard_rate).toFixed(2)),
      final_standard_rate: erpPayload.standard_rate
    });
    
    console.log('Sending payload to ERPNext:', JSON.stringify(erpPayload, null, 2));
    
    const res = await fetch(url, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(erpPayload)
    });
    
    console.log(`Update item response status: ${res.status}`);
    
    // Get the full response text for debugging
    const responseText = await res.text();
    console.log('Raw response from ERPNext:', responseText);
    
    // Try to parse it as JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('Parsed response:', responseData);
      
      // If the update was successful but we want to update the item_code (which is a separate operation),
      // handle that here if needed
      if (res.ok && itemData.item_code && itemData.item_code !== originalItemCode) {
        console.log(`Item code change requested from ${originalItemCode} to ${itemData.item_code}`);
        console.log('Note: Changing item_code requires special handling in ERPNext');
        // You would need a separate API call or approach to rename an item_code
      }
    } catch (parseError) {
      console.error('Could not parse response as JSON:', parseError);
    }
    
    if (!res.ok) {
      const errorData = responseData || { message: res.statusText };
      throw new Error(`ERPNext API Error (${res.status}): ${errorData.message || errorData.exception || errorData.exc || 'Unknown error'}`);
    }
      // If we need to update item price separately (which is common in ERPNext)
    if (res.ok) {
      // Check if either valuation_rate or standard_rate was provided and has changed
      const newPrice = parseFloat(itemData.valuation_rate || itemData.standard_rate);
      const oldPrice = parseFloat(existingItem.valuation_rate || existingItem.standard_rate || 0);
      
      console.log('Price comparison for Item Price update:', {
        newPrice: newPrice,
        oldPrice: oldPrice,
        shouldUpdate: newPrice !== oldPrice
      });
      
      if (!isNaN(newPrice) && newPrice !== oldPrice) {
        console.log(`Price changed from ${oldPrice} to ${newPrice}, updating Item Price...`);
        await updateItemPrice(itemId, newPrice);
      } else {
        console.log('Price unchanged or invalid, skipping Item Price update');
      }
    }
    
    return responseData;
  } catch (error) {
    console.error('Error updating item:', error);
    throw error;
  }
}

// Update an item's price in ERPNext
// In ERPNext, prices are often stored in a separate doctype called "Item Price"
async function updateItemPrice(itemId, price) {
  // First, we need to check if an Item Price already exists for this item
  const priceUrl = `${API_BASE}/Item Price?filters=[["item_code","=","${encodeURIComponent(itemId)}"]]`;
  
  try {
    console.log(`Checking existing Item Price for ${itemId}`);
    
    // Format the price correctly with 2 decimal places for ERPNext
    const formattedPrice = parseFloat(parseFloat(price).toFixed(2));
    console.log(`Price update - Raw: ${price}, Formatted: ${formattedPrice}`);
    
    const res = await fetch(priceUrl, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch Item Price: ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log('Item Price search results:', data);
    
    let priceMethod = 'POST'; // Default to creating a new price
    let priceDocUrl = `${API_BASE}/Item Price`;
    let pricePayload = {
      doctype: "Item Price",
      item_code: itemId,
      price_list: "Standard Selling", // Adjust based on your ERPNext setup
      price_list_rate: formattedPrice,
      currency: "PHP", // Change to your currency code
      valid_from: new Date().toISOString().split('T')[0] // Today's date
    };
    
    // If an Item Price already exists, update it instead of creating new
    if (data && data.data && data.data.length > 0) {
      const existingPrice = data.data[0];
      priceMethod = 'PUT';
      priceDocUrl = `${API_BASE}/Item Price/${existingPrice.name}`;
      pricePayload = {
        price_list_rate: formattedPrice,
        valid_from: new Date().toISOString().split('T')[0] // Update the valid from date
      };
      console.log(`Updating existing Item Price document: ${existingPrice.name}`);
    } else {
      console.log('Creating new Item Price document');
    }
    
    console.log('Price update URL:', priceDocUrl);
    console.log('Price update payload:', pricePayload);
    console.log('Price value type:', typeof pricePayload.price_list_rate, 'Value:', pricePayload.price_list_rate);
    
    const updateRes = await fetch(priceDocUrl, {
      method: priceMethod,
      headers: getAuthHeaders(),
      body: JSON.stringify(pricePayload)
    });
    
    console.log(`Price update response status: ${updateRes.status}`);
    
    const responseText = await updateRes.text();
    console.log('Raw price update response:', responseText);
    
    if (!updateRes.ok) {
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(`ERPNext API Error: ${errorData.message || errorData.exception || 'Unknown error'}`);
      } catch (e) {
        throw new Error(`Failed to update price: ${updateRes.statusText}`);
      }
    }
    
    return JSON.parse(responseText);
  } catch (error) {
    console.error('Error updating item price:', error);
    throw error;
  }
}

// Delete an inventory item from ERPNext
async function deleteItem(itemId) {
  const url = `${API_BASE}/Item/${encodeURIComponent(itemId)}`;
  
  try {
    console.log(`Deleting item ${itemId}`);
    
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    console.log(`Delete item response status: ${res.status}`);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`ERPNext API Error (${res.status}): ${errorData.message || errorData.exception || 'Unknown error'}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
}

// Export the fetchProductById, getBestProductName and fetchProducts functions for use in other modules
export { fetchProductById, getBestProductName, fetchProducts, updateItem, createItem, deleteItem, updateStockOnERP };
