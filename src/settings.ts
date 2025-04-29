export interface LocalAssetsManagerSettings {
	useRelativePath: boolean;
	keepOriginalUrl: boolean;
	imageFolder: string;
	deleteAssetsWithNote: boolean;
	downloadTimeout: number;
	refererRules: string;
}

export const DEFAULT_SETTINGS: LocalAssetsManagerSettings = {
	useRelativePath: true,
	keepOriginalUrl: false,
	imageFolder: "assets/{title}",
	deleteAssetsWithNote: true,
	downloadTimeout: 30000,
	refererRules: ""
}; 