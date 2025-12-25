import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, Text, TextInput, View } from 'react-native'
import { supabase } from './lib/supabase'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const onSignup = async () => {
    const e = email.trim().toLowerCase()

    if (!e || !password) {
      Alert.alert('Missing info', 'Enter an email and password.')
      return
    }
    if (password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.')
      return
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Confirm password must match.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: e,
      password,
    })
    setLoading(false)

    if (error) {
      Alert.alert('Sign up failed', error.message)
      return
    }

    // If email confirmation is ON in Supabase, session may be null until they confirm.
    if (!data.session) {
      Alert.alert(
        'Check your email',
        'Confirm your email address, then come back and log in.'
      )
      router.replace('/login')
      return
    }

    router.replace('/dashboard')
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 34, fontWeight: '700', marginBottom: 18 }}>
        Create account
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
          marginBottom: 14,
        }}
      />

      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 6 }}>
        Confirm password
      </Text>
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
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
        onPress={onSignup}
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
          {loading ? 'Creating…' : 'Create account'}
        </Text>
      </Pressable>

      <Link href="/login" asChild>
        <Pressable style={{ paddingVertical: 16, alignItems: 'center' }}>
          <Text style={{ color: 'blue', fontSize: 16, fontWeight: '700' }}>
            Already have an account? Log in
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



