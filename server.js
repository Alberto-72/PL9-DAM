//Servidor Express que conecta la app movil y la app web con Odoo
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csvParser = require('csv-parser');
const { Readable } = require('stream');
const Odoo = require('odoo-xmlrpc');

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
//Aumentamos limite porque las fotos en base64 pueden ser pesadas
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

//Multer en memoria para procesar CSV sin guardarlos en disco
const upload = multer({ storage: multer.memoryStorage() });

//Configuracion de conexion a Odoo
const odooConfig = {
    url: 'http://10.102.7.16',
    port: 8069,
    db: 'ControlAcceso',
    username: 'albertoroaf@gmail.com',
    password: 'AlberPabKil123'
};

//Mapeo de claves school_year (cortas) a nombre completo del curso.
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

function getCursoCompleto(key) {
    if (!key || key === false) return null;
    const found = CURSOS.find(([short]) => short === key);
    return found ? found[1] : key;
}

//============================================
//HELPER: ejecutar metodo de Odoo
//
//El cliente odoo-xmlrpc usa callbacks. Lo envolvemos en una promesa para usar
//async/await y manejar errores con try/catch en los endpoints.
//Asi se evita el "callback hell" y se centraliza el manejo de la conexion.
//============================================
function odooExec(model, method, args, kwargs = {}) {
    return new Promise((resolve, reject) => {
        const odoo = new Odoo(odooConfig);
        odoo.connect((errConn) => {
            if (errConn) return reject(new Error('Fallo conexion Odoo: ' + errConn.message));

            //La libreria espera [domain_o_ids, kwargs_o_values]
            //Para search_read: args = [domain, fields_kwargs]
            //Para create/write/unlink: args = [values_o_ids]
            const fullArgs = kwargs && Object.keys(kwargs).length > 0
                ? [args, kwargs]
                : [args];

            odoo.execute_kw(model, method, fullArgs, (err, result) => {
                if (err) return reject(new Error(`Error Odoo (${model}.${method}): ` + (err.message || err)));
                resolve(result);
            });
        });
    });
}

//Helper para responder errores de forma consistente
function sendError(res, status, message, extra = {}) {
    console.error(`[ERROR ${status}] ${message}`);
    return res.status(status).json({ success: false, message, ...extra });
}

//Ruta de test
app.get('/', (req, res) => {
    res.send('Servidor Odoo funcionando correctamente.');
});

