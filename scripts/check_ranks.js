
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Try to find .env file
const envPath = path.resolve(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials in .env')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkRanks() {
    const { data, error } = await supabase.from('ranks').select('name, royalties_config')
    if (error) {
        console.error('Error fetching ranks:', error)
    } else {
        console.log('--- RANKS CONFIGURATION ---')
        console.table(data)
    }
}

checkRanks()
