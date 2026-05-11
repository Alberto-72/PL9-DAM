//Servidor Express que conecta la app mvil y la app web con Odoo
const express = require('express');
const cors = require('cors');
const Odoo = require('odoo-xmlrpc');

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

//Configuracion de conexion a Odoo
const odooConfig = {
    url: 'http://10.102.7.16',
    port: 8069,
    db: 'ControlAcceso',
    username: 'albertoroaf@gmail.com',
    password: 'AlberPabKil123'
};

//Mapeo de claves school_year (cortas) a nombre completo del curso.
//Se usa solo en /api/verificar-tarjeta (NFC), donde el frontend muestra el curso largo directamente.
//En /api/alumnos NO se transforma, se devuelven los datos crudos para que el frontend decida como mostrarlos.
const CURSOS = [
    ['1ESO', '1 Educacion Secundaria Obligatoria'],
    ['2ESO', '2 Educacion Secundaria Obligatoria'],
    ['3ESO', '3 Educacion Secundaria Obligatoria'],
    ['3ESODIV', '3 ESO - Diversificacion'],
    ['4ESO', '4 Educacion Secundaria Obligatoria'],
    ['4ESODIV', '4 ESO - Diversificacion'],
    ['1BACH_CIEN', '1 Bachillerato Ciencias y Tecnologia'],
    ['2BACH_CIEN', '2 Bachillerato Ciencias y Tecnologia'],
    ['1BACH_HCS', '1 Bachillerato Humanidades y C. Sociales'],
    ['2BACH_HCS', '2 Bachillerato Humanidades y C. Sociales'],
    ['1CFGB_AGR', '1 CFGB Aprovechamientos Forestales'],
    ['2CFGB_AGR', '2 CFGB Agrojardineria y Comp. Florales'],
    ['1CFGM_SMR', '1 CFGM Sistemas Microinformaticos y Redes'],
    ['2CFGM_SMR', '2 CFGM Sistemas Microinformaticos y Redes'],
    ['1CFGM_ACMN', '1 CFGM Aprovechamiento y Cons. Medio Natural'],
    ['2CFGM_ACMN', '2 CFGM Aprovechamiento y Cons. Medio Natural'],
    ['1DAM', '1 CFGS Desarrollo de Aplicaciones Multiplataforma'],
    ['2DAM', '2 CFGS Desarrollo de Aplicaciones Multiplataforma'],
    ['1CFGS_GFMN', '1 CFGS Gestion Forestal y del Medio Natural'],
    ['2CFGS_GFMN', '2 CFGS Gestion Forestal y del Medio Natural']
];

//Funcion auxiliar para traducir codigo corto de curso a nombre completo
function getCursoCompleto(key) {
    if (!key || key === false) return null;
    const found = CURSOS.find(([short]) => short === key);
    return found ? found[1] : key;
}

//Ruta de test, util para comprobar desde el navegador que el servidor responde
app.get('/', (req, res) => {
    res.send('Servidor Odoo funcionando correctamente.');
});

//Verificar tarjeta NFC: busca un alumno por UID y devuelve sus datos para mostrar en el scanner
app.post('/api/verificar-tarjeta', (req, res) => {
    const { tarjetaId } = req.body;
    console.log(`\nUID Recibido: ${tarjetaId} -> Consultando Odoo...`);

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ success: false, error: 'Fallo conexion Odoo' });
        }

        odoo.execute_kw(
            'gestion_entrada.alumno',
            'search_read',
            [
                [[['uid', 'ilike', tarjetaId]]],
                {
                    fields: ['name', 'surname', 'photo', 'school_year', 'birth_date', 'can_bus'],
                    limit: 1
                }
            ], (err, result) => {
                if (err) {
                    console.error('Error en busqueda Odoo:', err);
                    return res.status(500).json({ success: false, error: err });
                }

                if (result && result.length > 0) {
                    const alumno = result[0];
                    const nombreCompleto = `${alumno.name} ${alumno.surname}`;

                    //Aqui SI transformamos los campos porque el scanner los muestra directamente,
                    //no tiene un sistema de mapeo propio como StudentsListScreen
                    const cursoCorto = (alumno.school_year && alumno.school_year !== false) ? alumno.school_year : null;
                    const cursoLargo = getCursoCompleto(alumno.school_year);

                    console.log(`ALUMNO ENCONTRADO: ${nombreCompleto}`);

                    return res.json({
                        success: true,
                        nombre: nombreCompleto,
                        foto: alumno.photo || null,
                        curso: cursoCorto,
                        cursoCompleto: cursoLargo,
                        fechaNacimiento: alumno.birth_date,
                        tieneTransporte: alumno.can_bus || false
                    });
                } else {
                    console.log(`UID ${tarjetaId} no existe en la base de datos.`);
                    return res.json({
                        success: false,
                        message: "Tarjeta no registrada"
                    });
                }
            });
    });
});

