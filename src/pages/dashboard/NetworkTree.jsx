
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
    ChevronRight, ChevronDown, User, Shield, Activity,
    TrendingUp, Users, Target, Loader2
} from 'lucide-react'
import styles from './NetworkTree.module.css'

import NetworkNode from '../../components/network/NetworkNode'

export default function NetworkTree() {
    const { profile } = useAuth()
    const [rootUser, setRootUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (profile) {
            setRootUser(profile)
            setLoading(false)
        }
    }, [profile])

    if (loading || !rootUser) {
        return (
            <div className={styles.loadingContainer}>
                <Loader2 className={styles.spinner} size={40} />
            </div>
        )
    }

    return (
        <div className={styles.wrapper}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    Red de <span className={styles.highlight}>Socios</span>
                </h1>
                <p className={styles.subtitle}>
                    Visualiza la expansión de tu organización Univel de forma interactiva.
                </p>
            </header>

            <div className={styles.viewPort}>
                <div className={styles.treeRoot}>
                    <NetworkNode affiliate={rootUser} />
                </div>
            </div>
        </div>
    )
}
