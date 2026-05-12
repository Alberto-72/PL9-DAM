//Servidor Express que conecta la app movil y la app web con Odoo.
//Centraliza todas las operaciones contra Odoo en endpoints REST.

const express = require('express');
const cors = require('cors');
const Odoo = require('odoo-xmlrpc');
const multer = require('multer');     //Para subida de archivos (importacion CSV)
const csv = require('csv-parser');    //Para parseo de CSV
const fs = require('fs');

const app = express();

//CORS con cabeceras explicitas. Necesario para que la app web pueda llamar a este servidor
//desde otro origen sin que el navegador bloquee la peticion por la politica de same-origin.
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

//Limite de 50mb porque algunas fotos en base64 pueden ser grandes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

//Multer guarda los archivos subidos temporalmente en uploads/ antes de procesarlos
const upload = multer({ dest: 'uploads/' });

//Configuracion de conexion a Odoo. Si cambia la IP de Odoo, se cambia aqui.
const odooConfig = {
    url: 'http://10.102.7.16',
    port: 8069,
    db: 'ControlAcceso',
    username: 'albertoroaf@gmail.com',
    password: 'AlberPabKil123'
};

//Mapeo de claves school_year (cortas) a nombre completo del curso.
//Se usa solo en /api/verificar-tarjeta (scanner NFC), donde el frontend muestra el curso largo directamente.
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

//Funcion auxiliar para arreglar fechas de CSV (de DD/MM/AAAA a AAAA-MM-DD)
//Odoo espera el formato ISO, asi que convertimos antes de enviar
const formatCSVDate = (dateStr) => {
    if (!dateStr || !dateStr.includes('/')) return dateStr;
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
};

//Ruta de test, util para comprobar desde el navegador que el servidor responde
app.get('/', (req, res) => {
    res.send('<h1>Servidor Node Activo</h1><p>Conectado a Odoo en 10.102.7.16</p>');
});

//============================================
//LOGIN
//============================================

//Valida usuario y contrasea contra Odoo y devuelve los datos del usuario.
//Incluye token, username y email (necesarios para la app movil).
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`\nIntento de login para usuario: ${username}`);

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo en Login:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexion Odoo' });
        }

        odoo.execute_kw(
            'gestion_entrada.profesor',
            'search_read',
            [
                [[['username', '=', username.trim()], ['user_pass', '=', password.trim()]]],
                {
                    fields: ['name', 'surname', 'email', 'username', 'is_management'],
                    limit: 1
                }
            ],
            (err, result) => {
                if (err) {
                    console.error('Error en busqueda de login en Odoo:', err);
                    return res.status(500).json({ success: false, message: 'Error interno de busqueda' });
                }

                if (result && result.length > 0) {
                    const userData = result[0];
                    console.log(`LOGIN EXITOSO: ${userData.name} ${userData.surname} (User: ${userData.username})`);

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
                    console.log(`LOGIN FALLIDO: Usuario o contrasea incorrectos (${username})`);
                    return res.status(401).json({
                        success: false,
                        message: "Usuario o contrasea no validos"
                    });
                }
            }
        );
    });
});

//============================================
//SCANNER NFC
//============================================

//Verificar tarjeta NFC: busca un alumno por UID y devuelve sus datos para mostrar en el scanner.
//Aqui SI transformamos los campos porque el scanner los muestra directamente.
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
            ],
            (err, result) => {
                if (err) {
                    console.error('Error en busqueda Odoo:', err);
                    return res.status(500).json({ success: false, error: err });
                }

                if (result && result.length > 0) {
                    const alumno = result[0];
                    const nombreCompleto = `${alumno.name} ${alumno.surname}`;

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
            }
        );
    });
});

