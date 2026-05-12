const express = require('express');
const cors = require('cors');
const Odoo = require('odoo-xmlrpc');
const multer = require('multer'); // Librería para subir archivos
const csv = require('csv-parser'); // Librería para leer CSV
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configuración de Multer para archivos temporales
const upload = multer({ dest: 'uploads/' });

const odooConfig = {
    url: 'http://10.102.7.16', 
    port: 8069,
    db: 'ControlAcceso', 
    username: 'albertoroaf@gmail.com',
    password: 'AlberPabKil123'
};

// Función auxiliar para arreglar fechas de CSV (de DD/MM/AAAA a AAAA-MM-DD)
const formatCSVDate = (dateStr) => {
    if (!dateStr || !dateStr.includes('/')) return dateStr;
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
};

app.get('/', (req, res) => {
    res.send('<h1>Servidor Node Activo</h1><p>Conectado a Odoo en 10.102.7.16</p>');
});

// --- LOGIN ROUTE ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`\nIntento de login para: [${username}]`);
    const odoo = new Odoo(odooConfig);
    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false, message: 'Fallo conexión Odoo' });
        const params = [[['username', '=', username.trim()], ['user_pass', '=', password.trim()]], ['name', 'surname', 'email', 'username', 'is_management'], 0, 1];
        odoo.execute_kw('gestion_entrada.profesor', 'search_read', [params], (err, result) => {
            if (err) return res.status(500).json({ success: false, message: 'Error interno en Odoo' });
            if (result && result.length > 0) {
                const u = result[0];
                return res.json({ success: true, usuario: { id: u.id, nombre: u.name, apellidos: u.surname, role: u.is_management ? 'directiva' : 'profesor' } });
            }
            res.status(401).json({ success: false, message: "Credenciales incorrectas" });
        });
    });
});

// --- LISTADOS ---
app.get('/api/alumnos', (req, res) => {
    const odoo = new Odoo(odooConfig);
    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false });
        odoo.execute_kw('gestion_entrada.alumno', 'search_read', [[], { fields: ['uid', 'name', 'surname', 'school_year', 'can_bus', 'photo'] }], (err, result) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true, alumnos: result });
        });
    });
});

app.get('/api/profesores', (req, res) => {
    const odoo = new Odoo(odooConfig);
    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false });
        odoo.execute_kw('gestion_entrada.profesor', 'search_read', [[], { fields: ['uid', 'name', 'surname', 'email', 'photo'] }], (err, result) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true, profesores: result });
        });
    });
});

// --- CRUD ALUMNOS ---
app.post('/api/alumnos', (req, res) => {
    const { name, surname, school_year, can_bus, photo, birth_date, email } = req.body;
    const odoo = new Odoo(odooConfig);
    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false });
        odoo.execute_kw('gestion_entrada.alumno', 'create', [[{ name, surname, school_year, can_bus, photo, birth_date, email }]], (err, result) => {
            if (err) return res.status(500).json({ success: false, error: err });
            res.json({ success: true, id: result });
        });
    });
});

app.put('/api/alumnos/:id', (req, res) => {
    const alumnoId = parseInt(req.params.id);
    const odoo = new Odoo(odooConfig);
    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false });
        odoo.execute_kw('gestion_entrada.alumno', 'write', [[[alumnoId], req.body]], (err, result) => {
            if (err) return res.status(500).json({ success: false, error: err });
            res.json({ success: true });
        });
    });
});

app.delete('/api/alumnos/:id', (req, res) => {
    const odoo = new Odoo(odooConfig);
    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false });
        odoo.execute_kw('gestion_entrada.alumno', 'unlink', [[[parseInt(req.params.id)]]], (err, result) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true });
        });
    });
});

// --- REGISTROS ---
app.get('/api/registros/:uid', (req, res) => {
    const odoo = new Odoo(odooConfig);
    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false });
        odoo.execute_kw('gestion_entrada.registro', 'search_read', [[[['uid', '=', req.params.uid]]], { fields: ['dateTime', 'reg_type', 'usr_type'], order: 'dateTime desc' }], (err, result) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true, registros: result });
        });
    });
});

// --- CRUD PROFESORES ---
app.post('/api/profesores', (req, res) => {
    const odoo = new Odoo(odooConfig);
    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false });
        odoo.execute_kw('gestion_entrada.profesor', 'create', [[req.body]], (err, result) => {
            if (err) return res.status(500).json({ success: false, error: err });
            res.json({ success: true, id: result });
        });
    });
});

app.put('/api/profesores/:id', (req, res) => {
    const profId = parseInt(req.params.id);
    const odoo = new Odoo(odooConfig);
    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false });
        odoo.execute_kw('gestion_entrada.profesor', 'write', [[[profId], req.body]], (err, result) => {
            if (err) return res.status(500).json({ success: false, error: err });
            res.json({ success: true });
        });
    });
});

app.delete('/api/profesores/:id', (req, res) => {
    const odoo = new Odoo(odooConfig);
    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false });
        odoo.execute_kw('gestion_entrada.profesor', 'unlink', [[[parseInt(req.params.id)]]], (err, result) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true });
        });
    });
});

// ==========================================
// RUTA DE IMPORTACIÓN MASIVA (CSV)
// ==========================================
app.post('/api/importar-csv/:tipo', upload.single('archivo'), (req, res) => {
    const tipo = req.params.tipo;
    const model = tipo === 'alumnos' ? 'gestion_entrada.alumno' : 'gestion_entrada.profesor';

    if (!req.file) return res.status(400).json({ success: false, message: "No se recibió archivo" });

    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(csv({ mapHeaders: ({ header }) => header.trim() })) 
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            const odoo = new Odoo(odooConfig);
            odoo.connect(async (err) => {
                if (err) return res.status(500).json({ success: false });

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
                    
                    await new Promise(resolve => {
                        odoo.execute_kw(model, 'create', [[datos]], (err) => {
                            if (!err) exitos++;
                            resolve();
                        });
                    });
                }
                fs.unlinkSync(req.file.path);
                res.json({ success: true, message: `Importados ${exitos} de ${results.length}` });
            });
        });
});

app.get('/api/exportar-accesos', (req, res) => {
    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) return res.status(500).json({ error: "Fallo conexión" });

        const domain = []; 
        const options = {
            // Usamos los nombres exactos que vimos en tu captura de Odoo
            fields: ['alumno_name', 'alumno_surname', 'profesor_name', 'profesor_surname', 'reg_type', 'dateTime', 'alumno_curso'],
            order: 'dateTime desc'
        };

        odoo.execute_kw('gestion_entrada.registro', 'search_read', [domain, options], (err, registros) => {
            if (err) {
                console.error("❌ Error de Odoo:", err);
                return res.status(500).json({ error: "Error de lectura", detalle: err.faultString || err });
            }

            if (!registros || registros.length === 0) {
                return res.status(404).json({ error: "No hay datos para exportar" });
            }

            // Construimos el CSV
            const encabezado = "Nombre,Apellidos,Tipo,Fecha y Hora,Curso,Responsable\n";
            const filas = registros.map(r => {
                // Si es un alumno, usamos sus campos; si es un profesor, los suyos
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

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Node corriendo en http://10.102.7.2:${PORT}`); 
});