import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, typography } from '../../theme';
import api from '../../services/api';

export default function ProposeMeetingScreen({ route, navigation }) {
  const { matchId, rescheduleId, prefill } = route.params;
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState(prefill?.title || '');
  const [locationType, setLocationType] = useState(prefill?.locationType || 'virtual');
  const [videoLink, setVideoLink] = useState(prefill?.videoLink || '');
  const [address, setAddress] = useState(prefill?.address || '');
  const [date, setDate] = useState(new Date(Date.now() + 86400000)); // tomorrow
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');
  const [loading, setLoading] = useState(false);

  // Address autocomplete
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);

  const openPicker = (mode) => { setPickerMode(mode); setShowPicker(true); };

  const onDateChange = (_event, selected) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setDate(selected);
  };

  const onAddressChange = (text) => {
    setAddress(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'BizMatch/1.0' } }
        );
        const data = await res.json();
        setSuggestions(data.map(p => p.display_name));
        setShowSuggestions(data.length > 0);
      } catch { /* silent */ }
    }, 500);
  };

  const pickSuggestion = (s) => {
    setAddress(s);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const submit = async () => {
    if (!title.trim()) return Alert.alert('Missing field', 'Please enter a meeting title.');
    if (locationType === 'virtual' && !videoLink.trim()) return Alert.alert('Missing field', 'Please enter a video call link.');
    if (locationType === 'in_person' && !address.trim()) return Alert.alert('Missing field', 'Please enter a meeting address.');

    setLoading(true);
    try {
      if (rescheduleId) {
        await api.patch(`/meetings/${rescheduleId}/reschedule`, {
          scheduledAt: date.toISOString(),
          locationType,
          videoLink:   locationType === 'virtual'   ? videoLink.trim()  : undefined,
          address:     locationType === 'in_person'  ? address.trim()   : undefined,
        });
        navigation.popToTop();
      } else {
        await api.post('/meetings', {
          matchId,
          title: title.trim(),
          scheduledAt: date.toISOString(),
          locationType,
          videoLink:   locationType === 'virtual'   ? videoLink.trim()  : undefined,
          address:     locationType === 'in_person'  ? address.trim()   : undefined,
        });
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not submit meeting.');
    }
    setLoading(false);
  };

  const formattedDate = date.toLocaleDateString('en-IL', { dateStyle: 'medium' });
  const formattedTime = date.toLocaleTimeString('en-IL', { timeStyle: 'short' });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>{rescheduleId ? 'Suggest a New Time' : 'Propose a Meeting'}</Text>

      <Text style={styles.label}>Meeting Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Initial pitch call"
        placeholderTextColor={colors.textHint}
      />

      <Text style={styles.label}>Date & Time</Text>
      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('date')}>
          <Ionicons name="calendar" size={16} color={colors.primary} />
          <Text style={styles.dateBtnText}>{formattedDate}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('time')}>
          <Ionicons name="time" size={16} color={colors.primary} />
          <Text style={styles.dateBtnText}>{formattedTime}</Text>
        </TouchableOpacity>
      </View>
      {showPicker && (
        <DateTimePicker
          value={date}
          mode={pickerMode}
          display="default"
          onChange={onDateChange}
          minimumDate={new Date()}
        />
      )}

      <Text style={styles.label}>Meeting Type</Text>
      <View style={styles.toggleRow}>
        {['virtual', 'in_person'].map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.toggleBtn, locationType === type && styles.toggleBtnActive]}
            onPress={() => setLocationType(type)}
          >
            <Ionicons
              name={type === 'virtual' ? 'videocam' : 'location'}
              size={16}
              color={locationType === type ? '#fff' : colors.textSecondary}
            />
            <Text style={[styles.toggleBtnText, locationType === type && styles.toggleBtnTextActive]}>
              {type === 'virtual' ? 'Virtual' : 'In Person'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {locationType === 'virtual' && (
        <>
          <Text style={styles.label}>Video Call Link</Text>
          <TextInput
            style={styles.input}
            value={videoLink}
            onChangeText={setVideoLink}
            placeholder="https://meet.google.com/..."
            placeholderTextColor={colors.textHint}
            autoCapitalize="none"
            keyboardType="url"
          />
        </>
      )}

      {locationType === 'in_person' && (
        <>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={onAddressChange}
            placeholder="Start typing an address…"
            placeholderTextColor={colors.textHint}
          />
          {showSuggestions && (
            <View style={styles.suggestionBox}>
              {suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.suggestionItem, i < suggestions.length - 1 && styles.suggestionBorder]}
                  onPress={() => pickSuggestion(s)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="location-outline" size={14} color={colors.textHint} style={{ marginRight: 8 }} />
                  <Text style={styles.suggestionText} numberOfLines={2}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>{rescheduleId ? 'Send New Time' : 'Send Meeting Proposal'}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.backgroundSoft },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backText:    { ...typography.bodyMedium, color: colors.primary },
  heading:     { ...typography.titleLarge, color: colors.primaryDark, marginBottom: 24 },
  label:       { ...typography.labelLarge, color: colors.textPrimary, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  dateRow:         { flexDirection: 'row', gap: 10 },
  dateBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.surfaceBorder, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11 },
  dateBtnText:     { ...typography.bodyMedium, color: colors.textPrimary },
  toggleRow:       { flexDirection: 'row', gap: 10 },
  toggleBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.surfaceBorder, borderRadius: radius.md, paddingVertical: 12 },
  toggleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleBtnText:   { ...typography.labelLarge, color: colors.textSecondary },
  toggleBtnTextActive: { color: '#fff' },
  submitBtn:       { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center', marginTop: 32 },
  submitBtnText:   { ...typography.titleSmall, color: '#fff' },

  suggestionBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.md,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSoft,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
});
