import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, ActivityIndicator, Alert, Modal, FlatList, Image,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { getMyProjects, createProject, updateProject, deleteProject, uploadDeck, uploadVideo, getPartners, addPartner, removePartner, setVisibility } from '../../services/project.service';
import { getMatches } from '../../services/match.service';
import { colors } from '../../theme';

const stageLabel = {
  idea: 'Idea Stage', mvp: 'MVP Stage', growth: 'Growth', scale: 'Scale',
};

const STAGES = ['idea', 'mvp', 'growth', 'scale'];

function PartnerAvatar({ name, photoUrl, size = 32 }) {
  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[styles.partnerAvatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontSize: size * 0.4, color: '#fff', fontWeight: '700' }}>
        {name ? name[0].toUpperCase() : '?'}
      </Text>
    </View>
  );
}

function ProjectCard({ project, onEdit, onDelete, onUploadDeck, onUploadVideo, onManagePartners, onToggleVisibility }) {
  const [partners, setPartners] = useState([]);

  useFocusEffect(useCallback(() => {
    getPartners(project.id)
      .then(res => setPartners(res.data))
      .catch(() => {});
  }, [project.id]));

  const handleRemovePartner = (userId) => {
    Alert.alert('Remove Partner', 'Remove this person from the project?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await removePartner(project.id, userId);
          setPartners(prev => prev.filter(p => p.userId !== userId));
        },
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{project.title}</Text>
          {project.stage ? (
            <View style={styles.stagePill}>
              <Text style={styles.stagePillText}>{stageLabel[project.stage] || project.stage}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => onToggleVisibility(project.id, project.visibility === 'private' ? 'public' : 'private')}
            style={[styles.actionBtn, project.visibility === 'private' && styles.privateBadge]}
          >
            <Text style={[styles.actionBtnText, project.visibility === 'private' && styles.privateBadgeText]}>
              {project.visibility === 'private' ? '🔒 Private' : '🌐 Public'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onEdit(project)} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(project.id)} style={[styles.actionBtn, styles.deleteBtn]}>
            <Text style={[styles.actionBtnText, styles.deleteBtnText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      {project.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{project.description}</Text>
      ) : null}
      <View style={styles.cardMeta}>
        {project.industry ? <Text style={styles.metaChip}>{project.industry}</Text> : null}
        {project.funding_needed ? (
          <Text style={styles.metaChip}>Seeking ${Number(project.funding_needed).toLocaleString()}</Text>
        ) : null}
        {project.deck_url ? <Text style={styles.metaChip}>📄 Deck</Text> : null}
        {project.video_url ? <Text style={styles.metaChip}>🎬 Video</Text> : null}
      </View>

      {/* Partners section */}
      <View style={styles.partnersSection}>
        <View style={styles.partnersHeader}>
          <Text style={styles.partnersSectionLabel}>TEAM</Text>
          <TouchableOpacity onPress={() => onManagePartners(project.id, setPartners)} style={styles.addPartnerBtn}>
            <Text style={styles.addPartnerBtnText}>+ Add Partner</Text>
          </TouchableOpacity>
        </View>
        {partners.length === 0 ? (
          <Text style={styles.noPartnersText}>No partners yet</Text>
        ) : (
          <View style={styles.partnerList}>
            {partners.map(p => (
              <TouchableOpacity
                key={p.userId}
                style={styles.partnerItem}
                onLongPress={() => handleRemovePartner(p.userId)}
              >
                <PartnerAvatar name={p.name} photoUrl={p.photoUrl} />
                <Text style={styles.partnerName}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.uploadRow}>
        <TouchableOpacity style={styles.uploadBtn} onPress={() => onUploadDeck(project.id)}>
          <Text style={styles.uploadBtnText}>📄 {project.deck_url ? 'Replace Deck' : 'Upload Deck'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadBtn} onPress={() => onUploadVideo(project.id)}>
          <Text style={styles.uploadBtnText}>🎬 {project.video_url ? 'Replace Video' : 'Upload Video'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AddPartnerModal({ visible, onClose, onAdd, matches }) {
  return (
    <Modal transparent visible={visible} animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Add Partner</Text>
          <Text style={styles.modalSub}>Pick from your matched connections</Text>
          {matches.length === 0 ? (
            <Text style={styles.noPartnersText}>No matches yet — swipe to connect first!</Text>
          ) : (
            <FlatList
              data={matches}
              keyExtractor={item => String(item.userId)}
              style={{ maxHeight: 320, width: '100%' }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.matchPickerItem} onPress={() => onAdd(item.userId)}>
                  <PartnerAvatar name={item.name} photoUrl={item.photoUrl} size={40} />
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
          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
            <Text style={styles.modalCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ProjectForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    stage: initial?.stage || '',
    funding_needed: initial?.funding_needed ? String(initial.funding_needed) : '',
    industry: initial?.industry || '',
    deck_url: initial?.deck_url || '',
    video_url: initial?.video_url || '',
  });
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setError('');
    await onSave({
      ...form,
      funding_needed: form.funding_needed ? Number(form.funding_needed) : null,
    });
  };

  return (
    <View style={styles.formPanel}>
      <Text style={styles.formTitle}>{initial ? 'Edit Project' : 'New Project'}</Text>

      <Text style={styles.fieldLabel}>Title *</Text>
      <TextInput
        style={styles.input}
        value={form.title}
        onChangeText={v => setForm(f => ({ ...f, title: v }))}
        placeholder="Project name"
        placeholderTextColor={colors.onSurfaceVariant}
      />

      <Text style={styles.fieldLabel}>Description</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        multiline
        value={form.description}
        onChangeText={v => setForm(f => ({ ...f, description: v }))}
        placeholder="What does your project do?"
        placeholderTextColor={colors.onSurfaceVariant}
      />

      <Text style={styles.fieldLabel}>Industry</Text>
      <TextInput
        style={styles.input}
        value={form.industry}
        onChangeText={v => setForm(f => ({ ...f, industry: v }))}
        placeholder="e.g. FinTech, HealthTech, SaaS"
        placeholderTextColor={colors.onSurfaceVariant}
      />

      <Text style={styles.fieldLabel}>Stage</Text>
      <View style={styles.chipRow}>
        {STAGES.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.stageChip, form.stage === s && styles.stageChipActive]}
            onPress={() => setForm(f => ({ ...f, stage: s }))}
          >
            <Text style={[styles.stageChipText, form.stage === s && styles.stageChipTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Funding Needed ($)</Text>
      <TextInput
        style={styles.input}
        value={form.funding_needed}
        onChangeText={v => setForm(f => ({ ...f, funding_needed: v }))}
        keyboardType="numeric"
        placeholder="e.g. 500000"
        placeholderTextColor={colors.onSurfaceVariant}
      />

      <Text style={styles.fieldLabel}>Deck URL</Text>
      <TextInput
        style={styles.input}
        value={form.deck_url}
        onChangeText={v => setForm(f => ({ ...f, deck_url: v }))}
        placeholder="Link to your pitch deck (Notion, Slides, etc.)"
        placeholderTextColor={colors.onSurfaceVariant}
        autoCapitalize="none"
        keyboardType="url"
      />

      <Text style={styles.fieldLabel}>Video URL</Text>
      <TextInput
        style={styles.input}
        value={form.video_url}
        onChangeText={v => setForm(f => ({ ...f, video_url: v }))}
        placeholder="Demo video link (YouTube, Loom, etc.)"
        placeholderTextColor={colors.onSurfaceVariant}
        autoCapitalize="none"
        keyboardType="url"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.formBtnRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Project</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ProjectsScreen() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [partnerModal, setPartnerModal] = useState({ visible: false, projectId: null, setPartners: null });
  const [matchedUsers, setMatchedUsers] = useState([]);

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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async (data) => {
    try {
      if (editingProject) {
        await updateProject(editingProject.id, data);
      } else {
        await createProject(data);
      }
      setShowForm(false);
      setEditingProject(null);
      load();
    } catch (e) {
      console.error('Failed to save project', e);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Project', 'Remove this project from the feed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteProject(id);
          load();
        },
      },
    ]);
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleManagePartners = async (projectId, setPartnersFn) => {
    try {
      const res = await getMatches();
      setMatchedUsers(res.data || []);
    } catch {
      setMatchedUsers([]);
    }
    setPartnerModal({ visible: true, projectId, setPartners: setPartnersFn });
  };

  const handleAddPartner = async (partnerUserId) => {
    const { projectId, setPartners } = partnerModal;
    try {
      await addPartner(projectId, partnerUserId);
      const res = await getPartners(projectId);
      setPartners(res.data);
      setPartnerModal({ visible: false, projectId: null, setPartners: null });
    } catch {
      Alert.alert('Error', 'Could not add partner.');
    }
  };

  const handleToggleVisibility = async (projectId, newVisibility) => {
    try {
      await setVisibility(projectId, newVisibility);
      setProjects(prev =>
        prev.map(p => p.id === projectId ? { ...p, visibility: newVisibility } : p)
      );
    } catch {
      Alert.alert('Error', 'Could not update project visibility.');
    }
  };

  const handleUploadDeck = async (projectId) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.ms-powerpoint',
               'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      await uploadDeck(projectId, file.uri, file.name);
      load();
    } catch (e) {
      Alert.alert('Upload Failed', 'Could not upload deck. Please try again.');
    }
  };

  const handleUploadVideo = async (projectId) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*'],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      await uploadVideo(projectId, file.uri, file.name);
      load();
    } catch (e) {
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
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.sectionLabel}>MY PROJECTS</Text>
            <Text style={styles.pageTitle}>Your Ventures</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => { setEditingProject(null); setShowForm(true); }}
          >
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {showForm && (
          <ProjectForm
            initial={editingProject}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingProject(null); }}
          />
        )}

        {projects.length === 0 && !showForm ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySub}>Create a project so investors can discover and swipe on your ventures.</Text>
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
              onToggleVisibility={handleToggleVisibility}
            />
          ))
        )}
      </ScrollView>

      <AddPartnerModal
        visible={partnerModal.visible}
        matches={matchedUsers}
        onAdd={handleAddPartner}
        onClose={() => setPartnerModal({ visible: false, projectId: null, setPartners: null })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: colors.onSurfaceVariant,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2,
  },
  pageTitle: { fontSize: 24, fontWeight: '800', color: colors.onSurface, letterSpacing: -0.4 },
  addBtn: {
    backgroundColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    marginHorizontal: 24, marginBottom: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#131b2e', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: 6 },
  stagePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
  },
  stagePillText: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: colors.surfaceContainerLow, borderRadius: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  deleteBtn: { backgroundColor: '#fff0f0' },
  deleteBtnText: { color: colors.error },
  privateBadge: { backgroundColor: '#f0f0ff' },
  privateBadgeText: { color: colors.primary },
  cardDesc: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18, marginBottom: 10 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    fontSize: 12, color: colors.secondary, fontWeight: '600',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
  },

  formPanel: {
    backgroundColor: colors.surfaceContainerLowest,
    marginHorizontal: 24, marginBottom: 16, borderRadius: 16, padding: 20,
    shadowColor: '#131b2e', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 16, elevation: 4,
  },
  formTitle: { fontSize: 18, fontWeight: '800', color: colors.onSurface, marginBottom: 16 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: colors.surfaceContainerLow, borderRadius: 10,
    padding: 12, fontSize: 14, color: colors.onSurface,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  stageChip: {
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.surfaceContainerHigh,
  },
  stageChipActive: { backgroundColor: colors.primary },
  stageChipText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  stageChipTextActive: { color: '#fff' },

  formBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.outlineVariant,
  },
  cancelBtnText: { color: colors.onSurfaceVariant, fontWeight: '600' },
  saveBtn: {
    flex: 2, backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },

  error: { color: colors.error, marginTop: 8, fontSize: 13 },

  uploadRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  uploadBtn: {
    flex: 1, backgroundColor: colors.surfaceContainerLow,
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.outlineVariant,
    borderStyle: 'dashed',
  },
  uploadBtnText: { fontSize: 12, fontWeight: '600', color: colors.secondary },

  empty: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, marginBottom: 8 },
  emptySub: { fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20 },

  partnersSection: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.outlineVariant,
  },
  partnersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  partnersSectionLabel: {
    fontSize: 10, fontWeight: '700', color: colors.onSurfaceVariant,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  addPartnerBtn: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  addPartnerBtnText: { fontSize: 12, fontWeight: '600', color: colors.secondary },
  partnerList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  partnerItem: { alignItems: 'center', gap: 4 },
  partnerName: { fontSize: 11, color: colors.onSurfaceVariant, maxWidth: 56, textAlign: 'center' },
  partnerAvatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  noPartnersText: { fontSize: 12, color: colors.onSurfaceVariant, fontStyle: 'italic' },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(7,0,73,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.onSurface, marginBottom: 4 },
  modalSub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 16 },
  matchPickerItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant,
  },
  matchPickerName: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  matchPickerRole: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2, textTransform: 'capitalize' },
  modalCloseBtn: {
    marginTop: 16, backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  modalCloseBtnText: { color: colors.onSurfaceVariant, fontWeight: '600', fontSize: 15 },
});
