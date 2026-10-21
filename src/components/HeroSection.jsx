import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useRef } from 'react';

const photos = [
	{
		src: 'https://images.pexels.com/photos/1128317/pexels-photo-1128317.jpeg?auto=compress&cs=tinysrgb&w=900',
		alt: 'A playful family portrait outdoors',
		className: 'hero-photo hero-photo-main',
	},
	{
		src: 'https://images.unsplash.com/photo-1602030028438-4cf153cbae9e?auto=format&fit=crop&w=700&q=85',
		alt: 'Two siblings enjoying time outdoors',
		className: 'hero-photo hero-photo-left',
	},
	{
		src: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=700&q=85',
		alt: 'A group of friends and family sharing a day together',
		className: 'hero-photo hero-photo-right',
	},
];

export default function HeroSection() {
	const ref = useRef(null);
	const pointerX = useMotionValue(0);
	const pointerY = useMotionValue(0);
	const rotateX = useSpring(useTransform(pointerY, [-300, 300], [5, -5]), { stiffness: 90, damping: 18 });
	const rotateY = useSpring(useTransform(pointerX, [-300, 300], [-6, 6]), { stiffness: 90, damping: 18 });

	function handlePointerMove(event) {
		if (!ref.current) return;
		const bounds = ref.current.getBoundingClientRect();
		pointerX.set(event.clientX - bounds.left - bounds.width / 2);
		pointerY.set(event.clientY - bounds.top - bounds.height / 2);
	}

	return (
		<section className="hero-section" ref={ref} onPointerMove={handlePointerMove} onPointerLeave={() => { pointerX.set(0); pointerY.set(0); }}>
			<div className="hero-copy">
				<motion.p className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
					A better way to stay connected
				</motion.p>
				<motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
					Your family&apos;s <em>private</em> archive.
				</motion.h1>
				<motion.p className="hero-intro" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }}>
					Keep the stories, snapshots, and small everyday magic that make your family yours, and access them all in one private home.
				</motion.p>
				<motion.div className="hero-actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}>
					<a className="landing-button landing-button-primary" href="/app">Join your family <span aria-hidden="true">↗</span></a>
					<a className="landing-button landing-button-quiet" href="#features">See how it works <span aria-hidden="true">↓</span></a>
				</motion.div>
				<div className="hero-trust"><span className="trust-avatars" aria-hidden="true"><i>J</i><i>M</i><i>A</i></span><span>Made for the people who know you best.</span></div>
			</div>
			<motion.div className="photo-stage" style={{ rotateX, rotateY }} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 1, ease: [0.22, 1, 0.36, 1] }}>
				<div className="photo-sun" />
				{photos.map((photo, index) => (
					<motion.figure className={photo.className} key={photo.src} animate={{ y: [0, index % 2 ? -10 : 8, 0], rotate: [index ? -3 : 2, index ? -1 : 4, index ? -3 : 2] }} transition={{ duration: 6 + index, repeat: Infinity, ease: 'easeInOut', delay: index * 0.45 }}>
						<img src={photo.src} alt={photo.alt} />
						{index === 0 && <figcaption><span>summer, 2016</span><b>the good days</b></figcaption>}
					</motion.figure>
				))}
				<span className="photo-note photo-note-top">our little world <span>✦</span></span>
				<span className="photo-note photo-note-bottom">keep close</span>
			</motion.div>
		</section>
	);
}
