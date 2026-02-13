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
    res.send('Servidor Odoo funcionando correctamente.');
});

app.post('/api/verificar-tarjeta', (req, res) => {
    const { tarjetaId } = req.body;
    console.log(`\nUID Recibido: ${tarjetaId} -> Consultando Odoo...`);

    const odoo = new Odoo(odooConfig);

    odoo.connect((err) => {
        if (err) {
            console.error('Error de conexión con Odoo:', err);
            return res.status(500).json({ success: false, error: 'Fallo conexión Odoo' });
        }
        odoo.execute_kw(
            'gestion_entrada.alumno', 
            'search_read', 
            [
                [[['uid', '=', tarjetaId]]], 
                {
                    fields: ['name', 'surname', 'photo'],
                    limit: 1
                }
            ],(err, result) => {
            if (err) {
                console.error('Error en búsqueda Odoo:', err);
                return res.status(500).json({ success: false, error: err });
            }

            if (result && result.length > 0) {

                const alumno = result[0];
                const nombreCompleto = `${alumno.name} ${alumno.surname}`;

                console.log(`ALUMNO ENCONTRADO: ${nombreCompleto}`);

                return res.json({
                    success: true,
                    nombre: nombreCompleto,
                    foto: alumno.photo || null,
                    autorizado: true
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

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor listo en http://localhost:${PORT}`);
});