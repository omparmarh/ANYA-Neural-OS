import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore, Phase } from '../store';
import { playIgnition, resumeAudio } from '../lib/sfx';
import { startClapWake, stopClapWake } from '../lib/clap';

// Full-screen ignition gate — shown only while phase === OFFLINE.
// Click, clap, or press Space to power up.
export default function Ignition() {
  const phase = useStore((s) => s.phase);
  const powerOn = useStore((s) => s.setPhase);

  useEffect(() => {
    if (phase !== Phase.OFFLINE) return;
    startClapWake(() => {
      powerOn(Phase.BOOT);
    });
    return () => stopClapWake();
  }, [phase, powerOn]);

  if (phase !== Phase.OFFLINE) return null;

  const handle = () => {
    resumeAudio();
    playIgnition();
    powerOn(Phase.BOOT);
  };

  return (
    <motion.button
      type="button"
      className="ignition"
      onClick={handle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
    >
      <span className="ignition-ring" />
      <span className="ignition-label">
        <span className="ignition-title">INITIALISE</span>
        <span className="ignition-sub">click · clap · or press Space to power up</span>
      </span>
    </motion.button>
  );
}