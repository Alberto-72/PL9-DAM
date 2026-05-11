import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { API_ENDPOINTS } from '../../config/api';
import { apiClient } from '../../services/apiClient';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ asistenciaHoy: 0, asistenciaMedia: '0%', incidenciasHoy: 0 });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const data = await apiClient.get(API_ENDPOINTS.DASHBOARD);
      
      if (data.success) {
        setKpis(data.kpis);
        setChartData(data.chartData);
      }
    } catch (error) {
      console.error("Error al cargar el dashboard:", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1D4ED8" />
        <Text style={{ marginTop: 10, color: '#64748B' }}>Cargando estadísticas...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      <View style={styles.statsContainer}>
        <StatCard title="Asistencia Hoy" value={kpis.asistenciaHoy} />
        <StatCard title="Asist. Media" value={kpis.asistenciaMedia} />
        <StatCard title="Incidencias Hoy" value={kpis.incidenciasHoy} color="red" />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Feather name="bar-chart-2" size={18} color="#1D4ED8" style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>Salidas (Semana)</Text>
        </View>
        
        <View style={styles.chartContainer}>
          {chartData.map((item, i) => (
            <View key={i} style={styles.barWrapper}>
              <View style={styles.barBackground}>
                {item.segments.map((seg, idx) => (
                  <View 
                    key={idx} 
                    style={[
                      styles.barFillSegment, 
                      { height: `${Math.min(seg.value, 100)}%`, backgroundColor: seg.color }
                    ]} 
                  />
                ))}
              </View>
              <Text style={styles.barLabel}>{item.day}</Text>
            </View>
          ))}
        </View>

        <View style={styles.legendContainer}>
          <LegendItem color="#3B82F6" label="Autorizadas" />
          <LegendItem color="#EF4444" label="No Autoriz." />
          <LegendItem color="#10B981" label="Transp/Recreo" />
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

const LegendItem = ({ color, label }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendColor, { backgroundColor: color }]} />
    <Text style={styles.legendLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 16,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  statTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
  },
  statTrend: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#22C55E',
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 150,
    alignItems: 'flex-end',
    paddingBottom: 10,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barBackground: {
    width: 30,
    height: 120,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFillSegment: {
    width: '100%',
  },
  barLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94A3B8',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginTop: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: '#64748B',
  },
});