
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRanks() {
    console.log('--- CHECKING RANKS CONFIGURATION ---')
    const { data: ranks, error } = await supabase
        .from('ranks')
        .select('name, royalties_config, min_pvg')
        .order('min_pvg', { ascending: true })

    if (error) {
        console.error('Error fetching ranks:', error)
        return
    }

    console.table(ranks)

    console.log('\n--- CHECKING PROFILES (First 5) ---')
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('email, current_rank, monthly_pvg')
        .limit(5)

    if (pError) {
        console.error('Error fetching profiles:', pError)
        return
    }

    console.table(profiles)
}

checkRanks()
