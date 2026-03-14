import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { GoogleGenAI } from "@google/genai";

declare module 'express-session' {
  interface SessionData {
    userId: number;
    username: string;
  }
}

const PORT = 3000;
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Configuration de la session
app.use(session({
  secret: 'kiosk-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    httpOnly: true,
  }
}));

// S'assurer que le dossier des uploads existe
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, Date.now() + '-' + safeName);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Servir les fichiers statiques du dossier uploads
app.use('/uploads', express.static(uploadsDir));

// Configuration de la base de données
const db = new Database('playlist.db');

// --- INITIALISATION DES TABLES ---

db.exec(`
  CREATE TABLE IF NOT EXISTS screens (
    id TEXT PRIMARY KEY,
    loop_playlist INTEGER DEFAULT 1,
    theme TEXT DEFAULT 'modern',
    layout_mode TEXT DEFAULT 'fullscreen',
    sidebar_config TEXT,
    flash_message TEXT,
    last_ping DATETIME,
    current_item_id INTEGER,
    uptime_start DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS playlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    screen_id TEXT NOT NULL DEFAULT 'default',
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 10,
    order_index INTEGER NOT NULL DEFAULT 0,
    loop INTEGER DEFAULT 0,
    layout_config TEXT,
    FOREIGN KEY (screen_id) REFERENCES screens(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    reward REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_to TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    approved_at DATETIME
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS family (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL, -- 'Grand-parent', 'Parent', 'Enfant'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// --- MIGRATION : AJOUT DES COLONNES SI ELLES N'EXISTENT PAS ---
// Cela évite les erreurs 500 sur les anciennes bases de données
try {
  db.prepare("ALTER TABLE screens ADD COLUMN loop_playlist INTEGER DEFAULT 1").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE playlist ADD COLUMN loop INTEGER DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE playlist ADD COLUMN layout_config TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE playlist ADD COLUMN schedule TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE screens ADD COLUMN theme TEXT DEFAULT 'modern'").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE screens ADD COLUMN layout_mode TEXT DEFAULT 'fullscreen'").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE screens ADD COLUMN sidebar_config TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE screens ADD COLUMN flash_message TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE screens ADD COLUMN last_ping DATETIME").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE screens ADD COLUMN current_item_id INTEGER").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE screens ADD COLUMN uptime_start DATETIME").run();
} catch (e) {}

// Initialisation de l'écran par défaut
db.prepare("INSERT OR IGNORE INTO screens (id) VALUES ('default')").run();

// Création d'un utilisateur admin par défaut si aucun n'existe
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hashedPassword);
}

// --- MIDDLEWARE D'AUTHENTIFICATION ---

const requireAuth = (req: any, res: any, next: any) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Non authentifié' });
  }
};

// --- ROUTES D'AUTHENTIFICATION ---

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  
  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, user: { id: user.id, username: user.username } });
  } else {
    res.status(401).json({ error: 'Identifiants invalides' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session.userId) {
    res.json({ id: req.session.userId, username: req.session.username });
  } else {
    res.status(401).json({ error: 'Non authentifié' });
  }
});

// --- ROUTES MÉDIATHÈQUE ---

app.get('/api/media', requireAuth, (req, res) => {
  try {
    const media = db.prepare('SELECT * FROM media ORDER BY created_at DESC').all();
    res.json(media);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/media', requireAuth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
    
    const url = `/uploads/${req.file.filename}`;
    const type = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    const stmt = db.prepare('INSERT INTO media (name, url, type, size) VALUES (?, ?, ?, ?)');
    const info = stmt.run(req.file.originalname, url, type, req.file.size);
    
    res.json({ id: info.lastInsertRowid, url, name: req.file.originalname, type });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/media/:id', requireAuth, (req, res) => {
  try {
    const media = db.prepare('SELECT url FROM media WHERE id = ?').get(req.params.id) as any;
    if (media) {
      const filePath = path.join(process.cwd(), media.url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      db.prepare('DELETE FROM media WHERE id = ?').run(req.params.id);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ROUTES IA (GEMINI) ---

app.post('/api/ai/generate', requireAuth, async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { systemInstruction }
    });
    res.json({ text: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ROUTES API INGREDIENTS ---

db.exec(`
  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )
