const express = require('express');
const cors = require('cors');
const Odoo = require('odoo-xmlrpc');

const app = express();
app.use(cors());
app.use(express.json());

const odooConfig = {
    url: 'http://10.102.7.237',
    port: 8069,
    db: 'ControlAcceso',
    username: 'albertoroaf@gmail.com',
    password: 'AlberPabKil123'
};

app.get('/', (req, res) => {
    res.send('<h1>Servidor Node Activo</h1><p>Conectado a Odoo en 10.102.7.237</p>');
});

// --- RUTA DE LOGIN ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`\nIntento de login para: [${username}]`);
    const odoo = new Odoo(odooConfig);
    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false, message: 'Fallo conexión Odoo' });
        
        const params = [
            [['username', '=', username.trim()], ['password', '=', password.trim()]],
            ['name', 'surname', 'email', 'username', 'is_management'],
            0, 1
        ];

        odoo.execute_kw('gestion_entrada.profesor', 'search_read', [params], (err, result) => {
            if (err) return res.status(500).json({ success: false, message: 'Error interno en Odoo' });
            if (result && result.length > 0) {
                const u = result[0];
                console.log(`LOGIN EXITOSO: ${u.name}`);
                return res.json({
                    success: true,
                    usuario: {
                        id: u.id,
                        nombre: u.name,
                        apellidos: u.surname,
                        role: u.is_management ? 'directiva' : 'profesor'
                    }
                });
            }
            res.status(401).json({ success: false, message: "Credenciales incorrectas" });
        });
    });
});

// --- RUTA ALUMNOS: Corregida para evitar Error 500 ---
app.get('/api/alumnos', (req, res) => {
    console.log("Petición de lista de alumnos recibida...");
    const odoo = new Odoo(odooConfig);
    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false });

        // AÑADIMOS 'photo' a la lista de campos
        const domain = [[]]; 
        const fields = ['uid', 'name', 'surname', 'school_year', 'can_bus', 'photo'];
        
        odoo.execute_kw('gestion_entrada.alumno', 'search_read', [domain, { fields: fields }], (err, result) => {
            if (err) {
                console.error("ERROR ODOO ALUMNOS:", err);
                return res.status(500).json({ success: false });
            }
            res.json({ success: true, alumnos: result });
        });
    });
});

// --- RUTA PARA OBTENER PROFESORES ---
app.get('/api/profesores', (req, res) => {
    console.log("Petición de lista de profesores recibida...");
    const odoo = new Odoo(odooConfig);
    odoo.connect((err) => {
        if (err) return res.status(500).json({ success: false });

        // Filtros y campos para el modelo de profesores
        const domain = [[]]; 
        const fields = ['uid', 'name', 'surname', 'email'];
        
        odoo.execute_kw('gestion_entrada.profesor', 'search_read', [domain, { fields: fields }], (err, result) => {
            if (err) {
                console.error("ERROR ODOO PROFESORES:", err);
                return res.status(500).json({ success: false });
            }
            res.json({ success: true, profesores: result });
        });
    });
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Node corriendo en http://10.102.7.200:${PORT}`);
});