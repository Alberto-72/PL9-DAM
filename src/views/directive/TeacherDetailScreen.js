import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Platform, Image } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

const API_URL = 'http://10.102.7.2:3001/api';

// Función para convertir de Odoo (AAAA-MM-DD) a la App (DD/MM/AAAA)
const formatoFechaParaApp = (fechaOdoo) => {
    if (!fechaOdoo) return '';
    const partes = fechaOdoo.split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return fechaOdoo;
};

// Función para convertir de la App (DD/MM/AAAA) a Odoo (AAAA-MM-DD)
const formatoFechaParaOdoo = (fechaApp) => {
    if (!fechaApp) return '';
    const partes = fechaApp.split('/');
    if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
    return fechaApp;
};

export default function TeacherDetailScreen({ route }) {
    const navigation = useNavigation();
    const { teacher } = route.params; 
    
    const isNew = teacher.isNew === true;

    const [name, setName] = useState(teacher.name || '');
    const [surname, setSurname] = useState(teacher.surname || '');
    const [email, setEmail] = useState(teacher.email && teacher.email !== false ? String(teacher.email) : '');
    const [username, setUsername] = useState(teacher.username && teacher.username !== false ? String(teacher.username) : '');
    
    // NUEVO: ESTADO DE LA FECHA
    const [birthDate, setBirthDate] = useState(formatoFechaParaApp(teacher.birth_date));
    
    const [photo, setPhoto] = useState(teacher.photo || null);
    const [password, setPassword] = useState(''); 
    
    const [loading, setLoading] = useState(false);
    const [registros, setRegistros] = useState([]);

    useEffect(() => {
        if (!isNew && teacher.uid) {
            cargarHistorial(teacher.uid);
        }
    }, []);

    const cargarHistorial = async (uid) => {
        try {
            const response = await fetch(`${API_URL}/registros/${uid}`);
            const data = await response.json();
            if (data.success) {
                setRegistros(data.registros);
            }
        } catch (error) {
            console.error("Error cargando historial:", error);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.3,
            base64: true, 
        });

        if (!result.canceled && result.assets[0].base64) {
            setPhoto(result.assets[0].base64);
        }
    };

    const handleSave = async () => {
        // VALIDACIÓN ACTUALIZADA CON LA FECHA
        if (!name.trim() || !surname.trim() || !photo || !email.trim() || !username.trim() || !birthDate.trim() || (isNew && !password.trim())) {
            const msjError = "Faltan campos obligatorios. Revisa Nombre, Apellidos, Usuario, Email, Fecha de Nacimiento y Foto.";
            if (Platform.OS === 'web') window.alert(`⚠️ ${msjError}`);
            else Alert.alert("Campos incompletos", msjError);
            return; 
        }

        const fechaParaOdoo = formatoFechaParaOdoo(birthDate.trim());

        setLoading(true);
        try {
            const url = isNew ? `${API_URL}/profesores` : `${API_URL}/profesores/${teacher.id}`;
            const method = isNew ? 'POST' : 'PUT';

            // Incluimos birth_date en el payload
            const payload = { 
                name, 
                surname, 
                email: email.trim(), 
                username: username.trim(),
                birth_date: fechaParaOdoo,
                photo 
            };
            
            if (password.trim() !== '') {
                payload.user_pass = password.trim();
            }

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            
            if (data.success) {
                const msjExito = isNew ? "Profesor creado correctamente" : "Datos actualizados correctamente";
                if (Platform.OS === 'web') window.alert(`Éxito: ${msjExito}`);
                else Alert.alert("Éxito", msjExito);
                
                navigation.goBack(); 
            } else {
                if (Platform.OS === 'web') window.alert("Error en la operación");
                else Alert.alert("Error", "No se pudo procesar la solicitud");
            }
        } catch (error) {
            if (Platform.OS === 'web') window.alert("Error de Red");
            else Alert.alert("Error de Red", "No se pudo conectar con el servidor");
        } finally {
            setLoading(false);
        }
    };

    const ejecutarBorrado = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/profesores/${teacher.id}`, { method: 'DELETE' });
            const data = await response.json();
            
            if (data.success) {
                if (Platform.OS === 'web') window.alert("Eliminado correctamente.");
                else Alert.alert("Eliminado", "El profesor ha sido borrado.");
                navigation.goBack(); 
            }
        } catch (error) {
            if (Platform.OS === 'web') window.alert("Error de Red");
            else Alert.alert("Error de Red", "No se pudo conectar con el servidor");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        const mensaje = `¿Estás seguro de que quieres eliminar a ${name}?`;
        if (Platform.OS === 'web') {
            if (window.confirm(`⚠️ Eliminar Profesor\n\n${mensaje}`)) ejecutarBorrado();
        } else {
            Alert.alert("⚠️ Eliminar Profesor", mensaje, [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: ejecutarBorrado }
            ]);
        }
    };

    const entradas = registros.filter(reg => String(reg.reg_type).toLowerCase().includes('entrada'));
    const salidas = registros.filter(reg => !String(reg.reg_type).toLowerCase().includes('entrada'));

    return (
        <ScrollView style={styles.container}>
            <View style={styles.formCard}>
                <Text style={styles.sectionTitle}>{isNew ? "Añadir Nuevo Profesor" : "Datos del Profesor"}</Text>

                <View style={styles.photoSection}>
                    <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
                        {photo ? (
                            <Image source={{ uri: `data:image/png;base64,${photo}` }} style={styles.profileImage} />
                        ) : (
                            <View style={styles.photoPlaceholder}>
                                <Ionicons name="camera-outline" size={40} color="#9CA3AF" />
                                <Text style={styles.photoText}>Añadir Foto *</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
                
                <Text style={styles.label}>Nombre <Text style={{color: '#EF4444'}}>*</Text></Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej: Alberto" />

                <Text style={styles.label}>Apellidos <Text style={{color: '#EF4444'}}>*</Text></Text>
                <TextInput style={styles.input} value={surname} onChangeText={setSurname} placeholder="Ej: Rodríguez" />

                <Text style={styles.label}>Nombre de Usuario (Login) <Text style={{color: '#EF4444'}}>*</Text></Text>
                <TextInput 
                    style={styles.input} 
                    value={username} 
                    onChangeText={setUsername} 
                    placeholder="Ej: arodriguez" 
                    autoCapitalize="none"
                />

                <Text style={styles.label}>Email <Text style={{color: '#EF4444'}}>*</Text></Text>
                <TextInput 
                    style={styles.input} 
                    value={email} 
                    onChangeText={setEmail} 
                    placeholder="Ej: profesor@colegio.com" 
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                {/* --- NUEVO CAMPO FECHA DE NACIMIENTO --- */}
                <Text style={styles.label}>Fecha de Nacimiento (DD/MM/AAAA) <Text style={{color: '#EF4444'}}>*</Text></Text>
                <TextInput 
                    style={styles.input} 
                    value={birthDate} 
                    onChangeText={setBirthDate} 
                    placeholder="Ej: 24/05/1980" 
                />

                <Text style={styles.label}>Contraseña {isNew ? <Text style={{color: '#EF4444'}}>*</Text> : <Text style={{color: '#9CA3AF', fontSize: 12}}>(Déjalo en blanco para no cambiarla)</Text>}</Text>
                <TextInput 
                    style={styles.input} 
                    value={password} 
                    onChangeText={setPassword} 
                    placeholder={isNew ? "Escribe la contraseña..." : "Escribe una nueva contraseña..."}
                    secureTextEntry={true} 
                />

                {loading ? (
                    <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 20 }}/>
                ) : (
                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                            <Feather name={isNew ? "plus-circle" : "save"} size={18} color="white" />
                            <Text style={styles.btnText}>{isNew ? "Crear Profesor" : "Guardar Cambios"}</Text>
                        </TouchableOpacity>

                        {!isNew && (
                            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                                <Feather name="trash-2" size={18} color="white" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            {!isNew && (
                <>
                    <Text style={[styles.sectionTitle, { marginLeft: 4, marginBottom: 12 }]}>Historial de Accesos</Text>
                    
                    {registros.length === 0 ? (
                        <Text style={styles.noData}>No hay registros para este profesor.</Text>
                    ) : (
                        <View style={{ paddingBottom: 40 }}>
                            <View style={styles.historyBlock}>
                                <View style={styles.headerEntradas}>
                                    <Ionicons name="enter-outline" size={22} color="#059669" />
                                    <Text style={styles.titleEntradas}>Entradas</Text>
                                </View>
                                {entradas.length === 0 ? (
                                    <Text style={styles.noDataMini}>No hay entradas registradas</Text>
                                ) : (
                                    entradas.map((reg, index) => (
                                        <View key={`in-${index}`} style={styles.historyRow}>
                                            <View style={styles.historyInfo}>
                                                <Text style={styles.historyDate}>{reg.dateTime}</Text>
                                                <Text style={styles.historyType}>{reg.reg_type.replace(/_/g, ' ').toUpperCase()}</Text>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>

                            <View style={styles.historyBlock}>
                                <View style={styles.headerSalidas}>
                                    <Ionicons name="exit-outline" size={22} color="#DC2626" />
                                    <Text style={styles.titleSalidas}>Salidas</Text>
                                </View>
                                {salidas.length === 0 ? (
                                    <Text style={styles.noDataMini}>No hay salidas registradas</Text>
                                ) : (
                                    salidas.map((reg, index) => (
                                        <View key={`out-${index}`} style={styles.historyRow}>
                                            <View style={styles.historyInfo}>
                                                <Text style={styles.historyDate}>{reg.dateTime}</Text>
                                                <Text style={styles.historyType}>{reg.reg_type.replace(/_/g, ' ').toUpperCase()}</Text>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        </View>
                    )}
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6', padding: 16 },
    formCard: { backgroundColor: 'white', padding: 20, borderRadius: 16, elevation: 2, marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 16 },
    photoSection: { alignItems: 'center', marginBottom: 20 },
    photoContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#D1D5DB', borderStyle: 'dashed' },
    profileImage: { width: '100%', height: '100%' },
    photoPlaceholder: { alignItems: 'center' },
    photoText: { fontSize: 12, color: '#9CA3AF', marginTop: 4, fontWeight: 'bold' },
    label: { fontSize: 14, fontWeight: '600', color: '#4B5563', marginBottom: 6, marginTop: 10 },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, color: '#1F2937', backgroundColor: '#F9FAFB' },
    actionButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    saveBtn: { flex: 1, backgroundColor: '#2563EB', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 14, borderRadius: 8, marginRight: 10 },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
    deleteBtn: { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', padding: 14, borderRadius: 8 },
    noData: { color: '#6B7280', fontStyle: 'italic', textAlign: 'center', marginTop: 10, marginBottom: 40 },
    noDataMini: { color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', marginVertical: 12, fontSize: 13 },
    historyBlock: { backgroundColor: 'white', padding: 16, borderRadius: 16, elevation: 2, marginBottom: 16 },
    headerEntradas: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#D1FAE5', paddingBottom: 10, marginBottom: 8 },
    titleEntradas: { fontSize: 16, fontWeight: 'bold', color: '#059669', marginLeft: 8 },
    headerSalidas: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#FEE2E2', paddingBottom: 10, marginBottom: 8 },
    titleSalidas: { fontSize: 16, fontWeight: 'bold', color: '#DC2626', marginLeft: 8 },
    historyRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    historyInfo: { marginLeft: 4 },
    historyDate: { fontSize: 14, fontWeight: 'bold', color: '#1F2937' },
    historyType: { fontSize: 12, color: '#6B7280', marginTop: 2 }
});