//Crear registro de entrada/salida en Odoo
app.post('/api/register', (req, res) => {
    const { uid, usr_type, mensajeEstado, dateTime } = req.body;
    console.log(uid, usr_type, mensajeEstado, dateTime);

    //Validacion de datos ANTES de conectar a Odoo (mas eficiente: si faltan datos, no abrimos conexion)
    if (!uid || !usr_type || !mensajeEstado) {
        console.log("ERROR en los datos pasados");
        return res.status(400).json({
            success: false,
            message: "Faltan datos obligatorios (uid, usr_type o mensajeEstado)"
        });
    }

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo en Register:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexion Odoo' });
        }

        odoo.execute_kw(
            'gestion_entrada.registro',
            'create',
            [[{
                'uid': uid,
                'usr_type': usr_type,
                'reg_type': mensajeEstado,
                'dateTime': dateTime
            }]],
            (err, result) => {
                if (err) {
                    console.error("Error creando registro:", err);
                    return res.status(500).json({
                        success: false,
                        message: "Error al crear el registro en Odoo"
                    });
                }
                console.log("Registro creado con el ID:", result);
                return res.json({
                    success: true,
                    id: result,
                    message: "Registro creado correctamente"
                });
            }
        );
    });
});

//============================================
//LISTADOS (datos crudos de Odoo)
//============================================

//Listado de alumnos: devuelve datos CRUDOS de Odoo (sin transformar) para que el frontend los formatee.
//Incluye birth_date y email (necesarios para la validacion de mayor de edad y muestra de email).
app.get('/api/alumnos', (req, res) => {
    console.log('\nSolicitando lista de alumnos...');

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
                [[]],
                {
                    fields: ['uid', 'name', 'surname', 'photo', 'school_year', 'birth_date', 'can_bus', 'email']
                }
            ],
            (err, result) => {
                if (err) {
                    console.error('Error obteniendo alumnos:', err);
                    return res.status(500).json({ success: false, error: err });
                }

                console.log(`Total alumnos encontrados: ${(result || []).length}`);

                return res.json({
                    success: true,
                    alumnos: result || []
                });
            }
        );
    });
});

//Listado de profesores: igual que alumnos, devuelve datos crudos.
//NOTA: NO incluimos 'photo' porque el campo NO existe en el modelo gestion_entrada.profesor.
//Pedirlo daba error 500 'Invalid field photo'.
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
                    fields: ['uid', 'name', 'surname', 'email']
                }
            ],
            (err, result) => {
                if (err) {
                    console.error('Error obteniendo profesores:', err);
                    return res.status(500).json({ success: false, error: err });
                }

                console.log(`Total profesores encontrados: ${(result || []).length}`);

                return res.json({
                    success: true,
                    profesores: result || []
                });
            }
        );
    });
});

//============================================
//CRUD ALUMNOS
//============================================

//Crear un alumno nuevo
app.post('/api/alumnos', (req, res) => {
    const { name, surname, school_year, can_bus, photo, birth_date, email } = req.body;
    console.log(`\nCreando alumno: ${name} ${surname}`);

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexion Odoo' });
        }

        odoo.execute_kw(
            'gestion_entrada.alumno',
            'create',
            [[{ name, surname, school_year, can_bus, photo, birth_date, email }]],
            (err, result) => {
                if (err) {
                    console.error('Error creando alumno:', err);
                    return res.status(500).json({ success: false, error: err });
                }
                console.log(`Alumno creado con ID: ${result}`);
                return res.json({ success: true, id: result });
            }
        );
    });
});

//Actualizar un alumno existente
app.put('/api/alumnos/:id', (req, res) => {
    const alumnoId = parseInt(req.params.id);
    console.log(`\nActualizando alumno ID: ${alumnoId}`);

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexion Odoo' });
        }

        odoo.execute_kw(
            'gestion_entrada.alumno',
            'write',
            [[[alumnoId], req.body]],
            (err, result) => {
                if (err) {
                    console.error('Error actualizando alumno:', err);
                    return res.status(500).json({ success: false, error: err });
                }
                console.log(`Alumno ${alumnoId} actualizado`);
                return res.json({ success: true });
            }
        );
    });
});

//Eliminar un alumno
app.delete('/api/alumnos/:id', (req, res) => {
    const alumnoId = parseInt(req.params.id);
    console.log(`\nEliminando alumno ID: ${alumnoId}`);

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexion Odoo' });
        }

        odoo.execute_kw(
            'gestion_entrada.alumno',
            'unlink',
            [[[alumnoId]]],
            (err, result) => {
                if (err) {
                    console.error('Error eliminando alumno:', err);
                    return res.status(500).json({ success: false });
                }
                console.log(`Alumno ${alumnoId} eliminado`);
                return res.json({ success: true });
            }
        );
    });
});

