import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fetchOdooData } from '../../services/LogInService';

export default function NFCBindingScreen({ navigation }) { 
  const [usuariosSinNFC, setUsuariosSinNFC] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsuarios = async () => {
      setLoading(true);
      try {
        const alumnos = await fetchOdooData('gestion_entrada.alumno', ["uid", "name", "surname", "school_year", "photo", "birth_date", "can_bus"]);
        const profesores = await fetchOdooData('gestion_entrada.profesor', ["uid", "name", "surname", "email", "photo"]);
        
        const alumnosMapped = alumnos.map(a => ({ ...a, tipo: 'Alumno', subtitulo: a.school_year }));
        const profesoresMapped = profesores.map(p => ({ ...p, tipo: 'Profesor', subtitulo: p.email || 'Personal Docente' }));

        const todosLosPendientes = [...alumnosMapped, ...profesoresMapped].filter(u => !u.uid);
        setUsuariosSinNFC(todosLosPendientes);
      } catch (error) {
        console.error("Error cargando usuarios pendientes:", error);
      } finally {
        setLoading(false);
      }
    };
    loadUsuarios();
  }, []);


  const handleVincular = (usuario) => {
    navigation.navigate('Control', { 
      screen: 'Escáner', 
      params: { 
        
        studentToValidate: {
          nombre: `${usuario.name} ${usuario.surname}`,
          curso: usuario.subtitulo,
          foto: usuario.photo,
          fechaNacimiento: usuario.birth_date,
          tieneTransporte: usuario.can_bus,
          esVinculacion: true 
        } 
      }
    });
  };

  const renderItem = ({ item }) => (
    <View style={styles.listItem}>
      <View style={styles.listTextContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.name} {item.surname}</Text>
          <View style={[styles.tipoBadge, item.tipo === 'Profesor' ? styles.badgeProfe : styles.badgeAlumno]}>
            <Text style={styles.tipoText}>{item.tipo}</Text>
          </View>
        </View>
        <Text style={styles.course}>{item.subtitulo}</Text>
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
            Selecciona un usuario y acerca la tarjeta NFC al lector para vincularla.
          </Text>
        </View>
        <View style={styles.iconCircle}>
          <Feather name="link-2" size={32} color="white" />
        </View>
      </View>

      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderTitle}>Usuarios pendientes (Total: {usuariosSinNFC.length})</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1D4ED8" />
          </View>
        ) : usuariosSinNFC.length > 0 ? (
          <FlatList
            data={usuariosSinNFC}
            keyExtractor={(item) => item.id.toString() + item.tipo}
            renderItem={renderItem}
            contentContainerStyle={styles.flatListContent}
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No hay usuarios pendientes de vincular.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  headerCard: { flexDirection: 'row', backgroundColor: '#2563EB', padding: 24, borderRadius: 16, alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, elevation: 4 },
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
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  name: { fontWeight: 'bold', color: '#1E293B', marginRight: 8 },
  tipoBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeAlumno: { backgroundColor: '#F0F9FF' },
  badgeProfe: { backgroundColor: '#F0FDF4' },
  tipoText: { fontSize: 9, fontWeight: '800', color: '#64748B' },
  course: { fontSize: 10, fontWeight: 'bold', color: '#94A3B8' },
  vincularBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DBEAFE' },
  vincularText: { color: '#1D4ED8', fontWeight: 'bold', fontSize: 12 }
});