`);

// Populate ingredients if empty
const count = db.prepare('SELECT COUNT(*) as count FROM ingredients').get() as { count: number };
if (count.count === 0) {
  const commonIngredients = [
    'Ail', 'Oignon', 'Échalote', 'Persil', 'Ciboulette', 'Basilic', 'Coriandre', 'Thym', 'Romarin', 'Laurier',
    'Sel', 'Poivre', 'Sucre', 'Farine', 'Beurre', 'Huile d\'olive', 'Huile de tournesol', 'Vinaigre', 'Moutarde', 'Mayonnaise',
    'Œuf', 'Lait', 'Crème fraîche', 'Yaourt', 'Fromage', 'Emmental', 'Parmesan', 'Mozzarella', 'Chèvre', 'Camembert',
    'Pomme de terre', 'Carotte', 'Courgette', 'Aubergine', 'Poivron', 'Tomate', 'Haricot vert', 'Petit pois', 'Épinard', 'Salade',
    'Champignon', 'Poireau', 'Chou-fleur', 'Brocoli', 'Asperge', 'Artichaut', 'Céleri', 'Radis', 'Concombre', 'Betterave',
    'Poulet', 'Bœuf', 'Porc', 'Agneau', 'Veau', 'Canard', 'Dinde', 'Lardon', 'Jambon', 'Saucisse',
    'Saumon', 'Thon', 'Cabillaud', 'Crevette', 'Moule', 'Huître', 'Saint-Jacques', 'Sardine', 'Truite', 'Colin',
    'Pomme', 'Poire', 'Banane', 'Orange', 'Citron', 'Fraise', 'Framboise', 'Cerise', 'Abricot', 'Pêche',
    'Riz', 'Pâtes', 'Semoule', 'Quinoa', 'Lentille', 'Pois chiche', 'Haricot rouge', 'Boulgour', 'Maïs', 'Pain',
    'Chocolat', 'Miel', 'Confiture', 'Vanille', 'Cannelle', 'Gingembre', 'Curry', 'Paprika', 'Cumin', 'Noix de muscade',
    'Amande', 'Noisette', 'Noix', 'Pistache', 'Pignon de pin', 'Sésame', 'Graine de courge', 'Graine de tournesol', 'Chia', 'Lin',
    'Vin blanc', 'Vin rouge', 'Bière', 'Cidre', 'Rhum', 'Cognac', 'Liqueur', 'Café', 'Thé', 'Infusion',
    'Bouillon de bœuf', 'Bouillon de volaille', 'Bouillon de légumes', 'Fond de veau', 'Sauce soja', 'Sauce tomate', 'Pesto', 'Tapenade', 'Houmous', 'Guacamole',
    'Aneth', 'Cerfeuil', 'Estragon', 'Menthe', 'Sauge', 'Origan', 'Piment', 'Safran', 'Curcuma', 'Cardamome',
    'Ananas', 'Mangue', 'Kiwi', 'Melon', 'Pastèque', 'Raisin', 'Prune', 'Figue', 'Datte', 'Noix de coco',
    'Lotte', 'Bar', 'Dorade', 'Sole', 'Turbot', 'Raie', 'Gambas', 'Langoustine', 'Crabe', 'Homard',
    'Bacon', 'Chorizo', 'Salami', 'Pancetta', 'Coppa', 'Mortadelle', 'Foie gras', 'Magret', 'Gésier', 'Rillettes',
    'Roquefort', 'Brie', 'Comté', 'Beaufort', 'Reblochon', 'Maroilles', 'Munster', 'Gorgonzola', 'Feta', 'Ricotta',
    'Chou rouge', 'Chou vert', 'Chou de Bruxelles', 'Chou frisé', 'Endive', 'Fenouil', 'Navet', 'Panais', 'Topinambour', 'Patate douce',
    'Lentille corail', 'Pois cassé', 'Fève', 'Soja', 'Tofu', 'Seitan', 'Tempeh', 'Lait d\'amande', 'Lait de soja', 'Lait de coco',
    'Sirop d\'érable', 'Sirop d\'agave', 'Cassonade', 'Sucre glace', 'Levure chimique', 'Levure de boulanger', 'Bicarbonate', 'Fécule de maïs', 'Gélatine', 'Agar-agar',
    'Câpre', 'Cornichon', 'Olive verte', 'Olive noire', 'Anchois', 'Truffe', 'Morille', 'Cèpe', 'Girolle', 'Pleurote',
    'Noix de pécan', 'Noix de cajou', 'Noix du Brésil', 'Macadamia', 'Cranberry', 'Baie de goji', 'Myrtille', 'Mûre', 'Groseille', 'Cassis',
    'Ketchup', 'Harissa', 'Wasabi', 'Tahini', 'Miso', 'Nuoc-mâm', 'Worcestershire', 'Tabasco', 'Sriracha', 'Barbecue',
    'Mascarpone', 'Faisselle', 'St Moret', 'Philadelphia', 'Vache qui rit', 'Kiri', 'Babybel', 'Cheddar', 'Gouda', 'Mimolette',
    'Radis noir', 'Céleri-rave', 'Rutabaga', 'Crosne', 'Salsifis', 'Blette', 'Cardon', 'Ortie', 'Pissenlit', 'Pourpier',
    'Caille', 'Perdreau', 'Faisan', 'Lièvre', 'Sanglier', 'Chevreuil', 'Biche', 'Cerf', 'Kangourou', 'Autruche',
    'Grenouille', 'Escargot', 'Poulpe', 'Calamar', 'Seiche', 'Encornet', 'Oursin', 'Palourde', 'Coque', 'Couteau',
    'Wasabi', 'Yuzu', 'Kombu', 'Wakame', 'Nori', 'Shiitake', 'Enoki', 'Shimeji', 'Daikon', 'Edamame',
    'Graine de pavot', 'Graine de nigelle', 'Graine de fenouil', 'Graine de coriandre', 'Graine de cumin', 'Graine de moutarde', 'Graine de carvi', 'Graine d\'anis', 'Graine de cardamome', 'Graine de céleri',
    'Piment d\'Espelette', 'Piment oiseau', 'Piment de Cayenne', 'Piment jalapeño', 'Piment habanero', 'Piment chipotle', 'Poivre de Sichuan', 'Poivre rose', 'Poivre blanc', 'Poivre vert',
    'Fleur de sel', 'Sel de Guérande', 'Sel rose de l\'Himalaya', 'Sel noir d\'Hawaï', 'Sel fumé', 'Sel de céleri', 'Sel de truffe', 'Gros sel', 'Sel fin', 'Sel de mer',
    'Huile de sésame', 'Huile de noix', 'Huile de noisette', 'Huile d\'avocat', 'Huile de pépins de raisin', 'Huile de colza', 'Huile de coco', 'Huile de lin', 'Huile de truffe', 'Huile de piment',
    'Vinaigre balsamique', 'Vinaigre de cidre', 'Vinaigre de vin rouge', 'Vinaigre de vin blanc', 'Vinaigre de riz', 'Vinaigre de framboise', 'Vinaigre de xérès', 'Vinaigre d\'alcool', 'Vinaigre de malt', 'Vinaigre de miel'
  ];
  const insert = db.prepare('INSERT OR IGNORE INTO ingredients (name) VALUES (?)');
  const transaction = db.transaction((items) => {
    for (const item of items) insert.run(item);
  });
  transaction(commonIngredients);
}

// --- ROUTES API INGREDIENTS ---

app.get('/api/ingredients', (req, res) => {
  try {
    const q = req.query.q as string;
    let ingredients;
    if (q) {
      ingredients = db.prepare('SELECT * FROM ingredients WHERE name LIKE ? LIMIT 20').all(`%${q}%`);
    } else {
      ingredients = db.prepare('SELECT * FROM ingredients ORDER BY name ASC LIMIT 50').all();
    }
    res.json(ingredients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ingredients', (req, res) => {
  try {
    const { name } = req.body;
    const stmt = db.prepare('INSERT OR IGNORE INTO ingredients (name) VALUES (?)');
    const info = stmt.run(name);
    const id = info.changes > 0 ? info.lastInsertRowid : (db.prepare('SELECT id FROM ingredients WHERE name = ?').get(name) as any).id;
    res.json({ id, name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ROUTES API BACKGROUNDS ---

app.get('/api/backgrounds', (req, res) => {
  const bgDir = path.join(process.cwd(), 'uploads', 'backgrounds');
  if (!fs.existsSync(bgDir)) {
    fs.mkdirSync(bgDir, { recursive: true });
  }
  const files = fs.readdirSync(bgDir);
  res.json(files.map(f => `/uploads/backgrounds/${f}`));
});

app.post('/api/backgrounds', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const bgDir = path.join(process.cwd(), 'uploads', 'backgrounds');
  if (!fs.existsSync(bgDir)) {
    fs.mkdirSync(bgDir, { recursive: true });
  }
  
  const fileName = `${Date.now()}-${req.file.originalname}`;
  const targetPath = path.join(bgDir, fileName);
  fs.renameSync(req.file.path, targetPath);
  
  res.json({ url: `/uploads/backgrounds/${fileName}` });
});

// Endpoint générique pour l'upload d'images (sans ajout à la playlist)
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// --- ROUTES API MENUS ---

app.get('/api/menus', (req, res) => {
  try {
    const menus = db.prepare('SELECT * FROM menus ORDER BY created_at DESC').all();
    res.json(menus);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/menus', (req, res) => {
  try {
    const { name, title, content } = req.body;
    const stmt = db.prepare('INSERT INTO menus (name, title, content) VALUES (?, ?, ?)');
    const info = stmt.run(name, title, JSON.stringify(content));
    res.json({ id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/menus/:id', (req, res) => {
  try {
    const menu = db.prepare('SELECT * FROM menus WHERE id = ?').get(req.params.id);
    if (!menu) return res.status(404).json({ error: 'Menu non trouvé' });
    res.json({ ...menu, content: JSON.parse((menu as any).content) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menus/:id', (req, res) => {
  try {
    const { name, title, content } = req.body;
    db.prepare('UPDATE menus SET name = ?, title = ?, content = ? WHERE id = ?')
      .run(name, title, JSON.stringify(content), req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/menus/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM menus WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ROUTES API TÂCHES ---

app.get('/api/tasks', (req, res) => {
  try {
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', (req, res) => {
  try {
    const { title, description, reward, assigned_to } = req.body;
    const stmt = db.prepare('INSERT INTO tasks (title, description, reward, assigned_to) VALUES (?, ?, ?, ?)');
    const info = stmt.run(title, description, reward || 0, assigned_to);
    res.json({ id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    let query = 'UPDATE tasks SET status = ?';
    const params: any[] = [status];

    if (status === 'finished') {
      query += ', finished_at = CURRENT_TIMESTAMP';
    } else if (status === 'approved') {
      query += ', approved_at = CURRENT_TIMESTAMP';
    }

    query += ' WHERE id = ?';
    params.push(req.params.id);

    db.prepare(query).run(...params);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ROUTES API FAMILY ---

app.get('/api/family', (req, res) => {
  try {
    const members = db.prepare('SELECT * FROM family ORDER BY role DESC, name ASC').all();
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/family', (req, res) => {
  try {
    const { name, role } = req.body;
    if (!name || !role) return res.status(400).json({ error: 'Nom et rôle requis' });
    const stmt = db.prepare('INSERT INTO family (name, role) VALUES (?, ?)');
    const info = stmt.run(name, role);
    res.json({ id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/family/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM family WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ROUTES API ---

// Récupérer les écrans et le nombre de médias
app.get('/api/screens', (req, res) => {
  try {
    const screens = db.prepare(`
      SELECT s.id as screen_id, s.loop_playlist, s.last_ping, s.current_item_id, s.uptime_start, COUNT(p.id) as item_count 
      FROM screens s
      LEFT JOIN playlist p ON s.id = p.screen_id
      GROUP BY s.id
    `).all();
    res.json(screens);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Créer un écran
app.post('/api/screens', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID requis' });
    db.prepare("INSERT OR IGNORE INTO screens (id) VALUES (?)").run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Configurer le mode boucle, le thème et le layout de l'écran
app.post('/api/screens/config', (req, res) => {
  try {
    const { screenId, loopPlaylist, theme, layoutMode, sidebarConfig } = req.body;
    db.prepare("UPDATE screens SET loop_playlist = ?, theme = ?, layout_mode = ?, sidebar_config = ? WHERE id = ?")
      .run(
        loopPlaylist !== undefined ? (loopPlaylist ? 1 : 0) : 1, 
        theme || 'modern', 
        layoutMode || 'fullscreen',
        sidebarConfig ? JSON.stringify(sidebarConfig) : null,
        screenId
      );
    
    io.to(screenId).emit('playlist_updated');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Envoyer un message flash à un écran
app.post('/api/screens/flash', (req, res) => {
  try {
    const { screenId, message } = req.body;
    // message: { text: string, duration: number, type: 'info' | 'warning' | 'error' }
    io.to(screenId).emit('flash_message', message);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un écran
app.delete('/api/screens/:screenId', (req, res) => {
  try {
    const { screenId } = req.params;
    db.prepare('DELETE FROM screens WHERE id = ?').run(screenId);
    io.to(screenId).emit('reload_player');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Récupérer la playlist complète d'un écran
app.get('/api/playlist', (req, res) => {
  try {
    const screenId = req.query.screenId || 'default';
    const screenInfo = db.prepare("SELECT loop_playlist, theme, layout_mode, sidebar_config FROM screens WHERE id = ?").get(screenId) as any;
    const items = db.prepare('SELECT * FROM playlist WHERE screen_id = ? ORDER BY order_index ASC').all(screenId);
    
    res.json({
      items,
      config: {
        loop_playlist: screenInfo ? !!screenInfo.loop_playlist : true,
        theme: screenInfo ? screenInfo.theme : 'modern',
        layout_mode: screenInfo ? screenInfo.layout_mode : 'fullscreen',
        sidebar_config: screenInfo && screenInfo.sidebar_config ? JSON.parse(screenInfo.sidebar_config) : null
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un média (Upload ou URL)
app.post('/api/playlist', upload.single('file'), (req, res) => {
  try {
    const { type, url, duration, screen_id, loop, layout_config, schedule } = req.body;
    const sid = screen_id || 'default';
    
    // S'assurer que l'écran existe (pour la contrainte de clé étrangère)
    db.prepare("INSERT OR IGNORE INTO screens (id) VALUES (?)").run(sid);
    
    const finalUrl = req.file ? `/uploads/${req.file.filename}` : url;
    
    const stmt = db.prepare('INSERT INTO playlist (type, url, duration, screen_id, loop, layout_config, schedule) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(type, finalUrl, parseInt(duration) || 10, sid, loop === 'true' ? 1 : 0, layout_config || null, schedule || null);
    
    io.to(sid).emit('playlist_updated');
    res.json({ id: info.lastInsertRowid, url: finalUrl });
  } catch (err: any) {
    console.error('Error adding to playlist:', err);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un média + suppression du fichier physique
app.delete('/api/playlist/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT screen_id, url FROM playlist WHERE id = ?').get(req.params.id) as any;
    
    if (item) {
      if (item.url.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), item.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      db.prepare('DELETE FROM playlist WHERE id = ?').run(req.params.id);
      io.to(item.screen_id).emit('playlist_updated');
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Réorganiser l'ordre des médias
app.post('/api/playlist/reorder', (req, res) => {
  try {
    const { items, screenId } = req.body;
    const sid = screenId || 'default';
    const stmt = db.prepare('UPDATE playlist SET order_index = ? WHERE id = ?');
    
    const transaction = db.transaction((updates: any[]) => {
      for (const update of updates) {
        stmt.run(update.order_index, update.id);
      }
    });
    
    transaction(items);
    io.to(sid).emit('playlist_updated');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- GESTION DES WEBSOCKETS ---



io.on('connection', (socket) => {
  const screenId = socket.handshake.query.screenId as string || 'default';
  socket.join(screenId);

  // Health Monitoring: Ping from screen
  socket.on('screen_ping', (data) => {
    const { currentItemId } = data;
    db.prepare("UPDATE screens SET last_ping = CURRENT_TIMESTAMP, current_item_id = ? WHERE id = ?")
      .run(currentItemId || null, screenId);
    
    // Si l'uptime_start n'est pas défini, on le définit maintenant
    const screen = db.prepare("SELECT uptime_start FROM screens WHERE id = ?").get(screenId) as any;
    if (!screen.uptime_start) {
      db.prepare("UPDATE screens SET uptime_start = CURRENT_TIMESTAMP WHERE id = ?").run(screenId);
    }
  });

  socket.on('force_reload', (sid) => {
    io.to(sid || screenId).emit('reload_player');
  });

  socket.on('next_slide', (sid) => {
    io.to(sid || screenId).emit('next_slide');
  });

  socket.on('prev_slide', (sid) => {
    io.to(sid || screenId).emit('prev_slide');
  });

  socket.on('pause_player', (sid) => {
    io.to(sid || screenId).emit('pause_player');
  });

  socket.on('resume_player', (sid) => {
    io.to(sid || screenId).emit('resume_player');
  });

  socket.on('flash_message', (data) => {
    const { sid, message } = data;
    io.to(sid || screenId).emit('flash_message', message);
  });
});

// --- DÉMARRAGE DU SERVEUR ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist/index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur Kiosk démarré sur http://localhost:${PORT}`);
  });
}

startServer();