// Express server connecting the mobile app with Odoo
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

// Odoo connection settings
const odooConfig = {
    url: 'http://10.102.7.237',
    port: 8069,
    db: 'ControlAcceso',
    username: 'albertoroaf@gmail.com',
    password: 'AlberPabKil123'
};

// Mapping of school_year selection keys to full course names
const CURSOS = {
    '1ESO': '1 Educacion Secundaria Obligatoria',
    '2ESO': '2 Educacion Secundaria Obligatoria',
    '3ESO': '3 Educacion Secundaria Obligatoria',
    '3ESODIV': '3 ESO - Diversificacion',
    '4ESO': '4 Educacion Secundaria Obligatoria',
    '4ESODIV': '4 ESO - Diversificacion',
    '1BACH_CIEN': '1 Bachillerato Ciencias y Tecnologia',
    '2BACH_CIEN': '2 Bachillerato Ciencias y Tecnologia',
    '1BACH_HCS': '1 Bachillerato Humanidades y C. Sociales',
    '2BACH_HCS': '2 Bachillerato Humanidades y C. Sociales',
    '1CFGB_AGR': '1 CFGB Aprovechamientos Forestales',
    '2CFGB_AGR': '2 CFGB Agrojardineria y Comp. Florales',
    '1CFGM_SMR': '1 CFGM Sistemas Microinformaticos y Redes',
    '2CFGM_SMR': '2 CFGM Sistemas Microinformaticos y Redes',
    '1CFGM_ACMN': '1 CFGM Aprovechamiento y Cons. Medio Natural',
    '2CFGM_ACMN': '2 CFGM Aprovechamiento y Cons. Medio Natural',
    '1DAM': '1 CFGS Desarrollo de Aplicaciones Multiplataforma',
    '2DAM': '2 CFGS Desarrollo de Aplicaciones Multiplataforma',
    '1CFGS_GFMN': '1 CFGS Gestion Forestal y del Medio Natural',
    '2CFGS_GFMN': '2 CFGS Gestion Forestal y del Medio Natural'
};

// Helper function to get the full course name from the selection key
function getCursoCompleto(key) {
    if (!key || key === false) return null;
    return CURSOS[key] || key;
}

// Test route to check if the server is running
app.get('/', (req, res) => {
    res.send('Servidor Odoo funcionando correctamente.');
});

// Main route: receives the NFC card UID and queries Odoo
app.post('/api/verificar-tarjeta', (req, res) => {
    const { tarjetaId } = req.body;
    console.log(`\nUID Recibido: ${tarjetaId} -> Consultando Odoo...`);

    // Create Odoo connection instance
    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ success: false, error: 'Fallo conexion Odoo' });
        }

        // Search in gestion_entrada.alumno model by UID
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

                // If student is found, return their full data
                if (result && result.length > 0) {
                    const alumno = result[0];
                    const nombreCompleto = `${alumno.name} ${alumno.surname}`;

                    // Get short key and full course name
                    const cursoCorto = (alumno.school_year && alumno.school_year !== false)
                        ? alumno.school_year
                        : null;
                    const cursoLargo = getCursoCompleto(alumno.school_year);

                    // Student found log
                    console.log(`ALUMNO ENCONTRADO: ${nombreCompleto}`);
                    console.log(`Foto: ${alumno.photo ? 'foto encontrada' : 'sin foto'}`);
                    console.log(`Curso: ${cursoCorto} -> ${cursoLargo}`);

                    // JSON response
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
                    // UID not found in database
                    console.log(`UID ${tarjetaId} no existe en la base de datos.`);
                    return res.json({
                        success: false,
                        message: "Tarjeta no registrada"
                    });
                }
            });
    });
});

// Route to get all registered students for the student list tab
app.get('/api/alumnos', (req, res) => {
    console.log('\nSolicitando lista de alumnos...');

    // Create Odoo connection instance
    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexion con Odoo:', err);
            return res.status(500).json({ success: false, error: 'Fallo conexion Odoo' });
        }

        // Fetch all students with extended fields
        odoo.execute_kw(
            'gestion_entrada.alumno',
            'search_read',
            [
                [[]],
                {
                    fields: ['uid', 'name', 'surname', 'photo', 'school_year', 'birth_date', 'can_bus']
                }
            ], (err, result) => {
                if (err) {
                    console.error('Error obteniendo alumnos:', err);
                    return res.status(500).json({ success: false, error: err });
                }

                // Map results to clean format for the app
                const alumnos = (result || []).map(alumno => {
                    const cursoCorto = (alumno.school_year && alumno.school_year !== false)
                        ? alumno.school_year
                        : null;

                    return {
                        uid: alumno.uid,
                        usr_type: 'alumno',
                        id: alumno.id,
                        nombre: `${alumno.name} ${alumno.surname}`,
                        foto: alumno.photo || null,
                        curso: cursoCorto,
                        cursoCompleto: getCursoCompleto(alumno.school_year),
                        fechaNacimiento: alumno.birth_date,
                        tieneTransporte: alumno.can_bus || false
                    };
                });

                console.log(`Total alumnos encontrados: ${alumnos.length}`);

                return res.json({
                    success: true,
                    alumnos: alumnos
                });
            });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`\nIntento de login para usuario: ${username}`);

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexión con Odoo en Login:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexión Odoo' });
        }

        odoo.execute_kw(
            'gestion_entrada.profesor',
            'search_read',
            [
                [[['username', '=', username], ['password', '=', password]]],
                {
                    fields: ['name', 'surname', 'email', 'username', 'is_management'],
                    limit: 1
                }
            ], 
            (err, result) => {
                if (err) {
                    console.error('Error en búsqueda de login en Odoo:', err);
                    return res.status(500).json({ success: false, message: 'Error interno de búsqueda' });
                }

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
                } else {
                    console.log(`LOGIN FALLIDO: Usuario o contraseña incorrectos (${username})`);
                    return res.status(401).json({
                        success: false,
                        message: "Usuario o contraseña no válidos"
                    });
                }
            }
        );
    });
});

app.post('/api/register', (req, res) => {
    const {uid, usr_type, mensajeEstado, dateTime} = req.body
    console.log(uid, usr_type, mensajeEstado, dateTime)
    const odoo = new Odoo(odooConfig)

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexión con Odoo en Login:', err);
            return res.status(500).json({ success: false, message: 'Fallo conexión Odoo' });
        }
        if (!uid || !usr_type || !mensajeEstado){
            console.log("ERROR en los datos pasados")
            return
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
                if (err){
                    console.error("Error:", err);
                    return
                } 
                console.log("Registro creado con el ID:", result);
                return 
            }
        )
    })
})

// Start server on port 3001
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor listo en http://localhost:${PORT}`);
});