//============================================
//CRUD PROFESORES
//============================================

//Crear un profesor nuevo
app.post('/api/profesores', (req, res) => {
    console.log(`\nCreando profesor: ${req.body.name} ${req.body.surname}`);

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexion Odoo' });
        }

        odoo.execute_kw(
            'gestion_entrada.profesor',
            'create',
            [[req.body]],
            (err, result) => {
                if (err) {
                    console.error('Error creando profesor:', err);
                    return res.status(500).json({ success: false, error: err });
                }
                console.log(`Profesor creado con ID: ${result}`);
                return res.json({ success: true, id: result });
            }
        );
    });
});

//Actualizar un profesor existente
app.put('/api/profesores/:id', (req, res) => {
    const profId = parseInt(req.params.id);
    console.log(`\nActualizando profesor ID: ${profId}`);

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexion Odoo' });
        }

        odoo.execute_kw(
            'gestion_entrada.profesor',
            'write',
            [[[profId], req.body]],
            (err, result) => {
                if (err) {
                    console.error('Error actualizando profesor:', err);
                    return res.status(500).json({ success: false, error: err });
                }
                console.log(`Profesor ${profId} actualizado`);
                return res.json({ success: true });
            }
        );
    });
});

//Eliminar un profesor
app.delete('/api/profesores/:id', (req, res) => {
    const profId = parseInt(req.params.id);
    console.log(`\nEliminando profesor ID: ${profId}`);

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexion Odoo' });
        }

        odoo.execute_kw(
            'gestion_entrada.profesor',
            'unlink',
            [[[profId]]],
            (err, result) => {
                if (err) {
                    console.error('Error eliminando profesor:', err);
                    return res.status(500).json({ success: false });
                }
                console.log(`Profesor ${profId} eliminado`);
                return res.json({ success: true });
            }
        );
    });
});

//============================================
//HISTORICO DE REGISTROS POR USUARIO
//============================================

//Devuelve los registros de un usuario concreto (por su uid NFC), ordenados de mas reciente a mas antiguo
app.get('/api/registros/:uid', (req, res) => {
    const uid = req.params.uid;
    console.log(`\nSolicitando registros para uid: ${uid}`);

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexion Odoo' });
        }

        odoo.execute_kw(
            'gestion_entrada.registro',
            'search_read',
            [
                [[['uid', '=', uid]]],
                { fields: ['dateTime', 'reg_type', 'usr_type'], order: 'dateTime desc' }
            ],
            (err, result) => {
                if (err) {
                    console.error('Error obteniendo registros:', err);
                    return res.status(500).json({ success: false });
                }
                console.log(`Encontrados ${(result || []).length} registros para uid ${uid}`);
                return res.json({ success: true, registros: result || [] });
            }
        );
    });
});

//============================================
//CAMBIO DE CONTRASEA
//============================================

//Cambio de contrasea: se hace con SQL directo porque la libreria odoo-xmlrpc
//tiene problemas con la firma del metodo write() para campos de tipo password en este modelo.
app.post('/api/change-password', (req, res) => {
    const { username, newPassword } = req.body;
    console.log(`\nPeticion de cambio de contrasea para usuario: ${username}`);

    if (!username || !newPassword) {
        return res.status(400).json({ success: false, message: "Username y newPassword son obligatorios" });
    }

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error conectando a Odoo en change-password:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexion Odoo' });
        }

        //Buscamos primero el id del usuario
        odoo.execute_kw(
            'gestion_entrada.profesor',
            'search_read',
            [
                [[['username', '=', username]]],
                { fields: ['id'], limit: 1 }
            ],
            (err, result) => {
                if (err || !result || result.length === 0) {
                    console.error('Usuario no encontrado:', username);
                    return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
                }

                const userId = result[0].id;
                console.log(`Usuario encontrado (ID ${userId}), actualizando contrasea con SQL directo...`);

                //SQL directo: unica forma de evitar el error de firma XML-RPC con este campo
                odoo.execute_kw(
                    'gestion_entrada.profesor',
                    'execute',
                    ['UPDATE gestion_entrada_profesor SET user_pass = %s WHERE id = %s', [newPassword, userId]],
                    (err, result) => {
                        if (err) {
                            console.error('Error actualizando contrasea con SQL directo:', err);
                            return res.status(500).json({ success: false, message: err.message || 'Error al actualizar contrasea' });
                        }

                        console.log(`Contrasea actualizada correctamente para usuario: ${username} (ID: ${userId})`);
                        return res.json({ success: true, message: 'Contrasea actualizada correctamente' });
                    }
                );
            }
        );
    });
});

