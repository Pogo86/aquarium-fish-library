class AquariumManagerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._built = false;
    this._modalItemId = null;
    this._modalMode = null;
    this._activeTab = "tank";
  }

  static getStubConfig() {
    return { tank_name: "Main Aquarium", entity_prefix: "main_aquarium" };
  }

  setConfig(config) {
    if (!config) throw new Error("Aquarium Manager card configuration is required");
    const tankName = config.tank_name || "Main Aquarium";
    const prefix = config.entity_prefix || tankName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    this._config = { tank_name: tankName, entity_prefix: prefix, entities: config.entities || {} };
    this._built = false;
    if (this._hass) {
      this._build();
      this._update();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) this._build();
    this._update();
  }

  getCardSize() { return 11; }

  _entity(key, domain, suffix) {
    return this._config.entities?.[key] || `${domain}.${this._config.entity_prefix}_${suffix}`;
  }

  _sensorEntity(key) {
    const map = {
      volume: ["sensor", "calculated_volume"],
      dimensions: ["sensor", "dimensions"],
      temperature: ["sensor", "temperature"],
      water_status: ["sensor", "water_status"],
      stocking: ["sensor", "stocking"],
      community: ["sensor", "community"],
      compatibility: ["sensor", "compatible_fish"],
      library: ["sensor", "fish_library"],
      gh_delta: ["sensor", "gh_above_source_water"],
      kh_delta: ["sensor", "kh_above_source_water"],
      nitrate_delta: ["sensor", "nitrate_above_source_water"],
    };
    const [domain, suffix] = map[key];
    return this._entity(key, domain, suffix);
  }

  _numberEntity(key) {
    const map = {
      ammonia: ["number", "ammonia"], nitrite: ["number", "nitrite"], nitrate: ["number", "nitrate"],
      ph: ["number", "ph"], gh: ["number", "gh"], kh: ["number", "kh"],
      source_nitrate: ["number", "source_water_nitrate"], source_ph: ["number", "source_water_ph"],
      source_gh: ["number", "source_water_gh"], source_kh: ["number", "source_water_kh"],
    };
    const [domain, suffix] = map[key];
    return this._entity(key, domain, suffix);
  }

  _state(entityId) { return this._hass?.states?.[entityId] || null; }

  _display(entityId) {
    const state = this._state(entityId);
    if (!state || ["unknown", "unavailable"].includes(state.state)) return "—";
    const unit = state.attributes?.unit_of_measurement || "";
    return `${state.state}${unit ? ` ${unit}` : ""}`;
  }

  _build() {
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block} ha-card{overflow:hidden;color:var(--primary-text-color);background:var(--ha-card-background,var(--card-background-color))}
        .hero{padding:20px;background:linear-gradient(135deg,color-mix(in srgb,var(--primary-color) 18%,transparent),transparent 62%);border-bottom:1px solid var(--divider-color)}
        .hero-top,.title-wrap,.section-title,.stock-meta,.modal-actions{display:flex;align-items:center}.hero-top{justify-content:space-between;gap:14px}.title-wrap{gap:12px}
        .tank-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:color-mix(in srgb,var(--primary-color) 15%,transparent)}
        .tank-icon ha-icon{color:var(--primary-color);--mdc-icon-size:27px} h1{font-size:21px;margin:0 0 3px}.subline{font-size:12px;color:var(--secondary-text-color)}
        .status{font-size:11px;font-weight:700;text-transform:uppercase;padding:6px 9px;border-radius:999px;background:var(--secondary-background-color)}
        .status.clear,.status.good{color:var(--success-color,#43a047);background:color-mix(in srgb,var(--success-color,#43a047) 16%,transparent)}
        .status.attention,.status.incomplete{color:var(--warning-color,#f9a825);background:color-mix(in srgb,var(--warning-color,#f9a825) 16%,transparent)}
        .status.danger,.status.conflict{color:var(--error-color);background:color-mix(in srgb,var(--error-color) 16%,transparent)}
        .summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:16px}.summary-item{padding:10px;border:1px solid var(--divider-color);border-radius:11px;background:color-mix(in srgb,var(--card-background-color) 80%,transparent)}
        .summary-label{font-size:10px;text-transform:uppercase;color:var(--secondary-text-color);margin-bottom:4px}.summary-value{font-size:15px;font-weight:650}
        .content{padding:18px 20px 22px}.section+.section{margin-top:24px}.section-title{gap:7px;font-size:14px;font-weight:650;margin-bottom:11px}.section-title ha-icon{--mdc-icon-size:18px;color:var(--secondary-text-color)}
        .community-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.range-card{border:1px solid var(--divider-color);border-radius:11px;padding:11px}.range-label{font-size:10px;color:var(--secondary-text-color);text-transform:uppercase}.range-value{font-size:16px;font-weight:650;margin-top:4px}.range-note{font-size:10px;color:var(--secondary-text-color);margin-top:3px}.range-card.conflict{border-color:var(--error-color)}
        .warnings{display:flex;flex-direction:column;gap:6px;margin-top:10px}.warning-line{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-radius:9px;font-size:12px;line-height:1.35;background:color-mix(in srgb,var(--warning-color,#f9a825) 10%,transparent)}
        .warning-line.info{background:var(--secondary-background-color);color:var(--secondary-text-color)}.warning-line.danger{background:color-mix(in srgb,var(--error-color) 10%,transparent)}.warning-line ha-icon{--mdc-icon-size:16px;margin-top:1px}
        details.stock-panel{border:1px solid var(--divider-color);border-radius:12px;overflow:hidden} details.stock-panel summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 13px;cursor:pointer;background:var(--secondary-background-color)} details.stock-panel summary::-webkit-details-marker{display:none}
        .stock-summary-left{display:flex;align-items:center;gap:9px;font-weight:650}.stock-summary-left ha-icon{--mdc-icon-size:19px}.stock-meta{gap:7px;color:var(--secondary-text-color);font-size:11px}.chevron{transition:transform .18s}details[open] .chevron{transform:rotate(180deg)}
        .stock-body{padding:7px}.library-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 8px 10px;color:var(--secondary-text-color);font-size:10px}.library-info{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.library-refresh{height:27px;padding:0 9px;font-size:10px;border-radius:8px}.stock-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:9px 8px;border-radius:9px;cursor:pointer}.stock-row:hover{background:var(--secondary-background-color)}.stock-name{min-width:0}.stock-name strong{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.scientific{font-size:10px;color:var(--secondary-text-color);font-style:italic;margin-top:2px}.qty-pill,.warn-pill{font-size:11px;font-weight:700;border-radius:999px;padding:4px 7px;background:var(--secondary-background-color)}.warn-pill{color:var(--warning-color,#f9a825)}
        button{border:1px solid var(--divider-color);background:var(--secondary-background-color);color:var(--primary-text-color);border-radius:8px;padding:6px 9px;cursor:pointer;font:inherit;font-size:11px}.edit-btn{font-weight:650}.add-btn{margin:7px 8px 8px;width:calc(100% - 16px);padding:8px;border-style:dashed;color:var(--primary-color);font-weight:650;background:transparent}
        .empty{padding:16px;text-align:center;font-size:12px;color:var(--secondary-text-color)}
        .parameter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.source-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.delta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.parameter,.delta{border:1px solid var(--divider-color);border-radius:10px;padding:10px;background:var(--secondary-background-color)}.delta{background:transparent}.param-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:5px}.param-name,.delta-label{font-size:11px;color:var(--secondary-text-color)}.param-unit{font-size:9px;color:var(--secondary-text-color)}.delta-value{font-size:15px;font-weight:650;margin-top:4px}
        input,textarea{box-sizing:border-box;width:100%;font:inherit;color:var(--primary-text-color);background:transparent;border:1px solid var(--divider-color);border-radius:8px;padding:8px;outline:none}input:focus,textarea:focus{border-color:var(--primary-color)}.parameter input{border:0;border-bottom:1px solid var(--divider-color);border-radius:0;padding:3px 0;font-size:18px;font-weight:650}.source-grid .parameter input{font-size:16px}
        .water-warning{display:none;margin-top:10px;padding:9px 10px;border-radius:9px;font-size:12px;background:color-mix(in srgb,var(--warning-color,#f9a825) 10%,transparent)}.water-warning.show{display:block}
        .modal-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.48);display:none;align-items:center;justify-content:center;padding:16px}.modal-backdrop.open{display:flex}.modal{width:min(620px,100%);max-height:min(780px,92vh);overflow:auto;background:var(--card-background-color);border-radius:16px;box-shadow:0 16px 50px rgba(0,0,0,.35)}
        .modal-head{position:sticky;top:0;background:var(--card-background-color);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:17px 18px 12px;border-bottom:1px solid var(--divider-color);z-index:1}.modal-title{font-size:18px;font-weight:700}.modal-subtitle{font-size:12px;color:var(--secondary-text-color);font-style:italic;margin-top:3px}.icon-btn{padding:5px;display:grid;place-items:center;background:transparent}.icon-btn ha-icon{--mdc-icon-size:20px}.modal-body{padding:16px 18px 18px}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.detail{border:1px solid var(--divider-color);border-radius:10px;padding:10px}.detail-label{font-size:10px;text-transform:uppercase;color:var(--secondary-text-color)}.detail-value{font-size:13px;font-weight:600;margin-top:4px}.modal-section{margin-top:16px}.modal-section-title{font-size:12px;font-weight:700;margin-bottom:8px}.care-note{font-size:12px;line-height:1.4;padding:8px 10px;background:var(--secondary-background-color);border-radius:8px;margin-top:5px}.modal-actions{justify-content:flex-end;gap:8px;margin-top:18px}.primary{background:var(--primary-color);color:var(--text-primary-color,#fff);border-color:var(--primary-color);font-weight:650}.danger-btn{color:var(--error-color);margin-right:auto}
        .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.form-field label{display:block;font-size:10px;color:var(--secondary-text-color);margin-bottom:4px}.form-field.full{grid-column:1/-1}.pair{display:grid;grid-template-columns:1fr 1fr;gap:7px}.small-help{font-size:10px;color:var(--secondary-text-color);margin-top:5px}.footer{margin-top:18px;padding-top:12px;border-top:1px solid var(--divider-color);font-size:10px;line-height:1.4;color:var(--secondary-text-color)}
        .tabs{display:flex;gap:4px;padding:8px 12px;border-bottom:1px solid var(--divider-color);background:var(--secondary-background-color)}.tab-btn{flex:1;padding:9px 10px;background:transparent;border-color:transparent;font-size:12px;font-weight:650;color:var(--secondary-text-color)}.tab-btn.active{background:var(--card-background-color);color:var(--primary-color);border-color:var(--divider-color);box-shadow:0 1px 2px rgba(0,0,0,.06)}.tab-page{display:none}.tab-page.active{display:block}
        .compat-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.compat-count{font-size:11px;color:var(--secondary-text-color);white-space:nowrap}.compat-list{display:flex;flex-direction:column;gap:7px}.compat-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid var(--divider-color);border-radius:11px;padding:10px 11px;cursor:pointer}.compat-row:hover{background:var(--secondary-background-color)}.compat-main{min-width:0}.compat-main strong{display:block;font-size:13px}.compat-sub{font-size:10px;color:var(--secondary-text-color);margin-top:3px;line-height:1.35}.compat-side{display:flex;align-items:center;gap:7px}.match-pill,.add-count{font-size:10px;font-weight:700;padding:4px 7px;border-radius:999px;background:var(--secondary-background-color);white-space:nowrap}.match-pill.high{color:var(--success-color,#43a047)}.match-pill.medium{color:var(--warning-color,#f9a825)}.match-pill.limited{color:var(--secondary-text-color)}.compat-add{font-weight:650;color:var(--primary-color)}
        .group-list{display:flex;flex-direction:column;gap:7px}.group-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 11px;border:1px solid var(--divider-color);border-radius:11px}.group-title{font-size:13px;font-weight:650}.group-sub{font-size:10px;color:var(--secondary-text-color);margin-top:3px}.add-count{color:var(--warning-color,#f9a825);font-size:11px}.bioload-note{margin-top:10px;padding:8px 10px;border-radius:8px;background:var(--secondary-background-color);font-size:10px;line-height:1.4;color:var(--secondary-text-color)}
        @media(max-width:700px){.hero,.content{padding-left:14px;padding-right:14px}.summary,.community-grid{grid-template-columns:1fr 1fr}.parameter-grid,.source-grid{grid-template-columns:1fr 1fr}.delta-grid{grid-template-columns:1fr}.detail-grid,.form-grid{grid-template-columns:1fr}.form-field.full{grid-column:auto}.modal-backdrop{padding:8px;align-items:flex-end}.modal{max-height:94vh;border-radius:16px 16px 8px 8px}}
      </style>

      <ha-card>
        <div class="hero">
          <div class="hero-top">
            <div class="title-wrap"><div class="tank-icon"><ha-icon icon="mdi:fishbowl-outline"></ha-icon></div><div><h1>${this._escape(this._config.tank_name)}</h1><div class="subline">Aquarium Manager</div></div></div>
            <div id="water_status" class="status">—</div>
          </div>
          <div class="summary">
            <div class="summary-item"><div class="summary-label">Temperature</div><div id="temperature" class="summary-value">—</div></div>
            <div class="summary-item"><div class="summary-label">Volume</div><div id="volume" class="summary-value">—</div></div>
            <div class="summary-item"><div class="summary-label">Dimensions</div><div id="dimensions" class="summary-value">—</div></div>
            <div class="summary-item"><div class="summary-label">Livestock</div><div id="livestock_total" class="summary-value">—</div></div>
          </div>
        </div>

        <div class="tabs">
          <button id="tab_btn_tank" class="tab-btn active">Aquarium</button>
          <button id="tab_btn_compat" class="tab-btn">Compatible fish</button>
        </div>

        <div class="content">
          <div id="tab_tank" class="tab-page active">
          <section class="section">
            <div class="section-title"><ha-icon icon="mdi:chart-bell-curve"></ha-icon>Community ranges <span id="community_status" class="status">—</span></div>
            <div id="community_grid" class="community-grid"></div>
            <div id="community_warnings" class="warnings"></div>
          </section>

          <section class="section">
            <details id="stock_panel" class="stock-panel">
              <summary><div class="stock-summary-left"><ha-icon icon="mdi:fish"></ha-icon>Stocking</div><div class="stock-meta"><span id="stock_summary">0 fish · 0 groups</span><ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon></div></summary>
              <div class="stock-body"><div class="library-bar"><span id="library_info" class="library-info">Fish library —</span><button id="refresh_library" class="library-refresh">Refresh</button></div><div id="stock_list"></div><button id="add_fish" class="add-btn">＋ Add fish</button></div>
            </details>
          </section>

          <section class="section"><div class="section-title"><ha-icon icon="mdi:test-tube"></ha-icon>Aquarium water</div><div class="parameter-grid">
            ${this._numberBox("ammonia","NH₃ / NH₄","mg/L","0.01")}${this._numberBox("nitrite","NO₂","mg/L","0.01")}${this._numberBox("nitrate","NO₃","mg/L","0.5")}${this._numberBox("ph","pH","","0.1")}${this._numberBox("gh","GH","dGH","1")}${this._numberBox("kh","KH","dKH","1")}
          </div><div id="water_warning" class="water-warning"></div></section>

          <section class="section"><div class="section-title"><ha-icon icon="mdi:home-water"></ha-icon>Source water</div><div class="source-grid">
            ${this._numberBox("source_nitrate","NO₃","mg/L","0.5")}${this._numberBox("source_ph","pH","","0.1")}${this._numberBox("source_gh","GH","dGH","1")}${this._numberBox("source_kh","KH","dKH","1")}
          </div></section>

          <section class="section"><div class="section-title"><ha-icon icon="mdi:compare-horizontal"></ha-icon>Change from source water</div><div class="delta-grid">
            <div class="delta"><div class="delta-label">GH increase</div><div id="gh_delta" class="delta-value">—</div></div><div class="delta"><div class="delta-label">KH increase</div><div id="kh_delta" class="delta-value">—</div></div><div class="delta"><div class="delta-label">NO₃ increase</div><div id="nitrate_delta" class="delta-value">—</div></div>
          </div></section>

          <div class="footer">Community ranges use only fish with complete parameters for that measurement. Unknown species stay in the stocking list but are clearly marked as excluded from the calculation.</div>
          </div>

          <div id="tab_compat" class="tab-page">
            <section class="section">
              <div class="section-title"><ha-icon icon="mdi:account-multiple-plus-outline"></ha-icon>Group size suggestions</div>
              <div id="group_suggestions" class="group-list"></div>
            </section>

            <section class="section">
              <div class="compat-head">
                <div>
                  <div class="section-title"><ha-icon icon="mdi:fish-plus"></ha-icon>Compatible fish</div>
                  <div class="small-help">Fish already recorded in this aquarium are excluded. Recommendations use the library's known tank dimensions, water ranges and current readings. Temperament concerns are shown as cautions rather than hidden.</div>
                </div>
                <div id="compat_count" class="compat-count">—</div>
              </div>
              <div id="compatible_list" class="compat-list"></div>
            </section>

            <div class="footer">Estimated bioload is a relative planning index based on adult length cubed and quantity. It is useful for comparing additions, but it is not a safe-stock percentage and does not replace filtration, maintenance or species-specific husbandry.</div>
          </div>
        </div>
      </ha-card>

      <div id="modal_backdrop" class="modal-backdrop"><div id="modal" class="modal"></div></div>
    `;

    this.shadowRoot.querySelectorAll("input[data-key]").forEach(input => {
      input.addEventListener("change", e => this._saveNumber(e));
      input.addEventListener("keydown", e => { if (e.key === "Enter") e.currentTarget.blur(); });
    });
    this.shadowRoot.getElementById("add_fish").addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); this._openEdit(null); });
    this.shadowRoot.getElementById("refresh_library").addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); this._refreshLibrary(); });
    this.shadowRoot.getElementById("tab_btn_tank").addEventListener("click", () => this._setTab("tank"));
    this.shadowRoot.getElementById("tab_btn_compat").addEventListener("click", () => this._setTab("compat"));
    this.shadowRoot.getElementById("modal_backdrop").addEventListener("click", e => { if (e.target.id === "modal_backdrop") this._closeModal(); });
    this._built = true;
  }

  _numberBox(key,label,unit,step){return `<div class="parameter"><div class="param-head"><span class="param-name">${label}</span><span class="param-unit">${unit}</span></div><input data-key="${key}" type="number" inputmode="decimal" step="${step}" placeholder="—"></div>`;}

  _update() {
    if (!this._built || !this._hass) return;
    this._setText("temperature", this._display(this._sensorEntity("temperature")));
    this._setText("volume", this._display(this._sensorEntity("volume")));
    this._setText("dimensions", this._display(this._sensorEntity("dimensions")));
    this._setText("gh_delta", this._signedDisplay(this._sensorEntity("gh_delta")));
    this._setText("kh_delta", this._signedDisplay(this._sensorEntity("kh_delta")));
    this._setText("nitrate_delta", this._signedDisplay(this._sensorEntity("nitrate_delta")));

    const active = this.shadowRoot.activeElement;
    this.shadowRoot.querySelectorAll("input[data-key]").forEach(input => {
      if (input === active) return;
      const state = this._state(this._numberEntity(input.dataset.key));
      input.value = state && !["unknown","unavailable"].includes(state.state) ? state.state : "";
      input.disabled = !state;
    });

    const water = this._state(this._sensorEntity("water_status"));
    this._setStatus("water_status", water?.state || "unknown");
    const reasons = water?.attributes?.reasons || [];
    const ww = this.shadowRoot.getElementById("water_warning");
    if (reasons.length) { ww.innerHTML = reasons.map(x => `• ${this._escape(x)}`).join("<br>"); ww.className = "water-warning show"; }
    else { ww.textContent = ""; ww.className = "water-warning"; }

    this._renderCommunity();
    this._renderLibrary();
    this._renderStocking();
    this._renderCompatibility();
    this._setTab(this._activeTab);
  }

  _setTab(tab) {
    this._activeTab = tab === "compat" ? "compat" : "tank";
    const tank = this.shadowRoot.getElementById("tab_tank");
    const compat = this.shadowRoot.getElementById("tab_compat");
    const tankBtn = this.shadowRoot.getElementById("tab_btn_tank");
    const compatBtn = this.shadowRoot.getElementById("tab_btn_compat");
    if (!tank || !compat || !tankBtn || !compatBtn) return;
    tank.classList.toggle("active", this._activeTab === "tank");
    compat.classList.toggle("active", this._activeTab === "compat");
    tankBtn.classList.toggle("active", this._activeTab === "tank");
    compatBtn.classList.toggle("active", this._activeTab === "compat");
  }

  _compatData() {
    const state = this._state(this._sensorEntity("compatibility"));
    return {
      state,
      compatible: state?.attributes?.compatible || [],
      groups: state?.attributes?.group_recommendations || [],
      total: Number(state?.attributes?.compatible_count ?? state?.state ?? 0),
      conflict: Boolean(state?.attributes?.community_conflict),
      method: state?.attributes?.bioload_method || "",
    };
  }

  _renderCompatibility() {
    const holder = this.shadowRoot.getElementById("compatible_list");
    const groupHolder = this.shadowRoot.getElementById("group_suggestions");
    const count = this.shadowRoot.getElementById("compat_count");
    if (!holder || !groupHolder || !count) return;

    const { state, compatible, groups, total, conflict } = this._compatData();

    if (!state) {
      count.textContent = "Unavailable";
      holder.innerHTML = `<div class="empty">Compatible-fish sensor not found. Restart Home Assistant after upgrading Aquarium Manager.</div>`;
      groupHolder.innerHTML = `<div class="empty">Group suggestions unavailable.</div>`;
      return;
    }

    count.textContent = `${total} match${total === 1 ? "" : "es"}`;

    if (groups.length) {
      groupHolder.innerHTML = groups.map(item => {
        const extra = item.estimated_added_bioload_points !== null && item.estimated_added_bioload_points !== undefined
          ? ` · about +${this._fmt(item.estimated_added_bioload_points)} bioload pts`
          : "";
        const blocked = item.safe_to_add === false;
        const advice = blocked
          ? `${Number(item.quantity)||0} kept · recorded minimum ${Number(item.minimum_group)||0} · do not add yet: ${this._escape(item.blocking_reason || "tank-size requirement not met")}`
          : `${Number(item.quantity)||0} kept · recorded minimum ${Number(item.minimum_group)||0}${extra}`;
        const badge = blocked ? `Needs +${Number(item.add_count)||0}, tank first` : `Add ${Number(item.add_count)||0}`;
        return `<div class="group-card"><div><div class="group-title">${this._escape(item.name)}</div><div class="group-sub">${advice}</div></div><div class="add-count">${badge}</div></div>`;
      }).join("");
    } else {
      groupHolder.innerHTML = `<div class="empty">All profiled fish with a recorded minimum group size currently meet it.</div>`;
    }

    if (conflict) {
      holder.innerHTML = `<div class="warning-line danger"><ha-icon icon="mdi:alert-octagon-outline"></ha-icon><span>The current stocked community has at least one conflicting care range. Resolve that conflict before treating new-fish recommendations as reliable.</span></div>`;
      return;
    }

    if (!compatible.length) {
      holder.innerHTML = `<div class="empty">No unstocked library fish currently pass the known tank-size and water-range checks.</div>`;
      return;
    }

    holder.innerHTML = compatible.map(item => {
      const group = Number(item.suggested_group || 1);
      const load = item.estimated_group_bioload_points !== null && item.estimated_group_bioload_points !== undefined
        ? ` · +${this._fmt(item.estimated_group_bioload_points)} bioload pts`
        : "";
      const cautions = (Array.isArray(item.cautions) ? item.cautions.length : 0) + (Array.isArray(item.care_notes) ? item.care_notes.length : 0);
      const extra = cautions ? ` · ${cautions} caution${cautions === 1 ? "" : "s"}` : "";
      return `<div class="compat-row" data-profile="${this._escape(item.profile_id)}"><div class="compat-main"><strong>${this._escape(item.name || "Unnamed")}</strong><div class="scientific">${this._escape(item.scientific_name || "")}</div><div class="compat-sub">Suggested group ${group}${load}${extra}</div></div><div class="compat-side"><span class="match-pill ${this._escape(item.confidence || "limited")}">${this._escape((item.confidence || "limited") + " match")}</span><button class="compat-add" data-add>Add ×${group}</button></div></div>`;
    }).join("");

    holder.querySelectorAll(".compat-row").forEach(row => {
      const profileId = row.dataset.profile;
      row.addEventListener("click", () => this._openCandidate(profileId));
      row.querySelector("[data-add]")?.addEventListener("click", e => {
        e.stopPropagation();
        this._addCompatible(profileId);
      });
    });
  }

  async _addCompatible(profileId) {
    const { compatible } = this._compatData();
    const item = compatible.find(x => x.profile_id === profileId);
    const { entryId } = this._stockData();
    if (!item || !entryId) return;
    const quantity = Math.max(1, Number(item.suggested_group || 1));
    await this._hass.callService("aquarium_manager", "add_stock", {
      entry_id: entryId,
      name: item.name,
      quantity,
      notes: "Added from compatible-fish recommendations"
    });
  }

  _openCandidate(profileId) {
    const { compatible } = this._compatData();
    const item = compatible.find(x => x.profile_id === profileId);
    if (!item) return;
    const matches = Array.isArray(item.matches) ? item.matches : [];
    const assessmentCautions = Array.isArray(item.cautions) ? item.cautions : [];
    const careNotes = Array.isArray(item.care_notes) ? item.care_notes : [];
    const combinedCautions = [...assessmentCautions, ...careNotes];
    const source = item.source_url ? `<div class="modal-section"><div class="modal-section-title">Profile source</div><div class="care-note">${this._escape(item.source_label || "Species profile")} — ${this._escape(item.source_url)}</div></div>` : "";
    const group = Math.max(1, Number(item.suggested_group || 1));
    this._showModal(`
      <div class="modal-head"><div><div class="modal-title">${this._escape(item.name)}</div><div class="modal-subtitle">${this._escape(item.scientific_name || "No scientific name")}</div></div><button class="icon-btn" data-close><ha-icon icon="mdi:close"></ha-icon></button></div>
      <div class="modal-body">
        <div class="detail-grid">
          ${this._detail("Suggested group", group)}
          ${this._detail("Estimated added bioload", item.estimated_group_bioload_points === null || item.estimated_group_bioload_points === undefined ? "Unknown" : `${this._fmt(item.estimated_group_bioload_points)} pts`)}
          ${this._detail("Adult size", this._unit(item.adult_size_cm,"cm"))}
          ${this._detail("Temperature", this._range(item.temperature_min,item.temperature_max,"°C"))}
          ${this._detail("pH", this._range(item.ph_min,item.ph_max,""))}
          ${this._detail("GH", this._range(item.gh_min,item.gh_max,"dGH"))}
          ${this._detail("KH", this._range(item.kh_min,item.kh_max,"dKH"))}
          ${this._detail("Minimum group", item.min_group_size ?? "Not set")}
          ${this._detail("Social", item.social_type || "Not set")}
          ${this._detail("Min tank", this._tankRange(item))}
          ${this._detail("Temperament", item.temperament || "Not set")}
          ${this._detail("Difficulty", item.difficulty || "Not set")}
          ${this._detail("Diet", item.diet_type || "Not set")}
        </div>
        ${matches.length ? `<div class="modal-section"><div class="modal-section-title">Why it matches</div>${matches.map(x => `<div class="care-note">${this._escape(x)}</div>`).join("")}</div>` : ""}
        ${combinedCautions.length ? `<div class="modal-section"><div class="modal-section-title">Cautions / care notes</div>${combinedCautions.map(x => `<div class="warning-line warning"><ha-icon icon="mdi:alert-outline"></ha-icon><span>${this._escape(x)}</span></div>`).join("")}</div>` : ""}
        <div class="bioload-note">Bioload is a relative adult-size estimate for comparison only; it is not a stocking-limit percentage.</div>
        ${source}
        <div class="modal-actions"><button data-close>Close</button><button class="primary" data-add-candidate>Add ×${group}</button></div>
      </div>`);
    this.shadowRoot.querySelector("[data-add-candidate]")?.addEventListener("click", async () => {
      await this._addCompatible(profileId);
      this._closeModal();
    });
  }

  _setStatus(id, value) {
    const el = this.shadowRoot.getElementById(id); if (!el) return;
    el.textContent = value === "unknown" ? "—" : value;
    el.className = `status ${value}`;
  }

  _renderCommunity() {
    const state = this._state(this._sensorEntity("community"));
    this._setStatus("community_status", state?.state || "unknown");
    const ranges = state?.attributes?.ranges || {};
    const keys = [["temperature","Temperature"],["ph","pH"],["gh","GH"],["kh","KH"]];
    const grid = this.shadowRoot.getElementById("community_grid");
    grid.innerHTML = keys.map(([key,label]) => {
      const r = ranges[key] || {};
      let value = "—";
      if (r.conflict) value = "No overlap";
      else if (r.min !== null && r.min !== undefined && r.max !== null && r.max !== undefined) value = `${this._fmt(r.min)}–${this._fmt(r.max)}${r.unit ? ` ${r.unit}` : ""}`;
      const excluded = Array.isArray(r.excluded) && r.excluded.length ? `${r.excluded.length} excluded` : "All profiled fish";
      return `<div class="range-card ${r.conflict ? "conflict" : ""}"><div class="range-label">${label}</div><div class="range-value">${value}</div><div class="range-note">${excluded}</div></div>`;
    }).join("");

    const warnings = state?.attributes?.warnings || [];
    const holder = this.shadowRoot.getElementById("community_warnings");
    holder.innerHTML = warnings.map(w => `<div class="warning-line ${this._escape(w.severity || "warning")}"><ha-icon icon="${w.severity === "danger" ? "mdi:alert-octagon-outline" : w.severity === "info" ? "mdi:information-outline" : "mdi:alert-outline"}"></ha-icon><span>${this._escape(w.message || "")}</span></div>`).join("");
  }

  _renderLibrary() {
    const state = this._state(this._sensorEntity("library"));
    const info = this.shadowRoot.getElementById("library_info");
    const button = this.shadowRoot.getElementById("refresh_library");
    if (!info || !button) return;

    if (!state) {
      info.textContent = "Fish library status unavailable";
      button.style.display = "none";
      return;
    }

    const attrs = state.attributes || {};
    const count = Number(state.state) || 0;
    const source = attrs.source === "remote" ? "GitHub / remote" : attrs.source === "cache" ? "cached GitHub / remote" : "bundled";
    const updated = attrs.updated ? ` · library ${attrs.updated}` : "";
    let refreshed = "";
    if (attrs.last_refresh) {
      const d = new Date(attrs.last_refresh);
      if (!Number.isNaN(d.getTime())) {
        refreshed = ` · fetched ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      }
    }
    const fingerprint = attrs.content_sha256 ? ` · ${String(attrs.content_sha256).slice(0, 8)}` : "";
    const ambiguousCount = Number(attrs.ambiguous_name_count || 0);
    const ambiguous = ambiguousCount ? ` · ${ambiguousCount} ambiguous name${ambiguousCount === 1 ? "" : "s"}` : "";
    const error = attrs.last_error ? ` · refresh error` : "";
    info.textContent = `${count} species · ${source}${updated}${refreshed}${fingerprint}${ambiguous}${error}`;
    const details = [
      attrs.last_error,
      attrs.url,
      attrs.remote_etag ? `ETag: ${attrs.remote_etag}` : "",
      attrs.remote_last_modified ? `Last-Modified: ${attrs.remote_last_modified}` : "",
      attrs.content_sha256 ? `SHA-256: ${attrs.content_sha256}` : "",
      ambiguousCount ? `Ambiguous names: ${(attrs.ambiguous_names || []).join(", ")}` : ""
    ].filter(Boolean);
    info.title = details.join("\n") || "Bundled fish library";
    button.style.display = attrs.url ? "block" : "none";
  }

  async _refreshLibrary() {
    const { entryId } = this._stockData();
    const button = this.shadowRoot.getElementById("refresh_library");
    if (!entryId || !button) return;
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = "Refreshing…";
    try {
      await this._hass.callService("aquarium_manager", "refresh_species_library", { entry_id: entryId });
      button.textContent = "Updated ✓";
      window.setTimeout(() => {
        if (button) button.textContent = previous;
      }, 1800);
    } catch (err) {
      button.textContent = "Failed";
      window.setTimeout(() => {
        if (button) button.textContent = previous;
      }, 2500);
      throw err;
    } finally {
      button.disabled = false;
    }
  }

  _renderStocking() {
    const state = this._state(this._sensorEntity("stocking"));
    const list = this.shadowRoot.getElementById("stock_list");
    if (!state) { list.innerHTML = `<div class="empty">Stocking sensor not found. Upgrade the Aquarium Manager integration to v0.4.</div>`; return; }
    const stock = Array.isArray(state.attributes?.stocking) ? state.attributes.stocking : [];
    const total = Number(state.state) || 0;
    const bioload = state.attributes?.estimated_bioload_points_total;
    this._setText("livestock_total", `${total} fish`);
    const loadText = bioload !== null && bioload !== undefined ? ` · ${this._fmt(bioload)} bioload pts` : "";
    this._setText("stock_summary", `${total} fish · ${stock.length} ${stock.length === 1 ? "group" : "groups"}${loadText}`);
    if (!stock.length) { list.innerHTML = `<div class="empty">No livestock recorded yet.</div>`; return; }
    list.innerHTML = stock.map(item => {
      const warnings = (item.warnings || []).filter(w => w.severity !== "info");
      return `<div class="stock-row" data-id="${this._escape(item.id)}"><div class="stock-name"><strong>${this._escape(item.name || "Unnamed")}</strong>${item.scientific_name ? `<div class="scientific">${this._escape(item.scientific_name)}</div>` : ""}</div><div class="stock-meta"><span class="qty-pill">×${Number(item.quantity)||0}</span>${warnings.length ? `<span class="warn-pill">⚠ ${warnings.length}</span>` : ""}</div><button class="edit-btn">Edit</button></div>`;
    }).join("");
    list.querySelectorAll(".stock-row").forEach(row => {
      const id = row.dataset.id;
      row.addEventListener("click", () => this._openDetails(id));
      row.querySelector(".edit-btn").addEventListener("click", e => { e.stopPropagation(); this._openEdit(id); });
    });
  }

  _stockData() {
    const state = this._state(this._sensorEntity("stocking"));
    return { state, stock: state?.attributes?.stocking || [], library: state?.attributes?.species_library || [], entryId: state?.attributes?.config_entry_id || null };
  }

  _openDetails(id) {
    const { stock } = this._stockData();
    const item = stock.find(x => x.id === id); if (!item) return;
    this._modalItemId = id; this._modalMode = "details";
    const warnings = item.warnings || [];
    const cautions = item.cautions || [];
    const source = item.source_url ? `<div class="modal-section"><div class="modal-section-title">Profile source</div><div class="care-note">${this._escape(item.source_label || "Species profile")} — ${this._escape(item.source_url)}</div></div>` : "";
    this._showModal(`
      <div class="modal-head"><div><div class="modal-title">${this._escape(item.name)}</div><div class="modal-subtitle">${this._escape(item.scientific_name || "No scientific name")}</div></div><button class="icon-btn" data-close><ha-icon icon="mdi:close"></ha-icon></button></div>
      <div class="modal-body">
        <div class="detail-grid">
          ${this._detail("Quantity", item.quantity)}${this._detail("Adult size", this._unit(item.adult_size_cm,"cm"))}
          ${this._detail("Estimated bioload", item.bioload_points_group === null || item.bioload_points_group === undefined ? "Unknown" : `${this._fmt(item.bioload_points_group)} pts group`)}
          ${this._detail("Bioload / fish", item.bioload_points_each === null || item.bioload_points_each === undefined ? "Unknown" : `${this._fmt(item.bioload_points_each)} pts`)}
          ${this._detail("Temperature", this._range(item.temperature_min,item.temperature_max,"°C"))}${this._detail("pH", this._range(item.ph_min,item.ph_max,""))}
          ${this._detail("GH", this._range(item.gh_min,item.gh_max,"dGH"))}${this._detail("KH", this._range(item.kh_min,item.kh_max,"dKH"))}
          ${this._detail("Minimum group", item.min_group_size ?? "Not set")}${this._detail("Social", item.social_type || "Not set")}
          ${this._detail("Min tank", this._tankRange(item))}${this._detail("Swimming zone", item.swimming_zone || "Not set")}
          ${this._detail("Temperament", item.temperament || "Not set")}
          ${this._detail("Difficulty", item.difficulty || "Not set")}${this._detail("Diet", item.diet_type || "Not set")}
        </div>
        <div class="bioload-note">Estimated bioload is a relative comparison score based on adult size and quantity, not a stocking-limit percentage.</div>
        ${warnings.length ? `<div class="modal-section"><div class="modal-section-title">Warnings</div>${warnings.map(w => `<div class="warning-line ${this._escape(w.severity || "warning")}"><ha-icon icon="mdi:alert-outline"></ha-icon><span>${this._escape(w.message)}</span></div>`).join("")}</div>` : ""}
        ${cautions.length ? `<div class="modal-section"><div class="modal-section-title">Care notes</div>${cautions.map(x => `<div class="care-note">${this._escape(x)}</div>`).join("")}</div>` : ""}
        ${item.notes ? `<div class="modal-section"><div class="modal-section-title">Your notes</div><div class="care-note">${this._escape(item.notes)}</div></div>` : ""}
        ${source}
        <div class="modal-actions"><button data-close>Close</button><button class="primary" data-edit>Edit fish</button></div>
      </div>`);
    this.shadowRoot.querySelector("[data-edit]").addEventListener("click", () => this._openEdit(id));
  }

  _openEdit(id) {
    const { stock, library } = this._stockData();
    const item = id ? stock.find(x => x.id === id) : null;
    this._modalItemId = id; this._modalMode = "edit";
    const v = (key) => item?.[key] ?? "";
    const libraryOptions = library.map(x => `<option value="${this._escape(x.name)}">${this._escape(x.scientific_name || "")}</option>`).join("");
    const advanced = item ? `
      <div class="form-field"><label>Scientific name</label><input data-field="scientific_name" value="${this._escape(v("scientific_name"))}"></div>
      <div class="form-field"><label>Adult size (cm)</label><input data-field="adult_size_cm" type="number" step="0.1" value="${this._escape(v("adult_size_cm"))}"></div>
      ${this._rangeInputs("Temperature °C","temperature_min","temperature_max",v)}
      ${this._rangeInputs("pH","ph_min","ph_max",v)}
      ${this._rangeInputs("GH dGH","gh_min","gh_max",v)}
      ${this._rangeInputs("KH dKH","kh_min","kh_max",v)}
      <div class="form-field"><label>Minimum group size</label><input data-field="min_group_size" type="number" step="1" min="1" value="${this._escape(v("min_group_size"))}"></div>
      <div class="form-field"><label>Social type</label><input data-field="social_type" value="${this._escape(v("social_type"))}"></div>
      <div class="form-field"><label>Minimum tank length (cm)</label><input data-field="min_tank_length_cm" type="number" step="1" value="${this._escape(v("min_tank_length_cm"))}"></div>
      <div class="form-field"><label>Minimum tank width (cm)</label><input data-field="min_tank_width_cm" type="number" step="1" value="${this._escape(v("min_tank_width_cm"))}"></div>
      <div class="form-field"><label>Minimum tank height (cm)</label><input data-field="min_tank_height_cm" type="number" step="1" value="${this._escape(v("min_tank_height_cm"))}"></div>
      <div class="form-field"><label>Swimming zone</label><input data-field="swimming_zone" value="${this._escape(v("swimming_zone"))}"></div>
      <div class="form-field full"><label>Temperament</label><input data-field="temperament" value="${this._escape(v("temperament"))}"></div>` : `<div class="form-field full"><div class="small-help">Known species are automatically filled from the active fish library after you add them. You can then edit individual values if required.</div></div>`;

    this._showModal(`
      <div class="modal-head"><div><div class="modal-title">${item ? "Edit fish" : "Add fish"}</div><div class="modal-subtitle">${item ? this._escape(item.name) : "Add a stocking group"}</div></div><button class="icon-btn" data-close><ha-icon icon="mdi:close"></ha-icon></button></div>
      <div class="modal-body"><datalist id="species_library">${libraryOptions}</datalist><div class="form-grid">
        <div class="form-field"><label>Species / name</label><input data-field="name" list="species_library" value="${this._escape(v("name"))}"></div>
        <div class="form-field"><label>Quantity</label><input data-field="quantity" type="number" min="1" step="1" value="${this._escape(item ? v("quantity") : 1)}"></div>
        ${advanced}
        <div class="form-field full"><label>Notes</label><textarea data-field="notes" rows="3">${this._escape(v("notes"))}</textarea></div>
      </div><div class="modal-actions">${item ? `<button class="danger-btn" data-delete>Delete</button>` : ""}<button data-close>Cancel</button><button class="primary" data-save>${item ? "Save changes" : "Add fish"}</button></div></div>`);
    this.shadowRoot.querySelector("[data-save]").addEventListener("click", () => this._saveStockForm(item));
    if (item) this.shadowRoot.querySelector("[data-delete]").addEventListener("click", () => this._removeStock(item));
  }

  _showModal(html) {
    const modal = this.shadowRoot.getElementById("modal"); modal.innerHTML = html;
    this.shadowRoot.getElementById("modal_backdrop").classList.add("open");
    modal.querySelectorAll("[data-close]").forEach(x => x.addEventListener("click", () => this._closeModal()));
  }

  _closeModal(){this.shadowRoot.getElementById("modal_backdrop").classList.remove("open");this._modalItemId=null;this._modalMode=null;}

  async _saveStockForm(existing) {
    const { entryId } = this._stockData(); if (!entryId) return;
    const modal = this.shadowRoot.getElementById("modal");
    const get = key => modal.querySelector(`[data-field="${key}"]`)?.value ?? "";
    const name = get("name").trim(); const quantity = Number(get("quantity"));
    if (!name || !Number.isInteger(quantity) || quantity < 1) return;
    if (!existing) {
      await this._hass.callService("aquarium_manager","add_stock",{entry_id:entryId,name,quantity,notes:get("notes").trim()});
      this._closeModal(); return;
    }
    const numeric = ["adult_size_cm","temperature_min","temperature_max","ph_min","ph_max","gh_min","gh_max","kh_min","kh_max","min_group_size","min_tank_length_cm","min_tank_width_cm","min_tank_height_cm"];
    const payload = {entry_id:entryId,stock_id:existing.id,name,quantity,scientific_name:get("scientific_name").trim(),social_type:get("social_type").trim(),temperament:get("temperament").trim(),swimming_zone:get("swimming_zone").trim(),notes:get("notes").trim()};
    numeric.forEach(key => { const raw=get(key).trim(); payload[key]=raw===""?null:Number(raw); });
    await this._hass.callService("aquarium_manager","update_stock",payload);
    this._closeModal();
  }

  async _removeStock(item){const {entryId}=this._stockData();if(!entryId)return;if(!window.confirm(`Remove ${item.name} from the aquarium?`))return;await this._hass.callService("aquarium_manager","remove_stock",{entry_id:entryId,stock_id:item.id});this._closeModal();}

  async _saveNumber(event){const input=event.currentTarget;const entity_id=this._numberEntity(input.dataset.key);const value=Number(input.value);if(Number.isNaN(value))return;input.disabled=true;try{await this._hass.callService("number","set_value",{entity_id,value});}finally{input.disabled=false;}}

  _detail(label,value){return `<div class="detail"><div class="detail-label">${this._escape(label)}</div><div class="detail-value">${this._escape(value ?? "Not set")}</div></div>`;}
  _range(min,max,unit){if(min===null||min===undefined||max===null||max===undefined)return "Not set";return `${this._fmt(min)}–${this._fmt(max)}${unit?` ${unit}`:""}`;}
  _unit(value,unit){return value===null||value===undefined?"Not set":`${this._fmt(value)} ${unit}`;}
  _tankRange(item){const vals=[item.min_tank_length_cm,item.min_tank_width_cm,item.min_tank_height_cm];const hasDims=vals.some(x=>x!==null&&x!==undefined);const volume=item.min_tank_volume_l;const dimText=hasDims?vals.map(x=>x===null||x===undefined?"—":this._fmt(x)).join(" × ")+" cm":"";const volumeText=volume!==null&&volume!==undefined?`${this._fmt(volume)} L`:"";return [dimText,volumeText].filter(Boolean).join(" · ")||"Not set";}
  _rangeInputs(label,minKey,maxKey,v){return `<div class="form-field full"><label>${label}</label><div class="pair"><input data-field="${minKey}" type="number" step="0.1" placeholder="Min" value="${this._escape(v(minKey))}"><input data-field="${maxKey}" type="number" step="0.1" placeholder="Max" value="${this._escape(v(maxKey))}"></div></div>`;}
  _fmt(value){const n=Number(value);return Number.isFinite(n)?(Number.isInteger(n)?String(n):String(Math.round(n*10)/10)):String(value);}
  _signedDisplay(entityId){const s=this._state(entityId);if(!s||["unknown","unavailable"].includes(s.state))return"—";const n=Number(s.state),u=s.attributes?.unit_of_measurement||"";return`${n>0?"+":""}${s.state}${u?` ${u}`:""}`;}
  _setText(id,value){const el=this.shadowRoot.getElementById(id);if(el)el.textContent=value;}
  _escape(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
}

if (!customElements.get("aquarium-manager-card")) customElements.define("aquarium-manager-card", AquariumManagerCard);
window.customCards = window.customCards || [];
window.customCards.push({type:"aquarium-manager-card",name:"Aquarium Manager",description:"Aquarium overview, community ranges, stocking and water testing.",preview:false});
console.info("%c AQUARIUM-MANAGER-CARD %c v0.5.0 ","color:white;background:#0277bd;font-weight:bold;","color:#0277bd;background:white;font-weight:bold;");
