import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { radius, typography } from '../../theme';
import { formatDuration } from '../../interview/formatAnswer';

// Shared playback strip used by both the interview runner and the summary screen. Recordings
// are stored as independent segments (one per start/stop take — see the recording_segments
// migration for why they're never merged into a single file), so this plays one segment at a
// time with a picker to switch between them, rather than one continuous timeline. Exposes
// seekAndPlay(segmentIndex, seconds) via ref so a bookmark tap can jump straight to the right
// segment and moment.
const RecordingPlayer = forwardRef(function RecordingPlayer({ segments, C }, ref) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeUrl = segments?.[activeIndex]?.url ?? null;
  const player = useAudioPlayer(activeUrl);
  const status = useAudioPlayerStatus(player);
  const pendingSeekRef = useRef(null);

  // Switching segments swaps the player's source (useAudioPlayer reacts to a changed uri by
  // creating a fresh player) — a seek requested at the same moment has to wait until that new
  // source is actually loaded before it can take effect.
  useEffect(() => {
    if (pendingSeekRef.current == null || !status.isLoaded) return;
    const seconds = pendingSeekRef.current;
    pendingSeekRef.current = null;
    player.seekTo(seconds).then(() => player.play());
  }, [status.isLoaded, activeIndex, player]);

  useImperativeHandle(ref, () => ({
    seekAndPlay: (segmentIndex, seconds) => {
      if (segmentIndex === activeIndex) {
        player.seekTo(seconds).then(() => player.play());
      } else {
        pendingSeekRef.current = seconds;
        setActiveIndex(segmentIndex);
      }
    },
  }));

  if (!segments || segments.length === 0) return null;

  const styles = makeStyles(C);
  const togglePlay = () => (status.playing ? player.pause() : player.play());

  return (
    <View>
      {segments.length > 1 && (
        <View style={styles.segmentRow}>
          {segments.map((seg, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.segmentChip, i === activeIndex && styles.segmentChipActive]}
              onPress={() => setActiveIndex(i)}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentChipText, i === activeIndex && styles.segmentChipTextActive]}>
                Segment {i + 1} · {formatDuration(seg.durationSeconds)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={styles.row}>
        <TouchableOpacity onPress={togglePlay} style={styles.playBtn} activeOpacity={0.85}>
          <Ionicons name={status.playing ? 'pause' : 'play'} size={16} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.time}>
          {formatDuration(status.currentTime)} / {formatDuration(status.duration)}
        </Text>
      </View>
    </View>
  );
});

function makeStyles(C) {
  return StyleSheet.create({
    segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    segmentChip: {
      borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5,
      backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.surfaceBorder,
    },
    segmentChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    segmentChipText: { fontSize: 11.5, fontWeight: '600', color: C.textSecondary },
    segmentChipTextActive: { color: '#fff' },

    row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    playBtn: {
      width: 34, height: 34, borderRadius: radius.pill, backgroundColor: C.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    time: { ...typography.caption, color: C.textSecondary, fontVariant: ['tabular-nums'] },
  });
}

export default RecordingPlayer;
