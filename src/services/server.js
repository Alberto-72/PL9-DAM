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
    url: 'http://10.102.8.22',
    port: 8072,
    db: 'admin',
    username: 'admin',
    password: 'admin'
};

// const odooConfig = {
//     url: 'http://10.102.7.192',
//     port: 8069,
//     db: 'ControlAcceso',
//     username: 'albertoroaf@gmail.com',
//     password: 'AlberPabKil123'
// };

// Mapping of school_year selection keys to full course names
const CURSOS = [
    ['1ESO', '1º Educación Secundaria Obligatoria'],
    ['2ESO', '2º Educación Secundaria Obligatoria'],
    ['3ESO', '3º Educación Secundaria Obligatoria'],
    ['3ESODIV', '3º ESO - Diversificación'],
    ['4ESO', '4º Educación Secundaria Obligatoria'],
    ['4ESODIV', '4º ESO - Diversificación'],
    ['1BACH_CIEN', '1º Bachillerato Ciencias y Tecnología'],
    ['2BACH_CIEN', '2º Bachillerato Ciencias y Tecnología'],
    ['1BACH_HCS', '1º Bachillerato Humanidades y C. Sociales'],
    ['2BACH_HCS', '2º Bachillerato Humanidades y C. Sociales'],
    ['1CFGB_AGR', '1º CFGB Aprovechamientos Forestales'],
    ['2CFGB_AGR', '2º CFGB Agrojardinería y Comp. Florales'],
    ['1CFGM_SMR', '1º CFGM Sistemas Microinformáticos y Redes'],
    ['2CFGM_SMR', '2º CFGM Sistemas Microinformáticos y Redes'],
    ['1CFGM_ACMN', '1º CFGM Aprovechamiento y Cons. Medio Natural'],
    ['2CFGM_ACMN', '2º CFGM Aprovechamiento y Cons. Medio Natural'],
    ['1DAM', '1º CFGS Desarrollo de Aplicaciones Multiplataforma'],
    ['2DAM', '2º CFGS Desarrollo de Aplicaciones Multiplataforma'],
    ['1CFGS_GFMN', '1º CFGS Gestión Forestal y del Medio Natural'],
    ['2CFGS_GFMN', '2º CFGS Gestión Forestal y del Medio Natural']
];

function getCursoCompleto(key) {
    if (!key || key === false) return null;
    const found = CURSOS.find(([short]) => short === key);
    return found ? found[1] : key;
}

// Test route
app.get('/', (req, res) => {
    res.send('Servidor Odoo funcionando correctamente.');
});

// Main route: NFC
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

// Get all students
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
                    fields: ['uid', 'name', 'surname', 'photo', 'school_year', 'birth_date', 'can_bus']
                }
            ], (err, result) => {
                if (err) {
                    console.error('Error obteniendo alumnos:', err);
                    return res.status(500).json({ success: false, error: err });
                }

                const alumnos = (result || []).map(alumno => {
                    const cursoCorto = (alumno.school_year && alumno.school_year !== false) ? alumno.school_year : null;

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
                [[['username', '=', username], ['user_pass', '=', password]]],
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
                    console.log(`LOGIN EXITOSO: ${userData.name} ${userData.surname} (User: ${userData.username})`);

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

// CHANGE PASSWORD - RAW SQL DIRECTO (la única forma que evita todos los errores de firma XML-RPC)
app.post('/api/change-password', (req, res) => {
    const { username, newPassword } = req.body;
    console.log(`\nRequest to change password for user: ${username}`);

    if (!username || !newPassword) {
        return res.status(400).json({ success: false, message: "Username and newPassword are required" });
    }

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error connecting to Odoo in change-password:', err);
            return res.status(500).json({ success: false, message: 'Odoo connection failed' });
        }

        // Find user
        odoo.execute_kw(
            'gestion_entrada.profesor',
            'search_read',
            [
                [[['username', '=', username]]],
                { fields: ['id'], limit: 1 }
            ],
            (err, result) => {
                if (err || !result || result.length === 0) {
                    console.error('User not found:', username);
                    return res.status(404).json({ success: false, message: 'User not found' });
                }

                const userId = result[0].id;
                console.log(`User found (ID ${userId}), updating password with RAW SQL...`);

                // RAW SQL DIRECTO - formato correcto que funciona con la librería
                odoo.execute_kw(
                    'gestion_entrada.profesor',
                    'execute',
                    ['UPDATE gestion_entrada_profesor SET user_pass = %s WHERE id = %s', [newPassword, userId]],
                    (err, result) => {
                        if (err) {
                            console.error('Error updating password with RAW SQL:', err);
                            return res.status(500).json({ success: false, message: err.message || 'Error updating password' });
                        }

                        console.log(`Password updated successfully for user: ${username} (ID: ${userId})`);
                        return res.json({ success: true, message: 'Password updated successfully' });
                    }
                );
            }
        );
    });
});

// Profile endpoint
app.get('/api/user/:username', (req, res) => {
    const username = req.params.username;
    
    console.log(`\nRequesting profile data for user: ${username}`);

    if (!username || username === 'null' || username === 'undefined') {
        return res.status(400).json({ success: false, message: "Invalid username" });
    }

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error connecting to Odoo:', err);
            return res.status(500).json({ success: false, message: 'Odoo connection failed' });
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
                    console.error('Error or user not found in Odoo:', err);
                    return res.status(500).json({ success: false, message: 'User not found' });
                }

                const userData = result[0];
                return res.json({
                    success: true,
                    user: {
                        nombre: userData.name,
                        apellidos: userData.surname,
                        username: userData.username,
                        uid: userData.uid || 'Not linked',
                        rol: userData.is_management ? 'Directiva' : 'Profesor'
                    }
                });
            }
        );
    });
});

// Start server on port 3001
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server ready at http://localhost:${PORT}`);
});