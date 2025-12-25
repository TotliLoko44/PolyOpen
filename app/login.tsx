import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, Text, TextInput, View } from 'react-native'
import { supabase } from './lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onLogin = async () => {
    const e = email.trim().toLowerCase()

    if (!e || !password) {
      Alert.alert('Missing info', 'Enter your email and password.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: e,
      password,
    })
    setLoading(false)

    if (error) {
      // Most common when you didn’t confirm email yet:
      // "Email not confirmed"
      Alert.alert('Login failed', error.message)
      return
    }

    if (!data.session) {
      Alert.alert(
        'Not logged in yet',
        'If this is a new account, confirm your email first, then try again.'
      )
      return
    }

    router.replace('/dashboard')
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 34, fontWeight: '700', marginBottom: 18 }}>
        Log in
      </Text>

      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 6 }}>
        Email
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          padding: 14,
          borderRadius: 12,
          marginBottom: 14,
        }}
      />

      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 6 }}>
        Password
      </Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          padding: 14,
          borderRadius: 12,
          marginBottom: 18,
        }}
      />

      <Pressable
        onPress={onLogin}
        disabled={loading}
        style={{
          backgroundColor: 'black',
          paddingVertical: 16,
          borderRadius: 14,
          alignItems: 'center',
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
          {loading ? 'Logging in…' : 'Log in'}
        </Text>
      </Pressable>

      <Link href="/signup" asChild>
        <Pressable style={{ paddingVertical: 16, alignItems: 'center' }}>
          <Text style={{ color: 'blue', fontSize: 16, fontWeight: '700' }}>
            Need an account? Sign up
          </Text>
        </Pressable>
      </Link>

      <Link href="/" asChild>
        <Pressable style={{ paddingVertical: 8, alignItems: 'center' }}>
          <Text style={{ color: 'blue', fontSize: 16 }}>
            ← Back to Home
          </Text>
        </Pressable>
      </Link>
    </View>
  )
}


