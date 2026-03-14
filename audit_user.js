import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing ENV vars")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function auditUser() {
    const searchName = 'RAYMUNDO MAMANI HUARITO'

    console.log('='.repeat(80))
    console.log(`AUDITORÍA DE USUARIO: ${searchName}`)
    console.log('='.repeat(80))

    // 1. Find the user profile
    console.log('\n--- 1. PERFIL DEL USUARIO ---')
    const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', `%RAYMUNDO%MAMANI%`)

    if (profErr) { console.error('Error:', profErr); return }
    if (!profiles || profiles.length === 0) {
        console.log('Usuario NO encontrado. Buscando de otra manera...')
        // Try searching by parts
        const { data: p2, error: e2 } = await supabase
            .from('profiles')
            .select('*')
            .or('full_name.ilike.%RAYMUNDO%,full_name.ilike.%MAMANI HUARITO%')
        if (e2) console.error('Error:', e2)
        console.log('Resultados alternativos:', JSON.stringify(p2, null, 2))
        if (!p2 || p2.length === 0) return
    }

    const user = profiles && profiles.length > 0 ? profiles[0] : null
    if (!user) { console.log('No se encontró el usuario'); return }

    console.log(JSON.stringify(user, null, 2))
    const userId = user.id

    // 2. Check sponsor/upline
    console.log('\n--- 2. PATROCINADOR (UPLINE) ---')
    if (user.sponsor_id) {
        const { data: sponsor } = await supabase
            .from('profiles')
            .select('id, full_name, current_rank, referral_code')
            .eq('id', user.sponsor_id)
            .single()
        console.log('Patrocinador:', JSON.stringify(sponsor, null, 2))
    } else {
        console.log('SIN PATROCINADOR (sponsor_id es null)')
    }

    // 3. Check direct referrals (downline)
    console.log('\n--- 3. REFERIDOS DIRECTOS (DOWNLINE) ---')
    const { data: referrals, error: refErr } = await supabase
        .from('profiles')
        .select('id, full_name, current_rank, monthly_pvg, created_at')
        .eq('sponsor_id', userId)
    if (refErr) console.error('Error:', refErr)
    console.log(`Total referidos directos: ${referrals?.length || 0}`)
    if (referrals && referrals.length > 0) {
        console.log(JSON.stringify(referrals, null, 2))
    }

    // 4. Check orders/purchases
    console.log('\n--- 4. ÓRDENES/COMPRAS ---')
    const { data: orders, error: ordErr } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    if (ordErr) console.error('Error orders:', ordErr)
    console.log(`Total órdenes: ${orders?.length || 0}`)
    if (orders && orders.length > 0) {
        orders.forEach(o => {
            console.log(`  Orden #${o.id}: total=${o.total}, status=${o.status}, pvp=${o.pvp_total || 'N/A'}, fecha=${o.created_at}`)
        })
    }

    // 5. Check PV points
    console.log('\n--- 5. PUNTOS PV ---')
    console.log(`  monthly_pvp (personal): ${user.monthly_pvp || 0}`)
    console.log(`  monthly_pvg (grupal): ${user.monthly_pvg || 0}`)
    console.log(`  current_rank: ${user.current_rank || 'SIN RANGO'}`)

    // 6. Check rank info
    console.log('\n--- 6. INFO DE RANGOS ---')
    const { data: ranks } = await supabase
        .from('ranks')
        .select('*')
        .order('level', { ascending: true })
    if (ranks) {
        console.log('Rangos disponibles:')
        ranks.forEach(r => {
            const marker = r.name === user.current_rank ? ' <<<< RANGO ACTUAL' : ''
            console.log(`  ${r.level}. ${r.name} (min_pvp=${r.min_personal_pv || 0}, min_pvg=${r.min_group_pv || 0})${marker}`)
        })
    }

    // 7. Check commissions/bonuses
    console.log('\n--- 7. COMISIONES ---')
    const { data: commissions, error: comErr } = await supabase
        .from('commissions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
    if (comErr) console.error('Error commissions:', comErr)
    console.log(`Total comisiones: ${commissions?.length || 0}`)
    if (commissions && commissions.length > 0) {
        commissions.forEach(c => {
            console.log(`  Comisión: type=${c.type || c.commission_type}, amount=${c.amount}, status=${c.status}, fecha=${c.created_at}`)
        })
    }

    // 8. Check network levels (genealogy)
    console.log('\n--- 8. RED/GENEALOGÍA (3 niveles) ---')
    // Level 1 - direct referrals  
    const level1Ids = referrals?.map(r => r.id) || []
    console.log(`  Nivel 1: ${level1Ids.length} personas`)

    if (level1Ids.length > 0) {
        // Level 2
        const { data: level2 } = await supabase
            .from('profiles')
            .select('id, full_name, current_rank, monthly_pvg, sponsor_id')
            .in('sponsor_id', level1Ids)
        console.log(`  Nivel 2: ${level2?.length || 0} personas`)
        if (level2 && level2.length > 0) {
            level2.forEach(p => console.log(`    - ${p.full_name} (rank: ${p.current_rank || 'N/A'}, pvg: ${p.monthly_pvg || 0})`))

            // Level 3
            const level2Ids = level2.map(r => r.id)
            const { data: level3 } = await supabase
                .from('profiles')
                .select('id, full_name, current_rank, monthly_pvg')
                .in('sponsor_id', level2Ids)
            console.log(`  Nivel 3: ${level3?.length || 0} personas`)
            if (level3 && level3.length > 0) {
                level3.forEach(p => console.log(`    - ${p.full_name} (rank: ${p.current_rank || 'N/A'}, pvg: ${p.monthly_pvg || 0})`))
            }
        }
    }

    // 9. DIAGNÓSTICO DE PROBLEMAS
    console.log('\n' + '='.repeat(80))
    console.log('DIAGNÓSTICO DE PROBLEMAS')
    console.log('='.repeat(80))

    const problems = []

    // Check: no sponsor
    if (!user.sponsor_id) {
        problems.push('❌ NO tiene patrocinador asignado (sponsor_id es NULL)')
    }

    // Check: no rank
    if (!user.current_rank) {
        problems.push('❌ NO tiene rango asignado (current_rank es NULL)')
    }

    // Check: no referral code
    if (!user.referral_code) {
        problems.push('❌ NO tiene código de referido')
    }

    // Check: 0 PV personal
    if (!user.monthly_pvp || user.monthly_pvp === 0) {
        problems.push('⚠️ PVP mensual es 0 - No ha generado puntos personales este mes')
    }

    // Check: 0 PVG group
    if (!user.monthly_pvg || user.monthly_pvg === 0) {
        problems.push('⚠️ PVG mensual es 0 - No tiene puntos de grupo')
    }

    // Check: no orders
    if (!orders || orders.length === 0) {
        problems.push('⚠️ No tiene ninguna orden/compra registrada')
    }

    // Check: no referrals
    if (!referrals || referrals.length === 0) {
        problems.push('⚠️ No tiene referidos directos')
    }

    // Check: rank vs requirements mismatch
    if (user.current_rank && ranks) {
        const currentRankInfo = ranks.find(r => r.name === user.current_rank)
        if (currentRankInfo) {
            if ((user.monthly_pvp || 0) < (currentRankInfo.min_personal_pv || 0)) {
                problems.push(`❌ PVP actual (${user.monthly_pvp || 0}) NO cumple el mínimo para su rango "${user.current_rank}" (requiere ${currentRankInfo.min_personal_pv || 0})`)
            }
            if ((user.monthly_pvg || 0) < (currentRankInfo.min_group_pv || 0)) {
                problems.push(`❌ PVG actual (${user.monthly_pvg || 0}) NO cumple el mínimo para su rango "${user.current_rank}" (requiere ${currentRankInfo.min_group_pv || 0})`)
            }
        }
    }

    // Check: missing profile fields
    if (!user.full_name) problems.push('❌ Falta nombre completo')
    if (!user.email && !user.phone) problems.push('⚠️ Sin email ni teléfono de contacto')

    // Check: has pending/failed orders
    if (orders) {
        const pendingOrders = orders.filter(o => o.status === 'pending')
        const failedOrders = orders.filter(o => o.status === 'failed' || o.status === 'cancelled')
        if (pendingOrders.length > 0) problems.push(`⚠️ Tiene ${pendingOrders.length} órdenes pendientes`)
        if (failedOrders.length > 0) problems.push(`⚠️ Tiene ${failedOrders.length} órdenes fallidas/canceladas`)
    }

    if (problems.length === 0) {
        console.log('✅ No se detectaron problemas evidentes')
    } else {
        console.log(`Se encontraron ${problems.length} problemas:`)
        problems.forEach(p => console.log(`  ${p}`))
    }

    console.log('\n' + '='.repeat(80))
}

auditUser().catch(console.error)
