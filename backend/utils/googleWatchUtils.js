import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import db from '../db/db.js'
import { getValidAccessToken } from './tokenUtils.js'

export async function startCalendarWatch(userId, calendarId) {
  const accessToken = await getValidAccessToken(userId)
  const channelId = uuidv4()

  const webhookUrl = process.env.GOOGLE_CALENDAR_WEBHOOK_URL

  const body = {
    id: channelId,
    type: 'web_hook',
    address: webhookUrl,
  }

  const response = await axios.post(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/watch`,
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  )


  db.data.subscriptions = db.data.subscriptions || []
  db.data.subscriptions.push({
    userId,
    calendarId,
    channelId,
    resourceId: response.data.resourceId,
    expiration: parseInt(response.data.expiration),
    createdAt: Date.now()
  })

  await db.write()

  return {
    channelId,
    resourceId: response.data.resourceId,
    expiration: response.data.expiration
  }
}
