import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fetchOdooData } from '../../services/LogInService';

export default function NFCBindingScreen() {
  const [alumnosSinNFC, setAlumnosSinNFC] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAlumnos = async () => {
      setLoading(true);
      try {
        const result = await fetchOdooData('gestion_entrada.alumno', ["uid", "name", "surname", "school_year"]);
        // Filtramos a los que NO tienen UID vinculado
        setAlumnosSinNFC(result.filter(a => !a.uid));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadAlumnos();
  }, []);

  const handleVincular = (alumno) => {
    Alert.alert(
      "Modo Vinculación",
      `Acerca una tarjeta NFC al lector del dispositivo móvil para vincularla a ${alumno.name} ${alumno.surname}.`
    );
    // Aquí más adelante pondremos la lógica real de NfcManager
  };

  const renderItem = ({ item }) => (
    <View style={styles.listItem}>
      <View style={styles.listTextContainer}>
        <Text style={styles.name}>{item.name} {item.surname}</Text>
        <Text style={styles.course}>{item.school_year}</Text>
      </View>
      <TouchableOpacity 
        style={styles.vincularBtn} 
        onPress={() => handleVincular(item)}
      >
        <Text style={styles.vincularText}>Vincular</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Cabecera Azul */}
      <View style={styles.headerCard}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Modo Emparejamiento</Text>
          <Text style={styles.headerSubtitle}>
            Selecciona un alumno y acerca la tarjeta NFC al lector para vincularla.
          </Text>
        </View>
        <View style={styles.iconCircle}>
          <Feather name="maximize" size={32} color="white" />
        </View>
      </View>

      {/* Lista de Alumnos */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderTitle}>Alumnos pendientes</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1D4ED8" />
          </View>
        ) : alumnosSinNFC.length > 0 ? (
          <FlatList
            data={alumnosSinNFC}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.flatListContent}
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Sin alumnos pendientes.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  headerCard: { flexDirection: 'row', backgroundColor: '#2563EB', padding: 24, borderRadius: 16, alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, elevation: 4, shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  headerTextContainer: { flex: 1, marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: 'white', marginBottom: 8 },
  headerSubtitle: { fontSize: 12, color: '#DBEAFE', lineHeight: 18 },
  iconCircle: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 16, borderRadius: 50 },
  listContainer: { flex: 1, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
  listHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  listHeaderTitle: { fontWeight: 'bold', color: '#334155' },
  center: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#94A3B8', fontWeight: 'bold' },
  flatListContent: { paddingBottom: 16 },
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  listTextContainer: { flex: 1 },
  name: { fontWeight: 'bold', color: '#1E293B', marginBottom: 2 },
  course: { fontSize: 10, fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase' },
  vincularBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DBEAFE' },
  vincularText: { color: '#1D4ED8', fontWeight: 'bold', fontSize: 12 }
});