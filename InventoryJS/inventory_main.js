
window.addEventListener("DOMContentLoaded", async () => {
  const products = await fetchProducts();
  renderProductList(products);
  document.getElementById("update-stock").addEventListener("click", updateStock);
});