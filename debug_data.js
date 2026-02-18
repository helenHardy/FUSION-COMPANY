
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing ENV vars")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debug() {
    const resultUsers = await supabase.from('profiles').select('id, current_rank, monthly_pvg').limit(5)
    if (resultUsers.error) console.error("Error users:", resultUsers.error)
    console.log('--- USERS ---')
    console.log(resultUsers.data)

    const resultRanks = await supabase.from('ranks').select('name, royalties_config')
    if (resultRanks.error) console.error("Error ranks:", resultRanks.error)
    console.log('--- RANKS ---')
    console.log(resultRanks.data)
}

debug()
