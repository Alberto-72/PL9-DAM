// Importación de módulos necesarios
const express = require('express'); // Para crear API REST
const cors = require('cors');
const multer = require('multer'); // Subida de archivos
const csvParser = require('csv-parser'); // Manejo de CSV
const { Readable } = require('stream');
const Odoo = require('odoo-xmlrpc'); // Para conectarnos con Odoo
const bcrypt = require('bcrypt'); // Para el hasheo de las contraseñas

const app = express();
app.use(cors({ // Configuracion del cors para que acepte peticiones de cualquier origen y los metodos estandar
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuracion para entender json y configurar el limite de mb para el tema de las fotos
app.use((req, res, next) => {
    const hora = new Date().toISOString().substring(11, 19);
    console.log(`[${hora}] ${req.method} ${req.url}`);
    next();
});

// Guarda, en este caso csv en la memoria en la RAM para mejor velocidad
const upload = multer({ storage: multer.memoryStorage() });

const odooConfig = {
    url: 'http://10.102.6.200',
    port: 8069,
    db: 'ControlAcceso',
    username: 'albertoroaf@gmail.com',
    password: 'AlberPabKil123'
};

// Diccionario para que sea mas legible los cursos en cuanto a lo que esta guardado en odoo
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

function getCursoCompleto(key) { // Funcion que coge la string corta y devuelve la grande
    if (!key || key === false) return null;
    const found = CURSOS.find(([short]) => short === key);
    return found ? found[1] : key;
}

function normalizarTexto(texto) { // Normalizacion de texto para la importación con csv
    if (!texto) return '';
    return String(texto)
        .normalize('NFD') // Separa en dos caracteres los que tengan til de es decir á -> a + ´
        .replace(/[\u0300-\u036f]/g, '') // Elimina acentos y este tipo de puntuaciones
        .replace(/[º°]/g, '') // Elimina caracteres referentes a los grados
        .replace(/\s+/g, ' ') // Elimina espacios dobles y los convierte en simples
        .trim() // Elimina espacios en blanco al principio y al final
        .toLowerCase(); // Lo pone todo en minúscula
}

function getCodigoCurso(nombreLargo) { // Coge el nombre que nos da el csv del pincel ekade y lo coteja con nuestro diccionario para tener el codigo que acepta odoo
    if (!nombreLargo) return null;
    const objetivo = normalizarTexto(nombreLargo);
    const found = CURSOS.find(([, largo]) => normalizarTexto(largo) === objetivo);
    return found ? found[0] : null;
}

function convertirFecha(valor) { // Covierte las fechas al formato que espera odoo yyyy-mm-dd
    if (!valor) return null;     // Si está ya en ese formato se deja igual
    const texto = String(valor).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

    const partes = texto.split(/[\/\-]/);
    if (partes.length !== 3) return null;

    let [dia, mes, anio] = partes;
    if (anio.length !== 4) return null;

    dia = dia.padStart(2, '0');
    mes = mes.padStart(2, '0');

    const d = parseInt(dia, 10);
    const m = parseInt(mes, 10);
    if (d < 1 || d > 31 || m < 1 || m > 12) return null;

    return `${anio}-${mes}-${dia}`;
}

function odooExec(model, method, args, kwargs = {}) { // Funcion para ejecutar crud en odoo
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

function sendError(res, status, message, extra = {}) { // Funcion para enviar errores en cunato al http
    console.error(`[ERROR ${status}] ${message}`);
    return res.status(status).json({ success: false, message, ...extra });
}

const LONGITUD_UID_CORTO = 8;
function prefijoUid(uid) {
    /*
    Funcion para normalizar el UID, ya que si se lee desde el lector del movil da 14 caracteres
    y si se lee desde el lector de escritorio lee 8 caracteres, por lo que se normaliza para que
    todos tengan 8
    */
    if (!uid) return '';
    return String(uid).trim().toUpperCase().substring(0, LONGITUD_UID_CORTO);
}
 
async function buscarPersonaPorUid(uid, fieldsAlumno, fieldsProfesor) { // Funcion para buscar personas en base a lo escaneado
    if (!uid) return { found: false, ambiguous: false, persona: null, modelo: null };

    const uidCorto = prefijoUid(uid); // En el caso de que se lea el uid por el movil (14 caracteres)

    try {
        const alumnos = await odooExec( // Búsqueda del uid en la tabla de alumnos
            'gestion_entrada.alumno',
            'search_read',
            [[['uid', '=', uidCorto]]],
            { fields: fieldsAlumno, limit: 2 }
        );
        if (alumnos && alumnos.length === 1) {
            return { found: true, ambiguous: false, persona: alumnos[0], modelo: 'alumno' };
        }
        if (alumnos && alumnos.length > 1) {
            return { found: false, ambiguous: true, persona: null, modelo: null };
        }
    } catch (e) {
        console.warn('Error buscando alumno por uid:', e.message);
    }

    try { // Si no lo encuentra, busca en la de profesorado realizando la misma consulta
        const profesores = await odooExec(
            'gestion_entrada.profesor',
            'search_read',
            [[['uid', '=', uidCorto]]],
            { fields: fieldsProfesor, limit: 2 }
        );
        if (profesores && profesores.length === 1) {
            return { found: true, ambiguous: false, persona: profesores[0], modelo: 'profesor' };
        }
        if (profesores && profesores.length > 1) {
            return { found: false, ambiguous: true, persona: null, modelo: null };
        }
    } catch (e) {
        console.warn('Error buscando profesor por uid:', e.message);
    }

    return { found: false, ambiguous: false, persona: null, modelo: null };
}

let _lectornfcIdCache = null;
async function getLectorNfcId() {// Si el id es leido por una maquina fisica estática (conserjeria) lo guarda como lectornfc
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

app.get('/', (req, res) => { // endpoint para comprobar si odoo está funcionando correctamente
    res.send('Servidor Odoo funcionando correctamente.');
});

app.post('/api/verificar-tarjeta', async (req, res) => { // Api endpoint para veirificar el uid de la tarjeta
    const { tarjetaId } = req.body;
    if (!tarjetaId) return sendError(res, 400, 'Falta tarjetaId');

    console.log(`\nUID Recibido: ${tarjetaId} -> Consultando Odoo...`);

    try {
        // Campos para consultar en odoo
        const fieldsAlumno = ['name', 'surname', 'photo', 'school_year', 'birth_date', 'can_bus'];
        const fieldsProfesor = ['name', 'surname', 'photo', 'birth_date'];

        const r = await buscarPersonaPorUid(tarjetaId, fieldsAlumno, fieldsProfesor); // Se busca a la persona en base a id y campos aceptados para cada uno

        // Si encuentra alumno, devuelve un json con los datos formateados
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

        // Si es profesor, pasa igual que si fuera alumno
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

        // Manejo de errores
        if (r.ambiguous) { // En el caso de que se encontraran con el mismo uid varios usuarios (NO DEBERIA, pero esta controlado)
            console.log(`UID ${tarjetaId} matchea varios candidatos. Tarjeta ambigua.`);
            return res.json({ success: false, message: 'Tarjeta ambigua (multiples coincidencias)' });
        }
        // En el caso de que no exista el uid escaneado
        console.log(`UID ${tarjetaId} no existe en la base de datos.`);
        return res.json({ success: false, message: 'Tarjeta no registrada' });

    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

//  ## ENDPOINTS PARA CRUD DE LOS ALUMNOS ##
app.get('/api/alumnos', async (req, res) => { // Busca listado completo de alumnos
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

app.post('/api/alumnos', async (req, res) => { // Creacion de un aluimno nuevo
    const { name, surname, nif, email, birth_date, school_year, can_bus, photo, uid } = req.body; // Extrae campos
    if (!name || !surname || !nif || !email || !birth_date) { // Datos obligatorios
        return sendError(res, 400, 'Faltan campos obligatorios (name, surname, nif, email, birth_date)');
    }

    try { // En el caso de que hayan datos que no existan los asigna
        const values = { name, surname, nif, email, birth_date };
        if (school_year !== undefined) values.school_year = school_year;
        if (can_bus !== undefined) values.can_bus = can_bus;
        if (photo !== undefined) values.photo = photo;
        if (uid !== undefined) values.uid = uid;

        const newId = await odooExec('gestion_entrada.alumno', 'create', [values]);
        console.log(`Alumno creado con id: ${newId}`);
        return res.json({ success: true, id: newId, message: 'Alumno creado' }); // Devuelve id y mensaje de confirmacion
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

app.put('/api/alumnos/:id', async (req, res) => { // Actualizacion de alumnos
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return sendError(res, 400, 'ID invalido');

    try {
        const allowed = ['name', 'surname', 'nif', 'email', 'birth_date', 'school_year', 'can_bus', 'photo', 'uid'];
        const values = {};
        for (const k of allowed) { // Comprobacion de los campos a ver si hay que hacer actualizaciones realmente
            if (req.body[k] !== undefined) values[k] = req.body[k];
        }

        if (Object.keys(values).length === 0) return sendError(res, 400, 'No hay campos para actualizar');

        await odooExec('gestion_entrada.alumno', 'write', [[id], values]); // En el caso de que haya que actualizar, se realiza la operacion
        console.log(`Alumno ${id} actualizado`);
        return res.json({ success: true, message: 'Alumno actualizado' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

app.delete('/api/alumnos/:id', async (req, res) => { // Eliminacion de un alumno
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


//  ## ENDPOINTS PARA CRUD DE LOS PROFESORES ##
app.get('/api/profesores', async (req, res) => { // Consulta para sacar el listado completo de profesores
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

app.post('/api/profesores', async (req, res) => { // Creacion de profesores
    const { name, surname, nif, email, birth_date, username, user_pass, photo, uid, is_management } = req.body;
    if (!name || !surname || !nif || !email || !birth_date || !username || !user_pass) { // Comprobacion de los require
        return sendError(res, 400, 'Faltan campos obligatorios (name, surname, nif, email, birth_date, username, user_pass)');
    }

    try {
        const hashedPassword = await bcrypt.hash(user_pass, 10); // Se coge la contraseña intruducida manualmente o por importacion y se hashea

        const values = { // Se formatean los valores y para las importaciones se pone por defecto que es falso
            name, surname, nif, email, birth_date, username, 
            user_pass: hashedPassword, 
            is_management: is_management === undefined ? false : !!is_management, // Si no existe false, por otro lado fuerza a que el dato sea un booleano
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

app.put('/api/profesores/:id', async (req, res) => { // Actualizacion de los datos de un profesor 
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return sendError(res, 400, 'ID invalido');

    try {
        const allowed = ['name', 'surname', 'nif', 'email', 'username', 'birth_date', 'photo', 'user_pass', 'uid', 'is_management'];
        const values = {};
        
        for (const k of allowed) {
            if (req.body[k] !== undefined) {
                if (k === 'user_pass') {
                    values[k] = await bcrypt.hash(req.body[k], 10);
                } else {
                    values[k] = req.body[k];
                }
            }
        }

        if (Object.keys(values).length === 0) return sendError(res, 400, 'No hay campos para actualizar');

        await odooExec('gestion_entrada.profesor', 'write', [[id], values]);
        console.log(`Profesor ${id} actualizado`);
        return res.json({ success: true, message: 'Profesor actualizado' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

app.delete('/api/profesores/:id', async (req, res) => { // Eliminacion de profesor
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

app.post('/api/login', async (req, res) => { // endpoint para el logeo de los profesores
    const { username, password } = req.body;
    if (!username || !password) return sendError(res, 400, 'Faltan credenciales'); // Si falta algun dato

    console.log(`\nIntento de login para usuario: ${username}`);

    try {
        const result = await odooExec( // Se consultan los datos del profesor en base al username
            'gestion_entrada.profesor',
            'search_read',
            [[['username', '=', username]]],
            { fields: ['id', 'name', 'surname', 'email', 'username', 'is_management', 'user_pass'], limit: 1 }
        );

        if (result && result.length > 0) {
            const userData = result[0];
            
            const isMatch = await bcrypt.compare(password, userData.user_pass); // Se comparan las contraseñas hasehadas

            if (isMatch) {
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
        }

        return res.status(401).json({ success: false, message: 'Usuario o contraseña no válidos' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

app.post('/api/register', async (req, res) => { // Registro de eventos
    const { uid, mensajeEstado, dateTime, origen_lector, operador_username } = req.body; // Extraccion de los datos necesarios
    const usr_type_recibido = req.body.usr_type;
    if (!uid || !mensajeEstado) return sendError(res, 400, 'Faltan datos obligatorios (uid, mensajeEstado)');

    try {
        const uidCorto = prefijoUid(uid);
        const values = {
            uid: uidCorto,
            reg_type: mensajeEstado,
            dateTime: dateTime || new Date().toISOString().replace('T', ' ').substring(0, 19) // Si no hay hora el servidor pone la hora actual
        };

        const fieldsAlumno = ['id', 'uid'];
        const fieldsProfesor = ['id', 'uid'];
        const r = await buscarPersonaPorUid(uid, fieldsAlumno, fieldsProfesor); // Busca a la persoan

        if (r.found && r.modelo === 'alumno') { // Si es alumno
            values.usr_type = 'alumno';
            values.alumno_id = r.persona.id;
            if (r.persona.uid) values.uid = prefijoUid(r.persona.uid); // Si tiene el uid largo lo normaliza
        } else if (r.found && r.modelo === 'profesor') { // Misma logica si es profesor
            values.usr_type = 'profesor';
            values.profesor_id = r.persona.id;
            if (r.persona.uid) values.uid = prefijoUid(r.persona.uid);
        } else {
            values.usr_type = usr_type_recibido || 'alumno';
        }

        if (origen_lector === 'usb') { // En el caso de que se haga desde conserjeria
            const lectorId = await getLectorNfcId();
            if (lectorId) {
                values.profesor_id = lectorId;
                console.log(`Registro origen USB: profesor_id = lectornfc (id ${lectorId})`);
            } else {
                console.warn("Usuario 'lectornfc' no existe en Odoo. profesor_id queda sin asignar.");
            }
        } else if (origen_lector === 'movil' && values.usr_type === 'alumno' && operador_username) { // Se busca el username del profesor que hizo el registro
            try {
                const operadores = await odooExec(
                    'gestion_entrada.profesor',
                    'search_read',
                    [[['username', '=', operador_username]]],
                    { fields: ['id'], limit: 1 }
                );
                if (operadores && operadores.length === 1) {
                    values.profesor_id = operadores[0].id;
                    console.log(`Registro origen movil: profesor_id = ${operador_username} (id ${operadores[0].id})`);
                } else {
                    console.warn(`Operador '${operador_username}' no encontrado en Odoo. profesor_id queda sin asignar.`);
                }
            } catch (e) {
                console.warn(`Error buscando operador '${operador_username}':`, e.message);
            }
        }

        const newId = await odooExec('gestion_entrada.registro', 'create', [values]); // Al tener todos lods datos se crea el registro
        return res.json({ success: true, id: newId, message: 'Registro creado' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

app.get('/api/registros/:uid', async (req, res) => { // Busca los ultimos registros de una persona en base a su id normalizado
    const uid = req.params.uid;
    if (!uid) return sendError(res, 400, 'Falta uid');

    const fecha = req.query.fecha ? String(req.query.fecha).trim() : null;
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return sendError(res, 400, 'fecha invalida, formato YYYY-MM-DD');
    }

    try {
        const uidCorto = prefijoUid(uid);
        const domain = [['uid', '=', uidCorto]];
        if (fecha) {
            domain.push(['dateTime', '>=', `${fecha} 00:00:00`]);
            domain.push(['dateTime', '<=', `${fecha} 23:59:59`]);
        }

        const result = await odooExec( // saca todos los registros en base a la fecha y hora para saber si el siguiente registro va a ser entrada o salida
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

app.post('/api/change-password', async (req, res) => { // Endpoint para el cambio de 
    const { username, currentPassword, newPassword } = req.body;
    if (!username || !currentPassword || !newPassword) {
        return sendError(res, 400, 'Username, currentPassword y newPassword son obligatorios');
    }

    if (String(newPassword).length < 4) {
        return sendError(res, 400, 'La contraseña nueva debe tener al menos 4 caracteres');
    }

    try { // Busca el password hasheado del usuario
        const found = await odooExec(
            'gestion_entrada.profesor',
            'search_read',
            [[['username', '=', username]]],
            { fields: ['id', 'user_pass'], limit: 1 }
        );

        if (!found || found.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        const usuario = found[0];

        const passwordCorrecta = await bcrypt.compare(currentPassword, usuario.user_pass || ''); // Compara contraseñas actuales como requisito indispensable para cambiarla
        if (!passwordCorrecta) {
            return res.status(401).json({
                success: false,
                code: 'PASSWORD_INCORRECTA',
                message: 'La contraseña actual no es correcta'
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10); // Si la acutal es correcta hashea la nueva
        await odooExec('gestion_entrada.profesor', 'write', [[usuario.id], { user_pass: hashedPassword }]); // y la guarda

        console.log(`Contraseña actualizada para ${username}`);
        return res.json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

app.get('/api/user/:username', async (req, res) => { // Busqueda de datos de usuario en base a username
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
        return res.json({ // Formateo de datos en json
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

app.post('/api/importar-csv/:tipo', upload.single('archivo'), async (req, res) => { // Endpoint para la importacion masiva de datos
    const tipo = req.params.tipo; // Tipos de datos profesores o alumnos
    if (!['alumnos', 'profesores'].includes(tipo)) {
        return sendError(res, 400, 'Tipo invalido. Debe ser alumnos o profesores');
    }
    // Si el archivo no se ha subido correctamente
    if (!req.file) return sendError(res, 400, 'No se ha recibido el archivo');

    const model = tipo === 'alumnos' ? 'gestion_entrada.alumno' : 'gestion_entrada.profesor'; // Variable para cargar el modelo correcto

    const filas = await new Promise((resolve, reject) => { 
        const resultados = [];
        Readable.from(req.file.buffer) // Convierte buffer de la RAM en stream leible
            .pipe(csvParser({ separator: ';' })) // usa csvParser para leer delimitadores, en este caso ';'
            .on('data', (data) => resultados.push(data))
            .on('end', () => resolve(resultados)) // Una vez finalizado resuelve la promesa
            .on('error', reject);
    }).catch((err) => {
        console.error('Error parseando CSV:', err.message);
        return null;
    });

    if (filas === null) return sendError(res, 400, 'CSV mal formado');

   
    const leerCampo = (fila, ...nombres) => { // Funcion que busca posibles nombre de cabecera de columna ya que los nombres de pincel ekade pueden cambiar
        for (const nombre of nombres) {
            if (fila[nombre] !== undefined && String(fila[nombre]).trim() !== '') {
                return String(fila[nombre]).trim();
            }
        }
        return '';
    };

    let creados = 0, errores = 0;
    const detallesErrores = []; // Logs de errores por fila
    const creadosLista = []; // Datos para mostrar por interfaz quienes se insertaron
    const fallidosLista = []; // y quienes fallaron

    for (let i = 0; i < filas.length; i++) {
        const fila = filas[i];
        const numeroFila = i + 2;
        let values = {};
        let infoPersona = { nombre: '', apellidos: '', extra: '' };
        
        // Va creando los diferentes usuarios comprobando el tipo de usrio, formateando los datos y posteriormente insertandolo en la bse de datos
        if (tipo === 'profesores') {
            const nombre = leerCampo(fila, 'Nombre');
            const apellido1 = leerCampo(fila, 'Primer Apellido');
            const apellido2 = leerCampo(fila, 'Segundo Apellido');
            const nif = leerCampo(fila, 'N.I.F./N.I.E.', 'NIF', 'Nif - Nie');
            const alias = leerCampo(fila, 'Alias');
            const email = leerCampo(fila, 'email', 'Email');
            const fechaCruda = leerCampo(fila, 'Fecha de Nacimiento', 'Fecha de nacimiento');

            const fecha = convertirFecha(fechaCruda);
            const passwordHasheada = await bcrypt.hash('IESSJR', 10);

            const apellidos = `${apellido1} ${apellido2}`.trim();
            infoPersona = { nombre, apellidos, extra: alias };

            values = {
                nif,
                name: nombre,
                surname: apellidos,
                username: alias,
                email,
                user_pass: passwordHasheada,
                is_management: false,
            };
            if (fecha) values.birth_date = fecha;

            if (!nombre || !apellido1 || !nif || !alias || !email) {
                errores++;
                const motivo = 'faltan datos obligatorios (nombre, apellido, nif, alias o email)';
                detallesErrores.push(`Fila ${numeroFila}: ${motivo}`);
                fallidosLista.push({ ...infoPersona, motivo });
                continue;
            }
            if (!fecha) {
                errores++;
                const motivo = `fecha de nacimiento invalida o ausente ("${fechaCruda}")`;
                detallesErrores.push(`Fila ${numeroFila}: ${motivo}`);
                fallidosLista.push({ ...infoPersona, motivo });
                continue;
            }
        } else { // Ocurre igual si es alumno
            const nombre = leerCampo(fila, 'Nombre');
            const apellido1 = leerCampo(fila, 'Primer apellido', 'Primer Apellido');
            const apellido2 = leerCampo(fila, 'Segundo apellido', 'Segundo Apellido');
            const nif = leerCampo(fila, 'Nif - Nie', 'N.I.F./N.I.E.', 'NIF');
            const email = leerCampo(fila, 'email', 'Email');
            const fechaCruda = leerCampo(fila, 'Fecha de nacimiento', 'Fecha de Nacimiento');
            const cursoCrudo = leerCampo(fila, 'Curso');

            const fecha = convertirFecha(fechaCruda);
            const codigoCurso = getCodigoCurso(cursoCrudo);

            const apellidos = `${apellido1} ${apellido2}`.trim();
            infoPersona = { nombre, apellidos, extra: getCursoCompleto(codigoCurso) || cursoCrudo };

            values = {
                nif,
                name: nombre,
                surname: apellidos,
                email,
                can_bus: false,
            };
            if (fecha) values.birth_date = fecha;
            if (codigoCurso) values.school_year = codigoCurso;

            if (!nombre || !apellido1 || !nif || !email) {
                errores++;
                const motivo = 'faltan datos obligatorios (nombre, apellido, nif o email)';
                detallesErrores.push(`Fila ${numeroFila}: ${motivo}`);
                fallidosLista.push({ ...infoPersona, motivo });
                continue;
            }
            if (!fecha) {
                errores++;
                const motivo = `fecha de nacimiento invalida o ausente ("${fechaCruda}")`;
                detallesErrores.push(`Fila ${numeroFila}: ${motivo}`);
                fallidosLista.push({ ...infoPersona, motivo });
                continue;
            }
            if (!codigoCurso) {
                errores++;
                const motivo = `curso no reconocido ("${cursoCrudo}")`;
                detallesErrores.push(`Fila ${numeroFila}: ${motivo}`);
                fallidosLista.push({ ...infoPersona, motivo });
                continue;
            }
        }

        try {
            await odooExec(model, 'create', [values]); // Creacion del usuario
            creados++;
            creadosLista.push(infoPersona);
        } catch (err) {
            errores++;
            detallesErrores.push(`Fila ${numeroFila}: ${err.message}`);
            fallidosLista.push({ ...infoPersona, motivo: err.message });
        }
    }

    return res.json({ // retorna los datos recogidos durante la importacion
        success: true,
        message: `Creados: ${creados}, Errores: ${errores}`,
        creados,
        errores,
        detalles: detallesErrores.slice(0, 20),
        creadosLista,
        fallidosLista,
    });
});

app.get('/api/exportar-accesos', async (req, res) => { // Endpoint para la exportacion masiva de registros
    try {
        const registros = await odooExec( // Consulta para extraer los ultimos 1000 registros
            'gestion_entrada.registro',
            'search_read',
            [[]],
            { fields: ['uid', 'usr_type', 'reg_type', 'dateTime'], order: 'dateTime desc', limit: 10000 }
        );

        const cabecera = 'uid,usr_type,reg_type,dateTime\n';
        const cuerpo = (registros || []).map(r => { // Preparacion de datos para el csv
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
        res.setHeader('Content-Type', 'text/csv; charset=utf-8'); // Indica tipo de archivo y charset
        res.setHeader('Content-Disposition', `attachment; filename="accesos_${fechaArchivo}.csv"`);
        res.send('\uFEFF' + cabecera + cuerpo); // Para que no se corrompa con caracteres españles
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

// Registros que definen los tipos de datos para cada registro
const REG_TYPES_ENTRADA = ['entrada_puntual', 'entrada_recreo', 'entrada_tardia', 'entrada_prof'];
const REG_TYPES_SALIDA  = ['salida_anticipada', 'salida_recreo', 'salida_bus',
                           'salida_anticipada_autorizada', 'salida_regular', 'salida_prof'];

const REG_TYPES_ASISTENCIA = ['entrada_puntual', 'entrada_recreo', 'entrada_tardia'];
const REG_TYPES_INCIDENCIA = ['error', 'no_autorizado'];

async function buildChartDataForWeek(fechaCualquieraDeLaSemana) { // Construccion del grafico
    //Calculamos el lunes de la semana de la fecha dada
    const ref = new Date(fechaCualquieraDeLaSemana + 'T00:00:00Z');
    const diaSem = ref.getUTCDay();  //0 dom, 1 lun, ... 6 sab
    //Restamos hasta llegar al lunes (si es domingo, restamos 6; si es lunes, 0)
    const offsetLunes = (diaSem === 0 ? 6 : diaSem - 1);
    const lunes = new Date(ref);
    lunes.setUTCDate(ref.getUTCDate() - offsetLunes);
    const sabado = new Date(lunes);
    sabado.setUTCDate(lunes.getUTCDate() + 5);  // Limpiamos hasta el viernes

    const fechaInicio = lunes.toISOString().split('T')[0] + ' 00:00:00';
    const fechaFin    = sabado.toISOString().split('T')[0] + ' 00:00:00';

    const records = await odooExec( // Extraemos registros de los 5 dias laborales
        'gestion_entrada.registro',
        'search_read',
        [[['dateTime', '>=', fechaInicio], ['dateTime', '<', fechaFin]]],
        { fields: ['dateTime', 'reg_type'] }
    );

    const chartDataMap = { // Estructuracion de los datos en base al dia de la semana
        1: { day: 'L', e_puntuales: 0, e_tardias: 0, e_recreo: 0, e_prof: 0, s_regulares: 0, s_anticipadas: 0, s_busrecreo: 0, s_prof: 0 },
        2: { day: 'M', e_puntuales: 0, e_tardias: 0, e_recreo: 0, e_prof: 0, s_regulares: 0, s_anticipadas: 0, s_busrecreo: 0, s_prof: 0 },
        3: { day: 'X', e_puntuales: 0, e_tardias: 0, e_recreo: 0, e_prof: 0, s_regulares: 0, s_anticipadas: 0, s_busrecreo: 0, s_prof: 0 },
        4: { day: 'J', e_puntuales: 0, e_tardias: 0, e_recreo: 0, e_prof: 0, s_regulares: 0, s_anticipadas: 0, s_busrecreo: 0, s_prof: 0 },
        5: { day: 'V', e_puntuales: 0, e_tardias: 0, e_recreo: 0, e_prof: 0, s_regulares: 0, s_anticipadas: 0, s_busrecreo: 0, s_prof: 0 },
    };

    (records || []).forEach(record => { // Itera sobre los datos de odoo y hace el calculo de la cantidad de cada cosa
        if (!record.dateTime) return;
        const recordDate = new Date(record.dateTime.replace(' ', 'T') + 'Z');
        const diaSemana = recordDate.getUTCDay();
        if (diaSemana < 1 || diaSemana > 5) return;
        const d = chartDataMap[diaSemana];
        const t = record.reg_type;
        if (t === 'entrada_puntual')                                  d.e_puntuales++;
        else if (t === 'entrada_tardia')                              d.e_tardias++;
        else if (t === 'entrada_recreo')                              d.e_recreo++;
        else if (t === 'entrada_prof')                                d.e_prof++;
        else if (t === 'salida_regular' || t === 'salida_anticipada_autorizada') d.s_regulares++;
        else if (t === 'salida_anticipada' || t === 'no_autorizado')             d.s_anticipadas++;
        else if (t === 'salida_bus' || t === 'salida_recreo')                    d.s_busrecreo++;
        else if (t === 'salida_prof')                                            d.s_prof++;
    });

    return { // Convierte el diccionario que tenemos ahora ha la estructra JSON necesaria para que se forme correctamente el grafico
        lunes: lunes.toISOString().split('T')[0],
        viernes: new Date(lunes.getTime() + 4 * 86400000).toISOString().split('T')[0],
        chartData: [1, 2, 3, 4, 5].map(dayIndex => {
            const d = chartDataMap[dayIndex];
            return {
                day: d.day,
                entrada: {
                    segments: [
                        { value: d.e_puntuales * 5, color: '#3B82F6', label: 'Puntuales'  },
                        { value: d.e_tardias   * 5, color: '#EF4444', label: 'Tardias'    },
                        { value: d.e_recreo    * 5, color: '#10B981', label: 'Recreo'     },
                        { value: d.e_prof      * 5, color: '#A855F7', label: 'Profesores' },
                    ],
                },
                salida: {
                    segments: [
                        { value: d.s_regulares  * 5, color: '#3B82F6', label: 'Regulares'   },
                        { value: d.s_anticipadas* 5, color: '#EF4444', label: 'Anticipadas' },
                        { value: d.s_busrecreo  * 5, color: '#10B981', label: 'Transporte/Recreo'  },
                        { value: d.s_prof       * 5, color: '#EAB308', label: 'Profesores' },
                    ],
                },
            };
        }),
    };
}

app.get('/api/dashboard', async (req, res) => { // Endpoint para dar las metricas principales KPIS y grficos
    try {
        const totalAlumnos = await odooExec('gestion_entrada.alumno', 'search_count', [[]]);

        const hoy = new Date();
        const hoyStr = hoy.toISOString().split('T')[0];

        //KPIs de hoy (asistencia / incidencias) - se calcula siempre desde "hoy real"
        const recordsHoy = await odooExec(
            'gestion_entrada.registro',
            'search_read',
            [[['dateTime', '>=', hoyStr + ' 00:00:00'], ['dateTime', '<=', hoyStr + ' 23:59:59']]],
            { fields: ['reg_type'] }
        );
        let asistenciaHoy = 0, incidenciasHoy = 0;
        (recordsHoy || []).forEach(r => {
            if (REG_TYPES_ASISTENCIA.includes(r.reg_type)) asistenciaHoy++;
            if (REG_TYPES_INCIDENCIA.includes(r.reg_type)) incidenciasHoy++;
        });
        
        const asistenciaMedia = totalAlumnos > 0 // Calcula el prodcentaje de alumnos que vineieron hoy
            ? Math.min(Math.round((asistenciaHoy / totalAlumnos) * 100), 100)
            : 0;

            //COntruye los datos de la semana principal
        const semanaParam = req.query.semana && /^\d{4}-\d{2}-\d{2}$/.test(req.query.semana)
            ? req.query.semana
            : hoyStr;
        const semanaData = await buildChartDataForWeek(semanaParam);

        //Funcionalidad de modo comparacion
        let semana2Data = null;
        if (req.query.semana2 && /^\d{4}-\d{2}-\d{2}$/.test(req.query.semana2)) {
            semana2Data = await buildChartDataForWeek(req.query.semana2);
        }

        return res.json({ // Devolucion de los datos
            success: true,
            kpis: { asistenciaHoy, incidenciasHoy, asistenciaMedia: `${asistenciaMedia}%` },
            semana: semanaData,
            semana2: semana2Data,
            chartData: semanaData.chartData,
        });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

app.get('/api/registros-paginado', async (req, res) => { // Tabla de registros
    const tipo   = String(req.query.tipo || '').toLowerCase(); // Tipo de pestaña entrada o salida
    const fecha  = String(req.query.fecha || '').trim();
    const curso  = req.query.curso ? String(req.query.curso).trim() : null;
    const usrTypeFiltro = req.query.usr_type ? String(req.query.usr_type).trim() : null;
    const buscar = req.query.buscar ? String(req.query.buscar).trim() : null;
    // Limite de la paginacion ya que es infinita, hace peticiones de 200 en 200
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
        // Si se pide de un curso especifico se consulta solo a esos primeramente
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

        const domain = [
            ['dateTime', '>=', fechaInicio],
            ['dateTime', '<=', fechaFin],
        ];
        if (uidsCurso !== null) {
            domain.push(['uid', 'in', uidsCurso]);
        }

        const todosRegistros = await odooExec( // Coge datos crudos basados en fehca y curso
            'gestion_entrada.registro',
            'search_read',
            [domain],
            {
                fields: ['uid', 'usr_type', 'reg_type', 'dateTime', 'profesor_id'],
                order: 'dateTime desc',
                limit: 1000,
            }
        ) || [];

        //Primero se filtra por tipo entrada o salida
        const filtradosPorTipo = todosRegistros.filter(r => regTypes.includes(r.reg_type));

        const uidsUnicos = [...new Set(filtradosPorTipo.map(r => r.uid).filter(Boolean))];

        const fieldsAlumno = ['name', 'surname', 'school_year', 'photo'];
        const fieldsProfesor = ['name', 'surname', 'photo'];

        const resoluciones = await Promise.all( // lanza n promesas asingcronas para buscar de quine es cada tarjeta
            uidsUnicos.map(uid =>
                buscarPersonaPorUid(uid, fieldsAlumno, fieldsProfesor)
                    .then(r => ({ uid, r }))
                    .catch(() => ({ uid, r: { found: false } }))
            )
        );

        const indicePorUid = {}; // Agrupacion de datos
        for (const { uid, r } of resoluciones) {
            indicePorUid[uid] = r;
        }

        // Combinacion de datos añadoendo nombre, foto
        const enriquecidosTodos = filtradosPorTipo.map(r => {
            const res = indicePorUid[r.uid];
            const persona = (res && res.found) ? res.persona : null;
            const modelo  = (res && res.found) ? res.modelo  : null;

            //profesor_id en Odoo viene como [id, "Nombre Apellido"]
            let operadorNombre = null;
            let operadorIdReg = null;
            if (Array.isArray(r.profesor_id) && r.profesor_id.length >= 2) {
                operadorIdReg = r.profesor_id[0];
                operadorNombre = r.profesor_id[1];
            }

            return {
                id: r.id,
                uid: r.uid,
                usr_type: modelo || r.usr_type,
                reg_type: r.reg_type,
                dateTime: r.dateTime,
                nombre:      persona ? `${persona.name || ''} ${persona.surname || ''}`.trim() : 'Desconocido',
                curso:       (persona && persona.school_year) ? persona.school_year : null,
                cursoLargo:  (persona && persona.school_year) ? getCursoCompleto(persona.school_year) : null,
                photo:       persona ? (persona.photo || null) : null,
                operadorNombre,
                operadorId: operadorIdReg,
            };
        });

        let filtradosFinales = enriquecidosTodos;
        if (usrTypeFiltro === 'alumno' || usrTypeFiltro === 'profesor') { // Filtrado de tipo
            filtradosFinales = filtradosFinales.filter(r => r.usr_type === usrTypeFiltro);
        }
        if (buscar) { // Filtro en barra de busqueda
            const buscarLower = buscar.toLowerCase();
            filtradosFinales = filtradosFinales.filter(r => {
                const enNombre   = (r.nombre || '').toLowerCase().includes(buscarLower);
                const enOperador = (r.operadorNombre || '').toLowerCase().includes(buscarLower);
                return enNombre || enOperador; // Se ecuentra si el usuario se llama asi o el profesor se llama asi
            });
        }

        const total = filtradosFinales.length; // Calculo de total de elemntos para que el front sepa cunado detener el scroll
        const enriquecidos = filtradosFinales.slice(offset, offset + limit); // paginacion que extrae solo el bloque que se pide

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

app.post('/api/vincular-nfc', async (req, res) => {
    const { id, tipo, uid } = req.body; // Se extrae el id del usuario a escanear, el tipo y el uid a vincular

    if (!id || !tipo || !uid) {
        return sendError(res, 400, 'Faltan datos obligatorios (id, tipo, uid)');
    }
    if (tipo !== 'alumno' && tipo !== 'profesor') {
        return sendError(res, 400, "tipo debe ser 'alumno' o 'profesor'");
    }

    try {
        const uidLimpio = prefijoUid(uid); // Normalizacion de id
        const idNum = parseInt(id, 10);

        const existeAlumno = await odooExec( // Verificacion de si existe o no un usuario ya con ese uid
            'gestion_entrada.alumno',
            'search_read',
            [[['uid', '=', uidLimpio]]],
            { fields: ['id', 'name', 'surname'], limit: 1 }
        );
        if (existeAlumno && existeAlumno.length > 0) {
            const ocupado = existeAlumno[0];
            const esEsteMismo = tipo === 'alumno' && ocupado.id === idNum;
            if (!esEsteMismo) {
                return res.status(409).json({ // Si la tiene otro devuelve error 
                    success: false,
                    code: 'UID_EN_USO',
                    message: `UID ya asignado a ${ocupado.name} ${ocupado.surname || ''}`.trim(),
                    ocupado: { id: ocupado.id, tipo: 'alumno', nombre: `${ocupado.name} ${ocupado.surname || ''}`.trim() }
                });
            }
        }

        const existeProfesor = await odooExec( // Misma logica anterior pero con los profesores
            'gestion_entrada.profesor',
            'search_read',
            [[['uid', '=', uidLimpio]]],
            { fields: ['id', 'name', 'surname'], limit: 1 }
        );
        if (existeProfesor && existeProfesor.length > 0) {
            const ocupado = existeProfesor[0];
            const esEsteMismo = tipo === 'profesor' && ocupado.id === idNum;
            if (!esEsteMismo) {
                return res.status(409).json({
                    success: false,
                    code: 'UID_EN_USO',
                    message: `UID ya asignado a ${ocupado.name} ${ocupado.surname || ''}`.trim(),
                    ocupado: { id: ocupado.id, tipo: 'profesor', nombre: `${ocupado.name} ${ocupado.surname || ''}`.trim() }
                });
            }
        }

        // si la tarjeta esta libre ejecuta la actualizacion del usaurio añadiendole el uid nuevo
        const modelo = tipo === 'alumno' ? 'gestion_entrada.alumno' : 'gestion_entrada.profesor';
        await odooExec(modelo, 'write', [[idNum], { uid: uidLimpio }]);

        console.log(`Vinculacion OK: ${tipo} id=${idNum} -> uid=${uidLimpio}`);
        return res.json({ success: true, message: 'NFC vinculado correctamente' });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => { // Metodo para encender el servidor y que escuche en todas las interfaces
    console.log(`Server ready at port ${PORT}`);
});