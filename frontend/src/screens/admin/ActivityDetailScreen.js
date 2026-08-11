import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { showAlert } from '../../services/alert';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import {
  getActivity, createActivity, updateActivity, setActivityParticipants,
  ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS,
} from '../../services/activities.service';
import { listFounders, DIMENSIONS, DIMENSION_LABELS } from '../../services/founders.service';
import { submitPeerFeedback } from '../../services/peerFeedback.service';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS, FOUNDER_NAV_ITEMS } from '../../config/nav';
import { Avatar, Pill } from '../../components/ui';

const STATUS_OPTIONS = ['upcoming', 'active', 'completed'];
const SCORE_OPTIONS = [20, 40, 60, 80, 100];

// MVP screens 5-6 companion — Activity Detail: type/date/participants/status,
// admin participant management, and (for founders) the peer-feedback
// capture flow that fans out into evidence at weight 0.8 (screen 5's peer-
// feedback capture, kept as a lightweight inline variant rather than a
// second full evaluation form).
export default function ActivityDetailScreen({ route, navigation }) {
  const activityId = route.params?.activityId ?? null;
  const currentUser = useAuthStore(s => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(!!activityId);
  const [saving, setSaving] = useState(false);

  // Create-mode fields
  const [type, setType] = useState('workshop');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Participant management (admin)
  const [managingParticipants, setManagingParticipants] = useState(false);
  const [allFounders, setAllFounders] = useState([]);
  const [selectedFounderIds, setSelectedFounderIds] = useState(new Set());

  const load = useCallback(async () => {
    if (!activityId) return;
    setLoading(true);
    try {
      const { data } = await getActivity(activityId);
      setActivity(data);
      setSelectedFounderIds(new Set((data.participants || []).map(p => p.id)));
    } catch {
      showAlert('Error', 'Could not load this activity.');
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreate = async () => {
    if (!title.trim()) { showAlert('Missing Title', 'Give this activity a title.'); return; }
    setSaving(true);
    try {
      const { data } = await createActivity({ type, title: title.trim(), description: description.trim() || null });
      navigation.replace('ActivityDetail', { activityId: data.id });
    } catch {
      showAlert('Error', 'Could not create activity.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (status) => {
    setSaving(true);
    updateActivity(activityId, { status })
      .then(() => setActivity(prev => ({ ...prev, status })))
      .catch(() => showAlert('Error', 'Could not update status.'))
      .finally(() => setSaving(false));
  };

  const openParticipantManager = async () => {
    setManagingParticipants(true);
    if (allFounders.length === 0) {
      try {
        const { data } = await listFounders({});
        setAllFounders(data);
      } catch { /* silent */ }
    }
  };

  const toggleFounder = (id) => {
    setSelectedFounderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const saveParticipants = async () => {
    setSaving(true);
    try {
      await setActivityParticipants(activityId, [...selectedFounderIds]);
      setManagingParticipants(false);
      load();
    } catch {
      showAlert('Error', 'Could not update participants.');
    } finally {
      setSaving(false);
    }
  };

  const navItems = isAdmin ? ADMIN_NAV_ITEMS : FOUNDER_NAV_ITEMS;

  if (loading) {
    return (
      <AppShell navigation={navigation} active="activities" items={navItems}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </AppShell>
    );
  }

  return (
    <AppShell navigation={navigation} active="activities" items={navItems}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Text style={styles.backText}>← Activities</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {!activityId ? (
          <View style={styles.card}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {ACTIVITY_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, type === t && styles.typeChipActive]}
                  onPress={() => setType(t)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
                    {ACTIVITY_TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Cohort 26 Team Challenge" placeholderTextColor={C.textHint} />
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} multiline placeholder="What happens in this activity?" placeholderTextColor={C.textHint} />
            <TouchableOpacity style={[styles.btnPrimary, saving && styles.btnDisabled]} onPress={handleCreate} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Create Activity</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{activity?.title}</Text>
                <Pill
                  label={STATUS_OPTIONS.includes(activity?.status) ? activity.status.charAt(0).toUpperCase() + activity.status.slice(1) : activity?.status}
                  C={C}
                  bg={activity?.status === 'active' ? C.warningLight : activity?.status === 'completed' ? C.successLight : C.surfaceElevated}
                  color={activity?.status === 'active' ? C.warning : activity?.status === 'completed' ? C.success : C.textSecondary}
                />
              </View>
              <Text style={styles.meta}>
                {ACTIVITY_TYPE_LABELS[activity?.type] || activity?.type}
                {activity?.scheduledAt ? ` · ${new Date(activity.scheduledAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}
                {' · '}{(activity?.participants || []).length} participant{(activity?.participants || []).length === 1 ? '' : 's'}
              </Text>
              {activity?.description ? <Text style={styles.description}>{activity.description}</Text> : null}

              {isAdmin && (
                <View style={styles.statusRow}>
                  {STATUS_OPTIONS.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.statusChip, activity?.status === s && styles.statusChipActive]}
                      onPress={() => handleStatusChange(s)}
                      disabled={saving}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.statusChipText, activity?.status === s && styles.statusChipTextActive]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Participants ({(activity?.participants || []).length})</Text>
                {isAdmin && (
                  <TouchableOpacity onPress={openParticipantManager}>
                    <Text style={styles.linkText}>Manage</Text>
                  </TouchableOpacity>
                )}
              </View>
              {(activity?.participants || []).length === 0 ? (
                <Text style={styles.emptyText}>No participants added yet.</Text>
              ) : (
                activity.participants.map(p => (
                  <View key={p.id} style={styles.participantRow}>
                    <Avatar photoUrl={p.photoUrl} name={p.name} size={32} C={C} />
                    <Text style={[styles.participantName, { flex: 1 }]}>{p.name || 'Unnamed'}</Text>
                    {isAdmin && (
                      <TouchableOpacity onPress={() => navigation.navigate('Evaluation', { founderId: p.id, activityId })}>
                        <Text style={styles.linkText}>Evaluate</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}

              {managingParticipants && (
                <View style={styles.managePanel}>
                  {allFounders.map(f => (
                    <TouchableOpacity key={f.id} style={styles.checkRow} onPress={() => toggleFounder(f.id)} activeOpacity={0.7}>
                      <View style={[styles.checkbox, selectedFounderIds.has(f.id) && styles.checkboxChecked]} />
                      <Text style={styles.participantName}>{f.name || 'Unnamed'}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={[styles.btnPrimary, saving && styles.btnDisabled]} onPress={saveParticipants} disabled={saving} activeOpacity={0.85}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Save Participants</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {!isAdmin && (activity?.participants || []).some(p => p.id === currentUser?.id) && (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>Give Peer Feedback</Text>
                {activity.participants.filter(p => p.id !== currentUser?.id).length === 0 ? (
                  <Text style={styles.emptyText}>No other participants to give feedback to yet.</Text>
                ) : (
                  activity.participants.filter(p => p.id !== currentUser?.id).map(p => (
                    <PeerFeedbackRow key={p.id} founder={p} activityId={activityId} C={C} styles={styles} />
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

function PeerFeedbackRow({ founder, activityId, C, styles }) {
  const [open, setOpen] = useState(false);
  const [dimension, setDimension] = useState(null);
  const [score, setScore] = useState(null);
  const [observation, setObservation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!dimension || score == null) return;
    setSubmitting(true);
    try {
      await submitPeerFeedback({ founderId: founder.id, activityId, dimension, score, observation: observation.trim() || null });
      setSubmitted(true);
      setOpen(false);
    } catch {
      showAlert('Error', 'Could not submit peer feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.peerFeedbackBlock}>
      <TouchableOpacity style={styles.participantRow} onPress={() => setOpen(v => !v)} activeOpacity={0.75}>
        <Text style={styles.participantName}>{founder.name || 'Unnamed'}</Text>
        <Text style={styles.linkText}>{submitted ? '✓ Rated' : open ? 'Cancel' : 'Rate'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.peerFeedbackForm}>
          <View style={styles.typeRow}>
            {DIMENSIONS.map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.typeChip, dimension === d && styles.typeChipActive]}
                onPress={() => setDimension(d)}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeChipText, dimension === d && styles.typeChipTextActive]}>{DIMENSION_LABELS[d]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.scaleRow}>
            {SCORE_OPTIONS.map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.scaleBtn, score === n && styles.scaleBtnActive]}
                onPress={() => setScore(n)}
                activeOpacity={0.8}
              >
                <Text style={[styles.scaleBtnText, score === n && styles.scaleBtnTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={observation}
            onChangeText={setObservation}
            multiline
            placeholder="Optional observation..."
            placeholderTextColor={C.textHint}
          />
          <TouchableOpacity
            style={[styles.btnPrimary, (submitting || !dimension || score == null) && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !dimension || score == null}
            activeOpacity={0.85}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Submit Feedback</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: 20, paddingTop: 16 },
    backRow: {},
    backText: { color: C.primary, ...typography.labelLarge },
    scrollContent: { padding: 20, paddingTop: 8, paddingBottom: 48, maxWidth: 900, width: '100%', alignSelf: 'center' },
    card: { backgroundColor: C.surface, borderRadius: radius.lg, padding: 16, marginBottom: 14, ...cardShadow },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },

    label: { ...typography.labelLarge, color: C.textSecondary, marginBottom: 6, marginTop: 10 },
    input: {
      backgroundColor: C.backgroundSoft, borderRadius: radius.md, padding: 12,
      color: C.textPrimary, fontSize: 14, borderWidth: 1, borderColor: C.surfaceBorder,
    },
    multiline: { minHeight: 70, textAlignVertical: 'top' },

    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: C.surfaceBorder, backgroundColor: C.surface },
    typeChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    typeChipText: { fontSize: 12, fontWeight: '700', color: C.textSecondary },
    typeChipTextActive: { color: '#fff' },

    title: { ...typography.titleLarge, color: C.textPrimary },
    meta: { ...typography.bodySmall, color: C.textSecondary, marginTop: 4 },
    description: { ...typography.bodyMedium, color: C.textSecondary, marginTop: 10 },

    statusRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    statusChip: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center', borderWidth: 1, borderColor: C.surfaceBorder },
    statusChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    statusChipText: { fontSize: 12, fontWeight: '700', color: C.textSecondary },
    statusChipTextActive: { color: '#fff' },

    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sectionLabel: { ...typography.labelSmall, textTransform: 'uppercase', color: C.textHint },
    linkText: { color: C.primary, ...typography.labelLarge },
    emptyText: { ...typography.bodyMedium, color: C.textHint },

    participantRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    participantName: { ...typography.bodyMedium, color: C.textPrimary },

    managePanel: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.surfaceBorder, paddingTop: 12 },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: C.surfaceBorder },
    checkboxChecked: { backgroundColor: C.primary, borderColor: C.primary },

    peerFeedbackBlock: {},
    peerFeedbackForm: { paddingVertical: 12, gap: 10 },
    scaleRow: { flexDirection: 'row', gap: 8 },
    scaleBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: C.surfaceBorder, alignItems: 'center' },
    scaleBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    scaleBtnText: { fontWeight: '700', fontSize: 13, color: C.textSecondary },
    scaleBtnTextActive: { color: '#fff' },

    btnPrimary: { backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
    btnDisabled: { opacity: 0.6 },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  });
}