// --- RUTA DE ALUMNOS (ARREGLADA) ---
app.get('/api/alumnos', (req, res) => {
    console.log('\nSolicitando lista de alumnos...');
    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false, error: 'Fallo conexion Odoo' });

        odoo.execute_kw(
            'gestion_entrada.alumno',
            'search_read',
            [
                [[]],
                { fields: ['uid', 'name', 'surname', 'photo', 'school_year', 'birth_date', 'can_bus', 'email'] }
            ], (err, result) => {
                if (err) return res.status(500).json({ success: false, error: err });

                console.log(`Total alumnos encontrados: ${result ? result.length : 0}`);
                
                // Enviamos el resultado crudo para que React pueda leer a.name, a.photo, etc.
                return res.json({ success: true, alumnos: result });
            });
    });
});

// --- RUTA DE PROFESORES (AÑADIDA) ---
app.get('/api/profesores', (req, res) => {
    console.log('\nSolicitando lista de profesores...');
    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false, error: 'Fallo conexion Odoo' });

        odoo.execute_kw(
            'gestion_entrada.profesor',
            'search_read',
            [
                [[]],
                { fields: ['uid', 'name', 'surname', 'email', 'photo', 'is_management'] }
            ], (err, result) => {
                if (err) return res.status(500).json({ success: false, error: err });

                console.log(`Total profesores encontrados: ${result ? result.length : 0}`);
                return res.json({ success: true, profesores: result });
            });
    });
});

//Listado de profesores: igual que alumnos, devuelve datos crudos. Endpoint integrado del server de Kilian.
app.get('/api/profesores', (req, res) => {
    console.log('\nSolicitando lista de profesores...');

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ success: false, error: 'Fallo conexion Odoo' });
        }

        odoo.execute_kw(
            'gestion_entrada.profesor',
            'search_read',
            [
                [[]],
                {
                    fields: ['uid', 'name', 'surname', 'email', 'photo']
                }
            ], (err, result) => {
                if (err) {
                    console.error('Error obteniendo profesores:', err);
                    return res.status(500).json({ success: false, error: err });
                }

                console.log(`Total profesores encontrados: ${(result || []).length}`);

                return res.json({
                    success: true,
                    profesores: result || []
                });
            });
    });
});

//Login: valida usuario y contrasea contra Odoo y devuelve los datos del usuario
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`\nIntento de login para usuario: ${username}`);

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false, message: 'Fallo conexión Odoo' });

        odoo.execute_kw(
            'gestion_entrada.profesor',
            'search_read',
            [
                [[['username', '=', username], ['user_pass', '=', password]]],
                { fields: ['name', 'surname', 'email', 'username', 'is_management'], limit: 1 }
            ], 
            (err, result) => {
                if (err) return res.status(500).json({ success: false, message: 'Error interno de búsqueda' });

                if (result && result.length > 0) {
                    const userData = result[0];
                    console.log(`LOGIN EXITOSO: ${userData.name} ${userData.surname}`);

                    return res.json({
                        success: true,
                        usuario: {
                            id: userData.id,
                            nombre: userData.name,
                            apellidos: userData.surname,
                            email: userData.email,
                            username: userData.username,
                            //TODO: por ahora usamos el id como token. En el futuro deberia ser un JWT real.
                            token: String(userData.id),
                            role: userData.is_management ? 'directiva' : 'profesor'
                        }
                    });
                } else {
                    return res.status(401).json({ success: false, message: "Usuario o contraseña no válidos" });
                }
            }
        );
    });
});

//Crear registro de entrada/salida en Odoo
app.post('/api/register', (req, res) => {
    const { uid, usr_type, mensajeEstado, dateTime } = req.body;
    
    if (!uid || !usr_type || !mensajeEstado) {
        return res.status(400).json({ success: false, message: "Faltan datos obligatorios" });
    }

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false, message: 'Fallo conexión Odoo' });

        odoo.execute_kw(
            'gestion_entrada.registro',
            'create',
            [[{ 'uid': uid, 'usr_type': usr_type, 'reg_type': mensajeEstado, 'dateTime': dateTime }]],
            (err, result) => {
                if (err) return res.status(500).json({ success: false, message: "Error al crear el registro" });
                return res.json({ success: true, id: result, message: "Registro creado" });
            }
        );
    });
});

// CHANGE PASSWORD 
app.post('/api/change-password', (req, res) => {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
        return res.status(400).json({ success: false, message: "Username y newPassword son obligatorios" });
    }

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false, message: 'Odoo connection failed' });

        odoo.execute_kw('gestion_entrada.profesor', 'search_read', [[[['username', '=', username]]], { fields: ['id'], limit: 1 }],
            (err, result) => {
                if (err || !result || result.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

                const userId = result[0].id;
                odoo.execute_kw('gestion_entrada.profesor', 'execute', ['UPDATE gestion_entrada_profesor SET user_pass = %s WHERE id = %s', [newPassword, userId]],
                    (err, result) => {
                        if (err) return res.status(500).json({ success: false, message: err.message });
                        return res.json({ success: true, message: 'Password updated successfully' });
                    }
                );
            }
        );
    });
});

