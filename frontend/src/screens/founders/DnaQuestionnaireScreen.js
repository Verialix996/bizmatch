import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors } from '../../theme';
import DnaQuestionnaire from '../../components/founder/DnaQuestionnaire';

// Reached from the "Fill in your DNA" prompt on a founder's own profile —
// same component the onboarding wizard's skippable 'dna' step uses, just
// without a Skip option since the founder navigated here on purpose.
export default function DnaQuestionnaireScreen({ navigation }) {
  const currentUser = useAuthStore(s => s.user);
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.backgroundSoft }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.body}>
        <DnaQuestionnaire
          founderId={currentUser.id}
          C={C}
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
});
