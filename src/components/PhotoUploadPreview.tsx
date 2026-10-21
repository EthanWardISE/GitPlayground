import { useEffect, useState } from 'react';

export default function PhotoUploadPreview({ files }: { files: File[] }) {
	const [previews, setPreviews] = useState<string[]>([]);

	useEffect(() => {
		const nextPreviews = files.map((file) => URL.createObjectURL(file));
		setPreviews(nextPreviews);
		return () => nextPreviews.forEach((preview) => URL.revokeObjectURL(preview));
	}, [files]);

	if (!files.length) return null;

	return (
		<div className="upload-preview-list" aria-label={`${files.length} selected photo${files.length === 1 ? '' : 's'}`}>
			{files.map((file, index) => (
				<span className="upload-preview-bubble" key={`${file.name}-${file.lastModified}-${index}`}>
					{previews[index] && <img src={previews[index]} alt="" />}
					<span>{file.name}</span>
				</span>
			))}
		</div>
	);
}
