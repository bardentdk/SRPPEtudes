"use client";

import type { ReactNode } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmt } from "@/lib/analysis";
import type { Tokens } from "./useTokens";

type Row = Record<string, number | string>;
export interface SerieDef { key: string; label: string; color: string }

const AXIS = (t: Tokens) => ({ stroke: t.axis, tick: { fill: t.muted, fontSize: 11 }, tickLine: false });

export function Legend({ series }: { series: SerieDef[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function TooltipBox({ title, rows }: { title: ReactNode; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-44 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] shadow-lg">
      <div className="mb-1 font-semibold">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-2">
            {r.color && <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="tabular font-semibold">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function seriesTooltip(series: SerieDef[], format: (v: number) => string, total?: boolean) {
  function SeriesTooltip({ active, payload, label }: { active?: boolean; payload?: readonly { dataKey?: unknown; value?: unknown }[]; label?: unknown }) {
    if (!active || !payload?.length) return null;
    const rows: { label: string; value: string; color?: string }[] = series.map((s) => {
      const p = payload.find((x) => x.dataKey === s.key);
      return { label: s.label, value: format(Number(p?.value ?? 0)), color: s.color };
    }).reverse();
    if (total) rows.push({ label: "Total", value: format(payload.reduce((a, p) => a + Number(p.value ?? 0), 0)), color: undefined });
    return <TooltipBox title={String(label)} rows={rows} />;
  }
  return SeriesTooltip;
}

export function StackedArea({ data, series, tokens, height = 240 }: { data: Row[]; series: SerieDef[]; tokens: Tokens; height?: number }) {
  return (
    <>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={tokens.grid} vertical={false} />
          <XAxis dataKey="annee" {...AXIS(tokens)} />
          <YAxis {...AXIS(tokens)} axisLine={false} width={44} tickFormatter={fmt.compact} />
          <Tooltip content={seriesTooltip(series, fmt.n, true)} cursor={{ stroke: tokens.axis }} />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} stackId="1" stroke={tokens.surface} strokeWidth={2} fill={s.color} fillOpacity={0.9} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </>
  );
}

export function StackedBars({ data, series, tokens, height = 240, xKey = "annee" }: { data: Row[]; series: SerieDef[]; tokens: Tokens; height?: number; xKey?: string }) {
  return (
    <>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={tokens.grid} vertical={false} />
          <XAxis dataKey={xKey} {...AXIS(tokens)} />
          <YAxis {...AXIS(tokens)} axisLine={false} width={44} tickFormatter={fmt.compact} />
          <Tooltip content={seriesTooltip(series, fmt.n, true)} cursor={{ fill: tokens.grid, opacity: 0.5 }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} stackId="1" fill={s.color} stroke={tokens.surface} strokeWidth={1}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

/** Une série mise en avant, les autres en gris pour le contexte. */
export function HighlightLines({ data, focus, others, tokens, unit, height = 240 }: {
  data: Row[]; focus: SerieDef; others: string[]; tokens: Tokens; unit: string; height?: number;
}) {
  const all: SerieDef[] = [focus, ...others.map((o) => ({ key: o, label: o, color: tokens.axis }))];
  return (
    <>
      <Legend series={[focus, { key: "_autres", label: "Autres DROM", color: tokens.axis }]} />
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={tokens.grid} vertical={false} />
          <XAxis dataKey="annee" {...AXIS(tokens)} />
          <YAxis {...AXIS(tokens)} axisLine={false} width={44} tickFormatter={fmt.compact} />
          <Tooltip content={seriesTooltip(all, (v) => `${fmt.n(v)} ${unit}`)} cursor={{ stroke: tokens.axis }} />
          {others.map((o) => (
            <Line key={o} dataKey={o} stroke={tokens.axis} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          ))}
          <Line dataKey={focus.key} stroke={focus.color} strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: tokens.surface, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

/** Barres horizontales empilées : décomposition d'un prix, ou offre face à demande. */
export function HStack({ data, series, tokens, format, height }: {
  data: Row[]; series: SerieDef[]; tokens: Tokens; format: (v: number) => string; height?: number;
}) {
  return (
    <>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={height ?? 56 + data.length * 44}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={tokens.grid} horizontal={false} />
          <XAxis type="number" {...AXIS(tokens)} tickFormatter={(v) => format(Number(v))} />
          <YAxis type="category" dataKey="nom" {...AXIS(tokens)} axisLine={false} width={92} tick={{ fill: tokens.ink2, fontSize: 12 }} />
          <Tooltip content={seriesTooltip(series, format, true)} cursor={{ fill: tokens.grid, opacity: 0.5 }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} stackId="1" fill={s.color} stroke={tokens.surface} strokeWidth={2}
              radius={i === series.length - 1 ? [0, 4, 4, 0] : 0} barSize={26} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

/** Classement en barres horizontales, une seule série. */
export function Ranking({ data, color, tokens, format, highlight, onPick }: {
  data: { code: string; nom: string; v: number }[]; color: string; tokens: Tokens; format: (v: number) => string;
  highlight: string | null; onPick: (code: string) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 24 + 16)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="nom" {...AXIS(tokens)} axisLine={false} width={124} tick={{ fill: tokens.ink2, fontSize: 12 }} interval={0} />
        <Tooltip
          cursor={{ fill: tokens.grid, opacity: 0.5 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox title={String(payload[0].payload.nom)} rows={[{ label: "Valeur", value: format(Number(payload[0].value)) }]} />
            ) : null
          }
        />
        <Bar dataKey="v" radius={[0, 4, 4, 0]} barSize={14} onClick={(d) => onPick(String((d as unknown as { code: string }).code))}
          label={{ position: "right", fill: tokens.ink2, fontSize: 11, formatter: (v: unknown) => format(Number(v)) }}>
          {data.map((d) => (
            <Cell key={d.code} fill={color} fillOpacity={highlight && highlight !== d.code ? 0.35 : 1} cursor="pointer" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({ data, color, tokens, format, height = 220 }: {
  data: Row[]; color: string; tokens: Tokens; format: (v: number) => string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={tokens.grid} vertical={false} />
        <XAxis dataKey="annee" {...AXIS(tokens)} />
        <YAxis {...AXIS(tokens)} axisLine={false} width={44} tickFormatter={fmt.compact} />
        <Tooltip
          cursor={{ fill: tokens.grid, opacity: 0.5 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? <TooltipBox title={String(label)} rows={[{ label: "Tonnage", value: format(Number(payload[0].value)), color }]} /> : null
          }
        />
        <Bar dataKey="v" fill={color} radius={[4, 4, 0, 0]} maxBarSize={44}
          label={{ position: "top", fill: tokens.ink2, fontSize: 11, formatter: (v: unknown) => fmt.compact(Number(v)) }} />
      </BarChart>
    </ResponsiveContainer>
  );
}
