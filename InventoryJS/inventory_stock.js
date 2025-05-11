let selectedProductId = null;
let inventoryMap = {}; // Local inventory quantity tracking

function renderProductList(products) {
  const list = document.getElementById("product-list");
  list.innerHTML = "";
  products.forEach(product => {
    inventoryMap[product.id] = inventoryMap[product.id] || Math.floor(Math.random() * 100); // mock stock quantity
    const div = document.createElement("div");
    div.className = "product-card";
    div.innerHTML = `
      <h2>${product.title}</h2>
      <img src="${product.image}" width="100">
      <p>Price: $${product.price}</p>
      <p>Stock: ${inventoryMap[product.id]}</p>
    `;
    div.addEventListener("click", () => showProductDetail(product.id));
    list.appendChild(div);
  });
}

async function showProductDetail(id) {
  selectedProductId = id;
  const detail = document.getElementById("product-detail");
  const product = await fetchProductById(id);
  detail.innerHTML = `
    <h2>${product.title}</h2>
    <img src="${product.image}" width="150">
    <p><strong>Description:</strong> ${product.description}</p>
    <p><strong>Price:</strong> $${product.price}</p>
    <p><strong>Category:</strong> ${product.category}</p>
    <p><strong>Stock Quantity:</strong> ${inventoryMap[id]}</p>
  `;
  detail.classList.remove("hidden");
  document.getElementById("stock-input").value = inventoryMap[id];
}

function updateStock() {
  const input = document.getElementById("stock-input");
  const status = document.getElementById("stock-status");
  const qty = parseInt(input.value);
  if (!selectedProductId || isNaN(qty)) {
    status.textContent = "Invalid input or no product selected.";
    return;
  }
  inventoryMap[selectedProductId] = qty;
  status.textContent = `Stock for product #${selectedProductId} updated to ${qty}`;
  showProductDetail(selectedProductId);
}
