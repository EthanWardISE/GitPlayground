type SkeletonLoaderProps = {
	variant?: 'photo-grid' | 'profile-cards' | 'page';
	count?: number;
};

function SkeletonBlock({ className = '' }: { className?: string }) {
	return <span className={`skeleton-block ${className}`} aria-hidden="true" />;
}

export default function SkeletonLoader({ variant = 'page', count = 6 }: SkeletonLoaderProps) {
	if (variant === 'photo-grid') {
		return (
			<div className="photo-grid skeleton-grid" aria-label="Loading memories" role="status">
				{Array.from({ length: count }, (_, index) => (
					<div className="photo-card skeleton-photo-card" key={`photo-skeleton-${index}`}>
						<SkeletonBlock className="skeleton-photo-image" />
						<span className="skeleton-photo-copy"><SkeletonBlock className="skeleton-title" /><SkeletonBlock className="skeleton-caption" /></span>
					</div>
				))}
			</div>
		);
	}

	if (variant === 'profile-cards') {
		return (
			<div className="skeleton-profile-grid" aria-label="Loading family members" role="status">
				{Array.from({ length: count }, (_, index) => (
					<div className="skeleton-profile-card" key={`profile-skeleton-${index}`}>
						<SkeletonBlock className="skeleton-avatar" />
						<span><SkeletonBlock className="skeleton-title" /><SkeletonBlock className="skeleton-caption" /></span>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="skeleton-page" aria-label="Loading family album" role="status">
			<SkeletonBlock className="skeleton-heading" />
			<SkeletonBlock className="skeleton-subheading" />
			<SkeletonLoader variant="profile-cards" count={4} />
			<SkeletonLoader variant="photo-grid" count={6} />
		</div>
	);
}