//Datos de perfil de un usuario por username, usado en SettingsScreen
app.get('/api/user/:username', (req, res) => {
    const username = req.params.username;
    if (!username || username === 'null' || username === 'undefined') return res.status(400).json({ success: false, message: "Invalid username" });

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false, message: 'Odoo connection failed' });

        odoo.execute_kw('gestion_entrada.profesor', 'search_read', [[[['username', '=', username]]], { fields: ['name', 'surname', 'username', 'uid', 'is_management'], limit: 1 }],
            (err, result) => {
                if (err || !result || result.length === 0) return res.status(500).json({ success: false, message: 'User not found' });

                const userData = result[0];
                return res.json({
                    success: true,
                    user: {
                        nombre: userData.name,
                        apellidos: userData.surname,
                        username: userData.username,
                        uid: userData.uid || 'No vinculado',
                        rol: userData.is_management ? 'Directiva' : 'Profesor'
                    }
                });
            }
        );
    });
});

//KPIs y datos del grafico semanal para el dashboard de directiva
app.get('/api/dashboard', (req, res) => {
    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false, message: 'Fallo conexión Odoo' });

        //Total de alumnos: para calcular el porcentaje de asistencia media
        odoo.execute_kw('gestion_entrada.alumno', 'search_count', [[[]]], (err, totalAlumnos) => {
            if (err) return res.status(500).json({ success: false, message: 'Error contando alumnos' });

            const hoy = new Date();
            const haceUnaSemana = new Date();
            haceUnaSemana.setDate(hoy.getDate() - 7);
            const dateStr = haceUnaSemana.toISOString().split('T')[0] + ' 00:00:00';

            odoo.execute_kw('gestion_entrada.registro', 'search_read', [[[['dateTime', '>=', dateStr]]], { fields: ['dateTime', 'reg_type'] }], (err, records) => {
                if (err) return res.status(500).json({ success: false, message: 'Error obteniendo registros' });

                let asistenciaHoy = 0, incidenciasHoy = 0;
                const hoyStr = hoy.toISOString().split('T')[0];
                const chartDataMap = {
                    1: { day: 'L', justificadas: 0, injustificadas: 0, otras: 0 },
                    2: { day: 'M', justificadas: 0, injustificadas: 0, otras: 0 },
                    3: { day: 'X', justificadas: 0, injustificadas: 0, otras: 0 },
                    4: { day: 'J', justificadas: 0, injustificadas: 0, otras: 0 },
                    5: { day: 'V', justificadas: 0, injustificadas: 0, otras: 0 },
                };

                records.forEach(record => {
                    if (!record.dateTime) return;
                    const recordDate = new Date(record.dateTime.replace(' ', 'T') + 'Z');
                    const recordDateStr = recordDate.toISOString().split('T')[0];
                    const diaSemana = recordDate.getDay(); 

                    //KPIs de hoy
                    if (recordDateStr === hoyStr) {
                        if (record.reg_type === 'entrada_puntual') asistenciaHoy++;
                        if (['error', 'no_autorizado'].includes(record.reg_type)) incidenciasHoy++;
                    }

                    //Acumulado semanal para el grafico (solo L-V)
                    if (diaSemana >= 1 && diaSemana <= 5 && recordDate >= haceUnaSemana) {
                        const dayData = chartDataMap[diaSemana];
                        if (['salida_autorizada_anticipada', 'autorizado'].includes(record.reg_type)) dayData.justificadas++;
                        else if (['anticipada', 'salida_antes_8'].includes(record.reg_type)) dayData.injustificadas++;
                        else if (['transporte', 'recreo'].includes(record.reg_type)) dayData.otras++;
                    }
                });

                let asistenciaMedia = totalAlumnos > 0 ? Math.min(Math.round((asistenciaHoy / totalAlumnos) * 100), 100) : 0;

                const chartData = [1, 2, 3, 4, 5].map(dayIndex => ({
                    day: chartDataMap[dayIndex].day,
                    segments: [
                        { value: chartDataMap[dayIndex].justificadas * 5, color: '#3B82F6' },
                        { value: chartDataMap[dayIndex].injustificadas * 5, color: '#EF4444' },
                        { value: chartDataMap[dayIndex].otras * 5, color: '#10B981' }
                    ]
                }));

                res.json({ success: true, kpis: { asistenciaHoy, incidenciasHoy, asistenciaMedia: `${asistenciaMedia}%` }, chartData });
            });
        });
    });
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server ready at port ${PORT}`);
});