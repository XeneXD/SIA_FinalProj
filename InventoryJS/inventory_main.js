import { fetchProducts } from './inventory_api.js';
import { renderProductList } from './inventory_stock.js';

// filepath: c:\Users\Joshua Enad\Documents\SIA_FinalProj\InventoryJS\inventory_main.js

// Wait for the DOM to fully load
window.addEventListener("DOMContentLoaded", async () => {
  try {
    // Display loading indicator
    document.getElementById("product-list").innerHTML = "<p>Loading inventory items from ERPNext...</p>";
    
    // Fetch products from ERPNext API
    const products = await fetchProducts();  
    
    // Check if we have any products
    if (!products || products.length === 0) {
      document.getElementById("product-list").innerHTML = "<p>No products found in ERPNext. Please add products.</p>";
      return;
    }
      // Render the list of products (now an async function)
    await renderProductList(products);    
    
    console.log('Product System Initialized');
  } catch (error) {
    console.error('Error initializing product system:', error);
    document.getElementById("product-list").innerHTML = `
      <p>Error loading inventory items: ${error.message}</p>
      <button onclick="location.reload()">Retry</button>
    `;
  }
});
