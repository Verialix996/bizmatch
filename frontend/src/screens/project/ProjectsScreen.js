import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, ActivityIndicator, Modal, Image, StatusBar,
} from 'react-native';
import { showAlert } from '../../services/alert';
import { useState, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  getMyProjects, createProject, updateProject, deleteProject,
  uploadDeck, uploadVideo, reviewDeck,
} from '../../services/project.service';
import useAppStore from '../../store/appStore';
import useAuthStore from '../../store/authStore';
import { colors, investorColors, investorThemeColors, radius, cardShadow } from '../../theme';

const STAGE_LABELS = { idea: 'Idea Stage', mvp: 'MVP Stage', growth: 'Growth', scale: 'Scale' };

function ProjectCard({ project, onEdit, onDelete, onUploadDeck, onUploadVideo, onReviewDeck, onViewDetail, videoUploadProgress, styles }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {project.icon_url ? (
          <Image source={{ uri: project.icon_url }} style={styles.projectIcon} />
        ) : null}
        <TouchableOpacity style={{ flex: 1 }} onPress={() => onViewDetail?.(project)} activeOpacity={0.7}>
          <Text style={styles.cardTitle}>{project.title}</Text>
          {project.stage ? (
            <View style={styles.stagePill}>
              <Text style={styles.stagePillText}>
                {STAGE_LABELS[project.stage] || project.stage}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
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
          style={[styles.uploadBtn, videoUploadProgress != null && { opacity: 0.6 }]}
          onPress={() => { if (videoUploadProgress == null) onUploadVideo(project.id); }}
          activeOpacity={0.8}
        >
          <Text style={styles.uploadBtnText}>
            🎬 {videoUploadProgress != null ? `Uploading ${videoUploadProgress}%` : project.video_url ? 'Replace Video' : 'Upload Video'}
          </Text>
        </TouchableOpacity>
      </View>
      {videoUploadProgress != null && (
        <View style={styles.videoProgressBar}>
          <View style={[styles.videoProgressFill, { width: `${videoUploadProgress}%` }]} />
        </View>
      )}

      {/* AI Deck Review — only if deck uploaded */}
      {project.deck_url ? (
        <TouchableOpacity style={styles.aiFeedbackBtn} onPress={() => onReviewDeck(project.id)}>
          <Text style={styles.aiFeedbackBtnText}>✦ Get AI Deck Feedback</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function ProjectForm({ initial, onSave, onCancel, styles, C }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    industry: initial?.industry || '',
    stage: initial?.stage || '',
    funding_needed: initial?.funding_needed ? String(initial.funding_needed) : '',
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
        placeholderTextColor={C.textHint}
      />

      <Text style={styles.fieldLabel}>DESCRIPTION</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        multiline
        value={form.description}
        onChangeText={v => setForm(f => ({ ...f, description: v }))}
        placeholder="What does your project do?"
        placeholderTextColor={C.textHint}
      />

      <Text style={styles.fieldLabel}>INDUSTRY</Text>
      <TextInput
        style={styles.input}
        value={form.industry}
        onChangeText={v => setForm(f => ({ ...f, industry: v }))}
        placeholder="e.g. FinTech, HealthTech, SaaS"
        placeholderTextColor={C.textHint}
      />

      <Text style={styles.fieldLabel}>STAGE</Text>
      <View style={styles.stageRow}>
        {['idea', 'mvp', 'growth', 'scale'].map(v => (
          <TouchableOpacity
            key={v}
            style={[styles.stageChip, form.stage === v && styles.stageChipActive]}
            onPress={() => setForm(f => ({ ...f, stage: v }))}
            activeOpacity={0.8}
          >
            <Text style={[styles.stageChipText, form.stage === v && styles.stageChipTextActive]}>
              {STAGE_LABELS[v]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>FUNDING NEEDED ($)</Text>
      <TextInput
        style={styles.input}
        value={form.funding_needed}
        onChangeText={v => setForm(f => ({ ...f, funding_needed: v }))}
        placeholder="e.g. 400000"
        placeholderTextColor={C.textHint}
        keyboardType="numeric"
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

export default function ProjectsScreen({ route }) {
  const navigation = useNavigation();
  const currentUser = useAuthStore(s => s.user);
  const darkMode = useAppStore(s => s.darkMode);
  const isInvestorTheme = useAppStore(s => s.isInvestorTheme);
  const C = darkMode ? investorColors : (isInvestorTheme ? investorThemeColors : colors);
  const styles = makeStyles(C);

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ visible: false, projectId: null });
  const [deckReview, setDeckReview] = useState({ visible: false, projectId: null, feedback: null, loading: false });
  const [videoUpload, setVideoUpload] = useState({ projectId: null, progress: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyProjects();
      setProjects(res.data);
    } catch (e) {
      console.error('Failed to load projects', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    if (route?.params?.startProject) {
      setShowForm(true);
      setEditingProject(null);
    }
  }, [load, route?.params?.startProject]));

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

  const handleViewProject = (project) => {
    navigation.navigate('ProjectDetail', {
      project,
      ownerName: currentUser?.name,
    });
  };

  const handleUploadDeck = async (projectId) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      await uploadDeck(projectId, file.uri, file.name, file.file || null);
      load();
    } catch {
      showAlert('Upload Failed', 'Could not upload deck. Please try again.');
    }
  };

  const handleReviewDeck = async (projectId) => {
    setDeckReview({ visible: true, projectId, feedback: null, loading: false });
  };

  const runDeckReview = async () => {
    setDeckReview(d => ({ ...d, loading: true }));
    try {
      const { data } = await reviewDeck(deckReview.projectId);
      setDeckReview(d => ({ ...d, feedback: data, loading: false }));
    } catch (err) {
      setDeckReview(d => ({ ...d, loading: false }));
      showAlert('Error', err.response?.data?.error || 'Could not get AI feedback.');
    }
  };

  const handleUploadVideo = async (projectId) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Photo library access is needed to upload a video.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType?.Videos ?? ImagePicker.MediaTypeOptions?.Videos,
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setVideoUpload({ projectId, progress: 0 });
      await uploadVideo(projectId, result.assets[0].uri, (pct) => {
        setVideoUpload({ projectId, progress: pct });
      }, result.assets[0].file || null);
      setVideoUpload({ projectId: null, progress: 0 });
      load();
    } catch {
      setVideoUpload({ projectId: null, progress: 0 });
      showAlert('Upload Failed', 'Could not upload video. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
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
              onReviewDeck={handleReviewDeck}
              onViewDetail={handleViewProject}
              videoUploadProgress={videoUpload.projectId === p.id ? videoUpload.progress : null}
              styles={styles}
            />
          ))
        )}
      </ScrollView>

      {/* New / Edit project — full-screen modal */}
      <Modal visible={showForm} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.formModalHeader}>
            <TouchableOpacity onPress={() => { setShowForm(false); setEditingProject(null); }}>
              <Text style={styles.formModalBack}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.formModalTitle}>{editingProject ? 'Edit Project' : 'New Project'}</Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <ProjectForm
              initial={editingProject}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingProject(null); }}
              styles={styles}
              C={C}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* AI Deck Review modal — shared across all project cards */}
      <Modal visible={deckReview.visible} transparent animationType="slide">
        <View style={styles.deckReviewOverlay}>
          <View style={styles.deckReviewSheet}>
            <View style={styles.deckReviewHeader}>
              <Text style={styles.deckReviewTitle}>AI Pitch Deck Review</Text>
              <TouchableOpacity onPress={() => setDeckReview({ visible: false, projectId: null, feedback: null, loading: false })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.deckReviewClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {!deckReview.feedback ? (
              <>
                <Text style={styles.deckReviewHint}>Our AI will read your uploaded PDF and provide structured feedback.</Text>
                <View style={styles.deckReviewActions}>
                  <TouchableOpacity onPress={() => setDeckReview({ visible: false, projectId: null, feedback: null, loading: false })} style={styles.deckReviewCancel}>
                    <Text style={{ color: C.textHint }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={runDeckReview} style={styles.deckReviewSubmit} disabled={deckReview.loading}>
                    {deckReview.loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Analyse</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                <Text style={styles.deckFeedbackScore}>Overall Score: {deckReview.feedback.overallScore}/10</Text>
                {[['Strengths', deckReview.feedback.strengths], ['Weaknesses', deckReview.feedback.weaknesses], ['Suggestions', deckReview.feedback.suggestions]].map(([label, items]) =>
                  items?.length ? (
                    <View key={label} style={{ marginBottom: 12 }}>
                      <Text style={styles.deckFeedbackLabel}>{label}</Text>
                      {items.map((item, i) => <Text key={i} style={styles.deckFeedbackItem}>• {item}</Text>)}
                    </View>
                  ) : null
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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

function makeStyles(C) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.backgroundSoft },
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
    fontSize: 13,
    fontWeight: '700',
    color: C.textHint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: C.primaryDark,
    letterSpacing: -0.4,
  },
  addBtn: {
    backgroundColor: C.primary,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Project card
  card: {
    backgroundColor: C.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    ...cardShadow,
    shadowOpacity: 0.04,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  projectIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: C.backgroundSoft,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.primaryDark,
    marginBottom: 6,
  },
  stagePill: {
    alignSelf: 'flex-start',
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  stagePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSecondary,
  },
  cardActions: { flexDirection: 'row', gap: 8 },
  cardActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  cardActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
  },
  cardActionBtnDelete: { backgroundColor: '#FFF0F0', borderColor: '#FFD4D4' },
  cardActionBtnDeleteText: { color: C.error, fontSize: 12, fontWeight: '600' },

  cardDesc: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  metaChip: {
    backgroundColor: C.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.primary,
  },

  aiFeedbackBtn: { marginTop: 8, backgroundColor: C.primaryLight || '#e8f0fe', borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 16, alignItems: 'center' },
  aiFeedbackBtnText: { color: C.primary, fontWeight: '700', fontSize: 13 },
  deckReviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  deckReviewSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  deckReviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  deckReviewTitle: { fontSize: 17, fontWeight: '800', color: C.primaryDark },
  deckReviewClose: { fontSize: 20, color: C.textHint, fontWeight: '600', paddingLeft: 16 },
  deckReviewHint: { fontSize: 13, color: C.textHint, marginBottom: 10 },
  formModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
    backgroundColor: C.surface,
  },
  formModalBack: { fontSize: 20, color: C.textSecondary, fontWeight: '600' },
  formModalTitle: { fontSize: 17, fontWeight: '800', color: C.primaryDark },
  deckReviewActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  deckReviewCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  deckReviewSubmit: { backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 24, alignItems: 'center' },
  deckFeedbackScore: { fontSize: 18, fontWeight: '800', color: C.primary, textAlign: 'center', marginBottom: 14 },
  deckFeedbackLabel: { fontSize: 13, fontWeight: '700', color: C.primaryDark, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  deckFeedbackItem: { fontSize: 13, color: C.textSecondary, marginBottom: 4, lineHeight: 19 },
  // Upload
  uploadRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  uploadBtn: {
    flex: 1,
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
    borderStyle: 'dashed',
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.primary,
  },
  videoProgressBar: {
    height: 4,
    backgroundColor: C.surfaceBorder,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  videoProgressFill: {
    height: 4,
    backgroundColor: C.primary,
    borderRadius: 2,
  },

  // Form panel
  formPanel: {
    backgroundColor: C.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    ...cardShadow,
    shadowOpacity: 0.05,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.primaryDark,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.primaryDark,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },

  stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stageChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.backgroundSoft,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
  },
  stageChipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  stageChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
  },
  stageChipTextActive: { color: '#fff' },

  formBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
  },
  cancelBtnText: { color: C.textSecondary, fontWeight: '600' },
  saveBtn: {
    flex: 2,
    backgroundColor: C.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  errorText: { color: C.error, marginTop: 8, fontSize: 13 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.primaryDark,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: C.textHint,
    textAlign: 'center',
    lineHeight: 20,
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
    backgroundColor: C.surface,
    borderRadius: radius.xl,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    ...cardShadow,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  deleteModalBody: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  deleteModalActions: { flexDirection: 'row', gap: 12 },
  deleteBtnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnCancelText: { color: C.textSecondary, fontWeight: '600', fontSize: 14 },
  deleteBtnConfirm: {
    flex: 1,
    backgroundColor: C.error,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnConfirmText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
}
