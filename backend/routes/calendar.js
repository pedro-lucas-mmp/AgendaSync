import express from 'express'
import axios from 'axios'
import db from '../db/db.js'
import { v4 as uuidv4 } from 'uuid'
import { getValidAccessToken } from '../utils/tokenUtils.js'
import { startCalendarWatch } from '../utils/googleWatchUtils.js'

const router = express.Router()

// Lista agendas
router.get('/list-calendars/:userId', async (req, res) => {
  const { userId } = req.params

  try {
    const accessToken = await getValidAccessToken(userId)
    const response = await axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    res.json(response.data)
  } catch (error) {
    console.error(error.response?.data || error.message)
    res.status(500).json({ error: 'Erro ao buscar calendários' })
  }
})
// // Lista eventos futuros com paginação (30 dias)
// router.get('/events/:userId/:calendarId', async (req, res) => {
//   const { userId, calendarId } = req.params
//   const { pageToken } = req.query

//   try {
//     const accessToken = await getValidAccessToken(userId)
//     const response = await axios.get(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
//       headers: { Authorization: `Bearer ${accessToken}` },
//       params: {
//         maxResults: 10,
//         singleEvents: true,
//         orderBy: 'startTime',
//         timeMin: new Date().toISOString(),
//         timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
//         pageToken
//       }
//     })

//     res.json({
//       items: response.data.items || [],
//       nextPageToken: response.data.nextPageToken || null
//     })
//   } catch (error) {
//     console.error(error.response?.data || error.message)
//     res.status(500).json({ error: 'Erro ao buscar eventos' })
//   }
// })
// Lista eventos futuros do banco local com paginação (30 dias)
router.get('/events/:userId/:calendarId', async (req, res) => {
  const { userId, calendarId } = req.params
  const { pageToken } = req.query
  const pageSize = 10
  const page = parseInt(pageToken || '1')

  try {
    await db.read()

    const now = new Date()
    const limit = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const eventos = db.data.events
      .filter(ev =>
        ev.calendarId === calendarId &&
        new Date(ev.start.dateTime || ev.start.date) >= now &&
        new Date(ev.start.dateTime || ev.start.date) <= limit
      )
      .sort((a, b) =>
        new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date)
      )

    const startIndex = (page - 1) * pageSize
    const paginatedItems = eventos.slice(startIndex, startIndex + pageSize)
    const hasMore = startIndex + pageSize < eventos.length

    res.json({
      items: paginatedItems,
      nextPageToken: hasMore ? page + 1 : null
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao acessar banco local' })
  }
})


// Cria evento (com opcional attendees)
router.post('/events/:userId/:calendarId', async (req, res) => {
  const { userId, calendarId } = req.params
  const eventData = req.body

  try {
    const accessToken = await getValidAccessToken(userId)
    const response = await axios.post(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      eventData,
      {
        params: { sendUpdates: 'all' },
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )
    res.json(response.data)
  } catch (error) {
    console.error(error.response?.data || error.message)
    res.status(500).json({ error: 'Erro ao criar evento' })
  }
})

// Atualiza evento
router.put('/events/:userId/:calendarId/:eventId', async (req, res) => {
  const { userId, calendarId, eventId } = req.params
  const updatedEvent = req.body

  try {
    const accessToken = await getValidAccessToken(userId)
    const response = await axios.put(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
      updatedEvent,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    res.json(response.data)
  } catch (error) {
    console.error(error.response?.data || error.message)
    res.status(500).json({ error: 'Erro ao atualizar evento' })
  }
})

// Delete de evento
router.delete('/events/:userId/:calendarId/:eventId', async (req, res) => {
  const { userId, calendarId, eventId } = req.params

  try {
    const accessToken = await getValidAccessToken(userId)
    console.log(accessToken)
    console.log(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`)
    await axios.delete(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    res.json({ success: true })
  } catch (error) {
    console.error(error.response?.data || error.message)
    res.status(500).json({ error: 'Erro ao deletar evento' })
  }
})

// Nova agenda
router.post('/create/:userId', async (req, res) => {
  const { userId } = req.params
  const calendarData = req.body

  try {
    const accessToken = await getValidAccessToken(userId)
    const response = await axios.post(
      `https://www.googleapis.com/calendar/v3/calendars`,
      calendarData,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    res.json(response.data)
  } catch (error) {
    console.error(error.response?.data || error.message)
    res.status(500).json({ error: 'Erro ao criar agenda' })
  }
})


export default router