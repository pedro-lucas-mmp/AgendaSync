import axios from 'axios'
import db from '../db/db.js'
import { getValidAccessToken } from '../utils/tokenUtils.js'
import { startCalendarWatch } from '../utils/googleWatchUtils.js'

export async function inicializarSync(userId) {
  try {
    const accessToken = await getValidAccessToken(userId)

    const agendaResponse = await axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    await db.read()
    const agendas = agendaResponse.data.items
    db.data.agendas = db.data.agendas || []
    db.data.events = db.data.events || []
    db.data.channels = db.data.channels || []

    for (const agenda of agendas) {
      const existeAgenda = db.data.agendas.some(a => a.userId === userId && a.calendarId === agenda.id)
      if (!['owner', 'writer'].includes(agenda.accessRole)) {
        console.log(`[Sync] Ignorando agenda ${agenda.id} por accessRole: ${agenda.accessRole}`)
        continue
        }
      if (!existeAgenda) {
        db.data.agendas.push({
          userId,
          calendarId: agenda.id,
          summary: agenda.summary,
          primary: agenda.primary || false
        })
      }

      try {
        let pageToken
        do {
          const res = await axios.get(`https://www.googleapis.com/calendar/v3/calendars/${agenda.id}/events`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: {
              timeMin: new Date().toISOString(),
              timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              singleEvents: true,
              orderBy: 'startTime',
              maxResults: 100,
              pageToken
            }
          })

          res.data.items.forEach(event => {
            const existeEvento = db.data.events.some(e => e.eventId === event.id && e.calendarId === agenda.id)
            if (!existeEvento) {
              db.data.events.push({
                calendarId: agenda.id,
                eventId: event.id,
                summary: event.summary,
                start: event.start,
                end: event.end,
                attendees: event.attendees || [],
                updated: event.updated
              })
            }
          })

          pageToken = res.data.nextPageToken
        } while (pageToken)

        const canalExistente = db.data.channels.find(c =>
          c.userId === userId && c.calendarId === agenda.id
        )

        if (!canalExistente) {
          await startCalendarWatch(userId, agenda.id)
        }
      } catch (erroAgenda) {
        console.error(`[Sync] Erro na agenda ${agenda.id}: ${erroAgenda.message}`)
      }
    }

    await db.write()
    console.log(`[Sync] Sincronização concluída para o usuário ${userId}`)
  } catch (erroGlobal) {
    console.error(`[Sync] Erro geral durante sync do usuário ${userId}: ${erroGlobal.message}`)
  }
}
