// ===== CONFIG =====
const API_KEY = "74d93a5aa4ee476188282039251308";
// We'll use the Forecast endpoint to get hourly data for 4 days.
const BASE = "https://api.weatherapi.com/v1/forecast.json";

// DOM refs
const form = document.getElementById("search-form");
const input = document.getElementById("location-input");

const placeNameEl = document.getElementById("place-name");
const localtimeEl = document.getElementById("localtime");
const currentIconEl = document.getElementById("current-icon");
const currentTempEl = document.getElementById("current-temp");
const currentCondEl = document.getElementById("current-cond");

const feelslikeEl = document.getElementById("feelslike");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const uvEl = document.getElementById("uv");
const precipEl = document.getElementById("precip");
const pressureEl = document.getElementById("pressure");

const aqiBadgeEl = document.getElementById("aqi-badge");
const usEpaEl = document.getElementById("us-epa");
const usEpaDescEl = document.getElementById("us-epa-desc");
const gbDefraEl = document.getElementById("gb-defra");
const gbDefraDescEl = document.getElementById("gb-defra-desc");
const pm25El = document.getElementById("pm2_5");
const pm10El = document.getElementById("pm10");
const o3El = document.getElementById("o3");
const no2El = document.getElementById("no2");
const so2El = document.getElementById("so2");
const coEl = document.getElementById("co");

const dayTabsEl = document.getElementById("day-tabs");
const hourCardsEl = document.getElementById("hour-cards");

// Chart.js instance holder
let tempChart;

// ===== Utilities =====
const pad = (n) => String(n).padStart(2, "0");

function epaLabel(i){
  // 1 Good, 2 Moderate, 3 Unhealthy for sensitive groups, 4 Unhealthy, 5 Very Unhealthy, 6 Hazardous
  const map = {
    1: "Good",
    2: "Moderate",
    3: "Unhealthy (Sensitive)",
    4: "Unhealthy",
    5: "Very Unhealthy",
    6: "Hazardous"
  };
  return map[i] || "—";
}

function epaClass(i){
  if (i === 1) return "good";
  if (i === 2) return "moderate";
  if (i >= 3) return "unhealthy";
  return "";
}

function defraLabel(i){
  // 1-3 Low, 4-6 Moderate, 7-9 High, 10 Very High
  if (!i && i !== 0) return "—";
  if (i <= 3) return "Low";
  if (i <= 6) return "Moderate";
  if (i <= 9) return "High";
  return "Very High";
}

