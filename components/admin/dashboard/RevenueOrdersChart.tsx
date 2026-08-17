"use client";

import { useState } from "react";

import type { RevenueOrderPoint } from "@/lib/dashboard/domain";

const currency = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("fr-MA");
const fullDate = new Intl.DateTimeFormat("fr-MA", {
  timeZone: "Africa/Casablanca",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const WIDTH = 920;
const HEIGHT = 340;
const PADDING = { top: 30, right: 58, bottom: 54, left: 72 };

const compactMoney = (value: number) =>
  value >= 1_000 ? `${number.format(Number((value / 1_000).toFixed(1)))}k` : number.format(value);

export default function RevenueOrdersChart({ data }: { data: RevenueOrderPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const maxRevenue = Math.max(...data.map((point) => point.revenue), 1);
  const maxOrders = Math.max(...data.map((point) => point.orders), 1);
  const step = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.max(8, Math.min(24, step * 0.58));
  const orderPoints = data.map((point, index) => ({
    x: PADDING.left + step * index + step / 2,
    y: PADDING.top + plotHeight - (point.orders / maxOrders) * plotHeight,
  }));
  const line = orderPoints
    .map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const active = activeIndex === null ? null : data[activeIndex];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-[3px] bg-blue-400" />
          CA encaissé (MAD)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 bg-violet-600" />
          Nombre de commandes
        </span>
      </div>

      <div className="relative overflow-x-auto rounded-[22px] border border-slate-200 bg-white p-2">
        {active && activeIndex !== null ? (
          <div
            role="status"
            className="pointer-events-none absolute top-4 z-10 min-w-48 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-xs text-white shadow-xl"
            style={{
              left: `${Math.min(76, Math.max(2, ((activeIndex + 0.5) / data.length) * 82))}%`,
            }}
          >
            <p className="font-semibold">
              {active.label.includes("–")
                ? active.label
                : fullDate.format(new Date(`${active.date}T12:00:00Z`))}
            </p>
            <p className="mt-2 text-slate-200">CA encaissé : {currency.format(active.revenue)}</p>
            <p className="mt-1 text-slate-200">Commandes : {number.format(active.orders)}</p>
          </div>
        ) : null}

        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-[320px] min-w-[760px] w-full"
          role="img"
          aria-labelledby="revenue-orders-title revenue-orders-description"
        >
          <title id="revenue-orders-title">Évolution du CA encaissé et des commandes</title>
          <desc id="revenue-orders-description">
            Les barres indiquent le chiffre d’affaires encaissé en dirhams sur l’axe gauche.
            La courbe indique les commandes créées sur l’axe droit.
          </desc>

          {Array.from({ length: 5 }, (_, index) => {
            const ratio = index / 4;
            const y = PADDING.top + plotHeight * ratio;
            const revenueTick = maxRevenue * (1 - ratio);
            const orderTick = maxOrders * (1 - ratio);
            return (
              <g key={index}>
                <line
                  x1={PADDING.left}
                  x2={WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 6"
                />
                <text x={PADDING.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                  {compactMoney(revenueTick)}
                </text>
                <text x={WIDTH - PADDING.right + 10} y={y + 4} fontSize="11" fill="#64748b">
                  {number.format(Math.round(orderTick))}
                </text>
              </g>
            );
          })}

          <text x={18} y={PADDING.top + plotHeight / 2} transform={`rotate(-90 18 ${PADDING.top + plotHeight / 2})`} textAnchor="middle" fontSize="11" fill="#64748b">
            CA encaissé (MAD)
          </text>
          <text x={WIDTH - 12} y={PADDING.top + plotHeight / 2} transform={`rotate(90 ${WIDTH - 12} ${PADDING.top + plotHeight / 2})`} textAnchor="middle" fontSize="11" fill="#64748b">
            Commandes
          </text>

          {data.map((point, index) => {
            const centerX = PADDING.left + step * index + step / 2;
            const barHeight = (point.revenue / maxRevenue) * plotHeight;
            const shouldLabel =
              data.length <= 14 || index % Math.ceil(data.length / 8) === 0 || index === data.length - 1;
            return (
              <g key={point.date}>
                <rect
                  x={centerX - barWidth / 2}
                  y={PADDING.top + plotHeight - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  fill={activeIndex === index ? "#2563eb" : "#60a5fa"}
                />
                {shouldLabel ? (
                  <text x={centerX} y={HEIGHT - 22} textAnchor="middle" fontSize="10" fill="#64748b">
                    {point.label}
                  </text>
                ) : null}
                <rect
                  x={PADDING.left + step * index}
                  y={PADDING.top}
                  width={step}
                  height={plotHeight}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${point.label} : ${currency.format(point.revenue)}, ${number.format(point.orders)} commandes`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                />
              </g>
            );
          })}

          <path d={line} fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {orderPoints.map((point, index) => (
            <g key={`${data[index].date}-orders`}>
              <circle cx={point.x} cy={point.y} r="5" fill="white" stroke="#7c3aed" strokeWidth="2.5" />
            </g>
          ))}
        </svg>
      </div>

      <table className="sr-only">
        <caption>Données du graphique CA encaissé et commandes</caption>
        <thead><tr><th>Date</th><th>CA encaissé</th><th>Commandes</th></tr></thead>
        <tbody>
          {data.map((point) => (
            <tr key={`table-${point.date}`}><td>{point.label}</td><td>{currency.format(point.revenue)}</td><td>{point.orders}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
