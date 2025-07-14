import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { io } from 'socket.io-client'
import styled from 'styled-components'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const socket = io(BACKEND_URL, {
  extraHeaders: {
    'ngrok-skip-browser-warning': 'true',
  },
})

function EventForm({ userId, calendarId, event, onSave, onCancel }) {
  const [summary, setSummary] = useState(event?.summary || '')
  const [start, setStart] = useState(event ? new Date(event.start.dateTime || event.start.date).toISOString().slice(0,16) : '')
  const [end, setEnd] = useState(event ? new Date(event.end.dateTime || event.end.date).toISOString().slice(0,16) : '')
  const [attendees, setAttendees] = useState(event?.attendees?.map(a => a.email).join(', ') || '')
  const isEdit = !!event

  const handleSubmit = async (e) => {
    e.preventDefault()
    const eventData = {
      summary,
      start: { dateTime: new Date(start).toISOString() },
      end: { dateTime: new Date(end).toISOString() },
      attendees: attendees
        .split(',')
        .map(email => email.trim())
        .filter(Boolean)
        .map(email => ({ email }))
    }

    const url = `${BACKEND_URL}/calendar/events/${userId}/${calendarId}${isEdit ? '/' + event.eventId : ''}`
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify(eventData)
      })
      if (!res.ok) throw new Error('Erro ao salvar evento')
      const data = await res.json()
      onSave(data)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <Form onSubmit={handleSubmit}>
      <h3>{isEdit ? 'Editar Evento' : 'Criar Evento'}</h3>
      <Input
        type="text"
        placeholder="Título"
        value={summary}
        onChange={e => setSummary(e.target.value)}
        required
      />
      <label>Início:</label><br />
      <Input
        type="datetime-local"
        value={start}
        onChange={e => setStart(e.target.value)}
        required
      /><br />
      <label>Fim:</label><br />
      <Input
        type="datetime-local"
        value={end}
        onChange={e => setEnd(e.target.value)}
        required
      /><br />
      <label>Convidados (e-mails, separados por vírgula):</label><br />
      <Input
        type="text"
        placeholder="exemplo1@gmail.com, exemplo2@gmail.com"
        value={attendees}
        onChange={e => setAttendees(e.target.value)}
      /><br />
      <Button type="submit">{isEdit ? 'Salvar' : 'Criar'}</Button>
      <Button type="button" onClick={onCancel}>Cancelar</Button>
    </Form>
  )
}