function celsius(v){ return `${Math.round(v)}°`; }
function kphToString(kph, deg){
  const dir = degToCompass(deg);
  return `${Math.round(kph)} km/h ${dir}`;
}
function degToCompass(num){
  const val = Math.floor((num/22.5) + 0.5);
  const arr = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return arr[(val % 16)];
}
function httpsIcon(url){
  if (!url) return "";
  return url.startsWith("//") ? `https:${url}` : url.replace("http://","https://");
}
function toLocalTimeStr(dtStr){
  // dtStr from API is local to the location, already human-friendly (YYYY-MM-DD HH:MM)
  const [d, t] = dtStr.split(" ");
  const [y, m, dd] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const date = new Date(y, m-1, dd, hh, mm);
  const opts = { weekday:"short", year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" };
  return date.toLocaleString(undefined, opts);
}
function shortHourLabel(dtStr){
  // returns "HH:MM" or "DD MMM HH:MM" if day boundary helpful
  const [d, t] = dtStr.split(" ");
  const [hh, mm] = t.split(":");
  return `${hh}:${mm}`;
}
function dayTitle(dateStr){
  const d = new Date(dateStr);
  const today = new Date();
  const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dN = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((dN - d0)/(1000*60*60*24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
}

// ===== Rendering =====
function renderCurrent(current, location){
  placeNameEl.textContent = `${location.name}, ${location.region || location.country}`;
  localtimeEl.textContent = `Local time: ${toLocalTimeStr(location.localtime)}`;
  currentIconEl.src = httpsIcon(current.condition.icon);
  currentIconEl.alt = current.condition.text || "weather icon";
  currentTempEl.textContent = celsius(current.temp_c);
  currentCondEl.textContent = current.condition.text || "—";

  feelslikeEl.textContent = celsius(current.feelslike_c);
  humidityEl.textContent = `${current.humidity}%`;
  windEl.textContent = kphToString(current.wind_kph, current.wind_degree);
  uvEl.textContent = `${current.uv}`;
  precipEl.textContent = `${current.precip_mm} mm`;
  pressureEl.textContent = `${current.pressure_mb} mb`;
}

function renderAQI(air){
  // air has keys: co, no2, o3, so2, pm2_5, pm10, "us-epa-index", "gb-defra-index"
  const us = air["us-epa-index"];
  const gb = air["gb-defra-index"];

  aqiBadgeEl.textContent = epaLabel(us);
  aqiBadgeEl.className = `badge ${epaClass(us)}`;

  usEpaEl.textContent = us ?? "—";
  usEpaDescEl.textContent = epaLabel(us);
  gbDefraEl.textContent = gb ?? "—";
  gbDefraDescEl.textContent = defraLabel(gb);

  pm25El.textContent = air.pm2_5?.toFixed(1) ?? "—";
  pm10El.textContent = air.pm10?.toFixed(1) ?? "—";
  o3El.textContent   = air.o3?.toFixed(1) ?? "—";
  no2El.textContent  = air.no2?.toFixed(1) ?? "—";
  so2El.textContent  = air.so2?.toFixed(1) ?? "—";
  coEl.textContent   = air.co?.toFixed(1) ?? "—";
}

function renderTabsAndHours(forecastDays){
  dayTabsEl.innerHTML = "";
  hourCardsEl.innerHTML = "";

  forecastDays.slice(0,3).forEach((fd, idx) => {
    const btn = document.createElement("button");
    btn.className = `tab ${idx===0 ? "active":""}`;
    btn.textContent = dayTitle(fd.date);
    btn.setAttribute("data-index", idx);
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      updateChartForDay(fd);
      renderHourCards(fd);
    });
    dayTabsEl.appendChild(btn);
  });

  // initial population for day 0
  updateChartForDay(forecastDays[0]);
  renderHourCards(forecastDays[0]);
}

function renderHourCards(forecastDay){
  hourCardsEl.innerHTML = "";
  forecastDay.hour.forEach(h => {
    const card = document.createElement("div");
    card.className = "hour-card";

    const time = document.createElement("div");
    time.className = "time";
    time.textContent = `${forecastDay.date} · ${shortHourLabel(h.time)}`;

    const row = document.createElement("div");
    row.className = "row";
    const icon = document.createElement("img");
    icon.src = httpsIcon(h.condition.icon);
    icon.alt = h.condition.text || "condition";
    const temp = document.createElement("div");
    temp.innerHTML = `<strong>${celsius(h.temp_c)}</strong>`;
    row.append(icon, temp);

    const cond = document.createElement("div");
    cond.className = "subtle";
    cond.textContent = h.condition.text || "";

    const extras = document.createElement("div");
    extras.className = "subtle";
    const pop = h.chance_of_rain || h.will_it_rain ? `${h.chance_of_rain || 0}%` : "0%";
    extras.textContent = `Feels: ${celsius(h.feelslike_c)} · Wind: ${Math.round(h.wind_kph)} km/h · Rain: ${pop}`;

    card.append(time, row, cond, extras);
    hourCardsEl.appendChild(card);
  });
}

function updateChartForDay(forecastDay){
  const ctx = document.getElementById("tempChart").getContext("2d");
  const labels = forecastDay.hour.map(h => shortHourLabel(h.time));
  const temps = forecastDay.hour.map(h => h.temp_c);

  if (tempChart) tempChart.destroy();
  tempChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: `Temperature (${forecastDay.date})`,
        data: temps,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
        },
        y: {
          title: { display: true, text: "°C" },
          suggestedMin: Math.min(...temps) - 2,
          suggestedMax: Math.max(...temps) + 2
        }
      },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y} °C`
          }
        }
      }
    }
  });
}

// ===== API Fetch =====
async function fetchWeather(q){
  const url = `${BASE}?key=${API_KEY}&q=${encodeURIComponent(q)}&days=3&aqi=yes&alerts=no`;
  const res = await fetch(url);
  if (!res.ok){
    const errText = await res.text();
    throw new Error(`API error ${res.status}: ${errText}`);
  }
  return res.json();
}

// ===== App init =====
async function loadLocation(query){
  try{
    const data = await fetchWeather(query);
    // Render sections
    renderCurrent(data.current, data.location);
    renderAQI(data.current?.air_quality || {});
    renderTabsAndHours(data.forecast?.forecastday || []);
  }catch(err){
    alert(`Failed to fetch weather. ${err.message}`);
    console.error(err);
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  loadLocation(q);
});

// Default: try a starter city from your example
window.addEventListener("DOMContentLoaded", () => {
  // You can change the default to your city if you like
  input.value = "Jamshedpur";
  loadLocation(input.value);
});
