import { motion } from 'framer-motion';

const features = [
	{ number: '01', title: 'Your family tree', text: 'Map the people that matter most', icon: '⌘', tone: 'feature-green' },
	{ number: '02', title: 'Dynamic collections', text: 'Turn important events into beautiful, collaborative photobooks.', icon: '▧', tone: 'feature-peach' },
	{ number: '03', title: 'Memory bounties', text: 'Ask the family for photos from any important moment', icon: '✦', tone: 'feature-sand' },
	{ number: '04', title: 'Family world map', text: 'See all the places your family has reached, and plan where is next', icon: '◎', tone: 'feature-blue' },
];

const gridVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } };
const cardVariants = { hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 110, damping: 16 } } };

export default function FeaturesGrid() {
	return (
		<motion.div className="features-grid" variants={gridVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.18 }}>
			{features.map((feature) => (
				<motion.article className={`feature-card ${feature.tone}`} variants={cardVariants} key={feature.number}>
					<div className="feature-card-top"><span>{feature.number}</span><span className="feature-icon" aria-hidden="true">{feature.icon}</span></div>
					<div><h3>{feature.title}</h3><p>{feature.text}</p></div>
					<span className="feature-arrow" aria-hidden="true">↗</span>
				</motion.article>
			))}
		</motion.div>
	);
}
