// ES module server
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, "data.json");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// read/write helpers
async function readData() {
  try {
    const txt = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(txt);
  } catch (e) {
    return { users: [], complaints: [] };
  }
}
async function writeData(obj) {
  await fs.writeFile(DATA_FILE, JSON.stringify(obj, null, 2), "utf8");
}

// create default demo data if missing
async function ensureDataFile() {
  const exists = await fs.access(DATA_FILE).then(() => true).catch(() => false);
  if (!exists) {
    const defaultData = {
      users: [
        { id: 1, username: "stationUser", password: "5678", role: "station" },
        { id: 2, username: "companyAdmin", password: "1234", role: "company" }
      ],
      complaints: []
    };
    await writeData(defaultData);
    console.log("Created data.json with demo users");
  } else {
    // ensure demo users exist (idempotent)
    const data = await readData();
    const hasStation = (data.users || []).some(u => u.username === "stationUser");
    const hasCompany = (data.users || []).some(u => u.username === "companyAdmin");
    if (!hasStation || !hasCompany) {
      data.users = data.users || [];
      if (!hasStation) data.users.push({ id: Date.now()+1, username: "stationUser", password: "5678", role: "station" });
      if (!hasCompany) data.users.push({ id: Date.now()+2, username: "companyAdmin", password: "1234", role: "company" });
      await writeData(data);
      console.log("Updated data.json users to required demo accounts");
    }
  }
}

// --- Auth ---
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username & password required" });

  const data = await readData();
  const user = (data.users || []).find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const token = `demo-token-${user.id}-${Date.now()}`;
  return res.json({ token, role: user.role, username: user.username });
});

// --- Complaints CRUD ---
app.get("/api/complaints", async (req, res) => {
  const data = await readData();
  res.json(data.complaints || []);
});

app.post("/api/complaints", async (req, res) => {
  const { name, email, issue } = req.body || {};
  if (!name || !issue) return res.status(400).json({ error: "name & issue required" });

  const data = await readData();
  const complaint = {
    id: Date.now(),
    name,
    email: email || "",
    issue,
    status: "Submitted",
    created_at: new Date().toISOString()
  };
  data.complaints.unshift(complaint);
  await writeData(data);
  res.status(201).json(complaint);
});

app.patch("/api/complaints/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  const data = await readData();
  const idx = (data.complaints || []).findIndex(c => Number(c.id) === id);
  if (idx === -1) return res.status(404).json({ error: "Complaint not found" });
  if (status) data.complaints[idx].status = status;
  data.complaints[idx].updated_at = new Date().toISOString();
  await writeData(data);
  res.json(data.complaints[idx]);
});

app.delete("/api/complaints/:id", async (req, res) => {
  const id = Number(req.params.id);
  const data = await readData();
  data.complaints = (data.complaints || []).filter(c => Number(c.id) !== id);
  await writeData(data);
  res.json({ success: true });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/", (req, res) => res.send("Backend running. Use /api/* endpoints."));

await ensureDataFile();

app.listen(PORT, () => {
  console.log(`✅ Backend listening at http://localhost:${PORT}`);
  console.log(`Demo accounts: stationUser/5678 (station), companyAdmin/1234 (company)`);
});
