import express from 'express'
import axios from 'axios'
import db from '../db/db.js'
import { v4 as uuidv4 } from 'uuid'
import {inicializarSync} from '../services/syncService.js'

const router = express.Router()

router.get('/google', async (req, res) => {
  const state = uuidv4()
  const scope = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
  ].join(' ')

  const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&state=${state}&prompt=consent&include_granted_scopes=false`

  res.json({ url: redirectUrl })
})

router.get('/callback', async (req, res) => {
  const { code } = req.query

  try {
    const response = await axios.post(`https://oauth2.googleapis.com/token`, null, {
      params: {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      }
    })

    const tokens = response.data

    const userInfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    })

    const email = userInfo.data.email

    let user = db.data.users.find(u => u.email === email)

    if (!user) {
      user = {
        id: uuidv4(),
        email,
        ...tokens
      }
      db.data.users.push(user)
    } else {
      user.access_token = tokens.access_token
      if (tokens.refresh_token) {
        user.refresh_token = tokens.refresh_token
      }
    }

    await db.write()
    await inicializarSync(user.id)

    res.redirect(`${process.env.FRONTEND_URL}/agendas?userId=${user.id}`)
  } catch (err) {
    console.error(err.response?.data || err.message)
    res.status(500).json({ error: 'Erro ao obter token' })
  }
})

export default router
