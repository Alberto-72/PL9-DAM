import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* Tarjetas de Estadísticas */}
      <View style={styles.statsContainer}>
        <StatCard title="Salidas Hoy" value="142" trend="+12%" />
        <StatCard title="Incidencias" value="3" color="red" />
        <StatCard title="Activos" value="98%" />
      </View>

      {/* Gráfico Simulado */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Feather name="trending-up" size={18} color="#1D4ED8" style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>Salidas Anticipadas (Semana)</Text>
        </View>
        
        <View style={styles.chartContainer}>
          {[65, 45, 85, 55, 30].map((h, i) => (
            <View key={i} style={styles.barWrapper}>
              <View style={styles.barBackground}>
                <View style={[styles.barFill, { height: `${h}%` }]} />
              </View>
              <Text style={styles.barLabel}>
                {['L', 'M', 'X', 'J', 'V'][i]}
              </Text>
            </View>
          ))}
        </View>
      </View>

    </ScrollView>
  );
}

const StatCard = ({ title, value, trend, color = "blue" }) => (
  <View style={styles.statCard}>
    <Text style={styles.statTitle}>{title}</Text>
    <View style={styles.statRow}>
      <Text style={[styles.statValue, color === 'red' && { color: '#EF4444' }]}>{value}</Text>
      {trend && <Text style={styles.statTrend}>{trend}</Text>}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: 16, marginHorizontal: 4, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  statTitle: { fontSize: 10, fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 },
  statRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  statValue: { fontSize: 24, fontWeight: '900', color: '#1E293B' },
  statTrend: { fontSize: 12, fontWeight: 'bold', color: '#22C55E' },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, marginBottom: 24 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
  chartContainer: { flexDirection: 'row', justifyContent: 'space-around', height: 150, alignItems: 'flex-end' },
  barWrapper: { alignItems: 'center', flex: 1 },
  barBackground: { width: 30, height: 120, backgroundColor: '#F1F5F9', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden', marginBottom: 8 },
  barFill: { width: '100%', backgroundColor: '#1D4ED8', borderRadius: 6 },
  barLabel: { fontSize: 12, fontWeight: 'bold', color: '#94A3B8' }
});