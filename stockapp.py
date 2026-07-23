from flask import Flask, render_template, request
import pandas as pd
import xgboost as xgb

app = Flask(__name__)

# ---------------------------
# LOAD MODEL (ONCE)
# ---------------------------
model = xgb.XGBRegressor()
model.load_model("xgb_model2.json")

# ---------------------------
# HOME ROUTE
# ---------------------------
@app.route("/", methods=["GET", "POST"])
def index():
    result = None
    preview = None

    if request.method == "POST":
        file = request.files["file"]

        if file:
            df = pd.read_csv(file)

            # Preview (last 5 rows)
            preview = df.tail(5).to_html(
                classes="table",
                index=False
            )

            # Date handling
            df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
            df = df.dropna(subset=["Date"])

            # Numeric conversion
            for col in df.columns:
                if col != "Date":
                    df[col] = pd.to_numeric(df[col], errors="coerce")

            # Feature engineering
            iso = df.Date.dt.isocalendar()
            df["month"] = df.Date.dt.month
            df["day"] = df.Date.dt.day
            df["day_of_week"] = df.Date.dt.dayofweek
            df["week"] = iso.week.astype(int)
            df["iso_year"] = iso.year.astype(int)

            df = df.fillna(df.mean(numeric_only=True))

            # Required features
            df["Trades"] = 0
            df["Deliverable Volume"] = df["Volume"] * 0.6
            df["%Deliverble"] = 60.0

            feature_cols = [
                "Prev Close", "Open", "High", "Low", "Last", "VWAP", "Volume",
                "Turnover", "Trades", "Deliverable Volume", "%Deliverble",
                "month", "day", "day_of_week", "week", "iso_year"
            ]

            X_last = df[feature_cols].iloc[[-1]]

            predicted_return = model.predict(X_last)[0]
            last_close = df["Close"].iloc[-1]
            predicted_close = last_close * (1 + predicted_return)
            last_date = df["Date"].iloc[-1].strftime("%Y-%m-%d")

            # ---------------------------
            # SPARKLINE DATA
            # Last 15 closing prices for the mini trend chart next to
            # "Last close price" on the result card.
            # ---------------------------
            close_history = df["Close"].tail(15).round(2).tolist()

            # ---------------------------
            # CONFIDENCE / VOLATILITY SCORE
            # Simple heuristic: the more volatile the recent daily
            # returns, the less confidence we display. Daily volatility
            # of ~0% maps to 100% confidence, ~5%+ maps to 0%. Tune the
            # 5.0 divisor if your stock's typical volatility differs.
            # ---------------------------
            returns = df["Close"].pct_change().dropna()
            if len(returns) >= 2:
                volatility_pct = float(returns.tail(20).std() * 100)
            else:
                volatility_pct = 0.0

            confidence = round(max(0, min(100, 100 - (volatility_pct / 5.0) * 100)))

            result = {
                "last_date": last_date,
                "last_close": round(last_close, 2),
                "predicted_return": round(predicted_return * 100, 2),
                "predicted_close": round(predicted_close, 2),
                "close_history": close_history,
                "confidence": confidence,
            }

    return render_template(
        "index.html",
        result=result,
        preview=preview
    )


if __name__ == "__main__":
    app.run(debug=True)