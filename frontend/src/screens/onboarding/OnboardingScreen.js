import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useAuthStore from '../../store/authStore';
import { colors } from '../../theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    key: '1',
    emoji: '🔍',
    title: 'Discover',
    subtitle: 'Browse investors and fellow entrepreneurs. Swipe right to connect, left to pass.',
  },
  {
    key: '2',
    emoji: '🤝',
    title: 'Match',
    subtitle: "When both sides swipe right, it's a match! Our AI explains exactly why you're a great fit.",
  },
  {
    key: '3',
    emoji: '💬',
    title: 'Chat & NDAs',
    subtitle: 'Message your matches, share your project, and sign NDAs to protect your ideas.',
  },
  {
    key: '4',
    emoji: '📅',
    title: 'Schedule Meetings',
    subtitle: 'Propose in-person or virtual meetings and get an AI due-diligence briefing before you meet.',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef(null);
  const setHasSeenOnboarding = useAuthStore(s => s.setHasSeenOnboarding);

  const finish = () => setHasSeenOnboarding();

  const next = () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      finish();
    }
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      {!isLast && (
        <TouchableOpacity style={styles.skipBtn} onPress={finish}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={item => item.key}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={next}>
          <Text style={styles.nextText}>{isLast ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  skipBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    color: colors.textHint,
    fontSize: 15,
    fontWeight: '600',
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 120,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DDE3F0',
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  nextBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 28,
  },
  nextText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
