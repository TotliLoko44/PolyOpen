import { Stack, usePathname, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function RootLayout() {
  const router = useRouter()
  const pathname = usePathname()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (loading) return

    const onHome = pathname === '/'
    const onLogin = pathname === '/login'
    const onSignup = pathname === '/signup'
    const onDashboard = pathname === '/dashboard'

    // Logged in → dashboard
    if (session && (onHome || onLogin || onSignup)) {
      router.replace('/dashboard')
    }

    // Logged out → home
    if (!session && onDashboard) {
      router.replace('/')
    }
  }, [loading, session, pathname])

  if (loading) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="dashboard" />
    </Stack>
  )
}
