import express from "express";
import http from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import stripeWebhook from "./routes/stripeWebhook.js";
import paypalWebhook from "./routes/paypalWebhook.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || "*",
  },
});

app.set("io", io);

app.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    stack: "railway-node-express-socketio-mongodb",
    ts: new Date().toISOString(),
  });
});

app.use(stripeWebhook);
app.use(paypalWebhook);

// normal JSON routes AFTER raw Stripe webhook
app.use(express.json());

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);
});

await mongoose.connect(process.env.MONGODB_URI);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`NoblePort rails online on port ${port}`);
});
