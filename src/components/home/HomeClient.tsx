'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import DynamicClashBeam from './DynamicClashBeam';
import styles from './HomeClient.module.css';

type Stats = { humanWins: number; aiWins: number; totalPlayers: number };
const fallback: Stats = { humanWins: 0, aiWins: 0, totalPlayers: 0 };
const leaders = [ ['PixelRanger', '125430'], ['StarGazer', '98120'], ['LeafWalker', '76430'], ['OceanDream', '64210'] ];

export default function HomeClient() {
  const [stats, setStats] = useState<Stats>(fallback);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.from('event_stats_public').select('*').single();
        if (mounted && data) setStats({ humanWins: data.human_wins ?? 0, aiWins: data.ai_wins ?? 0, totalPlayers: data.total_players ?? 0 });
      } catch { /* show neutral 50/50 beam while offline */ }
    };
    load(); const id = window.setInterval(load, 10000);
    return () => { mounted = false; window.clearInterval(id); };
  }, []);
  const total = stats.humanWins + stats.aiWins;
  const hp = total ? Math.round((stats.humanWins / total) * 100) : 50;
  const ap = 100 - hp;
  const participants = useMemo(() => stats.totalPlayers.toLocaleString(), [stats.totalPlayers]);
  return <main className={styles.home}>
    <div className={styles.nature} aria-hidden="true"><div className={styles.tree} /><Image src="/api/home-assets/Abaya.png" alt="" width={140} height={180} className={`${styles.sprite} ${styles.abaya}`} /><Image src="/api/home-assets/Emarati.png" alt="" width={130} height={170} className={`${styles.sprite} ${styles.emarati}`} /><Image src="/sprites/boy-cheer.png" alt="" width={120} height={140} className={`${styles.sprite} ${styles.boy}`} /><Image src="/sprites/girl-cheering.png" alt="" width={110} height={135} className={`${styles.sprite} ${styles.girl}`} /></div>
    <div className={styles.circuit} aria-hidden="true"><Image src="/sprites/robot-cheering.png" alt="" width={120} height={140} className={`${styles.sprite} ${styles.robot1}`} /><Image src="/sprites/robot-happy-cheering.png" alt="" width={110} height={130} className={`${styles.sprite} ${styles.robot2}`} /><Image src="/sprites/robot-cat.png" alt="" width={105} height={120} className={`${styles.sprite} ${styles.robot3}`} /></div>
    <header className={styles.header}><div className={styles.logo}>AU <span>vs</span> AI<small>THE 60 SECOND CHALLENGE</small></div><div className={styles.aida}><Image src="/sprites/mascot-boy-cheer.png" alt="AIDA male mascot" width={54} height={54}/><b>AIDA</b><Image src="/sprites/mascot-girl-cheer.png" alt="AIDA female mascot" width={54} height={54}/></div></header>
    <section className={styles.hero}><p className={styles.kicker}>HUMANS vs AI · LIVE CLASH</p><div className={styles.totals}><span>HUMANS <b>{hp}%</b></span><span>AI <b>{ap}%</b></span></div><DynamicClashBeam humanWins={stats.humanWins} aiWins={stats.aiWins}/><p className={styles.live}>{participants} CHALLENGERS HAVE ENTERED THE ARENA</p><Link className={styles.play} href="/play">PLAY <span>▶</span></Link></section>
    <section className={styles.leaderboard}><h2>✦ TOP HUMAN CHALLENGERS ✦</h2>{leaders.map(([name, score], i) => <div className={`${styles.row} ${i === 0 ? styles.first : ''}`} key={name}><span>{i + 1}</span><strong>{name}</strong><b>{score}</b></div>)}</section>
  </main>;
}
