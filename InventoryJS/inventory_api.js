const API_BASE = "https://fakestoreapi.com";

async function fetchProducts() {
  const res = await fetch(`${API_BASE}/products`);
  return res.json();
}

async function fetchProductById(id) {
  const res = await fetch(`${API_BASE}/products/${id}`);
  return res.json();
}
