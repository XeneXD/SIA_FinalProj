import { fetchProductById, deleteItem, fetchProducts } from './inventory_api.js';
import { renderProductList } from './inventory_stock.js';

// Global variables
let selectedProductId = null;

// CRUD operations for inventory items
document.addEventListener('DOMContentLoaded', () => {
  console.log('CRUD.js loaded and DOM content loaded');
  
  // Get DOM elements
  const addButton = document.getElementById('show-add-form');
  console.log('Add button found:', addButton);

  // Event listeners for CRUD buttons
  addButton.addEventListener('click', () => {
    console.log('Add button clicked');
    // Redirect to the add page instead of showing the form
    window.location.href = 'inventory_add.html';
  });
  
  // Add global event listeners for edit and delete buttons
  document.addEventListener('click', (e) => {
    // Check if the click was on an edit button
    if (e.target.classList.contains('edit-button') || e.target.closest('.edit-button')) {
      console.log('Edit button clicked');
      e.stopPropagation();
      const button = e.target.classList.contains('edit-button') ? e.target : e.target.closest('.edit-button');
      const productId = button.getAttribute('data-product-id');
      console.log('Product ID from edit button:', productId);
      if (productId) {
        console.log('Redirecting to edit page with ID:', productId);
        // Redirect to the edit page
        window.location.href = `inventory_edit.html?id=${encodeURIComponent(productId)}`;
      }
    }
    
    // Check if the click was on a delete button
    if (e.target.classList.contains('delete-button') || e.target.closest('.delete-button')) {
      console.log('Delete button clicked');
      e.stopPropagation();
      const button = e.target.classList.contains('delete-button') ? e.target : e.target.closest('.delete-button');
      const productId = button.getAttribute('data-product-id');
      console.log('Product ID from delete button:', productId);
      if (productId) {
        deleteSelectedItem(productId);
      }
    }
  });
});

// Delete the selected item
export async function deleteSelectedItem(itemId) {
  // If itemId is passed directly (from icon click), use it
  // Otherwise fall back to the global selectedProductId
  const productId = itemId || selectedProductId;
  
  if (!productId) {
    alert('Please select a product to delete');
    return;
  }
  
  // Confirm deletion
  const product = await fetchProductById(productId);
  const itemName = product.item_name || product.name;
  if (!confirm(`Are you sure you want to delete "${itemName}"?`)) {
    return;
  }
    try {
    await deleteItem(productId);
    alert(`Item ${itemName} deleted successfully`);
    
    // Refresh product list
    const products = await fetchProducts();
    renderProductList(products);
      // Clear selection and hide detail view
    if (productId === selectedProductId) {
      selectedProductId = null;
      document.getElementById('product-detail').classList.add('hidden');
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    alert(`Error deleting item: ${error.message}`);
  }
}

