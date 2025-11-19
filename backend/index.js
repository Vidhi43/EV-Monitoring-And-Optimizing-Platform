import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const dbFile = path.join(process.cwd(), "db.json");


const defaultData = { users: [] };
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, defaultData);

await db.read();

if (!db.data.users || db.data.users.length === 0) {
  db.data.users = [
    { id: 1, role: "company", username: "companyAdmin", password: "1234", name: "Company Admin" },
    { id: 2, role: "station", username: "stationUser", password: "5678", name: "Station User" }
  ];
  await db.write();
}


app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  await db.read();

  const user = db.data.users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ ok: false, message: "Invalid credentials" });
  }

  const token = Buffer.from(`${user.id}:${user.username}`).toString("base64");
  res.json({
    ok: true,
    token,
    user: { id: user.id, username: user.username, role: user.role, name: user.name },
  });
});

app.get("/api/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ ok: false, message: "No auth header" });

  const token = auth.replace("Bearer ", "");
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const [idStr, username] = decoded.split(":");
    const id = Number(idStr);

    await db.read();
    const user = db.data.users.find((u) => u.id === id && u.username === username);
    if (!user) return res.status(401).json({ ok: false, message: "Invalid token" });

    res.json({ ok: true, user });
  } catch {
    res.status(401).json({ ok: false, message: "Invalid token format" });
  }
});

const PORT = 4000;
app.listen(PORT, () =>
  console.log(`✅ Backend running on http://localhost:${PORT}`)
);
