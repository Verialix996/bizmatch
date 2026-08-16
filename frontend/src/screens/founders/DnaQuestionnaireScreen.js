import { View, StyleSheet, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors } from '../../theme';
import { getDnaSelfAssessment } from '../../services/founders.service';
import { DNA_DIMENSIONS } from '../../config/dnaQuestions';
import DnaQuestionnaire from '../../components/founder/DnaQuestionnaire';

function emptyAnswers() {
  return DNA_DIMENSIONS.reduce((acc, dim) => { acc[dim] = ''; return acc; }, {});
}

// Reached from the "Fill in your DNA" prompt on a founder's own profile —
// same component the onboarding wizard's skippable 'dna' step uses, just
// without a Skip option since the founder navigated here on purpose.
// Unlike onboarding (which lifts state up for its own AsyncStorage draft),
// this screen has no local draft — DNA-02 already saves each answer to the
// server as it's completed, so on open this fetches whatever was already
// saved and resumes from the first unanswered question instead of always
// starting blank (closing the tab mid-assessment previously looked like
// data loss even though nothing was actually lost server-side).
export default function DnaQuestionnaireScreen({ navigation }) {
  const currentUser = useAuthStore(s => s.user);
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;

  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState(emptyAnswers);
  const [dimIndex, setDimIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDnaSelfAssessment(currentUser.id)
      .then(({ data }) => {
        if (cancelled) return;
        const saved = data.answers || {};
        setAnswers({ ...emptyAnswers(), ...saved });
        const firstUnanswered = DNA_DIMENSIONS.findIndex((dim) => !saved[dim]);
        setDimIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentUser.id]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: C.backgroundSoft }]}>
        <View style={[styles.body, styles.centered]}><ActivityIndicator size="large" color={C.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.backgroundSoft }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.body}>
        <DnaQuestionnaire
          founderId={currentUser.id}
          C={C}
          answers={answers}
          onAnswersChange={setAnswers}
          dimIndex={dimIndex}
          onDimIndexChange={setDimIndex}
          onBack={() => navigation.goBack()}
          onComplete={() => navigation.goBack()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, padding: 24, maxWidth: 700, width: '100%', alignSelf: 'center' },
  centered: { justifyContent: 'center', alignItems: 'center' },
});
