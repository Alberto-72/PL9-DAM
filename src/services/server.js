//Servidor Express que conecta la app mvil y la app web con Odoo
const express = require('express');
const cors = require('cors');
const Odoo = require('odoo-xmlrpc');
//Fuente unica de cursos. El mismo archivo lo usan ListScreen y StudentsListScreen.
const { MAPA_CURSOS, getNombreCurso } = require('./src/config/cursos');

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
                    const cursoLargo = getNombreCurso(alumno.school_year);

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
                        //BUG FIX: contar los 3 tipos de entrada (puntual, recreo, tardia)
                        //antes solo se contaba entrada_puntual, infracontando la asistencia real
                        if (['entrada_puntual', 'entrada_recreo', 'entrada_tardia'].includes(record.reg_type)) asistenciaHoy++;
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

//============================================
//REGISTROS PAGINADOS PARA EL DASHBOARD DE DIRECTIVA
//
//Devuelve los registros del modelo gestion_entrada.registro filtrados por:
//  - tipo: "entrada" o "salida" (mapea internamente a los reg_type de Odoo)
//  - fecha: YYYY-MM-DD, devuelve registros entre 00:00:00 y 23:59:59 de ese dia
//  - curso: codigo corto (1ESO, 1DAM...). Filtra solo los registros cuyo UID
//           pertenece a un alumno de ese curso. Si esta presente, los registros
//           de profesores no aparecen (los profesores no tienen curso).
//  - limit / offset: paginacion. Default limit=50.
//
//Devuelve tambien total para que el frontend sepa si quedan mas paginas.
//Enriquece cada registro con datos del alumno/profesor (nombre, apellidos, curso)
//haciendo una sola query agrupando los UIDs unicos de la pagina.
//============================================

//Mapeo de tipos logicos -> reg_type de Odoo
const REG_TYPES_ENTRADA = ['entrada_puntual', 'entrada_recreo', 'entrada_tardia'];
const REG_TYPES_SALIDA  = ['salida_antes_8', 'recreo', 'anticipada', 'transporte',
                           'autorizado', 'no_autorizado', 'salida_autorizada_anticipada', 'error'];