export default function Agendas() {
  const router = useRouter()
  const { userId } = router.query
  const [calendars, setCalendars] = useState([])
  const [userEmail, setUserEmail] = useState(null)
  const [events, setEvents] = useState({})
  const [nextPageTokens, setNextPageTokens] = useState({})
  const [selectedCalendarId, setSelectedCalendarId] = useState(null)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [creatingNew, setCreatingNew] = useState(false)



  useEffect(() => {
  if (!userId) return

  // Buscar agendas
  fetch(`${BACKEND_URL}/calendar/list-calendars/${userId}`,{
    headers: {
      'ngrok-skip-browser-warning': 'true',
    },
  })
    .then(res => res.json())
    .then(data => setCalendars(data.items || []))
    .catch(console.error)

  // Buscar email do usuário
  fetch(`${BACKEND_URL}/user/user-email/${userId}`,{
    headers: {
      'ngrok-skip-browser-warning': 'true',
    },
  })
    .then(res => res.json())
    .then(data => setUserEmail(data.email || null))
    .catch(console.error)

  // WebSocket listener
  const eventoKey = `eventosAtualizados-${userId}`
  socket.on(eventoKey, (data) => {
    console.log('📣 Eventos atualizados via WebSocket:', data)
    if (data.reFetch && fetchEvents(data.calendarId))
    // Atualiza eventos da agenda atualmente selecionada
    if (selectedCalendarId === data.calendarId) {
      fetchEvents(selectedCalendarId)
    }
  })

  return () => {
    socket.off(eventoKey)
  }
}, [userId])

  const fetchEvents = (calendarId, pageToken = null) => {
    if (!userId) return
    setSelectedCalendarId(calendarId)
    setLoadingEvents(true)

    let url = `${BACKEND_URL}/calendar/events/${userId}/${calendarId}`
    if (pageToken) url += `?pageToken=${pageToken}`

    fetch(url,{
    headers: {
      'ngrok-skip-browser-warning': 'true',
    },
  })
      .then(res => res.json())
      .then(data => {
        setEvents(prev => ({
          ...prev,
          [calendarId]: pageToken
            ? [...(prev[calendarId] || []), ...data.items]
            : data.items
        }))
        setNextPageTokens(prev => ({
          ...prev,
          [calendarId]: data.nextPageToken
        }))
        setLoadingEvents(false)
      })
      .catch(err => {
        console.error(err)
        setLoadingEvents(false)
      })
  }

  const handleSaveEvent = (savedEvent) => {
    setEvents(prev => {
      const evts = prev[selectedCalendarId] || []
      const idx = evts.findIndex(e => e.id === savedEvent.id)

      let newEvents
      if (idx > -1) {
        newEvents = [...evts]
        newEvents[idx] = savedEvent
      } else {
        newEvents = [savedEvent, ...evts]
      }
      return { ...prev, [selectedCalendarId]: newEvents }
    })
    setEditingEvent(null)
    setCreatingNew(false)
  }

  const handleDeleteEvent = async (eventId) => {
    if (!userId || !selectedCalendarId) return
    try {
      const res = await fetch(
        `${BACKEND_URL}/calendar/events/${userId}/${selectedCalendarId}/${eventId}`,
        {
          method: 'DELETE',
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        }
      )
      if (!res.ok) throw new Error('Erro ao deletar evento')

      setEvents(prev => ({
        ...prev,
        [selectedCalendarId]: prev[selectedCalendarId].filter(ev => ev.id !== eventId)
      }))

      if (editingEvent?.id === eventId) {
        setEditingEvent(null)
      }
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <Container>
      <Title>Meus Calendários</Title>

      <CalendarList>
        {calendars.map(cal => (
          <CalendarItem key={cal.id}>
            <strong>{cal.summary}</strong> &nbsp;
            <Button onClick={() => fetchEvents(cal.id)}>Ver eventos</Button>
          </CalendarItem>
        ))}
      </CalendarList>

      {selectedCalendarId && (
        <div>
          <h3>Eventos do calendário</h3>
          <Button onClick={() => { setCreatingNew(true); setEditingEvent(null) }}>Criar novo evento</Button>

          {creatingNew && (
            <EventForm
              userId={userId}
              calendarId={selectedCalendarId}
              onSave={handleSaveEvent}
              onCancel={() => setCreatingNew(false)}
            />
          )}

          <EventList>
            {loadingEvents && <li>Carregando eventos...</li>}
            {events[selectedCalendarId]?.length > 0 ? (
              events[selectedCalendarId].map(ev => {
                const isGuest = Array.isArray(ev.attendees) && ev.attendees.some((attendee) => attendee?.email === userEmail);
                return (
                  <EventItem key={ev.eventId}>
                    <span onClick={() => { setEditingEvent(ev); setCreatingNew(false) }}>
                      <SubTitle creator={isGuest}>
                        {isGuest ? "Evento como Convidado" : "Meu evento"}
                      </SubTitle>
                      📅 {ev.summary || '(Sem título)'}<br />
                      🕒 {ev.start?.dateTime || ev.start?.date} → {ev.end?.dateTime || ev.end?.date}

                      {ev.attendees?.length > 0 && (
                        <div>
                          <br />
                          👥 Convidados:
                          <ul>
                            {ev.attendees.map((att, i) => (
                              <li key={i}>
                                {att.email} — <strong>{att.responseStatus}</strong>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </span>
                    <DangerButton onClick={() => handleDeleteEvent(ev.eventId)}>
                      {isGuest ? 'Sair do Evento' : 'Excluir Evento'}
                    </DangerButton>
                  </EventItem>
                );
              })
            ) : (
              !loadingEvents && <li>📅 Sem eventos registrados!</li>
            )}
          </EventList>


          {nextPageTokens[selectedCalendarId] && !loadingEvents && (
            <Button onClick={() => fetchEvents(selectedCalendarId, nextPageTokens[selectedCalendarId])}>
              Carregar mais
            </Button>
          )}

          {editingEvent && (
            <EventForm
              userId={userId}
              calendarId={selectedCalendarId}
              event={editingEvent}
              onSave={handleSaveEvent}
              onCancel={() => setEditingEvent(null)}
            />
          )}
        </div>
      )}
    </Container>
  )
}

const Container = styled.section`
  padding: 20px;
  max-width: 700px;
  margin: 0 auto;
  align-content: center;
  background-color: aliceblue;
  border-radius: 25px;
  font-family: Arial, sans-serif;
`

const Title = styled.h2`
  margin-bottom: 1rem;
  color: #333;
`
const SubTitle = styled.h4`
  margin-bottom: 1rem;
  color: ${({ creator }) => (creator ? '#0070f3' : 'green')};
`

const CalendarList = styled.ul`
  list-style: none;
  padding-left: 0;
`

const CalendarItem = styled.li`
  margin-bottom: 1rem;
`

const Button = styled.button`
  cursor: pointer;
  background-color: #0070f3;
  border: none;
  color: white;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  font-weight: bold;
  margin-left: 0.5rem;

  &:hover {
    background-color: #005bb5;
  }
`

const EventList = styled.ul`
  list-style: none;
  padding-left: 0;
`

const EventItem = styled.li`
  cursor: pointer;
  margin-bottom: 0.5rem;
  background-color: #f7f7f7;
  padding: 0.5rem;
  border-radius: 4px;

  span {
    display: block;
  }
`

const DangerButton = styled(Button)`
  background-color: #e00;
  margin-left: 1rem;

  &:hover {
    background-color: #a00;
  }
`

const Form = styled.form`
  border: 1px solid #ccc;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 6px;
  background: #fafafa;
`

const Label = styled.label`
  font-weight: bold;
  margin-top: 0.5rem;
  display: block;
`

const Input = styled.input`
  width: 100%;
  margin-bottom: 0.5rem;
  padding: 0.4rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
`
