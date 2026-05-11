import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, ActivityIndicator, Alert,
  Modal, FlatList, Image, StatusBar,
} from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  getMyProjects, createProject, updateProject, deleteProject,
  uploadDeck, uploadVideo, getPartners, removePartner, getJoinedProjects,
  reviewDeck,
} from '../../services/project.service';
import { getMatches, sendPartnerInvite } from '../../services/match.service';
import { colors, radius, cardShadow } from '../../theme';

const STAGE_LABELS = { idea: 'Idea Stage', mvp: 'MVP Stage', growth: 'Growth', scale: 'Scale' };

function PartnerAvatar({ name, photoUrl, size = 36 }) {
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View style={[
      styles.partnerAvatarPlaceholder,
      { width: size, height: size, borderRadius: size / 2 },
    ]}>
      <Text style={{ fontSize: size * 0.38, color: '#fff', fontWeight: '700' }}>
        {name ? name[0].toUpperCase() : '?'}
      </Text>
    </View>
  );
}

function ProjectCard({ project, onEdit, onDelete, onUploadDeck, onUploadVideo, onManagePartners }) {
  const [partners, setPartners] = useState([]);
  const [removeConfirm, setRemoveConfirm] = useState(null); // { userId, name }
  const [removing, setRemoving] = useState(false);
  const [showDeckReview, setShowDeckReview] = useState(false);
  const [deckFeedback, setDeckFeedback] = useState(null);
  const [deckReviewLoading, setDeckReviewLoading] = useState(false);

  const handleDeckReview = async () => {
    setDeckReviewLoading(true);
    try {
      const { data } = await reviewDeck(project.id);
      setDeckFeedback(data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not get AI feedback.');
    }
    setDeckReviewLoading(false);
  };

  useFocusEffect(useCallback(() => {
    getPartners(project.id)
      .then(res => setPartners(res.data))
      .catch(() => {});
  }, [project.id]));

  const confirmRemove = async () => {
    if (!removeConfirm || removing) return;
    setRemoving(true);
    try {
      await removePartner(project.id, removeConfirm.userId);
      setPartners(prev => prev.filter(p => p.userId !== removeConfirm.userId));
    } catch { /* silent */ }
    setRemoving(false);
    setRemoveConfirm(null);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{project.title}</Text>
          {project.stage ? (
            <View style={styles.stagePill}>
              <Text style={styles.stagePillText}>
                {STAGE_LABELS[project.stage] || project.stage}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => onEdit(project)}
            style={styles.cardActionBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.cardActionBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(project.id)}
            style={[styles.cardActionBtn, styles.cardActionBtnDelete]}
            activeOpacity={0.8}
          >
            <Text style={styles.cardActionBtnDeleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {project.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{project.description}</Text>
      ) : null}

      <View style={styles.cardMeta}>
        {project.industry ? (
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>{project.industry}</Text>
          </View>
        ) : null}
        {project.funding_needed ? (
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>
              Seeking ${Number(project.funding_needed).toLocaleString()}
            </Text>
          </View>
        ) : null}
        {project.deck_url ? (
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>📄 Deck</Text>
          </View>
        ) : null}
        {project.video_url ? (
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>🎬 Video</Text>
          </View>
        ) : null}
      </View>

      {/* Team */}
      <View style={styles.partnersSection}>
        <View style={styles.partnersHeader}>
          <Text style={styles.partnersSectionLabel}>TEAM</Text>
          <TouchableOpacity
            onPress={() => onManagePartners(project.id)}
            style={styles.addPartnerBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.addPartnerBtnText}>+ Add Partner</Text>
          </TouchableOpacity>
        </View>
        {partners.length === 0 ? (
          <Text style={styles.noPartnersText}>No partners yet</Text>
        ) : (
          <View style={styles.partnerList}>
            {partners.map(p => (
              <View key={p.userId} style={styles.partnerItem}>
                <PartnerAvatar name={p.name} photoUrl={p.photoUrl} size={30} />
                <Text style={styles.partnerName} numberOfLines={1}>{p.name}</Text>
                <TouchableOpacity
                  onPress={() => setRemoveConfirm({ userId: p.userId, name: p.name })}
                  style={styles.removePartnerBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.6}
                >
                  <Text style={styles.removePartnerBtnText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Upload row */}
      <View style={styles.uploadRow}>
        <TouchableOpacity
          style={styles.uploadBtn}
          onPress={() => onUploadDeck(project.id)}
          activeOpacity={0.8}
        >
          <Text style={styles.uploadBtnText}>
            📄 {project.deck_url ? 'Replace PDF' : 'Upload PDF'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.uploadBtn}
          onPress={() => onUploadVideo(project.id)}
          activeOpacity={0.8}
        >
          <Text style={styles.uploadBtnText}>
            🎬 {project.video_url ? 'Replace Video' : 'Upload Video'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* AI Deck Review — only if deck uploaded */}
      {project.deck_url ? (
        <TouchableOpacity style={styles.aiFeedbackBtn} onPress={() => { setShowDeckReview(true); setDeckFeedback(null); }}>
          <Text style={styles.aiFeedbackBtnText}>✦ Get AI Deck Feedback</Text>
        </TouchableOpacity>
      ) : null}

      {/* AI Deck Review Modal */}
      <Modal visible={showDeckReview} transparent animationType="slide">
        <View style={styles.deckReviewOverlay}>
          <View style={styles.deckReviewSheet}>
            <Text style={styles.deckReviewTitle}>AI Pitch Deck Review</Text>
            {!deckFeedback ? (
              <>
                <Text style={styles.deckReviewHint}>Claude will read your uploaded PDF and provide structured feedback.</Text>
                <View style={styles.deckReviewActions}>
                  <TouchableOpacity onPress={() => setShowDeckReview(false)} style={styles.deckReviewCancel}>
                    <Text style={{ color: colors.textHint }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDeckReview} style={styles.deckReviewSubmit} disabled={deckReviewLoading}>
                    {deckReviewLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Analyse</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                <Text style={styles.deckFeedbackScore}>Overall Score: {deckFeedback.overallScore}/10</Text>
                {[['Strengths', deckFeedback.strengths], ['Weaknesses', deckFeedback.weaknesses], ['Suggestions', deckFeedback.suggestions]].map(([label, items]) =>
                  items?.length ? (
                    <View key={label} style={{ marginBottom: 12 }}>
                      <Text style={styles.deckFeedbackLabel}>{label}</Text>
                      {items.map((item, i) => <Text key={i} style={styles.deckFeedbackItem}>• {item}</Text>)}
                    </View>
                  ) : null
                )}
                <TouchableOpacity onPress={() => setShowDeckReview(false)} style={[styles.deckReviewSubmit, { marginTop: 8 }]}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Remove partner confirmation modal */}
      <Modal visible={!!removeConfirm} transparent animationType="fade">
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteModalTitle}>Remove Partner</Text>
            <Text style={styles.deleteModalBody}>
              Are you sure you want to remove {removeConfirm?.name} from the project?
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.deleteBtnCancel}
                onPress={() => setRemoveConfirm(null)}
              >
                <Text style={styles.deleteBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtnConfirm}
                onPress={confirmRemove}
                disabled={removing}
              >
                <Text style={styles.deleteBtnConfirmText}>
                  {removing ? 'Removing...' : 'Remove'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AddPartnerModal({ visible, onClose, onAdd, projectId }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible || !projectId) return;
    setLoading(true);
    Promise.all([getMatches(), getPartners(projectId)])
      .then(([matchRes, partnerRes]) => {
        const existingIds = new Set((partnerRes.data || []).map(p => p.userId));
        setMatches((matchRes.data || []).filter(m => !existingIds.has(m.userId)));
      })
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [visible, projectId]);

  const handleAdd = async (matchId) => {
    setSending(true);
    try {
      await onAdd(matchId, projectId);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Add Partner</Text>
          <Text style={styles.modalSub}>Pick from your matched connections</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          ) : matches.length === 0 ? (
            <Text style={styles.noPartnersText}>
              No available matches — either you have no connections yet or they're already on this project.
            </Text>
          ) : (
            <FlatList
              data={matches}
              keyExtractor={item => String(item.userId)}
              style={{ maxHeight: 320, width: '100%' }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.matchPickerItem}
                  onPress={() => handleAdd(item.matchId)}
                  activeOpacity={0.7}
                  disabled={sending}
                >
                  <PartnerAvatar name={item.name} photoUrl={item.photoUrl} size={42} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.matchPickerName}>{item.name}</Text>
                    {item.roleType ? (
                      <Text style={styles.matchPickerRole}>{item.roleType}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.modalCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function JoinedProjectCard({ project }) {
  const [partners, setPartners] = useState([]);
  useFocusEffect(useCallback(() => {
    getPartners(project.id).then(res => setPartners(res.data)).catch(() => {});
  }, [project.id]));

  return (
    <View style={[styles.card, styles.joinedCard]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{project.title}</Text>
          {project.stage ? (
            <View style={styles.stagePill}>
              <Text style={styles.stagePillText}>{STAGE_LABELS[project.stage] || project.stage}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.joinedOwnerTag}>
          <Text style={styles.joinedOwnerText}>by {project.owner_name}</Text>
        </View>
      </View>

      {project.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{project.description}</Text>
      ) : null}

      <View style={styles.cardMeta}>
        {project.industry ? (
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>{project.industry}</Text>
          </View>
        ) : null}
        {project.deck_url ? (
          <View style={styles.metaChip}><Text style={styles.metaChipText}>📄 Deck</Text></View>
        ) : null}
        {project.video_url ? (
          <View style={styles.metaChip}><Text style={styles.metaChipText}>🎬 Video</Text></View>
        ) : null}
      </View>

      <View style={styles.partnersSection}>
        <Text style={styles.partnersSectionLabel}>TEAM</Text>
        {partners.length > 0 && (
          <View style={[styles.partnerList, { marginTop: 8 }]}>
            {partners.map(p => (
              <View key={p.userId} style={styles.partnerItem}>
                <PartnerAvatar name={p.name} photoUrl={p.photoUrl} size={36} />
                <Text style={styles.partnerName} numberOfLines={1}>{p.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function ProjectForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    industry: initial?.industry || '',
    visibility: initial?.visibility || 'public',
    deck_url: initial?.deck_url || '',
    video_url: initial?.video_url || '',
  });
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    setError('');
    try {
      await onSave({ ...form });
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save. Please try again.');
    }
  };

  return (
    <View style={styles.formPanel}>
      <Text style={styles.formTitle}>
        {initial ? 'Edit Project' : 'New Project'}
      </Text>

      <Text style={styles.fieldLabel}>TITLE *</Text>
      <TextInput
        style={styles.input}
        value={form.title}
        onChangeText={v => setForm(f => ({ ...f, title: v }))}
        placeholder="Project name"
        placeholderTextColor={colors.textHint}
      />

      <Text style={styles.fieldLabel}>DESCRIPTION</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        multiline
        value={form.description}
        onChangeText={v => setForm(f => ({ ...f, description: v }))}
        placeholder="What does your project do?"
        placeholderTextColor={colors.textHint}
      />

      <Text style={styles.fieldLabel}>INDUSTRY</Text>
      <TextInput
        style={styles.input}
        value={form.industry}
        onChangeText={v => setForm(f => ({ ...f, industry: v }))}
        placeholder="e.g. FinTech, HealthTech, SaaS"
        placeholderTextColor={colors.textHint}
      />

      <Text style={styles.fieldLabel}>VISIBILITY</Text>
      <View style={styles.stageRow}>
        {['public', 'private'].map(v => (
          <TouchableOpacity
            key={v}
            style={[styles.stageChip, form.visibility === v && styles.stageChipActive]}
            onPress={() => setForm(f => ({ ...f, visibility: v }))}
            activeOpacity={0.8}
          >
            <Text style={[styles.stageChipText, form.visibility === v && styles.stageChipTextActive]}>
              {v === 'public' ? 'Public' : 'Private'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.formBtnRow}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onCancel}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>Save Project</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ProjectsScreen() {
  const [projects, setProjects] = useState([]);
  const [joinedProjects, setJoinedProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [partnerModal, setPartnerModal] = useState({ visible: false, projectId: null });
  const [deleteModal, setDeleteModal] = useState({ visible: false, projectId: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ownRes, joinedRes] = await Promise.all([
        getMyProjects(),
        getJoinedProjects(),
      ]);
      setProjects(ownRes.data);
      setJoinedProjects(joinedRes.data);
    } catch (e) {
      console.error('Failed to load projects', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async (data) => {
    if (editingProject) {
      await updateProject(editingProject.id, data);
    } else {
      await createProject(data);
    }
    setShowForm(false);
    setEditingProject(null);
    load();
  };

  const handleDelete = (id) => {
    setDeleteModal({ visible: true, projectId: id });
  };

  const handleDeleteConfirmed = async () => {
    const id = deleteModal.projectId;
    setDeleteModal({ visible: false, projectId: null });
    await deleteProject(id);
    load();
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleManagePartners = (projectId) => {
    setPartnerModal({ visible: true, projectId });
  };

  const handleAddPartner = async (matchId, projectId) => {
    await sendPartnerInvite(matchId, projectId);
    setPartnerModal({ visible: false, projectId: null });
  };

  const handleUploadDeck = async (projectId) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      await uploadDeck(projectId, file.uri, file.name);
      load();
    } catch {
      Alert.alert('Upload Failed', 'Could not upload deck. Please try again.');
    }
  };

  const handleUploadVideo = async (projectId) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library access is needed to upload a video.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType?.Videos ?? ImagePicker.MediaTypeOptions?.Videos,
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;
      await uploadVideo(projectId, result.assets[0].uri);
      load();
    } catch {
      Alert.alert('Upload Failed', 'Could not upload video. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.sectionLabel}>MY PROJECTS</Text>
            <Text style={styles.pageTitle}>Your Ventures</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => { setEditingProject(null); setShowForm(true); }}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        {showForm && (
          <ProjectForm
            initial={editingProject}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingProject(null); }}
          />
        )}

        {/* My Projects */}
        {projects.length === 0 && !showForm ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Text style={{ fontSize: 28 }}>📁</Text>
            </View>
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySub}>
              Create a project so investors can discover and swipe on your ventures.
            </Text>
          </View>
        ) : (
          projects.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onUploadDeck={handleUploadDeck}
              onUploadVideo={handleUploadVideo}
              onManagePartners={handleManagePartners}
            />
          ))
        )}

        {/* Projects I've Joined */}
        {joinedProjects.length > 0 && (
          <>
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionDividerLabel}>PROJECTS I'VE JOINED</Text>
            </View>
            {joinedProjects.map(p => (
              <JoinedProjectCard key={p.id} project={p} />
            ))}
          </>
        )}
      </ScrollView>

      <AddPartnerModal
        visible={partnerModal.visible}
        projectId={partnerModal.projectId}
        onAdd={handleAddPartner}
        onClose={() => setPartnerModal({ visible: false, projectId: null })}
      />

      {/* Delete confirmation modal */}
      <Modal visible={deleteModal.visible} transparent animationType="fade">
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteModalTitle}>Delete Project</Text>
            <Text style={styles.deleteModalBody}>
              Are you sure you want to remove this project?{'\n\n'}It will disappear from the investor feed.
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.deleteBtnCancel}
                onPress={() => setDeleteModal({ visible: false, projectId: null })}
              >
                <Text style={styles.deleteBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtnConfirm}
                onPress={handleDeleteConfirmed}
              >
                <Text style={styles.deleteBtnConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textHint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.4,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Project card
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...cardShadow,
    shadowOpacity: 0.04,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 6,
  },
  stagePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  stagePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cardActions: { flexDirection: 'row', gap: 8 },
  cardActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  cardActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cardActionBtnDelete: { backgroundColor: '#FFF0F0', borderColor: '#FFD4D4' },
  cardActionBtnDeleteText: { color: colors.error, fontSize: 12, fontWeight: '600' },

  cardDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  metaChip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },

  // Partners
  partnersSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSoft,
  },
  partnersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  partnersSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textHint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  addPartnerBtn: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  addPartnerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  partnerList: { flexDirection: 'column', gap: 8, marginTop: 4 },
  partnerItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removePartnerBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePartnerBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  partnerName: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  partnerAvatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPartnersText: {
    fontSize: 12,
    color: colors.textHint,
    fontStyle: 'italic',
  },

  aiFeedbackBtn: { marginTop: 8, backgroundColor: colors.primaryLight || '#e8f0fe', borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 16, alignItems: 'center' },
  aiFeedbackBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  deckReviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  deckReviewSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  deckReviewTitle: { fontSize: 17, fontWeight: '800', color: colors.primaryDark, marginBottom: 10 },
  deckReviewHint: { fontSize: 13, color: colors.textHint, marginBottom: 10 },
  deckReviewInput: { borderWidth: 1.5, borderColor: colors.surfaceBorder, borderRadius: radius.md, padding: 12, minHeight: 110, textAlignVertical: 'top', color: colors.textPrimary, fontSize: 14, marginBottom: 12 },
  deckReviewActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  deckReviewCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  deckReviewSubmit: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 24, alignItems: 'center' },
  deckFeedbackScore: { fontSize: 18, fontWeight: '800', color: colors.primary, textAlign: 'center', marginBottom: 14 },
  deckFeedbackLabel: { fontSize: 13, fontWeight: '700', color: colors.primaryDark, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  deckFeedbackItem: { fontSize: 13, color: colors.textSecondary, marginBottom: 4, lineHeight: 19 },
  // Upload
  uploadRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  uploadBtn: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderStyle: 'dashed',
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  // Form panel
  formPanel: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...cardShadow,
    shadowOpacity: 0.05,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.primaryDark,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },

  stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stageChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
  },
  stageChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stageChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stageChipTextActive: { color: '#fff' },

  formBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
  },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  saveBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  errorText: { color: colors.error, marginTop: 8, fontSize: 13 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textHint,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,36,102,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primaryDark,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  matchPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSoft,
  },
  matchPickerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  matchPickerRole: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  modalCloseBtn: {
    marginTop: 16,
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  modalCloseBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },

  // Joined projects
  joinedCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  joinedOwnerTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  joinedOwnerText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // Section divider
  sectionDivider: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionDividerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textHint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // Delete confirmation modal
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 36, 102, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deleteModal: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    ...cardShadow,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  deleteModalBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  deleteModalActions: { flexDirection: 'row', gap: 12 },
  deleteBtnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnCancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  deleteBtnConfirm: {
    flex: 1,
    backgroundColor: colors.error,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnConfirmText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});