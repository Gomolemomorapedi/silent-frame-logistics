/* Optional shared Supabase pilot. Empty config keeps the honest browser demo active. */
(() => {
  const config = window.SFL_CONFIG || {};
  const configured = /^https:\/\/.+\.supabase\.co$/.test(config.supabaseUrl || "") &&
    typeof config.supabaseAnonKey === "string" && config.supabaseAnonKey.length > 20;
  const status = document.createElement("div");
  status.className = "notice";
  status.id = "backendStatus";
  status.setAttribute("role", "status");
  const market = document.querySelector("#marketplace .head");
  market?.after(status);

  const setStatus = (message) => { status.textContent = message; };
  const setRequestsReady = (ready) => document.querySelectorAll(".ask,.providerAsk").forEach(button => { button.disabled = !ready; });
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const clearLocal = document.createElement("button");
  clearLocal.className = "btn light";
  clearLocal.type = "button";
  clearLocal.textContent = "Clear local sample listings";
  clearLocal.hidden = true;
  clearLocal.style.marginTop = "8px";
  document.querySelector("#listingStatus")?.after(clearLocal);
  const updateClearButton = () => { clearLocal.hidden = !Array.isArray(local) || local.length === 0; };
  updateClearButton();
  const listingStatus = document.querySelector("#listingStatus");
  if (listingStatus) new MutationObserver(updateClearButton).observe(listingStatus, { childList: true, characterData: true, subtree: true });
  clearLocal.onclick = () => {
    try { localStorage.removeItem("sf-west-rand-listings-v1"); } catch {}
    if (Array.isArray(local)) local.splice(0, local.length);
    render();
    document.querySelector("#listingStatus").textContent = "Browser-only sample listings cleared from this device.";
    updateClearButton();
  };
  let client;
  let liveRows = [];
  let liveTransporters = [];
  const iconFor = (category) => ({
    "Roofing": "🏠", "Sand & stone": "⛰️", "Paving": "▦"
  }[category] || "🧱");
  const loadClient = async () => {
    if (!configured) throw new Error("The shared marketplace has not been configured yet.");
    if (!client) {
      const sdk = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      client = sdk.createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
    return client;
  };

  if (!configured) {
    window.SFL_LIVE = false;
    setStatus("Preview mode · sample listings only. Shared accounts and real enquiries are not connected yet.");
    return;
  }

  window.SFL_LIVE = true;
  setRequestsReady(false);
  setStatus("Connecting to the shared West Rand marketplace…");
  const authBox = document.createElement("div");
  authBox.className = "formbox";
  authBox.style.marginBottom = "12px";
  authBox.innerHTML = '<label for="pilotEmail">Supplier / transporter sign-in</label><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="control" id="pilotEmail" type="email" autocomplete="email" placeholder="Business email address" style="flex:1;min-width:220px"><button class="btn" id="pilotSignIn" type="button">Email me a sign-in link</button><button class="btn light" id="pilotSignOut" type="button" hidden>Sign out</button></div><label style="display:flex;gap:8px;align-items:flex-start;margin:12px 0"><input type="checkbox" id="pilotPrivacyAccepted" style="width:auto;margin-top:3px">I agree to the <a href="./privacy.html" target="_blank" rel="noopener">privacy notice</a> and <a href="./terms.html" target="_blank" rel="noopener">pilot terms</a>.</label><p class="localnote" id="pilotAuthStatus" aria-live="polite">Sign in to submit a listing for review.</p>';
  document.querySelector("#listing")?.before(authBox);
  const providerJoin = document.createElement("form");
  providerJoin.id = "providerRegistration";
  providerJoin.className = "formbox";
  providerJoin.style.marginTop = "14px";
  providerJoin.innerHTML = '<h3>Register interest as a transporter</h3><div class="fields"><div><label for="carrierName">Business or provider name</label><input class="control" id="carrierName" name="business_name" maxlength="100" required></div><div><label for="vehicleType">Vehicle type</label><input class="control" id="vehicleType" name="vehicle_type" maxlength="80" placeholder="Bakkie, flatbed, light truck" required></div><div><label for="capacityKg">Capacity (kg)</label><input class="control" id="capacityKg" name="capacity_kg" type="number" min="1" required></div><div><label for="carrierPhone">Contact phone</label><input class="control" id="carrierPhone" name="contact_phone" type="tel" minlength="7" maxlength="30" required></div><div class="wide"><label for="serviceAreas">West Rand service areas</label><input class="control" id="serviceAreas" name="service_areas" maxlength="250" placeholder="Krugersdorp, Randfontein" required></div></div><label style="display:flex;gap:8px;align-items:flex-start;margin:12px 0"><input type="checkbox" name="privacyAccepted" required style="width:auto;margin-top:3px">I agree to the <a href="./privacy.html" target="_blank" rel="noopener">privacy notice</a> and <a href="./terms.html" target="_blank" rel="noopener">pilot terms</a>.</label><button class="btn" type="submit">Submit vehicle for review</button><p class="localnote" id="carrierStatus" aria-live="polite">This interest form does not collect vehicle documents or complete safety, insurance or permit checks. Do not send sensitive documents through this pilot form.</p>';
  document.querySelector("#providers")?.after(providerJoin);
  const authStatus = document.querySelector("#pilotAuthStatus");
  const listingButton = document.querySelector('#listing button[type="submit"]');
  if (listingButton) listingButton.textContent = "Submit listing for review";
  const privacyText = document.querySelector(".privacy");
  if (privacyText) privacyText.innerHTML = 'Your details will be sent to the pilot team to respond to your request. Read the <a href="./privacy.html" target="_blank" rel="noopener">privacy notice</a>.';
  const modalBox = document.querySelector(".modalbox");
  if (modalBox) { modalBox.style.maxHeight = "calc(100vh - 30px)"; modalBox.style.overflowY = "auto"; }

  const refreshProducts = async () => {
    try {
      const db = await loadClient();
      const { data, error } = await db.from("products")
        .select("id,name,category,description,area,price_zar,unit,quantity,delivery_available")
        .eq("status", "active").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      liveRows = (data || []).map(row => ({
        ...row, price: row.price_zar, seller: "West Rand supplier", icon: iconFor(row.category), source: "pilot"
      }));
      if (liveRows.length) {
        sample.splice(0, sample.length, ...liveRows);
        render();
        setStatus("Shared marketplace · showing " + liveRows.length + " approved supplier listing" + (liveRows.length === 1 ? "." : "s."));
      } else {
        setStatus("Shared marketplace is connected. No supplier listings are approved yet; the sample preview remains visible.");
      }
      const { data: transports, error: transportError } = await db.from("transporters")
        .select("id,business_name,vehicle_type,capacity_kg,service_areas")
        .eq("status", "active").order("created_at", { ascending: false }).limit(100);
      if (transportError) throw transportError;
      liveTransporters = transports || [];
      const providers = document.querySelector("#providers");
      providers.innerHTML = liveTransporters.length ? liveTransporters.map(item =>
        '<article class="provider"><span>🚚</span><h3>' + escapeHtml(item.business_name) + '</h3><p>Reviewed pilot profile</p><small>Vehicle: ' + escapeHtml(item.vehicle_type) + '<br>Service area: ' + escapeHtml((item.service_areas || []).join(" · ")) + '<br>Capacity: ' + Number(item.capacity_kg).toLocaleString("en-ZA") + ' kg</small><button class="btn providerAsk" data-transporter-id="' + escapeHtml(item.id) + '">Request delivery quote →</button></article>'
      ).join("") : '<p class="notice">No transport profiles have been approved yet. Register a vehicle below to join the pilot.</p>';
      return true;
    } catch (error) {
      setStatus("The shared marketplace could not be reached. Please try again later; the preview listings are examples.");
      console.error("Marketplace connection failed", error);
      return false;
    }
  };

  (async () => {
    try {
      const db = await loadClient();
      const { data: sessionData, error } = await db.auth.getSession();
      if (error) throw error;
      const updateAuth = (user) => {
        authStatus.textContent = user ? "Signed in as " + user.email + ". New listings are sent for review." : "Sign in to submit a listing for review.";
        document.querySelector("#pilotSignOut").hidden = !user;
      };
      updateAuth(sessionData.session?.user || null);
      db.auth.onAuthStateChange((_event, session) => updateAuth(session?.user || null));
      document.querySelector("#pilotSignIn").onclick = async () => {
        const email = document.querySelector("#pilotEmail").value.trim();
        if (!email) { authStatus.textContent = "Enter your business email address first."; return; }
        if (!document.querySelector("#pilotPrivacyAccepted").checked) { authStatus.textContent = "Accept the privacy notice and pilot terms before signing in."; return; }
        authStatus.textContent = "Sending a secure sign-in link…";
        const { error: signInError } = await db.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin + window.location.pathname }
        });
        authStatus.textContent = signInError ? signInError.message : "Check your email for the sign-in link.";
      };
      document.querySelector("#pilotSignOut").onclick = async () => { await db.auth.signOut(); };

      document.querySelector("#listing").onsubmit = async (event) => {
        event.preventDefault();
        const button = event.currentTarget.querySelector('[type="submit"]');
        button.disabled = true;
        document.querySelector("#listingStatus").textContent = "Submitting for review…";
        try {
          const { data: auth } = await db.auth.getUser();
          if (!auth.user) throw new Error("Sign in with your business email before submitting a listing.");
          const values = Object.fromEntries(new FormData(event.currentTarget));
          const { error: saveError } = await db.from("products").insert({
            seller_id: auth.user.id, name: values.name, category: values.category,
            description: values.description, area: values.area, price_zar: Number(values.price),
            unit: values.unit, quantity: Number(values.quantity), status: "pending"
          });
          if (saveError) throw saveError;
          event.currentTarget.reset();
          document.querySelector("#listingStatus").textContent = "Listing submitted. It will appear after the pilot team reviews it.";
        } catch (error) {
          document.querySelector("#listingStatus").textContent = error.message || "Could not submit the listing. Please try again.";
        } finally { button.disabled = false; }
      };

      providerJoin.onsubmit = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('[type="submit"]');
        const output = document.querySelector("#carrierStatus");
        button.disabled = true;
        output.textContent = "Submitting vehicle for review…";
        try {
          const { data: auth } = await db.auth.getUser();
          if (!auth.user) throw new Error("Sign in with your provider email before registering a vehicle.");
          const values = Object.fromEntries(new FormData(form));
          const areas = values.service_areas.split(",").map(area => area.trim()).filter(Boolean).slice(0, 10);
          const { error: saveError } = await db.from("transporters").insert({
            owner_id: auth.user.id, business_name: values.business_name,
            vehicle_type: values.vehicle_type, capacity_kg: Number(values.capacity_kg),
            contact_phone: values.contact_phone, service_areas: areas, status: "pending"
          });
          if (saveError) throw saveError;
          form.reset();
          output.textContent = "Vehicle submitted. The pilot team will review your details before publishing the profile.";
        } catch (error) {
          output.textContent = error.message || "Could not submit the vehicle. Please try again.";
        } finally { button.disabled = false; }
      };

      document.querySelector("#contact").onsubmit = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        document.querySelector("#status").textContent = "Sending your request securely…";
        try {
          const values = Object.fromEntries(new FormData(form));
          const productId = window.SFL_REQUEST_PRODUCT_ID || "";
          const isProduct = Boolean(productId && liveRows.some(row => row.id === productId));
          if (productId && !isProduct) throw new Error("This is an example listing. Enquiries are available only for approved live listings.");
          const { data, error } = await (await loadClient()).functions.invoke("submit-enquiry", {
            body: {
              kind: isProduct ? "product" : "delivery", product_id: isProduct ? productId : undefined,
              transporter_id: window.SFL_REQUEST_TRANSPORTER_ID || undefined,
              name: values.name, email: values.email, phone: values.phone,
              quantity: values.requestQuantity, collection_area: values.collectionArea,
              destination: values.destination, preferred_date: values.preferredDate,
              message: [values.message, values.vehicleType && `Vehicle category: ${values.vehicleType}`, values.bookingDays && `Booking duration: ${values.bookingDays} day(s)`, values.loadDimensions && `Approximate load weight / dimensions: ${values.loadDimensions}`, values.stops && `Additional stops / handling: ${values.stops}`].filter(Boolean).join("\n").slice(0, 2000), privacy_accepted: values.privacyAccepted === "on",
              company_website: values.companyWebsite
            }
          });
          if (error) throw error;
          document.querySelector("#status").textContent = data.notice || "Request received. The pilot team will contact you using the details provided.";
          form.reset();
        } catch (error) {
          document.querySelector("#status").textContent = error.message || "We could not send the request. Please try again.";
        } finally { button.disabled = false; }
      };

      document.querySelector(".privacy").textContent = "Your request will be stored privately in the pilot enquiry database and forwarded to the configured business inbox. It does not confirm a booking or price.";
      document.querySelector("#contact").insertAdjacentHTML("beforeend", '<input name="companyWebsite" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-10000px">');
      const ready = await refreshProducts();
      setRequestsReady(ready);
    } catch (error) {
      setStatus("The shared marketplace could not be connected. Check the Supabase project settings.");
      console.error("Pilot setup failed", error);
    }
  })();

  document.addEventListener("click", event => {
    const productButton = event.target.closest(".ask");
    const deliveryButton = event.target.closest(".providerAsk");
    if (productButton) window.SFL_REQUEST_PRODUCT_ID = productButton.dataset.id;
    if (deliveryButton) {
      window.SFL_REQUEST_PRODUCT_ID = "";
      window.SFL_REQUEST_TRANSPORTER_ID = deliveryButton.dataset.transporterId || "";
    }
    if (productButton) window.SFL_REQUEST_TRANSPORTER_ID = "";
  }, true);
})();