//============================================
//PERFIL DE USUARIO
//============================================

//Datos de perfil de un usuario por username, usado en SettingsScreen
app.get('/api/user/:username', (req, res) => {
    const username = req.params.username;

    console.log(`\nSolicitando datos de perfil para usuario: ${username}`);

    if (!username || username === 'null' || username === 'undefined') {
        return res.status(400).json({ success: false, message: "Username invalido" });
    }

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error conectando a Odoo:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexion Odoo' });
        }

        odoo.execute_kw(
            'gestion_entrada.profesor',
            'search_read',
            [
                [[['username', '=', username]]],
                {
                    fields: ['name', 'surname', 'username', 'uid', 'is_management'],
                    limit: 1
                }
            ],
            (err, result) => {
                if (err || !result || result.length === 0) {
                    console.error('Error o usuario no encontrado en Odoo:', err);
                    return res.status(500).json({ success: false, message: 'Usuario no encontrado' });
                }

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

//============================================
//DASHBOARD
//============================================

//KPIs y datos del grafico semanal para el dashboard de directiva
app.get('/api/dashboard', (req, res) => {
    console.log('\nSolicitando datos para el Dashboard...');
    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexion Odoo' });
        }

        //Total de alumnos: para calcular el porcentaje de asistencia media
        odoo.execute_kw('gestion_entrada.alumno', 'search_count', [[[]]], (err, totalAlumnos) => {
            if (err) return res.status(500).json({ success: false, message: 'Error contando alumnos' });

            const hoy = new Date();
            const haceUnaSemana = new Date();
            haceUnaSemana.setDate(hoy.getDate() - 7);

            const dateStr = haceUnaSemana.toISOString().split('T')[0] + ' 00:00:00';

            //Traemos todos los registros de la ultima semana
            odoo.execute_kw('gestion_entrada.registro', 'search_read', [
                [[['dateTime', '>=', dateStr]]],
                { fields: ['dateTime', 'reg_type'] }
            ], (err, records) => {
                if (err) return res.status(500).json({ success: false, message: 'Error obteniendo registros' });

                let asistenciaHoy = 0;
                let incidenciasHoy = 0;
                const hoyStr = hoy.toISOString().split('T')[0];

                //Estructura para acumular datos por dia de la semana (L-V)
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
                    const diaSemana = recordDate.getDay(); //0=Dom, 1=Lun, ..., 5=Vie

                    //KPIs de hoy
                    if (recordDateStr === hoyStr) {
                        if (record.reg_type === 'entrada_puntual') asistenciaHoy++;
                        if (['error', 'no_autorizado'].includes(record.reg_type)) incidenciasHoy++;
                    }

                    //Acumulado semanal para el grafico (solo L-V)
                    if (diaSemana >= 1 && diaSemana <= 5 && recordDate >= haceUnaSemana) {
                        const dayData = chartDataMap[diaSemana];

                        if (['salida_autorizada_anticipada', 'autorizado'].includes(record.reg_type)) {
                            dayData.justificadas++;
                        } else if (['anticipada', 'salida_antes_8'].includes(record.reg_type)) {
                            dayData.injustificadas++;
                        } else if (['transporte', 'recreo'].includes(record.reg_type)) {
                            dayData.otras++;
                        }
                    }
                });

                let asistenciaMedia = 0;
                if (totalAlumnos > 0) {
                    asistenciaMedia = Math.round((asistenciaHoy / totalAlumnos) * 100);
                    if (asistenciaMedia > 100) asistenciaMedia = 100;
                }

                //Multiplicamos por 5 para que las barras tengan altura visible en el grafico
                const chartData = [1, 2, 3, 4, 5].map(dayIndex => {
                    const d = chartDataMap[dayIndex];
                    return {
                        day: d.day,
                        segments: [
                            { value: d.justificadas * 5, color: '#3B82F6' },
                            { value: d.injustificadas * 5, color: '#EF4444' },
                            { value: d.otras * 5, color: '#10B981' }
                        ]
                    };
                });

                res.json({
                    success: true,
                    kpis: {
                        asistenciaHoy,
                        incidenciasHoy,
                        asistenciaMedia: `${asistenciaMedia}%`
                    },
                    chartData
                });
            });
        });
    });
});

