import { useState } from 'react';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule } from 'expo-audio';

// Wraps expo-audio for the interview runner. Within one mount, expo-audio's
// record()/pause()/record() cycle continues the SAME underlying recorder, so pausing and
// resuming needs nothing special. Across a reload (or after any Stop) the live recorder is
// gone — starting again always begins a brand-new, independent take (segment); see
// InterviewRunnerScreen and the recording_segments migration for why segments are never
// merged into one file.
export function useInterviewRecording() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 500);
  const [error, setError] = useState(null);
  // True from a successful start() until stop() — independent of `isRecording`, which also
  // goes false while merely paused. Callers must check this (not "is there a saved segment")
  // to decide whether the next tap should resume() the SAME live recorder or start() a brand
  // new one: prepareToRecordAsync() inside start() allocates a fresh MediaRecorder/session,
  // discarding whatever's buffered in a paused-but-still-live one.
  const [hasSession, setHasSession] = useState(false);

  const start = async () => {
    setError(null);
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) {
      setError('Microphone access is required to record this interview.');
      return false;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setHasSession(true);
    return true;
  };

  const pause = () => recorder.pause();
  const resume = () => recorder.record();

  const stop = async () => {
    await recorder.stop();
    setHasSession(false);
    return { uri: recorder.uri, durationSeconds: Math.round((state.durationMillis ?? 0) / 1000) };
  };

  return {
    isRecording: state.isRecording,
    hasSession,
    elapsedSeconds: Math.floor((state.durationMillis ?? 0) / 1000),
    error,
    start,
    pause,
    resume,
    stop,
    clearError: () => setError(null),
  };
}
