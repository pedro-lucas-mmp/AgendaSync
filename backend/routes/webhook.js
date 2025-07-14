import express from 'express'
import axios from 'axios'
import db from '../db/db.js'
import { getValidAccessToken } from '../utils/tokenUtils.js'

const router = express.Router()

router.post('/google-calendar', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log("Sincronização assincrona aqui emm: 🫡")
  try {
    const channelId = req.header('X-Goog-Channel-ID')
    const resourceState = req.header('X-Goog-Resource-State')
    const resourceId = req.header('X-Goog-Resource-ID')

    console.log('-- Webhook recebido:', { channelId, resourceState, resourceId })

    const channel = db.data.subscriptions.find(c => c.channelId === channelId)
    if (!channel) return res.status(404).end()

    const user = db.data.users.find(u => u.id === channel.userId)
    if (!user) return res.status(404).end()

    const accessToken = await getValidAccessToken(channel.userId)

    const response = await axios.get(`https://www.googleapis.com/calendar/v3/calendars/${channel.calendarId}/events`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 50
      }
    })

    db.data.events = db.data.events || []
    db.data.events = db.data.events.filter(e => e.calendarId !== channel.calendarId)
    response.data.items.forEach(item => {
      db.data.events.push({
        calendarId: channel.calendarId,
        eventId: item.id,
        summary: item.summary,
        start: item.start,
        end: item.end,
        attendees: item.attendees || []
      })
    })

    await db.write()

    console.log(`Eventos sincronizados para calendarId ${channel.calendarId}:`, response.data.items.length)

    // WebSocket: notificar o cliente
    const io = req.app.get('io')
    io.emit(`eventosAtualizados-${channel.userId}`, {
      reFetch: true,
      calendarId: channel.calendarId,
      totalEventos: response.data.items.length
    })

    res.status(200).end()
  } catch (err) {
    console.error('Erro no webhook:', err)
    res.status(500).end()
  }
})

export default router