//============================================
//IMPORTACION CSV
//============================================

//Importacion masiva de alumnos o profesores desde un archivo CSV.
//El archivo se sube por multipart/form-data con el campo 'archivo'.
//URL: POST /api/importar-csv/alumnos  o  POST /api/importar-csv/profesores
app.post('/api/importar-csv/:tipo', upload.single('archivo'), (req, res) => {
    const tipo = req.params.tipo;
    const model = tipo === 'alumnos' ? 'gestion_entrada.alumno' : 'gestion_entrada.profesor';

    if (!req.file) return res.status(400).json({ success: false, message: "No se recibio archivo" });

    console.log(`\nImportando CSV de ${tipo} desde ${req.file.path}`);

    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            const odoo = new Odoo(odooConfig);
            odoo.connect(async (err) => {
                if (err) {
                    console.error('Error de conexion con Odoo en importacion CSV:', err);
                    return res.status(500).json({ success: false });
                }

                let exitos = 0;
                for (const fila of results) {
                    const datos = {
                        name: fila.name?.trim(),
                        surname: fila.surname?.trim(),
                        email: fila.email?.trim(),
                        school_year: fila.school_year?.trim(),
                        birth_date: formatCSVDate(fila.birth_date?.trim()),
                        can_bus: String(fila.can_bus).toLowerCase().includes('true')
                    };

                    //Esperamos cada insercion antes de pasar a la siguiente para no saturar Odoo
                    await new Promise(resolve => {
                        odoo.execute_kw(model, 'create', [[datos]], (err) => {
                            if (!err) exitos++;
                            resolve();
                        });
                    });
                }

                //Limpiamos el archivo temporal
                fs.unlinkSync(req.file.path);

                console.log(`Importacion completada: ${exitos} de ${results.length}`);
                res.json({ success: true, message: `Importados ${exitos} de ${results.length}` });
            });
        });
});

//============================================
//EXPORTACION CSV
//============================================

//Exporta todos los registros de accesos en formato CSV descargable.
//Devuelve un archivo control_accesos.csv con cabeceras de descarga.
app.get('/api/exportar-accesos', (req, res) => {
    console.log('\nSolicitando exportacion de accesos a CSV...');

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ error: "Fallo conexion" });
        }

        const domain = [];
        const options = {
            //Usamos los nombres de campos tal como estan en el modelo de Odoo
            fields: ['alumno_name', 'alumno_surname', 'profesor_name', 'profesor_surname', 'reg_type', 'dateTime', 'alumno_curso'],
            order: 'dateTime desc'
        };

        odoo.execute_kw('gestion_entrada.registro', 'search_read', [domain, options], (err, registros) => {
            if (err) {
                console.error("Error de Odoo en exportacion:", err);
                return res.status(500).json({ error: "Error de lectura", detalle: err.faultString || err });
            }

            if (!registros || registros.length === 0) {
                return res.status(404).json({ error: "No hay datos para exportar" });
            }

            //Construimos el CSV manualmente
            const encabezado = "Nombre,Apellidos,Tipo,Fecha y Hora,Curso,Responsable\n";
            const filas = registros.map(r => {
                //Si es un alumno, usamos sus campos; si es un profesor, los suyos
                const nombre = r.alumno_name || r.profesor_name || "N/A";
                const apellidos = r.alumno_surname || r.profesor_surname || "";
                const curso = r.alumno_curso || "Personal";
                const tipo = r.reg_type === 'in' ? 'Entrada' : 'Salida';

                return `"${nombre}","${apellidos}","${tipo}","${r.dateTime}","${curso}"`;
            }).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=control_accesos.csv');
            res.status(200).send(encabezado + filas);
        });
    });
});

//Servidor escuchando en el puerto 3001 en todas las interfaces de red
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor listo en http://localhost:${PORT}`);
});