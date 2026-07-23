// Ticker tape — duplicate the items once so the CSS scroll loop
// (translateX(-50%)) has no visible seam, no matter how many
// <span> items you add or remove in index.html.
const track = document.getElementById("tickerTrack");

if (track) {
    track.innerHTML += track.innerHTML;
}

// Dark / light mode toggle. Theme is applied to <html data-theme="...">
// (see the inline script in index.html's <head>, which sets it before
// paint) and saved to localStorage so it persists across visits.
const themeToggle = document.getElementById("themeToggle");
const themeLabel = themeToggle ? themeToggle.querySelector(".theme-toggle-label") : null;
const root = document.documentElement;

function updateToggleLabel() {
    const current = root.getAttribute("data-theme");
    if (themeLabel) {
        themeLabel.textContent = current === "dark" ? "Light mode" : "Dark mode";
    }
}

if (themeToggle) {
    updateToggleLabel();
    themeToggle.addEventListener("click", function () {
        const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
        updateToggleLabel();
    });
}

// Sparkline — draws the recent close-price history next to "Last close
// price". Points come from result.close_history (see stockapp.py),
// passed in as a JSON string on the data-points attribute.
const sparkline = document.getElementById("sparkline");

if (sparkline) {
    let values = [];
    try {
        values = JSON.parse(sparkline.dataset.points || "[]");
    } catch (e) {
        values = [];
    }

    if (values.length > 1) {
        const width = 120;
        const height = 32;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;

        const points = values.map((v, i) => {
            const x = (i / (values.length - 1)) * width;
            const y = height - ((v - min) / range) * height;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(" ");

        const isUp = values[values.length - 1] >= values[0];
        const strokeColor = isUp
            ? getComputedStyle(root).getPropertyValue("--bull").trim()
            : getComputedStyle(root).getPropertyValue("--bear").trim();

        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        polyline.setAttribute("points", points);
        polyline.setAttribute("stroke", strokeColor);
        sparkline.appendChild(polyline);
    }
}

// Animated predicting state — while the form's POST request is in
// flight, swap the submit button for a small growing-candlestick
// animation instead of leaving it looking unresponsive.
const predictForm = document.querySelector(".terminal-body form");

if (predictForm) {
    predictForm.addEventListener("submit", function () {
        const btn = predictForm.querySelector("button[type=submit]");
        if (btn) {
            btn.disabled = true;
            btn.classList.add("is-predicting");
            btn.innerHTML =
                '<span class="predict-candles"><span></span><span></span><span></span></span>Predicting\u2026';
        }
    });
}

// Confidence meter — width comes from a data attribute (rather than
// an inline style with a Jinja value in it) so no templating syntax
// ever ends up inside a CSS string.
document.querySelectorAll(".confidence-fill[data-width]").forEach(function (el) {
    el.style.width = el.dataset.width + "%";
});

// Export result — builds a small CSV from the data already rendered
// on the page and downloads it. No server round trip needed.
const exportBtn = document.getElementById("exportBtn");

if (exportBtn) {
    exportBtn.addEventListener("click", function () {
        const d = exportBtn.dataset;
        const rows = [
            ["Field", "Value"],
            ["Last trading date", d.date],
            ["Last close price", d.lastClose],
            ["Predicted return (%)", d.predictedReturn],
            ["Predicted next-day close", d.predictedClose],
            ["Prediction confidence (%)", d.confidence]
        ];
        const csv = rows.map((r) => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `prediction_${d.date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });
}