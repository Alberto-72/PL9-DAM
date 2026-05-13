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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage() });

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

function odooExec(model, method, args, kwargs = {}) {
    return new Promise((resolve, reject) => {
        const odoo = new Odoo(odooConfig);
        odoo.connect((errConn) => {
            if (errConn) return reject(new Error('Fallo conexion Odoo: ' + errConn.message));

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

function sendError(res, status, message, extra = {}) {
    console.error(`[ERROR ${status}] ${message}`);
    return res.status(status).json({ success: false, message, ...extra });
}

//============================================
//BUSQUEDA INTELIGENTE DE PERSONA POR UID
//
//Estrategia de matching usado por /api/verificar-tarjeta, /api/register
//y el enriquecimiento del dashboard.
//
//Reglas:
//  1) Primero intentamos match EXACTO case-insensitive con =ilike
//  2) Si no hay match y el UID es corto (menor que 14 chars, el largo tipico
//     de un NFC), probamos match por PREFIJO con =ilike y % al final
//  3) Si el match por prefijo devuelve EXACTAMENTE 1 resultado lo aceptamos
//  4) Si devuelve mas de uno, no podemos saber cual es: devolvemos null
//     y el llamador decide que hacer (tipicamente: asignar a lectornfc)
//
//Devuelve { found, ambiguous, persona, modelo } donde:
//  - found:    true si encontro exactamente 1 alumno o profesor
//  - ambiguous: true si encontro varios candidatos por prefijo
//  - persona:  objeto con los campos solicitados (si found==true)
//  - modelo:   'alumno' o 'profesor' (si found==true)
async function buscarPersonaPorUid(uid, fieldsAlumno, fieldsProfesor) {
    if (!uid) return { found: false, ambiguous: false, persona: null, modelo: null };

    //PASO 1: match exacto case-insensitive en alumnos
    try {
        const alumnos = await odooExec(
            'gestion_entrada.alumno',
            'search_read',
            [[['uid', 'ilike', uid]]],
            { fields: fieldsAlumno, limit: 2 }
        );
        if (alumnos && alumnos.length === 1) {
            return { found: true, ambiguous: false, persona: alumnos[0], modelo: 'alumno' };
        }
        if (alumnos && alumnos.length > 1) {
            return { found: false, ambiguous: true, persona: null, modelo: null };
        }
    } catch (e) {
        console.warn('Error buscando alumno exacto:', e.message);
    }

    //PASO 2: match exacto en profesores
    try {
        const profesores = await odooExec(
            'gestion_entrada.profesor',
            'search_read',
            [[['uid', 'ilike', uid]]],
            { fields: fieldsProfesor, limit: 2 }
        );
        if (profesores && profesores.length === 1) {
            return { found: true, ambiguous: false, persona: profesores[0], modelo: 'profesor' };
        }
        if (profesores && profesores.length > 1) {
            return { found: false, ambiguous: true, persona: null, modelo: null };
        }
    } catch (e) {
        console.warn('Error buscando profesor exacto:', e.message);
    }

    //PASO 3: si el UID parece corto (los lectores USB suelen devolver 8 chars en lugar
    //de 14), intentamos busqueda por prefijo
    const ES_UID_CORTO = uid.length < 14;
    if (!ES_UID_CORTO) {
        return { found: false, ambiguous: false, persona: null, modelo: null };
    }

    const patron = `${uid}%`;

    //PASO 3a: prefijo en alumnos
    try {
        const alumnos = await odooExec(
            'gestion_entrada.alumno',
            'search_read',
            [[['uid', 'ilike', patron]]],
            { fields: fieldsAlumno, limit: 5 }
        );
        if (alumnos && alumnos.length === 1) {
            return { found: true, ambiguous: false, persona: alumnos[0], modelo: 'alumno' };
        }
        if (alumnos && alumnos.length > 1) {
            return { found: false, ambiguous: true, persona: null, modelo: null };
        }
    } catch (e) {
        console.warn('Error buscando alumno por prefijo:', e.message);
    }

    //PASO 3b: prefijo en profesores
    try {
        const profesores = await odooExec(
            'gestion_entrada.profesor',
            'search_read',
            [[['uid', 'ilike', patron]]],
            { fields: fieldsProfesor, limit: 5 }
        );
        if (profesores && profesores.length === 1) {
            return { found: true, ambiguous: false, persona: profesores[0], modelo: 'profesor' };
        }
        if (profesores && profesores.length > 1) {
            return { found: false, ambiguous: true, persona: null, modelo: null };
        }
    } catch (e) {
        console.warn('Error buscando profesor por prefijo:', e.message);
    }

    //Nada
    return { found: false, ambiguous: false, persona: null, modelo: null };
}

//Busca el id del usuario 'lectornfc' en profesores. Se usa como fallback cuando
//la lectura es ambigua (UID corto que no se puede resolver a una sola persona).
//Cacheamos el id en memoria porque no cambia durante la ejecucion del servidor.
let _lectornfcIdCache = null;
async function getLectorNfcId() {
    if (_lectornfcIdCache !== null) return _lectornfcIdCache;
    try {
        const result = await odooExec(
            'gestion_entrada.profesor',
            'search',
            [[['username', '=', 'lectornfc']]],
            { limit: 1 }
        );
        if (result && result.length > 0) {
            _lectornfcIdCache = result[0];
            return _lectornfcIdCache;
        }
        console.warn("Usuario 'lectornfc' no existe en Odoo. Los fallbacks no se asociaran.");
        return null;
    } catch (e) {
        console.error("Error obteniendo id de 'lectornfc':", e.message);
        return null;
    }
}

app.get('/', (req, res) => {
    res.send('Servidor Odoo funcionando correctamente.');
});

//============================================
//VERIFICAR TARJETA NFC
//
//Busca el UID primero en gestion_entrada.alumno; si no aparece, busca tambien
//en gestion_entrada.profesor. Devuelve un campo `usr_type` ('alumno' o 'profesor')
//para que el frontend sepa que tipo de persona acaba de pasar la tarjeta.
//Esto es necesario porque los profesores tienen sus propios reg_types
//(entrada_prof / salida_prof) y no se procesan como alumnos.
//============================================
app.post('/api/verificar-tarjeta', async (req, res) => {
    const { tarjetaId } = req.body;
    if (!tarjetaId) return sendError(res, 400, 'Falta tarjetaId');

    console.log(`\nUID Recibido: ${tarjetaId} -> Consultando Odoo...`);

    try {
        //Usamos el helper unificado. Busca con =ilike exacto y, si el UID es corto,
        //prueba por prefijo. Devuelve found/ambiguous segun el resultado.
        const fieldsAlumno = ['name', 'surname', 'photo', 'school_year', 'birth_date', 'can_bus'];
        const fieldsProfesor = ['name', 'surname', 'photo', 'birth_date'];

        const r = await buscarPersonaPorUid(tarjetaId, fieldsAlumno, fieldsProfesor);

        if (r.found && r.modelo === 'alumno') {
            const a = r.persona;
            const nombreCompleto = `${a.name} ${a.surname || ''}`.trim();
            console.log(`ALUMNO ENCONTRADO: ${nombreCompleto}`);
            return res.json({
                success: true,
                usr_type: 'alumno',
                nombre: nombreCompleto,
                foto: a.photo || null,
                curso: a.school_year || null,
                cursoCompleto: getCursoCompleto(a.school_year),
                fechaNacimiento: a.birth_date,
                tieneTransporte: a.can_bus || false
            });
        }

        if (r.found && r.modelo === 'profesor') {
            const p = r.persona;
            const nombreCompleto = `${p.name} ${p.surname || ''}`.trim();
            console.log(`PROFESOR ENCONTRADO: ${nombreCompleto}`);
            return res.json({
                success: true,
                usr_type: 'profesor',
                nombre: nombreCompleto,
                foto: p.photo || null,
                curso: null,
                cursoCompleto: null,
                fechaNacimiento: p.birth_date || null,
                tieneTransporte: false
            });
        }

        //Caso ambiguo: el UID matcheo varios candidatos. Lo tratamos como tarjeta
        //no resoluble para que el scanner reaccione (sera atribuido a lectornfc al
        //registrarse).
        if (r.ambiguous) {
            console.log(`UID ${tarjetaId} matchea varios candidatos. Tarjeta ambigua.`);
            return res.json({ success: false, message: 'Tarjeta ambigua (multiples coincidencias)' });
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

app.get('/api/alumnos', async (req, res) => {
    console.log('\nSolicitando lista de alumnos...');
    try {
        const result = await odooExec(
            'gestion_entrada.alumno',
            'search_read',
            [[]],
            { fields: ['uid', 'name', 'surname', 'nif', 'photo', 'school_year', 'birth_date', 'can_bus', 'email'] }
        );
        console.log(`Total alumnos encontrados: ${result ? result.length : 0}`);
        return res.json({ success: true, alumnos: result || [] });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

app.post('/api/alumnos', async (req, res) => {
    //IMPORTANTE: en el modelo Odoo gestion_entrada.alumno (heredado de user),
    //los campos nif, name, surname, birth_date y email son required=True.
    //Si falta alguno, Odoo rechazara el create.
    const { name, surname, nif, email, birth_date, school_year, can_bus, photo, uid } = req.body;
    if (!name || !surname || !nif || !email || !birth_date) {
        return sendError(res, 400, 'Faltan campos obligatorios (name, surname, nif, email, birth_date)');
    }

    try {
        const values = { name, surname, nif, email, birth_date };
        if (school_year !== undefined) values.school_year = school_year;
        if (can_bus !== undefined) values.can_bus = can_bus;
        if (photo !== undefined) values.photo = photo;
        if (uid !== undefined) values.uid = uid;

        const newId = await odooExec('gestion_entrada.alumno', 'create', [values]);
        console.log(`Alumno creado con id: ${newId}`);
        return res.json({ success: true, id: newId, message: 'Alumno creado' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

app.put('/api/alumnos/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return sendError(res, 400, 'ID invalido');

    try {
        const allowed = ['name', 'surname', 'nif', 'email', 'birth_date', 'school_year', 'can_bus', 'photo', 'uid'];
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
            { fields: ['uid', 'name', 'surname', 'nif', 'email', 'photo', 'is_management', 'username', 'birth_date'] }
        );
        console.log(`Total profesores encontrados: ${result ? result.length : 0}`);
        return res.json({ success: true, profesores: result || [] });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

app.post('/api/profesores', async (req, res) => {
    //IMPORTANTE: en gestion_entrada.profesor son required=True:
    //  nif, name, surname, birth_date, email, username, user_pass, is_management
    const { name, surname, nif, email, birth_date, username, user_pass, photo, uid, is_management } = req.body;
    if (!name || !surname || !nif || !email || !birth_date || !username || !user_pass) {
        return sendError(res, 400, 'Faltan campos obligatorios (name, surname, nif, email, birth_date, username, user_pass)');
    }

    try {
        const values = {
            name, surname, nif, email, birth_date, username, user_pass,
            //is_management es required=True. Si no viene, asumimos false (profesor regular).
            is_management: is_management === undefined ? false : !!is_management,
        };
        if (photo !== undefined) values.photo = photo;
        if (uid !== undefined) values.uid = uid;

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
        const allowed = ['name', 'surname', 'nif', 'email', 'username', 'birth_date', 'photo', 'user_pass', 'uid', 'is_management'];
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
                    token: String(userData.id),
                    role: userData.is_management ? 'directiva' : 'profesor'
                }
            });
        }

        return res.status(401).json({ success: false, message: 'Usuario o contraseña no válidos' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//============================================
//REGISTRO DE ENTRADA/SALIDA
//============================================
app.post('/api/register', async (req, res) => {
    //Campos esperados:
    //  - uid:            requerido
    //  - mensajeEstado:  requerido (el reg_type)
    //  - dateTime:       opcional, si falta se usa el momento actual
    //  - origen_lector:  opcional ('usb' o 'movil'). Determina quien firma el registro:
    //                    - 'usb'   -> profesor_id = lectornfc (lector anonimo)
    //                    - 'movil' -> alumno_id o profesor_id segun el match del UID
    //  - usr_type:       opcional (tentativo desde frontend; el backend tiene palabra final)
    const { uid, mensajeEstado, dateTime, origen_lector } = req.body;
    const usr_type_recibido = req.body.usr_type;
    if (!uid || !mensajeEstado) return sendError(res, 400, 'Faltan datos obligatorios (uid, mensajeEstado)');

    try {
        const values = {
            uid,
            reg_type: mensajeEstado,
            dateTime: dateTime || new Date().toISOString().replace('T', ' ').substring(0, 19)
        };

        //Buscamos la persona por UID. Lo hacemos siempre, porque incluso si viene del
        //lector USB queremos asociar el alumno_id (el operador es otra cosa).
        const fieldsAlumno = ['id'];
        const fieldsProfesor = ['id'];
        const r = await buscarPersonaPorUid(uid, fieldsAlumno, fieldsProfesor);

        if (r.found && r.modelo === 'alumno') {
            values.usr_type = 'alumno';
            values.alumno_id = r.persona.id;
        } else if (r.found && r.modelo === 'profesor') {
            values.usr_type = 'profesor';
            values.profesor_id = r.persona.id;
        } else {
            //Sin match: usr_type cae al tentativo del frontend o 'alumno' por defecto
            values.usr_type = usr_type_recibido || 'alumno';
        }

        //REGLA NUEVA: si el origen es el lector USB, el "operador" del registro
        //SIEMPRE es lectornfc. Sobrescribimos profesor_id (incluso si la busqueda
        //identifico a un profesor escaneado: aqui solo importa quien opero el lector).
        if (origen_lector === 'usb') {
            const lectorId = await getLectorNfcId();
            if (lectorId) {
                values.profesor_id = lectorId;
                console.log(`Registro origen USB: profesor_id = lectornfc (id ${lectorId})`);
            } else {
                console.warn("Usuario 'lectornfc' no existe en Odoo. profesor_id queda sin asignar.");
            }
        }

        const newId = await odooExec('gestion_entrada.registro', 'create', [values]);
        return res.json({ success: true, id: newId, message: 'Registro creado' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//Historial de registros por UID.
//
//Opcionalmente acepta ?fecha=YYYY-MM-DD para filtrar solo las pasadas de ese dia.
//Lo usa el ScannerScreen para determinar si la pasada actual es la "primera" o
//"segunda" del dia (necesario para alternar entrada_prof/salida_prof y para
//distinguir salida_recreo de entrada_recreo).
app.get('/api/registros/:uid', async (req, res) => {
    const uid = req.params.uid;
    if (!uid) return sendError(res, 400, 'Falta uid');

    const fecha = req.query.fecha ? String(req.query.fecha).trim() : null;
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return sendError(res, 400, 'fecha invalida, formato YYYY-MM-DD');
    }

    try {
        //Construimos el dominio. Usamos 'ilike' con % al final para que UIDs cortos
        //(como los que devuelve el lector USB: '04356A42') matcheen registros
        //guardados con UID largo ('04356A42DA2C80'). Esto es necesario para que
        //el ScannerScreen detecte correctamente las pasadas previas del dia al
        //decidir entrada vs salida.
        const domain = [['uid', 'ilike', uid]];
        if (fecha) {
            domain.push(['dateTime', '>=', `${fecha} 00:00:00`]);
            domain.push(['dateTime', '<=', `${fecha} 23:59:59`]);
        }

        const result = await odooExec(
            'gestion_entrada.registro',
            'search_read',
            [domain],
            { fields: ['uid', 'usr_type', 'reg_type', 'dateTime'], order: 'dateTime desc', limit: 100 }
        );
        return res.json({ success: true, registros: result || [] });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//============================================
//CAMBIO DE CONTRASEÑA
//============================================
app.post('/api/change-password', async (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) return sendError(res, 400, 'Username y newPassword son obligatorios');

    try {
        const found = await odooExec(
            'gestion_entrada.profesor',
            'search_read',
            [[['username', '=', username]]],
            { fields: ['id'], limit: 1 }
        );

        if (!found || found.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

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
//============================================
app.post('/api/importar-csv/:tipo', upload.single('archivo'), async (req, res) => {
    const tipo = req.params.tipo;
    if (!['alumnos', 'profesores'].includes(tipo)) {
        return sendError(res, 400, 'Tipo invalido. Debe ser alumnos o profesores');
    }
    if (!req.file) return sendError(res, 400, 'No se ha recibido el archivo');

    const model = tipo === 'alumnos' ? 'gestion_entrada.alumno' : 'gestion_entrada.profesor';

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

    const camposValidos = tipo === 'alumnos'
        ? ['name', 'surname', 'school_year', 'email', 'can_bus', 'photo', 'birth_date', 'uid']
        : ['name', 'surname', 'email', 'username', 'birth_date', 'photo', 'user_pass', 'uid', 'is_management'];

    let creados = 0, errores = 0;
    const detallesErrores = [];

    for (let i = 0; i < filas.length; i++) {
        const fila = filas[i];

        const values = {};
        for (const k of camposValidos) {
            if (fila[k] !== undefined && fila[k] !== '') {
                if (k === 'can_bus' || k === 'is_management') {
                    values[k] = ['true', '1', 'si', 'sí', 'yes'].includes(String(fila[k]).toLowerCase().trim());
                } else {
                    values[k] = fila[k];
                }
            }
        }

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
        detalles: detallesErrores.slice(0, 20)
    });
});

//============================================
//EXPORTACION CSV DE ACCESOS
//============================================
app.get('/api/exportar-accesos', async (req, res) => {
    try {
        const registros = await odooExec(
            'gestion_entrada.registro',
            'search_read',
            [[]],
            { fields: ['uid', 'usr_type', 'reg_type', 'dateTime'], order: 'dateTime desc', limit: 10000 }
        );

        const cabecera = 'uid,usr_type,reg_type,dateTime\n';
        const cuerpo = (registros || []).map(r => {
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
        res.send('\uFEFF' + cabecera + cuerpo);
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//============================================
//CONSTANTES DE reg_type
//
//Estas listas reflejan el modelo Odoo actualizado (gestion_entrada.registro).
//Si Odoo cambia los valores del Selection, hay que actualizar aqui tambien.
//
//Lo usamos en /api/dashboard (KPIs y grafico) y en /api/registros-paginado.
//============================================
const REG_TYPES_ENTRADA = ['entrada_puntual', 'entrada_recreo', 'entrada_tardia', 'entrada_prof'];
const REG_TYPES_SALIDA  = ['salida_anticipada', 'salida_recreo', 'salida_bus',
                           'salida_anticipada_autorizada', 'salida_regular', 'salida_prof'];

//Tipos considerados "asistencia confirmada" (cuentan en el KPI de Asistencia Hoy)
const REG_TYPES_ASISTENCIA = ['entrada_puntual', 'entrada_recreo', 'entrada_tardia'];

//Tipos considerados "incidencias"
const REG_TYPES_INCIDENCIA = ['error', 'no_autorizado'];

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
                if (REG_TYPES_ASISTENCIA.includes(record.reg_type)) asistenciaHoy++;
                if (REG_TYPES_INCIDENCIA.includes(record.reg_type)) incidenciasHoy++;
            }

            if (diaSemana >= 1 && diaSemana <= 5 && recordDate >= haceUnaSemana) {
                const dayData = chartDataMap[diaSemana];
                //Justificadas: salidas regulares y autorizadas (verde)
                if (['salida_regular', 'salida_anticipada_autorizada'].includes(record.reg_type)) {
                    dayData.justificadas++;
                }
                //Injustificadas: salidas anticipadas sin autorizar + no_autorizado (rojo)
                else if (['salida_anticipada', 'no_autorizado'].includes(record.reg_type)) {
                    dayData.injustificadas++;
                }
                //Otras: bus y recreo (verde claro/azul)
                else if (['salida_bus', 'salida_recreo'].includes(record.reg_type)) {
                    dayData.otras++;
                }
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
//REGISTROS PAGINADOS PARA EL DASHBOARD DE DIRECTIVA
//============================================
app.get('/api/registros-paginado', async (req, res) => {
    const tipo   = String(req.query.tipo || '').toLowerCase();
    const fecha  = String(req.query.fecha || '').trim();
    const curso  = req.query.curso ? String(req.query.curso).trim() : null;
    const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    if (!['entrada', 'salida'].includes(tipo)) {
        return sendError(res, 400, 'tipo debe ser entrada o salida');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return sendError(res, 400, 'fecha invalida, formato YYYY-MM-DD');
    }

    const regTypes = tipo === 'entrada' ? REG_TYPES_ENTRADA : REG_TYPES_SALIDA;
    const fechaInicio = `${fecha} 00:00:00`;
    const fechaFin    = `${fecha} 23:59:59`;

    try {
        let uidsCurso = null;
        if (curso) {
            const alumnosCurso = await odooExec(
                'gestion_entrada.alumno',
                'search_read',
                [[['school_year', '=', curso]]],
                { fields: ['uid'] }
            );
            uidsCurso = (alumnosCurso || [])
                .map(a => a.uid)
                .filter(u => u && u !== false);

            if (uidsCurso.length === 0) {
                return res.json({ success: true, registros: [], total: 0, offset, limit });
            }
        }

        //FIX: el operador 'in' con un Selection field en este cliente XML-RPC
        //a veces devuelve resultados vacios aunque haya coincidencias. Para evitarlo,
        //filtramos solo por fecha (y curso si aplica) y aplicamos el filtro de
        //reg_type en JavaScript. El coste es traer mas registros de los necesarios
        //(toda la fecha en lugar de solo entradas/salidas), pero es robusto.
        const domain = [
            ['dateTime', '>=', fechaInicio],
            ['dateTime', '<=', fechaFin],
        ];
        if (uidsCurso !== null) {
            domain.push(['uid', 'in', uidsCurso]);
        }

        //Traemos TODOS los registros del rango (sin paginar todavia) para filtrar
        //por reg_type en JS. Limite alto de seguridad: 1000 registros por dia
        //deberia ser mas que suficiente para un centro educativo.
        const todosRegistros = await odooExec(
            'gestion_entrada.registro',
            'search_read',
            [domain],
            {
                fields: ['uid', 'usr_type', 'reg_type', 'dateTime'],
                order: 'dateTime desc',
                limit: 1000,
            }
        ) || [];

        //Filtrado en JS por tipo (entrada o salida segun los reg_types correspondientes)
        const filtrados = todosRegistros.filter(r => regTypes.includes(r.reg_type));
        const total = filtrados.length;

        //Aplicamos paginacion manualmente sobre el array filtrado
        const registros = filtrados.slice(offset, offset + limit);

        //Enriquecimiento: para cada UID unico hacemos una busqueda inteligente
        //(usando el mismo helper que /api/register). Asi un UID corto del lector
        //USB se resuelve tambien correctamente y NO aparece como "Desconocido".
        //
        //Cachamos los UIDs unicos en un Map para no buscar el mismo varias veces.
        const uidsUnicos = [...new Set(registros.map(r => r.uid).filter(Boolean))];

        const fieldsAlumno = ['name', 'surname', 'school_year', 'photo'];
        const fieldsProfesor = ['name', 'surname', 'photo'];

        //Resolvemos cada UID en paralelo (con limite implicito por la propia API Odoo)
        const resoluciones = await Promise.all(
            uidsUnicos.map(uid =>
                buscarPersonaPorUid(uid, fieldsAlumno, fieldsProfesor)
                    .then(r => ({ uid, r }))
                    .catch(() => ({ uid, r: { found: false } }))
            )
        );

        const indicePorUid = {};
        for (const { uid, r } of resoluciones) {
            indicePorUid[uid] = r;
        }

        const enriquecidos = registros.map(r => {
            const res = indicePorUid[r.uid];
            const persona = (res && res.found) ? res.persona : null;
            const modelo  = (res && res.found) ? res.modelo  : null;

            return {
                id: r.id,
                uid: r.uid,
                //usr_type final: priorizamos el del registro, pero si la persona
                //resuelta es de otro tipo, usamos el de la persona encontrada
                usr_type: modelo || r.usr_type,
                reg_type: r.reg_type,
                dateTime: r.dateTime,
                nombre:      persona ? `${persona.name || ''} ${persona.surname || ''}`.trim() : 'Desconocido',
                curso:       (persona && persona.school_year) ? persona.school_year : null,
                cursoLargo:  (persona && persona.school_year) ? getCursoCompleto(persona.school_year) : null,
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