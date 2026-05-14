import {
  View, Text, TouchableOpacity,
  StyleSheet, StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { brandGradient, radius } from '../../theme';
import useAuthStore from '../../store/authStore';
import { API_BASE_URL } from '../../config/constants';

WebBrowser.maybeCompleteAuthSession();

export default function WelcomeScreen({ navigation }) {
  const setAuth = useAuthStore(s => s.setAuth);
  const [googleError, setGoogleError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleError('');
    setGoogleLoading(true);
    try {
      if (Platform.OS === 'web') {
        const oid = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const popup = window.open(`${API_BASE_URL}/auth/google?oid=${oid}`, 'google-auth', 'width=500,height=600,left=200,top=100');
        if (!popup) { setGoogleError('Allow popups for this site and try again.'); return; }
        await new Promise((resolve) => {
          let attempts = 0;
          const interval = setInterval(async () => {
            attempts++;
            try {
              const resp = await fetch(`${API_BASE_URL}/auth/poll/${oid}`);
              if (resp.status === 200) {
                const data = await resp.json();
                clearInterval(interval);
                if (data.token) {
                  setAuth(data.token, {
                    id: Number(data.userId),
                    email: data.email,
                    name: data.name,
                    role: data.role,
                    has_profile: data.has_profile === true || data.has_profile === 'true',
                  });
                }
                return resolve();
              }
            } catch { /* keep polling */ }
            if (popup.closed || attempts > 150) { clearInterval(interval); resolve(); }
          }, 1000);
        });
      } else {
        const result = await WebBrowser.openAuthSessionAsync(
          `${API_BASE_URL}/auth/google`,
          'bizmatch://'
        );
        if (result.type === 'success' && result.url) {
          const qs = result.url.split('?')[1] || '';
          const params = Object.fromEntries(qs.split('&').map(p => {
            const [k, v] = p.split('=');
            return [k, decodeURIComponent(v || '')];
          }));
          if (params.token) {
            setAuth(params.token, {
              id: Number(params.userId),
              email: params.email,
              name: params.name,
              role: params.role,
              has_profile: params.has_profile === 'true',
            });
          } else {
            setGoogleError('Sign-in completed but no token received. Please try again.');
          }
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
          // On Android the deep link is handled by the OS (Linking listener in App.js),
          // so openAuthSessionAsync returns 'cancel' even on success — do nothing here.
          // Only show an error if we're sure it was a genuine user cancellation (no account change).
        } else {
          setGoogleError('Google sign-in failed. Please try again.');
        }
      }
    } catch (e) {
      setGoogleError('Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };
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
            style={[styles.btnGoogle, googleLoading && { opacity: 0.7 }]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading
              ? <ActivityIndicator size="small" color="#444" />
              : <Text style={styles.btnGoogleText}>G   CONTINUE WITH GOOGLE</Text>
            }
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