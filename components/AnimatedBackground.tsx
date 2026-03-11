import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate,
    Easing
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/hooks/useAppTheme';

const { width, height } = Dimensions.get('window');

export const AnimatedBackground = ({ children, style }: { children: React.ReactNode, style?: any }) => {
    const progress = useSharedValue(0);
    const { theme } = useAppTheme();

    useEffect(() => {
        progress.value = withRepeat(
            withTiming(1, { duration: 15000, easing: Easing.linear }),
            -1,
            true
        );
    }, []);

    const animatedStyle1 = useAnimatedStyle(() => {
        const translateX = interpolate(progress.value, [0, 1], [-20, 20]);
        const translateY = interpolate(progress.value, [0, 1], [-30, 30]);
        return {
            transform: [{ translateX }, { translateY }, { scale: 1.2 }],
        };
    });

    const animatedStyle2 = useAnimatedStyle(() => {
        const translateX = interpolate(progress.value, [0, 1], [30, -30]);
        const translateY = interpolate(progress.value, [0, 1], [20, -20]);
        return {
            transform: [{ translateX }, { translateY }, { scale: 1.1 }],
        };
    });

    return (
        <View style={[styles.container, { backgroundColor: theme.backgroundBase }, style]}>
            {/* Abstract Animated Blobs */}
            <Animated.View style={[styles.blob, styles.blob1, { opacity: theme.blobOpacity }, animatedStyle1]}>
                <LinearGradient
                    colors={theme.blobColorsA}
                    style={styles.gradient}
                />
            </Animated.View>
            <Animated.View style={[styles.blob, styles.blob2, { opacity: theme.blobOpacity }, animatedStyle2]}>
                <LinearGradient
                    colors={theme.blobColorsB}
                    style={styles.gradient}
                />
            </Animated.View>
            <View style={[styles.overlay, { backgroundColor: theme.backgroundOverlay }]} />
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    blob: {
        position: 'absolute',
        width: width * 0.8,
        height: width * 0.8,
        borderRadius: (width * 0.8) / 2,
    },
    blob1: {
        top: -width * 0.2,
        left: -width * 0.2,
    },
    blob2: {
        bottom: -width * 0.2,
        right: -width * 0.2,
    },
    gradient: {
        flex: 1,
        borderRadius: (width * 0.8) / 2,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        flex: 1,
    },
});
