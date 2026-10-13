"use strict";
const F = window.Freehouse;
const remote = window.FreehouseRemote;
const STORAGE_KEY = "freehouse-demo-v2";
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const iconNames = { location_on: "MapPin", swap_horiz: "ArrowLeftRight", account_circle: "CircleUser", arrow_forward: "ArrowRight", send: "Send", add: "Plus", add_location_alt: "MapPinPlus", download: "Download", content_copy: "Copy", close: "X", travel_explore: "Compass", apartment: "Building2", event_available: "CalendarDays", map: "Map", groups: "Users", dashboard: "LayoutDashboard", bookmark: "Bookmark", edit: "Pencil", delete: "Trash2", login: "LogIn", search: "Search" };
iconNames.qr = "QrCode";
iconNames.refresh = "RefreshCw";
const icon = name => window.lucide.createElement(window.lucide[iconNames[name] || "Circle"], { width: 22, height: 22, "aria-hidden": "true", class: "app-icon" }).outerHTML;
document.querySelectorAll(".material-symbols-rounded").forEach(element => { element.outerHTML = icon(element.textContent.trim()); });
const money = value => value === 0 ? "Gratuito" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
const when = value => new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
function localDate(value) { const date = new Date(value); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); }
let state;
try { const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)); state = stored?.version === 2 && Array.isArray(stored.accounts) && Array.isArray(stored.experiences) ? stored : F.seed(); }
catch { state = F.seed(); }
let mode = F.account(state)?.role || "guest";
let selectedPlace = state.places[0].id, hostPlace = state.places[0].id;
let category = "Todas", mapCategory = "Todos", search = "", placeFilter = "all", route = "home", toastTimer, busy = !!remote, authMode = "signin", period = "upcoming";
function toast(message) { $("#toast").textContent = message; $("#toast").classList.add("visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4000); }
function persist() { if (remote) return; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { toast("Nao foi possivel salvar neste navegador. Os dados permanecem nesta aba."); } }
async function save() {
  if (!remote) { persist(); render(); return true; }
  busy = true; document.body.setAttribute("aria-busy", "true");
  try { state = await remote.commit(state); render(); return true; }
  catch (error) { state = remote.rollback(); render(); toast(error.message); return false; }
  finally { busy = false; document.body.removeAttribute("aria-busy"); }
}
function place(id) { return state.places.find(p => p.id === id); }
function user() { return F.account(state); }
function requireAccount(role = "guest") { if ((remote && user()) || user()?.role === role) return true; renderAccounts(); $("#account-form [name=role]").value = role; $("#account-dialog").showModal(); return false; }
const guestNav = [["home", "travel_explore", "Descobrir"], ["places", "apartment", "Lugares"], ["experiences", "event_available", "Agenda"], ["map", "map", "Guia local"], ["community", "groups", "Comunidade"], ["guest", "account_circle", "Minha conta"]];
const hostNav = [["host", "dashboard", "Meu painel"], ["hostel", "apartment", "Pagina do lugar"], ["host-community", "groups", "Planos do lugar"], ["experiences", "event_available", "Agenda publica"], ["map", "map", "Guia local"], ["guest", "account_circle", "Minha conta"]];
function navigation() {
  document.body.dataset.mode = mode;
  const items = mode === "host" ? hostNav : guestNav;
  $("#navigation").innerHTML = items.map(([id, symbol, title]) => `<button class="nav-item ${id === route ? "is-active" : ""}" type="button" data-route="${id}" title="${title}">${icon(symbol)}<span>${title}</span></button>`).join("");
  const mobile = mode === "host" ? hostNav.filter(item => item[0] !== "experiences") : [guestNav[0], guestNav[2], guestNav[3], guestNav[4], guestNav[5]];
  $("#bottom-navigation").innerHTML = mobile.map(([id, symbol, title]) => `<button class="bottom-item ${id === route ? "is-active" : ""}" type="button" data-route="${id}">${icon(symbol)}<span>${title}</span></button>`).join("");
  document.querySelectorAll("[data-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
}
function routeTo(next, writeHash = true) {
  if (!document.getElementById(next)?.classList.contains("screen")) next = "home";
  route = next; if (["host", "host-community"].includes(next)) mode = "host"; else if (["home", "places", "community"].includes(next)) mode = "guest";
  if (next === "hostel") { if (remote) remote.view(selectedPlace).catch(() => {}); else { state.views.push({ placeId: selectedPlace, at: new Date().toISOString() }); persist(); } }
  document.querySelectorAll(".screen").forEach(screen => screen.classList.toggle("is-current", screen.id === route));
  if (writeHash) { const fragment = next === "hostel" ? `${next}/${selectedPlace}` : next; if (location.hash !== `#${fragment}`) history.pushState(null, "", `#${fragment}`); }
  render(); window.scrollTo(0, 0); requestAnimationFrame(() => window.scrollTo(0, 0));
}
function readHash() { const [next, id] = location.hash.slice(1).split("/"); if (place(id)) selectedPlace = id; routeTo(next || "home", false); }
function joinButton(exp) { const joined = user()?.joined.includes(exp.id), available = F.upcoming(exp); return `<button type="button" class="join-button ${joined ? "is-joined" : ""}" data-action="join" data-id="${esc(exp.id)}" ${!available && !joined ? "disabled" : ""}>${joined ? "Interesse marcado" : available ? "Tenho interesse" : exp.status === "cancelled" ? "Cancelada" : "Encerrada"}</button>`; }
function saveButton(exp) { const saved = !!user()?.saved.includes(exp.id); return `<button type="button" class="icon-button ${saved ? "is-saved" : ""}" data-action="save" data-id="${esc(exp.id)}" title="${saved ? "Remover dos salvos" : "Salvar experiencia"}" aria-label="${saved ? "Remover dos salvos" : "Salvar experiencia"}" aria-pressed="${saved}">${icon("bookmark")}</button>`; }
function metadata(exp) { return `${when(exp.startsAt)} / ${money(exp.price)} / ${esc(exp.category)}`; }
function experienceCard(exp) { return `<article class="experience-card"><img src="${esc(exp.image)}" alt="${esc(exp.title)}" loading="lazy"><div class="card-body"><div class="card-meta">${metadata(exp)}</div><h3>${esc(exp.title)}</h3><p>${esc(place(exp.placeId)?.name)} / ${esc(exp.location)}</p></div><div class="card-actions">${joinButton(exp)}${saveButton(exp)}</div></article>`; }
function agendaItem(exp, host = false) {
  const controls = host ? `<button class="icon-button" type="button" data-action="participants" data-id="${esc(exp.id)}" aria-label="Ver interessados em ${esc(exp.title)}" title="Ver interessados">${icon("groups")}</button><button class="icon-button" type="button" data-action="edit-experience" data-id="${esc(exp.id)}" aria-label="Editar ${esc(exp.title)}" title="Editar">${icon("edit")}</button><button class="icon-button" type="button" data-action="delete-experience" data-id="${esc(exp.id)}" aria-label="Excluir ${esc(exp.title)}" title="Excluir">${icon("delete")}</button>` : `${joinButton(exp)}${saveButton(exp)}`;
  return `<article class="agenda-item"><div><div class="card-meta">${metadata(exp)}</div><h3>${esc(exp.title)}</h3><p>${esc(exp.description)}</p><div class="card-meta">${esc(exp.location)} / ${exp.capacity} lugares / ${F.interestCount(state, exp.id)} interesses</div>${exp.status !== "open" ? `<span class="status-label">${exp.status === "cancelled" ? "Cancelada" : "Encerrada"}</span>` : ""}</div><div class="card-actions">${controls}</div></article>`;
}
function placeCard(p) { return `<article class="place-card"><img src="${esc(p.image)}" alt="Imagem ilustrativa de ${esc(p.type)}" loading="lazy"><div class="card-body"><span class="tag">${esc(p.type)}</span><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p></div><button type="button" class="secondary-button" data-action="place" data-id="${esc(p.id)}">Ver lugar ${icon("arrow_forward")}</button></article>`; }
function sortedExperiences() { return [...state.experiences].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)); }
function renderExperiences() {
  $("#featured-experiences").innerHTML = sortedExperiences().filter(e => F.upcoming(e)).slice(0, 2).map(experienceCard).join("") || `<p class="empty-state">Nenhuma experiencia aberta por enquanto.</p>`;
  const normalized = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const list = sortedExperiences().filter(e => (period === "all" || (period === "upcoming" ? F.upcoming(e) : !F.upcoming(e))) && (category === "Todas" || e.category === category) && (placeFilter === "all" || e.placeId === placeFilter) && normalized(`${e.title} ${e.description} ${e.category} ${place(e.placeId)?.name}`).includes(normalized(search)));
  $("#experience-list").innerHTML = list.map(e => agendaItem(e)).join("") || `<p class="empty-state">Nenhuma experiencia encontrada. Tente outra categoria ou busca.</p>`;
  $("#experience-search").value = search;
  if (!$("#period-filter")) { const filter = document.createElement("select"); filter.id = "period-filter"; filter.setAttribute("aria-label", "Periodo da agenda"); filter.innerHTML = '<option value="upcoming">Proximas</option><option value="past">Encerradas e canceladas</option><option value="all">Todas as datas</option>'; $("#experiences .filter-bar").append(filter); filter.addEventListener("change", event => { period = event.target.value; renderExperiences(); }); }
  $("#period-filter").value = period;
  $("#place-filter").innerHTML = `<option value="all">Todos os lugares</option>` + state.places.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join(""); $("#place-filter").value = placeFilter;
  $("#category-filters").innerHTML = ["Todas", ...F.categories].map(c => `<button type="button" data-category="${esc(c)}" aria-pressed="${c === category}">${esc(c)}</button>`).join("");
}
function renderPlace() {
  const p = place(selectedPlace), stay = F.activeStay(user());
  $("#place-detail").innerHTML = `<img class="place-cover" src="${esc(p.image)}" alt="Imagem ilustrativa do lugar"><div class="place-heading"><div><span class="tag">${esc(p.type)}</span><h1>${esc(p.name)}</h1><p>${esc(p.description)}</p></div><button class="primary-button" type="button" data-action="checkin">${icon("login")}${stay?.placeId === p.id ? "Editar estadia" : "Vincular estadia"}</button></div><div class="section-head"><h2>Agenda do lugar</h2></div><div class="agenda-list">${sortedExperiences().filter(e => e.placeId === p.id).map(e => agendaItem(e)).join("") || `<p class="empty-state">Ainda sem experiencias na agenda.</p>`}</div><div class="section-head"><h2>Recomendacoes do anfitriao</h2></div><div class="map-list">${state.points.filter(point => point.placeId === p.id).map(point => pointCard(point)).join("") || `<p class="empty-state">As recomendacoes aparecerao aqui.</p>`}</div>`;
}
function pointCard(point, host = false) { return `<article class="map-point"><span class="tag">${esc(point.category)}</span><h3>${esc(point.name)}</h3><p>${esc(point.description)}</p><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point.query)}" target="_blank" rel="noopener noreferrer">Abrir no mapa</a>${host ? `<div class="card-actions"><button type="button" class="icon-button" data-action="edit-point" data-id="${esc(point.id)}" title="Editar ponto" aria-label="Editar ${esc(point.name)}">${icon("edit")}</button><button type="button" class="icon-button" data-action="delete-point" data-id="${esc(point.id)}" title="Excluir ponto" aria-label="Excluir ${esc(point.name)}">${icon("delete")}</button></div>` : ""}</article>`; }
function renderMap() { const categories = ["Todos", ...new Set(state.points.map(p => p.category))]; if (!categories.includes(mapCategory)) mapCategory = "Todos"; $("#map-filters").innerHTML = categories.map(c => `<button type="button" data-map-category="${esc(c)}" aria-pressed="${c === mapCategory}">${esc(c)}</button>`).join(""); $("#map-points").innerHTML = state.points.filter(p => mapCategory === "Todos" || p.category === mapCategory).map(p => pointCard(p)).join("") || `<p class="empty-state">Sem recomendacoes nesta categoria.</p>`; }
function renderCommunity() {
  const stay = F.activeStay(user());
  $("#community-context").innerHTML = stay ? `Planos de ${esc(place(stay.placeId)?.name)}. <button type="button" data-route="guest">Minha estadia</button>` : `Planos publicos na Barra da Lagoa. <button type="button" data-route="places">Vincular estadia</button>`;
  const posts = state.posts.filter(p => new Date(p.expiresAt).getTime() > Date.now() && (!stay || p.placeId === stay.placeId)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  $("#community-posts").innerHTML = posts.map(postCard).join("") || `<p class="empty-state">Ainda sem planos por aqui. Publique o primeiro encontro.</p>`;
}
function postCard(p) { const author = state.accounts.find(a => a.id === p.authorId), own = p.authorId === user()?.id; return `<article class="plan-card"><div class="plan-heading"><span class="avatar-letter">${esc(author?.name[0]?.toUpperCase() || "V")}</span><div><strong>${esc(author?.name || "Viajante")}</strong><small>${when(p.startsAt)} / ${esc(place(p.placeId)?.name || "Barra da Lagoa")}</small></div></div><p>${esc(p.text)}</p><div class="plan-actions"><button type="button" class="secondary-button" data-action="post-interest" data-id="${esc(p.id)}" aria-pressed="${p.interested.includes(user()?.id)}">${p.interested.includes(user()?.id) ? "Interesse marcado" : "Tenho interesse"} (${p.interested.length})</button>${own || (user()?.role === "host" && p.placeId === hostPlace) ? `<button class="icon-button" type="button" data-action="delete-post" data-id="${esc(p.id)}" aria-label="Excluir plano" title="Excluir plano">${icon("delete")}</button>` : ""}</div></article>`; }
function itinerary() { const u = user(); return u ? sortedExperiences().filter(e => u.saved.includes(e.id) || u.joined.includes(e.id)) : []; }
function stayMarkup() { const stay = F.activeStay(user()); return stay ? `<div class="stay-box"><span class="eyebrow">Minha estadia</span><h3>${esc(place(stay.placeId)?.name)}</h3><p>Ate ${new Date(stay.endsAt).toLocaleDateString("pt-BR")}</p><button class="secondary-button" type="button" data-action="stay-place">Ver lugar ${icon("arrow_forward")}</button></div>` : `<div class="stay-box"><span class="eyebrow">Minha estadia</span><p>Nenhuma estadia ativa</p><button class="secondary-button" type="button" data-route="places">Escolher lugar ${icon("arrow_forward")}</button></div>`; }
function renderGuest() {
  const u = user();
  if (!u) $("#guest-content").innerHTML = `<div class="empty-state">Seu perfil, seus planos e suas experiencias salvas.<br><button type="button" class="primary-button" data-action="account">${remote ? "Entrar" : "Entrar na demo"}</button></div>`;
  else $("#guest-content").innerHTML = `<div class="profile-head"><span class="avatar-letter">${esc(u.name[0].toUpperCase())}</span><div><span class="tag">${u.role === "guest" ? "Hospede" : "Anfitriao"}</span><h2>${esc(u.name)}</h2><p>${esc(u.bio || "")}</p></div><button type="button" class="icon-button" data-action="edit-profile" title="Editar perfil" aria-label="Editar perfil">${icon("edit")}</button></div><div class="profile-actions"><button class="secondary-button" type="button" data-action="account">Trocar perfil</button><button class="secondary-button" type="button" data-action="logout">Sair</button>${F.activeStay(u) ? `<button class="secondary-button" type="button" data-action="checkout">Encerrar estadia</button>` : ""}</div>${u.interests.length ? `<div class="card-meta">${u.interests.map(esc).join(" / ")}</div>` : ""}${u.role === "guest" ? stayMarkup() : ""}<div class="section-head"><h2>Meu roteiro</h2></div><div class="agenda-list">${itinerary().map(e => agendaItem(e)).join("") || `<p class="empty-state">Nenhuma experiencia salva ainda. <a href="#experiences">Explorar agenda</a></p>`}</div>`;
  $("#stay-summary").innerHTML = stayMarkup(); $("#rail-itinerary").innerHTML = itinerary().slice(0, 4).map(e => `<a class="rail-item" href="#experiences">${esc(e.title)}<small>${when(e.startsAt)}</small></a>`).join("") || `<p class="empty-state">Seu roteiro esta vazio.</p>`;
}
function renderHost() {
  const managed = state.places.filter(p => !remote || p.managedByMe);
  if (remote && !managed.some(p => p.id === hostPlace)) hostPlace = managed[0]?.id || "";
  $("#host-place").innerHTML = managed.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join(""); $("#host-place").value = hostPlace;
  $("#host-account").innerHTML = user() ? `${remote ? "Conta" : "Perfil local"}: ${esc(user().name)} ${remote ? '<button type="button" data-action="new-place">Cadastrar lugar</button>' : ""}` : `<button type="button" data-action="host-account">Entrar como anfitriao</button>`;
  if (remote && !managed.length) {
    $("#host-experiences").innerHTML = '<p class="empty-state">Nenhum lugar cadastrado na sua conta.</p>';
    $("#host-metrics").innerHTML = ""; $("#host-points").innerHTML = ""; $("#host .share-row").hidden = true;
    $("#host [data-action=new-experience]").disabled = true; $("#host [data-action=new-point]").disabled = true; $("#host [data-action=export-report]").disabled = true;
    $("#host-community-context").textContent = "Cadastre um lugar para acompanhar seus planos."; $("#host-community-posts").innerHTML = ""; return;
  }
  $("#host .share-row").hidden = false;
  $("#host [data-action=new-experience]").disabled = false; $("#host [data-action=new-point]").disabled = false;
  $("#host [data-action=export-report]").disabled = false;
  $("#host-community-context").textContent = place(hostPlace)?.name || "";
  $("#host-community-posts").innerHTML = state.posts.filter(p => p.placeId === hostPlace && Date.parse(p.expiresAt) > Date.now()).map(postCard).join("") || '<p class="empty-state">Nenhum plano ativo neste lugar.</p>';
  const m = F.metrics(state, hostPlace); $("#host-metrics").innerHTML = [[m.views, "Aberturas da pagina"], [m.experiences, "Experiencias"], [m.interests, "Interesses"], [m.posts, "Planos ativos"]].map(([value, label]) => `<div class="metric"><strong>${value}</strong><small>${label}</small></div>`).join("");
  $("#host-experiences").innerHTML = sortedExperiences().filter(e => e.placeId === hostPlace).map(e => agendaItem(e, true)).join("") || `<p class="empty-state">Publique a primeira experiencia deste lugar.</p>`;
  $("#host-points").innerHTML = state.points.filter(p => p.placeId === hostPlace).map(p => pointCard(p, true)).join("") || `<p class="empty-state">Adicione uma recomendacao para os hospedes.</p>`;
  const link = `${location.href.split("#")[0]}#hostel/${hostPlace}`; $("#place-public-link").href = link; $("#place-public-link").textContent = link;
  if (!$("#host [data-action=qr]")) { const button = document.createElement("button"); button.type = "button"; button.className = "icon-button"; button.dataset.action = "qr"; button.title = "Gerar QR code"; button.setAttribute("aria-label", "Gerar QR code"); button.innerHTML = icon("qr"); $("#host .share-row").append(button); }
}
function render() { navigation(); renderExperiences(); $("#home-places").innerHTML = state.places.map(placeCard).join(""); $("#place-directory").innerHTML = state.places.map(placeCard).join(""); renderPlace(); renderMap(); renderCommunity(); renderGuest(); renderHost(); }
function renderAccounts() {
  if (remote) {
    $("#account-form").innerHTML = `<div class="dialog-head"><h2 id="account-title">${authMode === "signup" ? "Criar conta" : authMode === "recover" ? "Recuperar acesso" : "Entrar"}</h2><button class="icon-button" type="button" data-action="close-dialog" aria-label="Fechar">${icon("close")}</button></div><input name="authMode" type="hidden" value="${authMode}">${authMode === "signup" ? '<label>Nome<input name="name" required maxlength="40" autocomplete="nickname"></label>' : ''}<label>Email<input name="email" type="email" required autocomplete="email"></label>${authMode !== "recover" ? `<label>Senha<input name="password" type="password" required minlength="8" autocomplete="${authMode === "signup" ? "new-password" : "current-password"}"></label>` : ''}<label>Versao<select name="role"><option value="guest">Hospede</option><option value="host">Anfitriao</option></select></label><p id="auth-error" role="alert"></p><button class="primary-button" type="submit">${authMode === "signup" ? "Criar conta" : authMode === "recover" ? "Enviar recuperacao" : "Entrar"}</button><div class="auth-options"><button class="text-button" type="button" data-auth-mode="${authMode === "signup" ? "signin" : "signup"}">${authMode === "signup" ? "Ja tenho conta" : "Criar conta"}</button><button class="text-button" type="button" data-auth-mode="recover">Esqueci minha senha</button></div>`;
    return;
  }
  $("#local-accounts").innerHTML = state.accounts.map(a => `<button class="local-account" type="button" data-action="login-local" data-id="${esc(a.id)}"><strong>${esc(a.name)}</strong><small>${a.role === "guest" ? "Hospede" : "Anfitriao"}</small></button>`).join("");
}
function dialogForm(title, contents, action, id = "") { $("#editor-content").innerHTML = `<form id="editor-form" data-kind="${action}" data-id="${esc(id)}"><div class="dialog-head"><h2 id="editor-title">${title}</h2><button class="icon-button" type="button" data-action="close-dialog" aria-label="Fechar" title="Fechar">${icon("close")}</button></div>${contents}<button class="primary-button" type="submit">Salvar</button></form>`; $("#editor-dialog").showModal(); }
function editExperience(id) {
  if (!requireAccount("host")) return; const e = state.experiences.find(item => item.id === id); if (e && e.placeId !== hostPlace) return;
  const data = e || { title: "", description: "", startsAt: new Date(Date.now() + 86400000).toISOString(), price: 0, capacity: 10, location: "", category: "Surf", status: "open" };
  dialogForm(e ? "Editar experiencia" : "Nova experiencia", `<label>Titulo<input name="title" required maxlength="80" value="${esc(data.title)}"></label><label>Descricao<textarea name="description" required maxlength="450">${esc(data.description)}</textarea></label><div class="form-grid"><label>Data e horario<input name="startsAt" type="datetime-local" required value="${localDate(data.startsAt)}"></label><label>Categoria<select name="category">${F.categories.map(c => `<option ${c === data.category ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Preco (R$)<input name="price" type="number" min="0" max="100000" step="0.01" required value="${data.price}"></label><label>Capacidade<input name="capacity" type="number" min="1" max="500" required value="${data.capacity}"></label><label class="full">Ponto de encontro<input name="location" required maxlength="100" value="${esc(data.location)}"></label><label class="full">Status<select name="status">${[["open", "Aberta"], ["closed", "Encerrada"], ["cancelled", "Cancelada"]].map(([value, label]) => `<option value="${value}" ${value === data.status ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>`, "experience", id);
}
function editPoint(id) { if (!requireAccount("host")) return; const p = state.points.find(item => item.id === id); if (p && p.placeId !== hostPlace) return; const data = p || { name: "", category: "Praia", description: "", query: "" }; dialogForm(p ? "Editar recomendacao" : "Nova recomendacao", `<label>Nome<input name="name" required maxlength="80" value="${esc(data.name)}"></label><label>Categoria<select name="category">${["Praia", "Trilha", "Passeio", "Cafe", "Bar", "Workspace", "Servico"].map(c => `<option ${c === data.category ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Recomendacao<textarea name="description" required maxlength="350">${esc(data.description)}</textarea></label><label>Endereco ou referencia no mapa<input name="query" required maxlength="180" value="${esc(data.query)}"></label>`, "point", id); }
function deleteDialog(kind, id, title) { dialogForm("Excluir " + title, `<p>Excluir este item da demo? Esta acao remove o item e seus vinculos.</p>`, kind, id); }
document.addEventListener("click", async event => {
  const target = event.target.closest("button, a"); if (!target) return;
  if (busy) { event.preventDefault(); return; }
  if (target.dataset.authMode) { authMode = target.dataset.authMode; renderAccounts(); return; }
  if (target.tagName === "A" && target.getAttribute("href")?.startsWith("#")) { event.preventDefault(); const [next, id] = target.getAttribute("href").slice(1).split("/"); if (place(id)) selectedPlace = id; routeTo(next); return; }
  if (target.dataset.route) { event.preventDefault(); if (target.dataset.route === "hostel" && mode === "host") selectedPlace = hostPlace; routeTo(target.dataset.route); return; }
  if (target.dataset.mode) { mode = target.dataset.mode; routeTo(mode === "host" ? "host" : "home"); return; }
  if (target.dataset.category) { category = target.dataset.category; renderExperiences(); return; }
  if (target.dataset.mapCategory) { mapCategory = target.dataset.mapCategory; renderMap(); return; }
  const { action, id } = target.dataset, exp = state.experiences.find(e => e.id === id);
  if (action === "refresh" && remote) { busy = true; try { state = await remote.refresh(); render(); toast("Atualizado."); } catch (e) { toast(e.message); } finally { busy = false; } }
  if (action === "participants" && exp) {
    if (!requireAccount("host")) return;
    busy = true;
    try {
      const list = remote ? await remote.participants(id) : state.accounts.filter(a => a.joined.includes(id));
      $("#editor-content").innerHTML = `<div class="dialog-head"><h2 id="editor-title">Interessados</h2><button class="icon-button" type="button" data-action="close-dialog" aria-label="Fechar">${icon("close")}</button></div><p class="context-line">${esc(exp.title)}</p><div class="participant-list">${list.map(a => `<div class="plan-heading"><span class="avatar-letter">${esc(a.name[0].toUpperCase())}</span><strong>${esc(a.name)}</strong></div>`).join("") || '<p class="empty-state">Ainda sem interessados.</p>'}</div>`;
      $("#editor-dialog").showModal();
    } catch (e) { toast(e.message); } finally { busy = false; }
  }
  if (action === "close-dialog") { target.closest("dialog").close(); return; }
  if (action === "switch-mode") { mode = mode === "guest" ? "host" : "guest"; routeTo(mode === "host" ? "host" : "home"); }
  if (action === "account" || action === "host-account") { renderAccounts(); $("#account-form [name=role]").value = action === "host-account" ? "host" : mode; $("#account-dialog").showModal(); }
  if (action === "login-local") { state.sessionId = id; mode = user().role; $("#account-dialog").close(); save(); routeTo(mode === "host" ? "host" : "guest"); }
  if (action === "logout") { if (remote) { busy = true; try { state = await remote.signOut(); render(); toast("Voce saiu da conta."); } catch (e) { toast(e.message); } finally { busy = false; } } else { state.sessionId = null; await save(); toast("Voce saiu do perfil local."); } }
  if (action === "place") { selectedPlace = id; routeTo("hostel"); }
  if (action === "open-place") { selectedPlace = hostPlace; routeTo("hostel"); }
  if (action === "stay-place") { selectedPlace = F.activeStay(user()).placeId; routeTo("hostel"); }
  if (action === "join" && exp) { if (!requireAccount()) return; if (!F.upcoming(exp) && !user().joined.includes(id)) return; const added = F.toggle(user().joined, id); if (!await save()) return; toast(added ? "Interesse marcado. A participacao depende da confirmacao do anfitriao." : "Interesse removido."); }
  if (action === "save" && exp) { if (!requireAccount()) return; const added = F.toggle(user().saved, id); if (!await save()) return; toast(added ? "Experiencia salva no seu roteiro." : "Experiencia removida dos salvos."); }
  if (action === "checkin") { if (!requireAccount()) return; dialogForm("Vincular estadia", `<p>${esc(place(selectedPlace).name)}</p><label>Saida prevista<input name="endsAt" type="date" required min="${localDate(Date.now()).slice(0, 10)}" value="${localDate(Date.now() + 3 * 86400000).slice(0, 10)}"></label>`, "stay", selectedPlace); }
  if (action === "checkout" && user()) { user().stay = null; if (!await save()) return; toast("Estadia encerrada."); }
  if (action === "new-place") { if (!requireAccount("host")) return; dialogForm("Cadastrar lugar", '<label>Nome<input name="name" required maxlength="80"></label><label>Tipo<select name="type"><option>Hostel</option><option>Workspace</option><option>Casa de temporada</option><option>Pousada</option><option>Coliving</option></select></label><label>Descricao<textarea name="description" required maxlength="350"></textarea></label>', "place"); }
  if (action === "edit-profile") { const u = user(); if (!u) return; dialogForm("Editar perfil", `<label>Nome<input name="name" required maxlength="40" value="${esc(u.name)}"></label><label>Sobre voce<textarea name="bio" maxlength="200">${esc(u.bio)}</textarea></label><div class="interest-grid">${F.categories.map(c => `<label class="inline-check"><input type="checkbox" name="interests" value="${c}" ${u.interests.includes(c) ? "checked" : ""}>${c}</label>`).join("")}</div>`, "profile"); }
  if (action === "new-experience" || action === "edit-experience") editExperience(id);
  if (action === "delete-experience" && exp && exp.placeId === hostPlace && requireAccount("host")) deleteDialog("delete-experience", id, "experiencia");
  if (action === "new-point" || action === "edit-point") editPoint(id);
  if (action === "delete-point" && state.points.find(p => p.id === id)?.placeId === hostPlace && requireAccount("host")) deleteDialog("delete-point", id, "recomendacao");
  if (action === "post-interest") { if (!requireAccount()) return; const p = state.posts.find(item => item.id === id); if (p) { F.toggle(p.interested, user().id); await save(); } }
  if (action === "delete-post") { const p = state.posts.find(item => item.id === id); if (p && (p.authorId === user()?.id || (user()?.role === "host" && p.placeId === hostPlace))) deleteDialog("delete-post", id, "plano"); }
  if (action === "copy-link") { try { await navigator.clipboard.writeText($("#place-public-link").href); toast("Link do lugar copiado."); } catch { toast("Abra a pagina do lugar e copie o endereco do navegador."); } }
  if (action === "qr") {
    if (!requireAccount("host")) return;
    $("#editor-content").innerHTML = `<form id="qr-form" data-kind="qr"><div class="dialog-head"><h2 id="editor-title">QR code do lugar</h2><button class="icon-button" type="button" data-action="close-dialog" title="Fechar" aria-label="Fechar">${icon("close")}</button></div><label>Endereco do lugar<input name="url" type="url" required maxlength="500" value="${esc($("#place-public-link").href)}"></label><p class="muted qr-note">O endereco local abre neste computador. Para usar em outros celulares, informe o endereco publicado.</p><div id="qr-preview"></div><div class="form-row"><button class="secondary-button" type="submit">Atualizar QR</button><button class="primary-button" type="button" data-action="download-qr">${icon("download")} Baixar QR</button></div></form>`;
    updateQR($("#place-public-link").href); $("#editor-dialog").showModal();
  }
  if (action === "download-qr") { const svg = $("#qr-preview svg"); if (!svg) return; const url = URL.createObjectURL(new Blob([svg.outerHTML], { type: "image/svg+xml" })); const link = document.createElement("a"); link.href = url; link.download = `freehouse-${hostPlace}-qr.svg`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  if (action === "export-report") {
    if (!requireAccount("host")) return;
    const report = { place: place(hostPlace).name, generatedAt: new Date().toISOString(), scope: "Dados locais desta demo", metrics: F.metrics(state, hostPlace), experiences: state.experiences.filter(e => e.placeId === hostPlace).map(e => ({ title: e.title, startsAt: e.startsAt, status: e.status, interests: F.interestCount(state, e.id) })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = `freehouse-${hostPlace}-relatorio.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast("Relatorio baixado.");
  }
});
$("#search-form").addEventListener("submit", event => { event.preventDefault(); search = new FormData(event.target).get("query").trim(); category = "Todas"; placeFilter = "all"; routeTo("experiences"); });
$("#experience-search").addEventListener("input", event => { search = event.target.value; renderExperiences(); });
$("#place-filter").addEventListener("change", event => { placeFilter = event.target.value; renderExperiences(); });
$("#host-place").addEventListener("change", event => { hostPlace = event.target.value; renderHost(); });
$("#account-form").addEventListener("submit", async event => {
  event.preventDefault(); if (busy) return; const data = new FormData(event.target), role = data.get("role");
  if (remote) {
    const submit = event.target.querySelector('button[type="submit"]'); submit.disabled = true; busy = true;
    try {
      if (data.get("authMode") === "recover") { await remote.recover(data.get("email")); $("#auth-error").textContent = "Se o email estiver cadastrado, voce recebera as instrucoes."; return; }
      state = data.get("authMode") === "signup" ? await remote.signUp(data.get("email"), data.get("password"), data.get("name").trim(), role) : await remote.signIn(data.get("email"), data.get("password"));
      authMode = "signin"; mode = role; $("#account-dialog").close(); routeTo(role === "host" ? "host" : "guest"); toast("Voce entrou na sua conta.");
    } catch (error) { $("#auth-error").textContent = error.message; } finally { busy = false; submit.disabled = false; }
    return;
  }
  const name = data.get("name").trim(); if (!name) return;
  const id = F.uid(); state.accounts.push({ id, name, role, bio: "", interests: [], saved: [], joined: [], stay: null }); state.sessionId = id; mode = role;
  $("#account-dialog").close(); event.target.reset(); await save(); routeTo(role === "host" ? "host" : "guest"); toast("Perfil local criado.");
});
$("#post-plan").addEventListener("submit", async event => { event.preventDefault(); if (busy || !requireAccount()) return; const data = new FormData(event.target), text = data.get("text").trim(), startsAt = new Date(data.get("startsAt")); if (!text) return; if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now()) { toast("Escolha um horario futuro para o plano."); return; } state.posts.push({ id: F.uid(), authorId: user().id, placeId: F.activeStay(user())?.placeId || null, text, startsAt: startsAt.toISOString(), createdAt: new Date().toISOString(), expiresAt: new Date(startsAt.getTime() + 86400000).toISOString(), interested: [] }); if (!await save()) return; event.target.reset(); toast("Plano publicado."); });
$("#editor-dialog").addEventListener("submit", async event => {
  if (busy) { event.preventDefault(); return; }
  event.preventDefault(); const form = event.target, data = new FormData(form), { kind, id } = form.dataset;
  try {
    if (kind === "qr") { const url = new URL(data.get("url")); if (!["http:", "https:", "file:"].includes(url.protocol)) throw new Error("Informe um endereco valido."); updateQR(url.href); return; }
    if (kind === "reset") { await remote.reset(data.get("password"), new URLSearchParams(location.search).get("token")); $("#editor-dialog").close(); history.replaceState(null, "", location.pathname + "#guest"); toast("Senha atualizada. Entre na sua conta."); return; }
    if (kind === "place") {
      user().role = "host"; const id = F.uid();
      state.places.push({ id, name: data.get("name").trim(), type: data.get("type"), description: data.get("description").trim(), image: F.photos[data.get("type") === "Workspace" ? "work" : "hostel"], managedByMe: true }); hostPlace = id;
    }
    if (kind === "experience") {
      if (user()?.role !== "host") return; const existing = state.experiences.find(e => e.id === id); if (existing && existing.placeId !== hostPlace) return;
      const value = F.validateExperience({ id: id || F.uid(), placeId: hostPlace, title: data.get("title").trim(), description: data.get("description").trim(), startsAt: new Date(data.get("startsAt")).toISOString(), price: Number(data.get("price")), capacity: Number(data.get("capacity")), location: data.get("location").trim(), category: data.get("category"), status: data.get("status"), image: existing?.image || F.photos[data.get("category") === "Surf" ? "surf" : data.get("category") === "Gastronomia" ? "dinner" : data.get("category") === "Coworking" ? "work" : "beach"] });
      if (existing) Object.assign(existing, value); else state.experiences.push(value);
    }
    if (kind === "point") { if (user()?.role !== "host") return; const existing = state.points.find(p => p.id === id); if (existing && existing.placeId !== hostPlace) return; const value = { id: id || F.uid(), placeId: hostPlace, name: data.get("name").trim(), category: data.get("category"), description: data.get("description").trim(), query: data.get("query").trim() }; if (!value.name || !value.description || !value.query) throw new Error("Preencha os campos da recomendacao."); if (existing) Object.assign(existing, value); else state.points.push(value); }
    if (kind === "profile" && user()) { const name = data.get("name").trim(); if (!name) throw new Error("Informe um nome."); Object.assign(user(), { name, bio: data.get("bio").trim(), interests: data.getAll("interests") }); }
    if (kind === "stay" && user() && (remote || user().role === "guest")) { const date = new Date(`${data.get("endsAt")}T23:59:59`); if (!place(id) || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new Error("Escolha uma data de saida valida."); user().stay = { placeId: id, endsAt: date.toISOString() }; }
    if (kind === "delete-experience" && user()?.role === "host" && state.experiences.find(e => e.id === id)?.placeId === hostPlace) F.removeExperience(state, id);
    if (kind === "delete-point" && user()?.role === "host") state.points = state.points.filter(p => !(p.id === id && p.placeId === hostPlace));
    if (kind === "delete-post") { const p = state.posts.find(p => p.id === id); if (p && (p.authorId === user()?.id || (user()?.role === "host" && p.placeId === hostPlace))) state.posts = state.posts.filter(item => item.id !== id); }
    if (!await save()) return;
    $("#editor-dialog").close(); toast(kind.startsWith("delete") ? "Item excluido." : "Alteracoes salvas.");
  } catch (error) { toast(error.message || "Revise os dados e tente novamente."); }
});
function updateQR(url) { const code = window.qrcode(0, "M"); code.addData(url); code.make(); $("#qr-preview").innerHTML = code.createSvgTag(5, 20); $("#qr-preview svg").setAttribute("aria-label", "QR code do lugar"); }
window.addEventListener("hashchange", readHash);
window.addEventListener("storage", event => { if (remote || event.key !== STORAGE_KEY || !event.newValue) return; try { const incoming = JSON.parse(event.newValue); if (incoming.version === 2) { state = incoming; render(); } } catch { /* Ignore invalid data from another tab. */ } });
async function boot() {
  if (!remote) { persist(); readHash(); return; }
  $(".demo-label").textContent = "Conectando...";
  try {
    state = await remote.boot(); mode = user()?.role || "guest"; selectedPlace = state.places[0].id;
    busy = false; $(".demo-label").textContent = "Ambiente de teste";
    if (!$("[data-action=refresh]")) { const button = document.createElement("button"); button.className = "icon-button"; button.type = "button"; button.dataset.action = "refresh"; button.title = "Atualizar"; button.setAttribute("aria-label", "Atualizar"); button.innerHTML = icon("refresh"); $(".top-actions").prepend(button); }
    readHash();
    if (location.hash === "#reset-password" && new URLSearchParams(location.search).has("token")) dialogForm("Nova senha", '<label>Nova senha<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>', "reset");
  } catch { $(".demo-label").textContent = "Conexao indisponivel"; $("#home").classList.add("is-current"); $("#home").innerHTML = '<h1>Conexao indisponivel</h1><p class="empty-state">Nao foi possivel carregar seus dados. Tente novamente em alguns instantes.</p><button class="primary-button" type="button" onclick="location.reload()">Tentar novamente</button>'; }
}
boot();
