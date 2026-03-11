import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Load data
const shipDataPath = path.join(__dirname, 'data', 'ships.json');
const missileDataPath = path.join(__dirname, 'data', 'missiles.json');

let ships = JSON.parse(fs.readFileSync(shipDataPath, 'utf8'));
let missiles = JSON.parse(fs.readFileSync(missileDataPath, 'utf8'));

// Real-time state simulation
const updateRealTimeData = () => {
    ships = ships.map(ship => ({
        ...ship,
        realtime: {
            systemStatus: Math.random() > 0.95 ? 'Warning: Maintenance' : 'Operational',
            energyOutput: (Math.random() * 20 + 80).toFixed(1) + '%',
            lastPulse: new Date().toLocaleTimeString(),
            currentCoordinates: {
                lat: (Math.random() * 180 - 90).toFixed(4),
                lng: (Math.random() * 360 - 180).toFixed(4)
            }
        }
    }));
};

// Update every 10 seconds
setInterval(updateRealTimeData, 10000);
updateRealTimeData();

// Routes
app.get('/api/ships', (req, res) => {
    res.json(ships);
});

app.get('/api/ships/:id', (req, res) => {
    const ship = ships.find(s => s.id === req.params.id);
    if (ship) res.json(ship);
    else res.status(404).json({ message: 'Ship not found' });
});

app.get('/api/missiles', (req, res) => {
    res.json(missiles);
});

app.get('/api/missiles/:id', (req, res) => {
    const missile = missiles.find(m => m.id === req.params.id);
    if (missile) res.json(missile);
    else res.status(404).json({ message: 'Missile not found' });
});

app.listen(PORT, () => {
    console.log(`Maritime Backend running at http://localhost:${PORT}`);
});
