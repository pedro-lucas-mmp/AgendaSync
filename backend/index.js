import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import http from "http"
import { Server } from "socket.io"

import authRoutes from './routes/auth.js'
import calendarRoutes from './routes/calendar.js'
import webhookRoutes from './routes/webhook.js'
import userRoutes from './routes/user.js'

dotenv.config()

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
})

app.set('io', io)

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(express.json())

app.use('/auth', authRoutes)
app.use('/calendar', calendarRoutes)
app.use('/webhook', webhookRoutes)
app.use('/user', userRoutes)

io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado ao WebSocket:', socket.id)
})

const PORT = 5000
server.listen(PORT, () => console.log(`Backend on http://localhost:${PORT}`))
