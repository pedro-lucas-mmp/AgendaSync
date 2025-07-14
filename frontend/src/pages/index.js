import { useEffect, useState } from 'react'

export default function Home() {
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
  const [authUrl, setAuthUrl] = useState(null)
  console.log(BACKEND_URL)
  useEffect(() => {
    fetch(`${BACKEND_URL}/auth/google`,{
    headers: {
      'ngrok-skip-browser-warning': 'true',
    },
  })
      .then(res => res.json())
      .then(data => setAuthUrl(data.url))
  }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Agenda Sync</h1>
      {authUrl && <a href={authUrl}><button>Conectar com Google</button></a>}
    </div>
  )
}