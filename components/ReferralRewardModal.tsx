import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Gift, Sparkles, Star } from 'lucide-react-native';

import { Text } from '@/components/Themed';
import { formatReferralExpiry, markLatestReferralRewardSeen, markPremiumCelebrationSeen } from '@/services/referrals';
import { useAuthStore } from '@/store/authStore';

const CONFETTI_COLORS = ['#16A34A', '#DC2626', '#F59E0B', '#0F766E', '#F97316', '#BE123C'];

export function ReferralRewardModal() {
  const referralReward = useAuthStore((state) => state.referralReward);
  const clearReferralReward = useAuthStore((state) => state.clearReferralReward);
  const { height, width } = useWindowDimensions();
  const visible = Boolean(referralReward);
  const scaleValue = useRef(new Animated.Value(0.92)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => ({
        id: index,
        leftRatio: ((index * 37) % 100) / 100,
        delay: (index % 6) * 180,
        duration: 2400 + (index % 5) * 280,
        size: 8 + (index % 4) * 4,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        rotateStart: `${(index % 3) * 18}deg`,
        rotateEnd: `${220 + (index % 5) * 35}deg`,
      })),
    []
  );

  const confettiProgress = useRef(confettiPieces.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) {
      fadeValue.setValue(0);
      scaleValue.setValue(0.92);
      confettiProgress.forEach((value) => value.setValue(0));
      return;
    }

    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(fadeValue, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    const loops = confettiProgress.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(confettiPieces[index].delay),
          Animated.timing(value, {
            toValue: 1,
            duration: confettiPieces[index].duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      )
    );

    loops.forEach((animation) => animation.start());

    return () => {
      loops.forEach((animation) => animation.stop());
    };
  }, [confettiPieces, confettiProgress, fadeValue, scaleValue, visible]);

  const dismiss = async () => {
    await markPremiumCelebrationSeen();
    await markLatestReferralRewardSeen();
    clearReferralReward();
  };

  const expiresLabel = formatReferralExpiry(referralReward?.premiumExpiresAt);
  const source = referralReward?.source || 'referral';
  const sourceContent = {
    referral: {
      title: 'Premium unlocked for this account',
      subtitle: `Three people used your invite code, so Buddy Balance activated ${referralReward?.rewardMonths || 1} month of Premium for you.`,
      leftBadge: 'Referral reward',
      rightBadge: 'Premium granted',
      footer: 'Unlimited friends, unlimited records, and this celebration appears the first time the app detects the reward, including after a refresh or page change.',
      button: 'Open My Premium',
    },
    purchase: {
      title: 'Purchase confirmed. Premium is live.',
      subtitle: 'Your payment was processed and Premium access is now active on this account.',
      leftBadge: 'Purchase complete',
      rightBadge: 'Premium active',
      footer: 'This welcome screen appears the first time the app detects the purchase, including after a refresh or page change.',
      button: 'Enter Premium',
    },
    admin: {
      title: 'Premium was granted to your account',
      subtitle: 'An administrator activated Premium access for this account, and the upgrade is ready to use now.',
      leftBadge: 'Admin granted',
      rightBadge: 'Premium active',
      footer: 'This notice appears the first time the app detects the admin upgrade, including after a refresh or page change.',
      button: 'Use Premium',
    },
  } as const;
  const content = sourceContent[source];

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => {
        void dismiss();
      }}
    >
      <LinearGradient colors={['#052E16', '#14532D', '#7F1D1D']} style={styles.container}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {confettiPieces.map((piece, index) => {
            const translateY = confettiProgress[index].interpolate({
              inputRange: [0, 1],
              outputRange: [-80, height + 80],
            });
            const translateX = confettiProgress[index].interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, (index % 2 === 0 ? 18 : -18), 0],
            });
            const rotate = confettiProgress[index].interpolate({
              inputRange: [0, 1],
              outputRange: [piece.rotateStart, piece.rotateEnd],
            });

            return (
              <Animated.View
                key={piece.id}
                style={[
                  styles.confetti,
                  {
                    left: piece.leftRatio * width,
                    width: piece.size,
                    height: piece.size * 1.8,
                    backgroundColor: piece.color,
                    opacity: fadeValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.95],
                    }),
                    transform: [{ translateY }, { translateX }, { rotate }],
                  },
                ]}
              />
            );
          })}
        </View>

        <Animated.View style={[styles.heroShell, { opacity: fadeValue, transform: [{ scale: scaleValue }] }]}>
          <View style={styles.topRow}>
            <View style={[styles.sparkBadge, styles.greenBadge]}>
              <Sparkles size={18} color="#DCFCE7" />
            </View>
            <View style={styles.centerCrest}>
              <LinearGradient colors={['#FEF08A', '#F59E0B']} style={styles.crestGradient}>
                <Crown size={42} color="#14532D" />
              </LinearGradient>
            </View>
            <View style={[styles.sparkBadge, styles.redBadge]}>
              <Star size={18} color="#FEE2E2" />
            </View>
          </View>

          <View style={styles.ribbonRow}>
            <View style={[styles.ribbonPill, styles.ribbonGreen]}>
              <Gift size={14} color="#DCFCE7" />
              <Text style={styles.ribbonText}>{content.leftBadge}</Text>
            </View>
            <View style={[styles.ribbonPill, styles.ribbonRed]}>
              <Sparkles size={14} color="#FEE2E2" />
              <Text style={styles.ribbonText}>{content.rightBadge}</Text>
            </View>
          </View>

          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.subtitle}>{content.subtitle}</Text>

          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              {source === 'referral' ? (
                <>
                  <View style={[styles.statChip, styles.statChipGreen]}>
                    <Text style={styles.statValue}>{referralReward?.referralCount || 0}</Text>
                    <Text style={styles.statLabel}>uses</Text>
                  </View>
                  <View style={[styles.statChip, styles.statChipRed]}>
                    <Text style={styles.statValue}>{referralReward?.rewardMonths || 1}</Text>
                    <Text style={styles.statLabel}>month</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.statChip, styles.statChipGreen]}>
                    <Text style={styles.statValue}>PRO</Text>
                    <Text style={styles.statLabel}>status</Text>
                  </View>
                  <View style={[styles.statChip, styles.statChipRed]}>
                    <Text style={styles.statValue}>{source === 'purchase' ? 'BUY' : 'ADM'}</Text>
                    <Text style={styles.statLabel}>source</Text>
                  </View>
                </>
              )}
            </View>
            <Text style={styles.expiryText}>
              {source === 'referral' && expiresLabel ? `Premium active until ${expiresLabel}.` : 'Premium is active on your account now.'}
            </Text>
          </View>

          <Text style={styles.footerText}>{content.footer}</Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              void dismiss();
            }}
          >
            <Text style={styles.primaryButtonText}>{content.button}</Text>
          </Pressable>
        </Animated.View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 40,
  },
  confetti: {
    position: 'absolute',
    top: -40,
    borderRadius: 4,
  },
  heroShell: {
    borderRadius: 34,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    backgroundColor: 'rgba(255, 251, 235, 0.94)',
    borderWidth: 2,
    borderColor: 'rgba(254, 240, 138, 0.65)',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sparkBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenBadge: {
    backgroundColor: '#166534',
  },
  redBadge: {
    backgroundColor: '#B91C1C',
  },
  centerCrest: {
    marginTop: -42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestGradient: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#FEF3C7',
  },
  ribbonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  ribbonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ribbonGreen: {
    backgroundColor: '#166534',
  },
  ribbonRed: {
    backgroundColor: '#991B1B',
  },
  ribbonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    marginTop: 22,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    color: '#14532D',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 14,
    fontSize: 17,
    lineHeight: 25,
    color: '#7F1D1D',
    textAlign: 'center',
  },
  statsCard: {
    marginTop: 22,
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statChip: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statChipGreen: {
    backgroundColor: '#DCFCE7',
  },
  statChipRed: {
    backgroundColor: '#FEE2E2',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#475569',
  },
  expiryText: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#166534',
    fontWeight: '800',
  },
  footerText: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: '#334155',
  },
  primaryButton: {
    marginTop: 22,
    minHeight: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14532D',
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
