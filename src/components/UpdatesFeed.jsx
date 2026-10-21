import { motion } from 'framer-motion';

export default function UpdatesFeed() {
	return (
		<motion.div className="developer-blog-notice" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.6 }}>
			<span className="developer-blog-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none">
					<path d="M7 3.5h8.5L19 7v13.5H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
					<path d="M15 3.5V7h4M9 11h6M9 14.5h6M9 18h4" />
				</svg>
			</span>
			<div>
				<p className="eyebrow">A note from Ethan</p>
				<h3>Developer blogs are coming soon.</h3>
				<p>I&apos;m still gathering my thoughts. Check back soon for build notes, and a peek behind the scenes at Kinfolk.</p>
			</div>
			<a href="/blog" className="update-link">Stay tuned <span aria-hidden="true">↗</span></a>
		</motion.div>
	);
}
