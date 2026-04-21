import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://baxbpwqxxvyakznsckuo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJheGJwd3F4eHZ5YWt6bnNja3VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjI3ODksImV4cCI6MjA5MDY5ODc4OX0.WECdqkbF0siZge7tDLuIkDQGS9T2YmRcI42miKPMQqI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)