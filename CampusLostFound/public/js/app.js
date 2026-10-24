const grid = document.getElementById("itemsGrid");
const message = document.getElementById("message");
const emptyState = document.getElementById("emptyState");
const form = document.getElementById("reportForm");
const formMessage = document.getElementById("formMessage");
let searchTimer;

const icons = {
  "ID Card": "▣", Wallet: "▰", Books: "▤", Electronics: "▱",
  Keys: "⚿", Clothing: "◇", Bag: "▢", Other: "✦"
};
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));
const safeUrl = value => {
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/uploads/") ? url.href : "";
  } catch { return ""; }
};

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed. Please try again.");
  return data;
}

async function loadItems() {
  message.textContent = "";
  const params = new URLSearchParams();
  const search = document.getElementById("searchInput").value.trim();
  const type = document.getElementById("typeFilter").value;
  const category = document.getElementById("categoryFilter").value;
  const status = document.getElementById("statusFilter").value;
  if (search) params.set("search", search);
  if (type) params.set("type", type);
  if (category) params.set("category", category);
  if (status) params.set("status", status);
  grid.innerHTML = '<div class="loading">Loading community reports…</div>';
  emptyState.classList.add("hidden");
  try {
    const items = await request(`/api/items?${params.toString()}`);
    renderItems(items);
    updateStats();
  } catch (err) {
    grid.innerHTML = "";
    message.textContent = `${err.message} Check that the server and MySQL are running.`;
  }
}

function renderItems(items) {
  if (!items.length) {
    grid.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");
  grid.innerHTML = items.map(item => {
    const imageUrl = item.image_url ? safeUrl(item.image_url) : "";
    const statusLabel = item.status === "RESOLVED" ? "Resolved" : item.status === "CLAIMED" ? "Claimed" : "Open";
    const dateLabel = item.item_date ? new Date(`${item.item_date}T12:00:00`).toLocaleDateString() : new Date(item.created_at).toLocaleDateString();
    const phone = item.contact_phone ? `<div>☎ ${escapeHtml(item.contact_phone)}</div>` : "";
    return `<article class="item-card">
      <div class="item-image">${imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.item_name)}" loading="lazy" onerror="this.remove()">`
        : `<span class="image-placeholder" aria-hidden="true">${icons[item.category] || "✦"}</span>`}
        <span class="type-badge ${item.report_type.toLowerCase()}">${item.report_type === "LOST" ? "LOST ITEM" : "FOUND ITEM"}</span>
      </div>
      <div class="item-content">
        <div class="item-meta"><span>${escapeHtml(item.category)}</span><span>${escapeHtml(dateLabel)}</span></div>
        <h3>${escapeHtml(item.item_name)}</h3>
        <span class="category-label">${escapeHtml(item.category)}</span>
        <div class="item-description">${escapeHtml(item.description)}</div>
        <div class="item-location"><span>⌖</span><span>${escapeHtml(item.location)}</span></div>
        <div class="item-footer">
          <div class="contact"><b>${escapeHtml(item.contact_name)}</b><a href="mailto:${encodeURIComponent(item.contact_email)}">${escapeHtml(item.contact_email)}</a>${phone}</div>
          <span class="status-pill ${item.status.toLowerCase()}">${statusLabel}</span>
        </div>
      </div>
    </article>`;
  }).join("");
}

async function updateStats() {
  try {
    const items = await request("/api/items");
    document.getElementById("totalCount").textContent = items.length;
    document.getElementById("lostCount").textContent = items.filter(x => x.report_type === "LOST").length;
    document.getElementById("foundCount").textContent = items.filter(x => x.report_type === "FOUND").length;
    document.getElementById("resolvedCount").textContent = items.filter(x => x.status === "RESOLVED").length;
  } catch { /* list request displays the main error */ }
}

["typeFilter", "categoryFilter", "statusFilter"].forEach(id => {
  document.getElementById(id).addEventListener("change", loadItems);
});
document.getElementById("searchInput").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadItems, 250);
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  formMessage.textContent = "";
  formMessage.classList.remove("error");
  const submitButton = form.querySelector("button[type=submit]");
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Submitting…";
  try {
    const payload = new FormData(form);
    const created = await request("/api/items", { method: "POST", body: payload });
    form.reset();
    formMessage.textContent = `Report submitted successfully! Your report ID is #${created.id}.`;
    document.getElementById("statusFilter").value = "OPEN";
    document.getElementById("typeFilter").value = "";
    document.getElementById("categoryFilter").value = "";
    document.getElementById("searchInput").value = "";
    await loadItems();
    document.getElementById("items").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    formMessage.textContent = err.message;
    formMessage.classList.add("error");
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Submit report";
  }
});

loadItems();
