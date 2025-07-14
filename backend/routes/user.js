import express from 'express'
import axios from 'axios'
import db from '../db/db.js'

const router = express.Router()

router.get('/user-email/:userId', async (req, res) => {
  const { userId } = req.params

  const user = db.data.users.find(u => u.id === userId)
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })

  return res.json({ email: user.email })
})

export default router