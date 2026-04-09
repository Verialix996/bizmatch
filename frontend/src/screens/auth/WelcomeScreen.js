import {
  View, Text, TouchableOpacity,
  StyleSheet, StatusBar,
} from 'react-native';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { brandGradient, radius } from '../../theme';
import { googleSignIn } from '../../services/auth.service';
import useAuthStore from '../../store/authStore';
import { GOOGLE_CLIENT_ID } from '../../config/constants';

WebBrowser.maybeCompleteAuthSession();

export default function WelcomeScreen({ navigation }) {
  const setAuth = useAuthStore(s => s.setAuth);
  const [googleError, setGoogleError] = useState('');

  const [, response, promptAsync] = Google.useAuthRequest({ clientId: GOOGLE_CLIENT_ID });

  useEffect(() => {
    if (response?.type === 'success') {
      const { accessToken } = response.authentication;
      googleSignIn(accessToken)
        .then(({ data }) => setAuth(data.token, data.user))
        .catch(e => setGoogleError(e.response?.data?.error || 'Google sign-in failed. Please try again.'));
    }
  }, [response]);
  return (
    <>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[brandGradient.start, brandGradient.middle, brandGradient.end]}
        style={styles.gradient}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      >
        {/* Logo center */}
        <View style={styles.logoArea}>
          <View style={styles.logoRow}>
            <LogoIcon />
            <Text style={styles.brandName}>BizMatch</Text>
          </View>
        </View>

        {/* Bottom actions */}
        <View style={styles.bottomArea}>
          <Text style={styles.legalText}>
            By tapping "Create account" or "Sign in", you agree to our{' '}
            <Text style={styles.legalLink}>Terms</Text>. Learn how we process
            your data in our{' '}
            <Text style={styles.legalLink}>Privacy Policy</Text> and{' '}
            <Text style={styles.legalLink}>Cookies Policy</Text>.
          </Text>

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>CREATE ACCOUNT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnOutlineText}>SIGN IN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnGoogle}
            onPress={() => { setGoogleError(''); promptAsync(); }}
            activeOpacity={0.85}
          >
            <Text style={styles.btnGoogleText}>G   CONTINUE WITH GOOGLE</Text>
          </TouchableOpacity>
          {!!googleError && <Text style={styles.errorText}>{googleError}</Text>}

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.troubleBtn}
          >
            <Text style={styles.troubleText}>Trouble signing in?</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </>
  );
}

function LogoIcon() {
  return (
    <View style={styles.logoIconWrap}>
      <View style={styles.chain1} />
      <View style={styles.chain2} />
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    justifyContent: 'space-between',
  },

  logoArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chain1: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#fff',
    position: 'absolute',
    left: 8,
    top: 14,
  },
  chain2: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.75)',
    position: 'absolute',
    right: 8,
    top: 14,
  },
  brandName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },

  bottomArea: {
    paddingHorizontal: 28,
    paddingBottom: 52,
    gap: 12,
  },
  legalText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  legalLink: {
    color: 'rgba(255,255,255,0.85)',
    textDecorationLine: 'underline',
  },

  btnPrimary: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingVertical: 17,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#022466',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  btnOutline: {
    backgroundColor: 'transparent',
    borderRadius: radius.pill,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  btnOutlineText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  btnGoogle: {
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 0,
  },
  btnGoogleText: {
    color: '#444',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  troubleBtn: {
    alignItems: 'center',
    paddingTop: 4,
  },
  troubleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },
  errorText: {
    fontSize: 13,
    color: '#FFB3AE',
    textAlign: 'center',
    marginTop: 8,
  },
});