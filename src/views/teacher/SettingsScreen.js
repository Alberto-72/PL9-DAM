import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="build-outline" size={60} color="#9CA3AF" />
      <Text style={styles.text}>Ajustes de Perfil</Text>
      <Text style={styles.subtext}>Próximamente</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  text: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginTop: 16 },
  subtext: { fontSize: 14, color: '#6B7280', marginTop: 8 }
});