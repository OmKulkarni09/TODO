import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AuthProvider, { useAuth } from './components/AuthProvider.jsx'
import ConfirmProvider from './components/ConfirmProvider.jsx'
import Login from './components/Login.jsx'
import { Loader2 } from 'lucide-react'
import './index.css'

function AuthGate() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-venom-300">
        <Loader2 className="animate-spin" size={28} />
      </div>
    )
  }
  return user ? <App /> : <Login />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ConfirmProvider>
        <AuthGate />
      </ConfirmProvider>
    </AuthProvider>
  </React.StrictMode>,
)
