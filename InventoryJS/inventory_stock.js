import { getBestProductName } from './inventory_api.js';
import { deleteSelectedItem } from './inventory_crud.js';

let selectedProductId = null;

// Helper function to get the best display name for a product
function getProductDisplayName(product) {
  // Use the helper function from inventory_api.js
  return getBestProductName(product);
}

// Render the list of products with clickable cards
export async function renderProductList(products) {
  const list = document.getElementById("product-list");
  list.innerHTML = "<p>Loading product items...</p>";
  
  // Log products to see what we're getting
  console.log("Products to render:", products);
  
  // If products is not an array, show error and return
  if (!Array.isArray(products)) {
    list.innerHTML = "<p>Error loading products. Check console for details.</p>";
    return;
  }

  // Clear the loading message
  list.innerHTML = "";
  
  // Process each product
  for (const product of products) {
    // For ERPNext, the ID is likely 'name'
    const productId = product.name;
      
    // Use a local placeholder instead of an external service that might fail
    const defaultImage = './placeholder.svg'; // Use the SVG we created
    // Or use a data URI for a simple colored rectangle
    const dataUriPlaceholder = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23cccccc'/%3E%3Ctext x='50%25' y='50%25' font-size='18' text-anchor='middle' dominant-baseline='middle' fill='%23666666'%3E${encodeURIComponent(product.item_code || productId || 'Product')}%3C/text%3E%3C/svg%3E`;
      
    // Format price properly from ERPNext data
    let price = 'N/A';
    let priceSource = 'none';
      
    // For logging and debugging price values
    console.log(`Price fields for ${productId}:`, {
      price_list_rate: product.price_list_rate,
      standard_rate: product.standard_rate,
      valuation_rate: product.valuation_rate
    });
    
    // CRITICAL FIX: Use valuation_rate ONLY since this is what's shown in ERPNext (400.00)
    // This ensures consistent price display throughout the application
    if (product.valuation_rate !== undefined) {
      price = parseFloat(product.valuation_rate).toFixed(2);
      priceSource = 'valuation_rate';
      console.log(`Using valuation_rate for ${productId}: ${price}`);
    }
    // These fallbacks will only be used if valuation_rate is completely missing
    else if (product.standard_rate !== undefined) {
      price = parseFloat(product.standard_rate).toFixed(2);
      priceSource = 'standard_rate';
      console.log(`Using standard_rate for ${productId}: ${price}`);
    } 
    else if (product.price_list_rate !== undefined) {
      price = parseFloat(product.price_list_rate).toFixed(2);
      priceSource = 'price_list_rate';
      console.log(`Using price_list_rate for ${productId}: ${price}`);
    } 
    else {
      console.warn(`No price found for product ${productId} - showing N/A`);
    }
    
    // Store price info in product for later reference
    product.displayed_price = price;
    product.price_source = priceSource;
    
    // Get the best available name for the product
    const productName = getProductDisplayName(product);    
    
    const div = document.createElement("div");
    div.className = "product-card";    
    div.innerHTML = `
      <div class="card-header">
        <h2>${productName}</h2>
        <div class="card-actions">
          <button class="icon-button edit-button" data-product-id="${productId}" title="Edit Item">✏️</button>
          <button class="icon-button delete-button" data-product-id="${productId}" title="Delete Item">🗑️</button>
        </div>      </div>
      <img src="${product.image_url || dataUriPlaceholder}" width="100" height="100" alt="${productName}" 
           onerror="this.src='${dataUriPlaceholder}'; this.onerror=null;">
      <p>Price: ${price === 'N/A' ? 'N/A' : '$' + price}</p>
      <p><small class="price-source">${price === 'N/A' ? '' : '(Price from ' + priceSource + ')'}</small></p>
      <p class="product-id">ID: ${product.item_code || productId}</p>
    `;
    
    // Main card click to view details
    div.querySelector("img").addEventListener("click", () => showProductDetail(productId));
    div.querySelector("h2").addEventListener("click", () => showProductDetail(productId));    
    
    // Add direct click handlers for the buttons
    const editButton = div.querySelector(".edit-button");
    editButton.addEventListener("click", (e) => {
      e.stopPropagation();
      console.log('Edit button clicked directly with ID:', productId);
      window.location.href = `inventory_edit.html?id=${encodeURIComponent(productId)}`;
    });
    
    const deleteButton = div.querySelector(".delete-button");
    deleteButton.addEventListener("click", (e) => {
      e.stopPropagation();
      console.log('Delete button clicked directly with ID:', productId);
      deleteSelectedItem(productId);
    });
    
    list.appendChild(div);
  }
}

// Show detailed info of the selected product
export async function showProductDetail(id) {
  selectedProductId = id;
  const detail = document.getElementById("product-detail");
  const product = await fetchProductById(id);
  
  console.log("Product detail:", product); // Log what we get from fetchProductById
  
  // Generate a placeholder image URL
  const imageUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23cccccc'/%3E%3Ctext x='50%25' y='50%25' font-size='18' text-anchor='middle' dominant-baseline='middle' fill='%23666666'%3E${encodeURIComponent(product.item_code || id || 'Product')}%3C/text%3E%3C/svg%3E`;
    
  // Format price properly from ERPNext data
  let price = 'N/A';
  
  // CRITICAL FIX: Use valuation_rate ONLY since this is what's shown in ERPNext (400.00)
  // This ensures consistent price display with the list view and ERPNext
  if (product.valuation_rate !== undefined) {
    price = parseFloat(product.valuation_rate).toFixed(2);
    console.log(`Detail view using valuation_rate for ${id}: ${price}`);
  } 
  // These fallbacks will only be used if valuation_rate is completely missing
  else if (product.standard_rate !== undefined) {
    price = parseFloat(product.standard_rate).toFixed(2);
    console.log(`Detail view using standard_rate for ${id}: ${price}`);
  } else if (product.price_list_rate !== undefined) {
    price = parseFloat(product.price_list_rate).toFixed(2);
    console.log(`Detail view using price_list_rate for ${id}: ${price}`);
  } else {
    console.warn(`No price found for product detail ${id} - showing N/A`);
  }
  
  const productName = getProductDisplayName(product);
  
  detail.innerHTML = `
    <h2>${productName}</h2>
    <img src="${product.image_url || imageUrl}" width="150" alt="${productName}" 
         onerror="this.src='${imageUrl}'; this.onerror=null;">
    <p><strong>Description:</strong> ${product.description || "No description available"}</p>
    <p><strong>Price:</strong> ${price === 'N/A' ? 'N/A' : '$' + price}</p>
    <p><strong>Item Group:</strong> ${product.item_group || "N/A"}</p>
    <p><strong>Item ID/SKU:</strong> ${product.item_code || id}</p>
  `;
  
  // Show the detail section
  detail.classList.remove("hidden");
  
  // Dispatch event to notify that a product was selected (for CRUD operations)
  document.dispatchEvent(new CustomEvent('productSelected', { 
    detail: { productId: id, product: product }
  }));
}