//============================================
//VERIFICAR TARJETA NFC
//============================================
app.post('/api/verificar-tarjeta', async (req, res) => {
    const { tarjetaId } = req.body;
    if (!tarjetaId) return sendError(res, 400, 'Falta tarjetaId');

    console.log(`\nUID Recibido: ${tarjetaId} -> Consultando Odoo...`);

    try {
        const result = await odooExec(
            'gestion_entrada.alumno',
            'search_read',
            [[['uid', 'ilike', tarjetaId]]],
            { fields: ['name', 'surname', 'photo', 'school_year', 'birth_date', 'can_bus'], limit: 1 }
        );

        if (result && result.length > 0) {
            const alumno = result[0];
            const nombreCompleto = `${alumno.name} ${alumno.surname || ''}`.trim();
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
        }

        console.log(`UID ${tarjetaId} no existe en la base de datos.`);
        return res.json({ success: false, message: 'Tarjeta no registrada' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//============================================
//ALUMNOS - CRUD COMPLETO
//============================================

//Listar
app.get('/api/alumnos', async (req, res) => {
    console.log('\nSolicitando lista de alumnos...');
    try {
        const result = await odooExec(
            'gestion_entrada.alumno',
            'search_read',
            [[]],
            { fields: ['uid', 'name', 'surname', 'photo', 'school_year', 'birth_date', 'can_bus', 'email'] }
        );
        console.log(`Total alumnos encontrados: ${result ? result.length : 0}`);
        return res.json({ success: true, alumnos: result || [] });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//Crear
app.post('/api/alumnos', async (req, res) => {
    const { name, surname, school_year, email, can_bus, photo, birth_date, uid } = req.body;
    if (!name || !surname) return sendError(res, 400, 'Nombre y apellidos son obligatorios');

    try {
        //Construimos el objeto de campos. Solo incluimos los que vienen definidos.
        const values = { name, surname };
        if (school_year !== undefined) values.school_year = school_year;
        if (email !== undefined) values.email = email;
        if (can_bus !== undefined) values.can_bus = can_bus;
        if (photo !== undefined) values.photo = photo;
        if (birth_date !== undefined) values.birth_date = birth_date;
        if (uid !== undefined) values.uid = uid;

        const newId = await odooExec('gestion_entrada.alumno', 'create', [values]);
        console.log(`Alumno creado con id: ${newId}`);
        return res.json({ success: true, id: newId, message: 'Alumno creado' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//Actualizar
app.put('/api/alumnos/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return sendError(res, 400, 'ID invalido');

    try {
        //Filtramos campos undefined para no sobrescribir con valores vacios
        const allowed = ['name', 'surname', 'school_year', 'email', 'can_bus', 'photo', 'birth_date', 'uid'];
        const values = {};
        for (const k of allowed) {
            if (req.body[k] !== undefined) values[k] = req.body[k];
        }

        if (Object.keys(values).length === 0) return sendError(res, 400, 'No hay campos para actualizar');

        await odooExec('gestion_entrada.alumno', 'write', [[id], values]);
        console.log(`Alumno ${id} actualizado`);
        return res.json({ success: true, message: 'Alumno actualizado' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//Eliminar
app.delete('/api/alumnos/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return sendError(res, 400, 'ID invalido');

    try {
        await odooExec('gestion_entrada.alumno', 'unlink', [[id]]);
        console.log(`Alumno ${id} eliminado`);
        return res.json({ success: true, message: 'Alumno eliminado' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//============================================
//PROFESORES - CRUD COMPLETO
//============================================

app.get('/api/profesores', async (req, res) => {
    console.log('\nSolicitando lista de profesores...');
    try {
        const result = await odooExec(
            'gestion_entrada.profesor',
            'search_read',
            [[]],
            { fields: ['uid', 'name', 'surname', 'email', 'photo', 'is_management', 'username', 'birth_date'] }
        );
        console.log(`Total profesores encontrados: ${result ? result.length : 0}`);
        return res.json({ success: true, profesores: result || [] });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

app.post('/api/profesores', async (req, res) => {
    const { name, surname, email, username, birth_date, photo, user_pass, uid, is_management } = req.body;
    if (!name || !surname || !username) return sendError(res, 400, 'Nombre, apellidos y username son obligatorios');

    try {
        const values = { name, surname, username };
        if (email !== undefined) values.email = email;
        if (birth_date !== undefined) values.birth_date = birth_date;
        if (photo !== undefined) values.photo = photo;
        if (user_pass !== undefined) values.user_pass = user_pass;
        if (uid !== undefined) values.uid = uid;
        if (is_management !== undefined) values.is_management = is_management;

        const newId = await odooExec('gestion_entrada.profesor', 'create', [values]);
        console.log(`Profesor creado con id: ${newId}`);
        return res.json({ success: true, id: newId, message: 'Profesor creado' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

app.put('/api/profesores/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return sendError(res, 400, 'ID invalido');

    try {
        const allowed = ['name', 'surname', 'email', 'username', 'birth_date', 'photo', 'user_pass', 'uid', 'is_management'];
        const values = {};
        for (const k of allowed) {
            if (req.body[k] !== undefined) values[k] = req.body[k];
        }

        if (Object.keys(values).length === 0) return sendError(res, 400, 'No hay campos para actualizar');

        await odooExec('gestion_entrada.profesor', 'write', [[id], values]);
        console.log(`Profesor ${id} actualizado`);
        return res.json({ success: true, message: 'Profesor actualizado' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

app.delete('/api/profesores/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return sendError(res, 400, 'ID invalido');

    try {
        await odooExec('gestion_entrada.profesor', 'unlink', [[id]]);
        console.log(`Profesor ${id} eliminado`);
        return res.json({ success: true, message: 'Profesor eliminado' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//============================================
//LOGIN
//============================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return sendError(res, 400, 'Faltan credenciales');

    console.log(`\nIntento de login para usuario: ${username}`);

    try {
        const result = await odooExec(
            'gestion_entrada.profesor',
            'search_read',
            [[['username', '=', username], ['user_pass', '=', password]]],
            { fields: ['id', 'name', 'surname', 'email', 'username', 'is_management'], limit: 1 }
        );

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
        }

        //401 con success:false para que el frontend distinga credenciales malas de error de red
        return res.status(401).json({ success: false, message: 'Usuario o contraseña no válidos' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//============================================
//REGISTRO DE ENTRADA/SALIDA
//============================================
app.post('/api/register', async (req, res) => {
    const { uid, usr_type, mensajeEstado, dateTime } = req.body;
    if (!uid || !usr_type || !mensajeEstado) return sendError(res, 400, 'Faltan datos obligatorios');

    try {
        const values = {
            uid,
            usr_type,
            reg_type: mensajeEstado,
            dateTime: dateTime || new Date().toISOString().replace('T', ' ').substring(0, 19)
        };

        const newId = await odooExec('gestion_entrada.registro', 'create', [values]);
        return res.json({ success: true, id: newId, message: 'Registro creado' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//Historial de registros por UID (usado en StudentDetailScreen y TeacherDetailScreen)
app.get('/api/registros/:uid', async (req, res) => {
    const uid = req.params.uid;
    if (!uid) return sendError(res, 400, 'Falta uid');

    try {
        const result = await odooExec(
            'gestion_entrada.registro',
            'search_read',
            [[['uid', '=', uid]]],
            { fields: ['uid', 'usr_type', 'reg_type', 'dateTime'], order: 'dateTime desc', limit: 100 }
        );
        return res.json({ success: true, registros: result || [] });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//============================================
//CAMBIO DE CONTRASEÑA
//
//Bug del codigo anterior: usaba execute_kw(model, 'execute', ['UPDATE ... SQL'])
//eso no es una llamada Odoo valida. 'execute' no es un metodo de modelo, y XML-RPC
//no acepta SQL crudo. Se sustituye por 'write', que es la forma correcta de
//actualizar campos en Odoo.
//============================================
app.post('/api/change-password', async (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) return sendError(res, 400, 'Username y newPassword son obligatorios');

    try {
        //1. Buscar el id del usuario
        const found = await odooExec(
            'gestion_entrada.profesor',
            'search_read',
            [[['username', '=', username]]],
            { fields: ['id'], limit: 1 }
        );

        if (!found || found.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

        //2. Actualizar el campo user_pass via write()
        const userId = found[0].id;
        await odooExec('gestion_entrada.profesor', 'write', [[userId], { user_pass: newPassword }]);

        console.log(`Contraseña actualizada para ${username}`);
        return res.json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//============================================
//PERFIL DE USUARIO
//============================================
app.get('/api/user/:username', async (req, res) => {
    const username = req.params.username;
    if (!username || username === 'null' || username === 'undefined') {
        return sendError(res, 400, 'Username invalido');
    }

    try {
        const result = await odooExec(
            'gestion_entrada.profesor',
            'search_read',
            [[['username', '=', username]]],
            { fields: ['name', 'surname', 'username', 'uid', 'is_management'], limit: 1 }
        );

        if (!result || result.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

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
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//============================================
//IMPORTACION CSV (alumnos | profesores)
//
//El frontend (ListScreen) sube un FormData con el archivo bajo el campo 'archivo'.
//Lo parseamos con csv-parser y creamos los registros uno a uno.
//Devuelve un resumen con cuantos se han creado, cuantos han fallado, y errores.
//============================================
app.post('/api/importar-csv/:tipo', upload.single('archivo'), async (req, res) => {
    const tipo = req.params.tipo;
    if (!['alumnos', 'profesores'].includes(tipo)) {
        return sendError(res, 400, 'Tipo invalido. Debe ser alumnos o profesores');
    }
    if (!req.file) return sendError(res, 400, 'No se ha recibido el archivo');

    const model = tipo === 'alumnos' ? 'gestion_entrada.alumno' : 'gestion_entrada.profesor';

    //Parseamos el buffer del CSV en memoria
    const filas = await new Promise((resolve, reject) => {
        const resultados = [];
        Readable.from(req.file.buffer)
            .pipe(csvParser())
            .on('data', (data) => resultados.push(data))
            .on('end', () => resolve(resultados))
            .on('error', reject);
    }).catch((err) => {
        console.error('Error parseando CSV:', err.message);
        return null;
    });

    if (filas === null) return sendError(res, 400, 'CSV mal formado');

    //Campos validos por tipo (filtramos columnas raras del CSV)
    const camposValidos = tipo === 'alumnos'
        ? ['name', 'surname', 'school_year', 'email', 'can_bus', 'photo', 'birth_date', 'uid']
        : ['name', 'surname', 'email', 'username', 'birth_date', 'photo', 'user_pass', 'uid', 'is_management'];

    let creados = 0, errores = 0;
    const detallesErrores = [];

    for (let i = 0; i < filas.length; i++) {
        const fila = filas[i];

        //Filtramos solo los campos validos del modelo
        const values = {};
        for (const k of camposValidos) {
            if (fila[k] !== undefined && fila[k] !== '') {
                //can_bus e is_management vienen como string en CSV; los convertimos a bool
                if (k === 'can_bus' || k === 'is_management') {
                    values[k] = ['true', '1', 'si', 'sí', 'yes'].includes(String(fila[k]).toLowerCase().trim());
                } else {
                    values[k] = fila[k];
                }
            }
        }

        //Validacion minima: name y surname
        if (!values.name || !values.surname) {
            errores++;
            detallesErrores.push(`Fila ${i + 2}: name y surname obligatorios`);
            continue;
        }

        try {
            await odooExec(model, 'create', [values]);
            creados++;
        } catch (err) {
            errores++;
            detallesErrores.push(`Fila ${i + 2}: ${err.message}`);
        }
    }

    return res.json({
        success: true,
        message: `Creados: ${creados}, Errores: ${errores}`,
        creados,
        errores,
        detalles: detallesErrores.slice(0, 20) //limitamos para no inundar la respuesta
    });
});

//============================================
//EXPORTACION CSV DE ACCESOS
//
//Devuelve directamente un archivo CSV (Content-Disposition: attachment).
//El frontend abre la URL en navegador y se descarga sola.
//============================================
app.get('/api/exportar-accesos', async (req, res) => {
    try {
        const registros = await odooExec(
            'gestion_entrada.registro',
            'search_read',
            [[]],
            { fields: ['uid', 'usr_type', 'reg_type', 'dateTime'], order: 'dateTime desc', limit: 10000 }
        );

        //Construimos el CSV manualmente para no anadir otra dependencia
        const cabecera = 'uid,usr_type,reg_type,dateTime\n';
        const cuerpo = (registros || []).map(r => {
            //Escapamos comas y comillas en cada campo
            const escapar = (v) => {
                if (v === null || v === undefined || v === false) return '';
                const s = String(v);
                return s.includes(',') || s.includes('"') || s.includes('\n')
                    ? `"${s.replace(/"/g, '""')}"`
                    : s;
            };
            return [escapar(r.uid), escapar(r.usr_type), escapar(r.reg_type), escapar(r.dateTime)].join(',');
        }).join('\n');

        const fechaArchivo = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="accesos_${fechaArchivo}.csv"`);
        //BOM al inicio para que Excel detecte UTF-8 correctamente
        res.send('\uFEFF' + cabecera + cuerpo);
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//============================================
//DASHBOARD: KPIs y datos del grafico semanal
//============================================
app.get('/api/dashboard', async (req, res) => {
    try {
        const totalAlumnos = await odooExec('gestion_entrada.alumno', 'search_count', [[]]);

        const hoy = new Date();
        const haceUnaSemana = new Date();
        haceUnaSemana.setDate(hoy.getDate() - 7);
        const dateStr = haceUnaSemana.toISOString().split('T')[0] + ' 00:00:00';

        const records = await odooExec(
            'gestion_entrada.registro',
            'search_read',
            [[['dateTime', '>=', dateStr]]],
            { fields: ['dateTime', 'reg_type'] }
        );

        let asistenciaHoy = 0, incidenciasHoy = 0;
        const hoyStr = hoy.toISOString().split('T')[0];
        const chartDataMap = {
            1: { day: 'L', justificadas: 0, injustificadas: 0, otras: 0 },
            2: { day: 'M', justificadas: 0, injustificadas: 0, otras: 0 },
            3: { day: 'X', justificadas: 0, injustificadas: 0, otras: 0 },
            4: { day: 'J', justificadas: 0, injustificadas: 0, otras: 0 },
            5: { day: 'V', justificadas: 0, injustificadas: 0, otras: 0 },
        };

        (records || []).forEach(record => {
            if (!record.dateTime) return;
            const recordDate = new Date(record.dateTime.replace(' ', 'T') + 'Z');
            const recordDateStr = recordDate.toISOString().split('T')[0];
            const diaSemana = recordDate.getDay();

            if (recordDateStr === hoyStr) {
                if (record.reg_type === 'entrada_puntual') asistenciaHoy++;
                if (['error', 'no_autorizado'].includes(record.reg_type)) incidenciasHoy++;
            }

            if (diaSemana >= 1 && diaSemana <= 5 && recordDate >= haceUnaSemana) {
                const dayData = chartDataMap[diaSemana];
                if (['salida_autorizada_anticipada', 'autorizado'].includes(record.reg_type)) dayData.justificadas++;
                else if (['anticipada', 'salida_antes_8'].includes(record.reg_type)) dayData.injustificadas++;
                else if (['transporte', 'recreo'].includes(record.reg_type)) dayData.otras++;
            }
        });

        const asistenciaMedia = totalAlumnos > 0
            ? Math.min(Math.round((asistenciaHoy / totalAlumnos) * 100), 100)
            : 0;

        const chartData = [1, 2, 3, 4, 5].map(dayIndex => ({
            day: chartDataMap[dayIndex].day,
            segments: [
                { value: chartDataMap[dayIndex].justificadas * 5, color: '#3B82F6' },
                { value: chartDataMap[dayIndex].injustificadas * 5, color: '#EF4444' },
                { value: chartDataMap[dayIndex].otras * 5, color: '#10B981' }
            ]
        }));

        return res.json({
            success: true,
            kpis: { asistenciaHoy, incidenciasHoy, asistenciaMedia: `${asistenciaMedia}%` },
            chartData
        });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//============================================
//ARRANQUE
//============================================
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server ready at port ${PORT}`);
});