(function (root) {
  "use strict";
  const categories = ["Surf", "Trilha", "Gastronomia", "Coworking", "Passeio", "Noite"];
  const photos = {
    surf: "assets/surf.jpg",
    dinner: "assets/dinner.jpg",
    work: "assets/work.jpg",
    beach: "assets/beach.jpg",
    house: "assets/house.jpg",
    hostel: "assets/hostel.jpg"
  };
  function dateAt(days, hour) { const date = new Date(); date.setDate(date.getDate() + days); date.setHours(hour, 0, 0, 0); return date.toISOString(); }
  function seed() {
    return {
      version: 2, sessionId: null, accounts: [], views: [], posts: [],
      places: [
        { id: "barra-flow", name: "Hostel Barra Flow", type: "Hostel", image: photos.hostel, description: "Perto da praia, com mesa compartilhada e encontros de viajantes." },
        { id: "workspot", name: "Workspot Lagoa", type: "Workspace", image: photos.work, description: "Mesas de trabalho, cafe e encontros para quem trabalha viajando." },
        { id: "casa-canal", name: "Casa Canal", type: "Casa de temporada", image: photos.house, description: "Estadia perto do canal com recomendacoes do anfitriao." }
      ],
      experiences: [
        { id: "surf", placeId: "barra-flow", title: "Surf ao nascer do sol", category: "Surf", description: "Encontro na praia principal. Aula e equipamento a combinar com o responsavel.", startsAt: dateAt(1, 6), price: 70, capacity: 8, location: "Praia da Barra", status: "open", image: photos.surf },
        { id: "jantar", placeId: "barra-flow", title: "Jantar coletivo", category: "Gastronomia", description: "Uma mesa compartilhada para conhecer quem esta por aqui.", startsAt: dateAt(1, 20), price: 45, capacity: 18, location: "Area comum do Barra Flow", status: "open", image: photos.dinner },
        { id: "prainha", placeId: "barra-flow", title: "Prainha + Piscinas Naturais", category: "Trilha", description: "Encontro na ponte. Percurso sujeito as condicoes do mar e orientacao local.", startsAt: dateAt(2, 9), price: 0, capacity: 10, location: "Ponte da Barra", status: "open", image: photos.beach },
        { id: "cowork", placeId: "workspot", title: "Coworking day", category: "Coworking", description: "Dia de trabalho com cafe e uma pausa para conhecer outros viajantes.", startsAt: dateAt(1, 9), price: 35, capacity: 12, location: "Workspot Lagoa", status: "open", image: photos.work },
        { id: "canal", placeId: "casa-canal", title: "Fim de tarde no canal", category: "Passeio", description: "Caminhada leve pelo canal com parada para fotos.", startsAt: dateAt(2, 16), price: 0, capacity: 8, location: "Canal da Barra", status: "open", image: photos.beach }
      ],
      points: [
        { id: "praia", placeId: "barra-flow", name: "Praia da Barra", category: "Praia", description: "Areia, caminhada e ponto de encontro para o surf.", query: "Praia da Barra da Lagoa Florianopolis" },
        { id: "ponte", placeId: "barra-flow", name: "Ponte da Barra", category: "Passeio", description: "Referencia de encontro para seguir em direcao a Prainha.", query: "Ponte da Barra da Lagoa Florianopolis" },
        { id: "prainha-ponto", placeId: "barra-flow", name: "Prainha da Barra", category: "Trilha", description: "Consulte as condicoes locais antes de seguir para as piscinas naturais.", query: "Prainha da Barra da Lagoa Florianopolis" },
        { id: "canal-ponto", placeId: "casa-canal", name: "Canal da Barra", category: "Passeio", description: "Passeio pelo canal e referencias de gastronomia no entorno.", query: "Canal da Barra da Lagoa Florianopolis" }
      ]
    };
  }
  function uid() { return root.crypto.randomUUID(); }
  function account(state) { return state.accounts.find(a => a.id === state.sessionId) || null; }
  function activeStay(user, now = Date.now()) { return user?.stay && new Date(user.stay.endsAt).getTime() > now ? user.stay : null; }
  function upcoming(exp, now = Date.now()) { return exp.status === "open" && new Date(exp.startsAt).getTime() > now; }
  function toggle(list, id) { const index = list.indexOf(id); if (index < 0) list.push(id); else list.splice(index, 1); return index < 0; }
  function interestCount(state, id) { return state.shared ? state.experiences.find(e => e.id === id)?.interestCount || 0 : state.accounts.filter(a => a.joined.includes(id)).length; }
  function metrics(state, placeId) { if (state.shared) return state.metrics[placeId] || {views:0,experiences:0,interests:0,posts:0}; const ids = new Set(state.experiences.filter(e => e.placeId === placeId).map(e => e.id)); return { views: state.views.filter(v => v.placeId === placeId).length, experiences: ids.size, interests: state.accounts.reduce((sum, a) => sum + a.joined.filter(id => ids.has(id)).length, 0), posts: state.posts.filter(p => p.placeId === placeId && new Date(p.expiresAt).getTime() > Date.now()).length }; }
  function removeExperience(state, id) { state.experiences = state.experiences.filter(e => e.id !== id); state.accounts.forEach(a => { a.saved = a.saved.filter(x => x !== id); a.joined = a.joined.filter(x => x !== id); }); }
  function validateExperience(data) {
    if (!data.title?.trim() || !data.location?.trim() || !data.description?.trim()) throw new Error("Preencha titulo, local e descricao.");
    if (!Number.isFinite(new Date(data.startsAt).getTime())) throw new Error("Escolha uma data valida.");
    if (data.status === "open" && new Date(data.startsAt).getTime() <= Date.now()) throw new Error("Escolha uma data futura para uma experiencia aberta.");
    if (!Number.isFinite(data.price) || data.price < 0) throw new Error("Informe um preco valido.");
    if (!Number.isInteger(data.capacity) || data.capacity < 1 || data.capacity > 500) throw new Error("A capacidade deve estar entre 1 e 500.");
    if (!categories.includes(data.category) || !["open", "closed", "cancelled"].includes(data.status)) throw new Error("Categoria ou status invalido.");
    return data;
  }
  const api = { categories, photos, seed, uid, account, activeStay, upcoming, toggle, interestCount, metrics, removeExperience, validateExperience };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Freehouse = api;
})(globalThis);