app.get('/api/registros-paginado', (req, res) => {
    const tipo   = String(req.query.tipo || '').toLowerCase();
    const fecha  = String(req.query.fecha || '').trim();
    const curso  = req.query.curso ? String(req.query.curso).trim() : null;
    const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    //Validacion
    if (!['entrada', 'salida'].includes(tipo)) {
        return res.status(400).json({ success: false, message: 'tipo debe ser entrada o salida' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return res.status(400).json({ success: false, message: 'fecha invalida, formato YYYY-MM-DD' });
    }

    const regTypes = tipo === 'entrada' ? REG_TYPES_ENTRADA : REG_TYPES_SALIDA;
    const fechaInicio = `${fecha} 00:00:00`;
    const fechaFin    = `${fecha} 23:59:59`;

    const odoo = new Odoo(odooConfig);
    odoo.connect((errConn) => {
        if (errConn) {
            console.error('Error de conexion con Odoo:', errConn);
            return res.status(500).json({ success: false, message: 'Fallo conexion Odoo' });
        }

        //PASO 1: si hay filtro de curso, primero obtenemos los UIDs de los alumnos
        //de ese curso. Si no hay filtro, saltamos directamente al PASO 2.
        const obtenerUidsCurso = (callback) => {
            if (!curso) return callback(null, null); //null = sin restriccion de UIDs

            odoo.execute_kw(
                'gestion_entrada.alumno',
                'search_read',
                [[[['school_year', '=', curso]]], { fields: ['uid'] }],
                (err, alumnos) => {
                    if (err) return callback(err);
                    //Extraemos UIDs validos (descartamos los false/null/vacio)
                    const uids = (alumnos || [])
                        .map(a => a.uid)
                        .filter(u => u && u !== false);
                    callback(null, uids);
                }
            );
        };

        obtenerUidsCurso((errUids, uidsCurso) => {
            if (errUids) {
                console.error('Error obteniendo UIDs del curso:', errUids);
                return res.status(500).json({ success: false, message: 'Error filtrando por curso' });
            }

            //Si el filtro de curso no devuelve ningun UID, no hay registros que mostrar.
            //Devolvemos respuesta vacia rapida sin hacer mas queries.
            if (uidsCurso !== null && uidsCurso.length === 0) {
                return res.json({ success: true, registros: [], total: 0, offset, limit });
            }

            //PASO 2: construir el dominio de busqueda de registros
            //Odoo usa notacion polaca prefija para AND/OR. Por defecto los criterios se
            //combinan con AND, asi que no necesitamos operadores explicitos.
            const domain = [
                ['dateTime', '>=', fechaInicio],
                ['dateTime', '<=', fechaFin],
                ['reg_type', 'in', regTypes],
            ];
            if (uidsCurso !== null) {
                domain.push(['uid', 'in', uidsCurso]);
            }

            //PASO 3: contar total para saber si quedan mas paginas
            odoo.execute_kw(
                'gestion_entrada.registro',
                'search_count',
                [domain],
                (errCount, total) => {
                    if (errCount) {
                        console.error('Error contando registros:', errCount);
                        return res.status(500).json({ success: false, message: 'Error contando registros' });
                    }

                    //PASO 4: leer la pagina actual ordenada por fecha descendente
                    odoo.execute_kw(
                        'gestion_entrada.registro',
                        'search_read',
                        [
                            [domain],
                            {
                                fields: ['uid', 'usr_type', 'reg_type', 'dateTime'],
                                order: 'dateTime desc',
                                limit,
                                offset,
                            }
                        ],
                        (errReg, registros) => {
                            if (errReg) {
                                console.error('Error leyendo registros:', errReg);
                                return res.status(500).json({ success: false, message: 'Error leyendo registros' });
                            }

                            registros = registros || [];

                            //PASO 5: enriquecer con datos del alumno/profesor
                            //Sacamos UIDs unicos de los registros para hacer 2 queries
                            //(una a alumno, otra a profesor) en vez de una por registro.
                            const uidsAlumno   = [...new Set(registros.filter(r => r.usr_type === 'alumno').map(r => r.uid).filter(Boolean))];
                            const uidsProfesor = [...new Set(registros.filter(r => r.usr_type === 'profesor').map(r => r.uid).filter(Boolean))];

                            const queries = [];

                            if (uidsAlumno.length > 0) {
                                queries.push(new Promise((resolve) => {
                                    odoo.execute_kw(
                                        'gestion_entrada.alumno',
                                        'search_read',
                                        [[[['uid', 'in', uidsAlumno]]], { fields: ['uid', 'name', 'surname', 'school_year', 'photo'] }],
                                        (e, r) => resolve(e ? [] : (r || []))
                                    );
                                }));
                            } else {
                                queries.push(Promise.resolve([]));
                            }

                            if (uidsProfesor.length > 0) {
                                queries.push(new Promise((resolve) => {
                                    odoo.execute_kw(
                                        'gestion_entrada.profesor',
                                        'search_read',
                                        [[[['uid', 'in', uidsProfesor]]], { fields: ['uid', 'name', 'surname', 'photo'] }],
                                        (e, r) => resolve(e ? [] : (r || []))
                                    );
                                }));
                            } else {
                                queries.push(Promise.resolve([]));
                            }

                            Promise.all(queries).then(([alumnos, profesores]) => {
                                //Indexamos por UID para lookup rapido
                                const indiceAlumnos = {};
                                alumnos.forEach(a => { indiceAlumnos[a.uid] = a; });
                                const indiceProfesores = {};
                                profesores.forEach(p => { indiceProfesores[p.uid] = p; });

                                //Componemos la respuesta final
                                const enriquecidos = registros.map(r => {
                                    const persona = r.usr_type === 'alumno'
                                        ? indiceAlumnos[r.uid]
                                        : indiceProfesores[r.uid];

                                    return {
                                        id: r.id,
                                        uid: r.uid,
                                        usr_type: r.usr_type,
                                        reg_type: r.reg_type,
                                        dateTime: r.dateTime,
                                        //Datos de la persona (null si el UID no existe en alumnos/profesores)
                                        nombre:      persona ? `${persona.name || ''} ${persona.surname || ''}`.trim() : 'Desconocido',
                                        curso:       (persona && persona.school_year) ? persona.school_year : null,
                                        cursoLargo:  (persona && persona.school_year) ? getNombreCurso(persona.school_year) : null,
                                        photo:       persona ? (persona.photo || null) : null,
                                    };
                                });

                                return res.json({
                                    success: true,
                                    registros: enriquecidos,
                                    total,
                                    offset,
                                    limit,
                                });
                            });
                        }
                    );
                }
            );
        });
    });
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server ready at port ${PORT}`);
});