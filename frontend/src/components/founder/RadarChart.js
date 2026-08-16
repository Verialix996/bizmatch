import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';
import { typography } from '../../theme';

const GRID_LEVELS = [0.25, 0.5, 0.75, 1];

// Shorter on-chart labels so 8 axes fit without clipping in a card-width
// radar; RadarLegend below still shows the full dimension name.
const SHORT_LABEL = {
  execution: 'Execution',
  integrity: 'Integrity',
  commitment: 'Commit.',
  communication: 'Comms',
  conflict: 'Conflict',
  resilience: 'Resil.',
  ego: 'Ego',
  values: 'Values',
};

// Founder DNA radar — one axis per evidence dimension, plotted from real
// dimensions.*.score (0-100, null when no evidence yet, treated as 0 so the
// shape never lies about missing data). No fabricated "Founder Score" —
// each axis is labeled with its own real number, same as the DimRow list
// this chart supplements rather than replaces.
// A null score plotted at 0 looks identical to a genuine 0 score, which
// reads as "scored zero" rather than "no evidence" — the dot for a null
// axis is rendered as a hollow ring instead of a filled dot so the two
// cases stay visually distinct even though both pull the shape inward.
export default function RadarChart({ axes, size = 280, C }) {
  const center = size / 2;
  const radius = size * 0.22; // leave generous room for axis labels
  const n = axes.length;
  const angleFor = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const pointAt = (i, frac) => {
    const angle = angleFor(i);
    return {
      x: center + radius * frac * Math.cos(angle),
      y: center + radius * frac * Math.sin(angle),
    };
  };

  const dataPoints = axes.map((a, i) => pointAt(i, Math.max(0, Math.min(100, a.score ?? 0)) / 100));
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  const hasCohortAvg = axes.some((a) => a.cohortAvg != null);
  const avgPoints = axes.map((a, i) => pointAt(i, Math.max(0, Math.min(100, a.cohortAvg ?? 0)) / 100));
  const avgPolygon = avgPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {GRID_LEVELS.map((level) => (
          <Polygon
            key={level}
            points={axes.map((_, i) => { const p = pointAt(i, level); return `${p.x},${p.y}`; }).join(' ')}
            fill="none"
            stroke={C.surfaceBorder}
            strokeWidth={1}
          />
        ))}

        {axes.map((_, i) => {
          const p = pointAt(i, 1);
          return <Line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke={C.surfaceBorder} strokeWidth={1} />;
        })}

        {hasCohortAvg ? (
          <Polygon points={avgPolygon} fill="none" stroke={C.textHint} strokeWidth={1.5} strokeDasharray="4,3" />
        ) : null}

        <Polygon points={dataPolygon} fill={C.primary} fillOpacity={0.18} stroke={C.primary} strokeWidth={2} />

        {dataPoints.map((p, i) => (
          axes[i].score == null ? (
            <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={C.surface} stroke={C.textHint} strokeWidth={1.5} strokeDasharray="2,2" />
          ) : (
            <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={C.primary} />
          )
        ))}

        {axes.map((a, i) => {
          const angle = angleFor(i);
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const labelP = pointAt(i, 1.45);
          const anchor = cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';
          // Nudge top/bottom labels up/down a touch so they clear the outer ring.
          const dy = sin > 0.2 ? 4 : sin < -0.2 ? -2 : 1;
          return (
            <SvgText
              key={i}
              x={labelP.x}
              y={labelP.y + dy}
              fill={C.textSecondary}
              fontSize={10}
              fontWeight="700"
              textAnchor={anchor}
            >
              {SHORT_LABEL[a.key] || a.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

export function RadarSeriesLegend({ axes, C }) {
  const hasCohortAvg = axes.some((a) => a.cohortAvg != null);
  if (!hasCohortAvg) return null;
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    lineSolid: { width: 16, height: 2, backgroundColor: C.primary, borderRadius: 1 },
    lineDashed: { width: 16, height: 0, borderTopWidth: 1.5, borderColor: C.textHint, borderStyle: 'dashed' },
    label: { ...typography.caption, color: C.textSecondary },
  });
  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <View style={styles.lineSolid} />
        <Text style={styles.label}>You</Text>
      </View>
      <View style={styles.item}>
        <View style={styles.lineDashed} />
        <Text style={styles.label}>Cohort Average</Text>
      </View>
    </View>
  );
}

export function RadarLegend({ axes, C }) {
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: '30%' },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
    label: { ...typography.caption, color: C.textSecondary },
    score: { ...typography.caption, color: C.textPrimary, fontWeight: '700' },
  });
  return (
    <View style={styles.row}>
      {axes.map((a) => (
        <View key={a.key} style={styles.chip}>
          <View style={styles.dot} />
          <Text style={styles.label}>{a.label}</Text>
          <Text style={styles.score}>{a.score ?? '—'}</Text>
        </View>
      ))}
    </View>
  );
}
