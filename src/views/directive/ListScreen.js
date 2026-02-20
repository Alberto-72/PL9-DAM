import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fetchOdooData } from '../../services/LogInService'; 

export default function ListScreen({ route }) {
  const { type } = route.params; 
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const isAlumnado = type === 'alumnado';
      const model = isAlumnado ? 'gestion_entrada.alumno' : 'gestion_entrada.profesor'; 
      const fields = isAlumnado ? ["uid", "name", "surname", "school_year", "can_bus"] : ["uid", "name", "surname", "email"]; 
      
      try {
        const result = await fetchOdooData(model, fields);
        setData(result);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [type]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.name} {item.surname}</Text>
        <Text style={[styles.uid, !item.uid && styles.uidMissing]}>
          {item.uid || 'Sin NFC'}
        </Text>
      </View>
      
      <View style={styles.cardFooter}>
        {type === 'alumnado' ? (
          <>
            <Text style={styles.detailText}>{item.school_year}</Text>
            <View style={styles.busRow}>
              <Feather name="truck" size={14} color={item.can_bus ? "#22C55E" : "#EF4444"} />
              <Text style={item.can_bus ? styles.textGreen : styles.textRed}>
                {item.can_bus ? ' Bus' : ' Sin Bus'}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.detailText}>{item.email || 'Sin email'}</Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1D4ED8" />
        <Text style={styles.loadingText}>Cargando datos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listPadding}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  listPadding: { padding: 16 },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', flex: 1 },
  uid: { fontSize: 12, fontWeight: 'bold', color: '#1D4ED8', backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  uidMissing: { color: '#EF4444', backgroundColor: '#FEF2F2' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },
  detailText: { fontSize: 14, color: '#64748B' },
  busRow: { flexDirection: 'row', alignItems: 'center' },
  textGreen: { color: '#22C55E', fontWeight: 'bold', fontSize: 12 },
  textRed: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 }
}); 