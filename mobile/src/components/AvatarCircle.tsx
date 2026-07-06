import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

const FALLBACK_COLORS = ['#1877F2','#E4405F','#25D366','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316'];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}

function getAvatarColor(name: string): string {
  if (!name) return FALLBACK_COLORS[0];
  const num = hashCode(name);
  if (isNaN(num) || !isFinite(num)) return FALLBACK_COLORS[Math.abs(hashCode(name)) % FALLBACK_COLORS.length];
  const hue = Math.abs(num) % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

function getInitials(name: string): string {
  if (!name || name.trim().length === 0) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase();
}

interface AvatarCircleProps {
  name: string;
  size?: number;
}

export default function AvatarCircle({ name, size = 40 }: AvatarCircleProps) {
  const bgColor = useMemo(() => getAvatarColor(name), [name]);
  const initials = useMemo(() => getInitials(name), [name]);
  const fontSize = Math.round(size * 0.4);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
      ]}
      accessibilityLabel={`Avatar for ${name}`}
    >
      <Text
        style={[
          styles.initials,
          { fontSize, lineHeight: fontSize * 1.2 },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
});
