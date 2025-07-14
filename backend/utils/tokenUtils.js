import axios from 'axios'
import db from '../db/db.js'

export async function getValidAccessToken(userId) {
  await db.read()
    //console.log(userId)
  const user = db.data.users.find(u => u.id === userId)
  if (!user) throw new Error('Usuário não encontrado')

  try {
    await axios.get('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: { Authorization: `Bearer ${user.access_token}` }
    })
    return user.access_token
  } catch (err) {
    if (err.response?.status !== 401) throw err

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: user.refresh_token,
        grant_type: 'refresh_token'
      }
    })

    user.access_token = tokenResponse.data.access_token
    await db.write()

    return user.access_token
  }
}