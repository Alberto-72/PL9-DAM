import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Image, Modal } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fetchOdooData } from '../../services/LogInService';

export default function ListScreen({ route, navigation }) {
  const { type } = route.params; 
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const isAlumnado = type === 'alumnado';
      const model = isAlumnado ? 'gestion_entrada.alumno' : 'gestion_entrada.profesor'; 
      
      const fields = isAlumnado 
      ? ["uid", "name", "surname", "school_year", "can_bus", "photo", "birth_date", "email"] 
      : ["uid", "name", "surname", "email", "photo"];

      try {
        const result = await fetchOdooData(model, fields);
        setData(result);
      } catch (e) {
        console.error("Error cargando datos:", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [type]);

  const verDatosUsuario = (item) => {
    setUsuarioSeleccionado(item);
    setModalVisible(true);
  };

  const manejarNFC = (item) => {
    if (!item.uid) {
      navigation.navigate('NFC', { usuarioParaVincular: item });
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.avatarMini}>
          {item.photo ? (
            <Image source={{ uri: `data:image/png;base64,${item.photo}` }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={20} color="#94A3B8" />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.cardHeader}>
            <Text style={styles.name}>{item.name} {item.surname}</Text>
            {}
            <TouchableOpacity onPress={() => manejarNFC(item)} disabled={!!item.uid}>
              <Text style={[styles.uid, !item.uid && styles.uidMissing]}>
                {item.uid || 'Sin NFC'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.cardFooter}>
            <View style={{ flex: 1 }}>
              {type === 'alumnado' ? (
                <View style={styles.infoRow}>
                  <Text style={styles.detailText}>{item.school_year}</Text>
                  <View style={styles.busRow}>
                    <Feather name="truck" size={14} color={item.can_bus ? "#22C55E" : "#EF4444"} />
                    <Text style={item.can_bus ? styles.textGreen : styles.textRed}>
                      {item.can_bus ? ' Bus' : ' Sin Bus'}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.detailText} numberOfLines={1}>
                    {item.email && item.email !== false ? item.email : 'Sin email'}
                </Text>
              )}
            </View>

            <TouchableOpacity style={styles.btnVerDatos} onPress={() => verDatosUsuario(item)}>
              <Feather name="eye" size={14} color="#1D4ED8" />
              <Text style={styles.textoBtn}> Ver datos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1D4ED8" />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listPadding}
        />
      )}

      {}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <Ionicons name="close-circle" size={32} color="#64748B" />
            </TouchableOpacity>

            {usuarioSeleccionado && (
              <View style={styles.modalBody}>
                <View style={styles.modalAvatarContainer}>
                  {usuarioSeleccionado.photo ? (
                    <Image source={{ uri: `data:image/png;base64,${usuarioSeleccionado.photo}` }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={60} color="#CBD5E1" />
                  )}
                </View>
                
                <Text style={styles.modalName}>{usuarioSeleccionado.name} {usuarioSeleccionado.surname}</Text>
                <View style={styles.modalDivider} />

                <View style={styles.modalInfoRow}>
                    <Text style={styles.modalLabel}>Email:</Text>
                    <Text style={styles.modalValue}>
                      {usuarioSeleccionado.email && usuarioSeleccionado.email !== false && usuarioSeleccionado.email !== "false"
                        ? String(usuarioSeleccionado.email)
                        : "Sin correo registrado"}
                    </Text>
                </View>

                {type === 'alumnado' && (
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalLabel}>Curso:</Text>
                    <Text style={styles.modalValue}>{usuarioSeleccionado.school_year}</Text>
                  </View>
                )}

                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalLabel}>NFC UID:</Text>
                  <Text style={[styles.modalValue, !usuarioSeleccionado.uid && {color: '#EF4444'}]}>
                    {usuarioSeleccionado.uid || 'Pendiente'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  listPadding: { padding: 16 },
  card: { backgroundColor: 'white', borderRadius: 12, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardContent: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatarMini: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', marginRight: 12, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  name: { fontSize: 15, fontWeight: '700', color: '#1E293B', flex: 1, marginRight: 8 },
  uid: { fontSize: 10, fontWeight: '800', color: '#1D4ED8', backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  uidMissing: { color: '#EF4444', backgroundColor: '#FEF2F2' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  detailText: { fontSize: 12, color: '#64748B', marginRight: 10 },
  busRow: { flexDirection: 'row', alignItems: 'center' },
  textGreen: { color: '#22C55E', fontWeight: 'bold', fontSize: 11 },
  textRed: { color: '#EF4444', fontWeight: 'bold', fontSize: 11 },
  btnVerDatos: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F4FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  textoBtn: { color: '#1D4ED8', fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', width: '100%', maxWidth: 400, borderRadius: 20, padding: 25, alignItems: 'center', elevation: 10 },
  closeBtn: { position: 'absolute', top: 10, right: 10 },
  modalBody: { width: '100%', alignItems: 'center' },
  modalAvatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F5F9', marginBottom: 15, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#2563EB' },
  modalName: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginBottom: 10 },
  modalDivider: { width: '100%', height: 1, backgroundColor: '#E2E8F0', marginBottom: 15 },
  modalInfoRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  modalLabel: { fontWeight: 'bold', color: '#64748B', fontSize: 14 },
  modalValue: { color: '#1E293B', fontSize: 14, flex: 1, textAlign: 'right', marginLeft: 10 }
});