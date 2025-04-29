// main.ts
import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	requestUrl,
	TFile,
	TFolder,
} from 'obsidian';
import * as path from 'path'; // 使用 Node.js path 模块

import { LocalAssetsManagerSettings, DEFAULT_SETTINGS } from './src/settings';
import { LocalAssetsManagerSettingTab } from './src/SettingTab';
import { ConfirmModal } from './src/ConfirmModal'; // 导入 Modal 类


export default class LocalAssetsManagerPlugin extends Plugin {
	settings: LocalAssetsManagerSettings;
	// 存储解析后的 Referer 规则，避免每次都解析 JSON
	private parsedRefererRules: Record<string, string> | null = null;

	async onload() {
		await this.loadSettings();

		// 添加设置面板
		this.addSettingTab(new LocalAssetsManagerSettingTab(this.app, this));

		// 注册粘贴事件监听器
		this.registerEvent(
			this.app.workspace.on('editor-paste', this.handlePaste.bind(this))
		);

		// 注册文件重命名事件监听器
		this.registerEvent(
			this.app.vault.on('rename', async (file: TFile, oldPath: string) => {
				if (!(file instanceof TFile) || file.extension !== 'md') return;
				if (!this.settings.imageFolder.includes('{title}')) return;

				try {
					const oldAssetsPath = this.getAssetsFolderPathFromPath(oldPath);
					const newAssetsPath = this.getAssetsFolderPath(file);
					
					if (oldAssetsPath === newAssetsPath) return;

					// 检查旧文件夹是否存在
					const oldFolder = this.app.vault.getAbstractFileByPath(oldAssetsPath);
					if (!oldFolder || !(oldFolder instanceof TFolder)) {
						return;
					}

					// 检查新路径是否已存在
					const newPathExists = await this.app.vault.adapter.exists(newAssetsPath);
					if (newPathExists) {
						console.warn(`Cannot rename asset folder, target path already exists: ${newAssetsPath}`);
						return;
					}

					// 重命名资源文件夹
					await this.app.vault.rename(oldFolder, newAssetsPath);
					new Notice(`已更新资源文件夹: ${newAssetsPath}`);

					// 更新笔记中的链接
					console.log(`Updating links in note: ${file.path}`);
					let content = await this.app.vault.read(file);
					let updated = false;

					// 处理 Obsidian 格式的图片链接
					const updateImageLinks = (text: string, oldPath: string, newPath: string): string => {
						// 支持去除 '../' 和 './' 前缀
						let normOld = oldPath.replace(/^(?:\.\.\/)+|^\.\//g, '').replace(/\\/g, '/');
						let normNew = newPath.replace(/^(?:\.\.\/)+|^\.\//g, '').replace(/\\/g, '/');

						const wikiLinkRegex    = /!\[\[([^\]]+)\]\]/g;
						const markdownLinkRegex= /!\[([^\]]*)\]\(([^)]+)\)/g;

						// 处理 ![[...]] 链接
						text = text.replace(wikiLinkRegex, (match, imagePath) => {
							// 去除前缀 '../' 或 './'，并解码
							const raw = decodeURIComponent(imagePath.replace(/^(?:\.\.\/)+|^\.\//g, '').replace(/\\/g, '/'));
							if (raw.startsWith(normOld)) {
								updated = true;
								// 替换旧路径为新路径，再重新编码
								const replaced = raw.replace(normOld, normNew);
								return `![[${encodeURI(replaced)}]]`;
							}
							return match;
						});

						// 处理 ![alt](...) 链接
						text = text.replace(markdownLinkRegex, (match, alt, imagePath) => {
							// 去除前缀 '../' 或 './'，并解码
							const raw = decodeURIComponent(imagePath.replace(/^(?:\.\.\/)+|^\.\//g, '').replace(/\\/g, '/'));
							if (raw.startsWith(normOld)) {
								updated = true;
								const replaced = raw.replace(normOld, normNew);
								return `![${alt}](${encodeURI(replaced)})`;
							}
							return match;
						});

						return text;
					};

					// 更新链接
					content = updateImageLinks(content, oldAssetsPath, newAssetsPath);

					if (updated) {
						await this.app.vault.modify(file, content);
						new Notice(`笔记 ${file.basename} 内的图片链接已更新`);
						console.log(`Links updated in note: ${file.path}`);
					} else {
						console.log(`No links needed updating in note: ${file.path}`);
					}
				} catch (error) {
					console.error('更新资源文件夹或笔记链接失败:', error);
					new Notice(`更新资源文件夹或链接失败: ${error.message}`);
				}
			})
		);

		// 注册文件删除事件监听器
		this.registerEvent(
			this.app.vault.on('delete', async (file) => {
				if (!(file instanceof TFile) || !this.settings.deleteAssetsWithNote || !this.settings.imageFolder.includes('{title}')) return;

				try {
					const assetsFolderPath = this.getAssetsFolderPath(file);
					const adapter = this.app.vault.adapter;
					if (await adapter.exists(assetsFolderPath)) {
						await adapter.rmdir(assetsFolderPath, true);
						new Notice(`已删除资源文件夹: ${assetsFolderPath}`);
					}
				} catch (error) {
					console.error("删除资源文件夹失败:", error);
					new Notice(`删除资源文件夹失败: ${error.message}`);
				}
			})
		);

		// --- 添加清理命令 --- Start
		this.addCommand({
			id: 'cleanup-unused-images-current-note',
			name: '清理当前笔记未使用的本地图片',
			checkCallback: (checking: boolean) => {
				const currentFile = this.app.workspace.getActiveFile();
				if (currentFile instanceof TFile) {
					// 如果只是检查命令是否可用，则返回 true
					if (checking) {
						return true;
					}
					// 否则，执行清理操作
					this.cleanupUnusedImages(currentFile);
					return true; // 返回 true 表示命令已处理
				} else {
					// 没有活动文件，命令不可用
					return false;
				}
			}
		});
		// --- 添加清理命令 --- End

		// 在 onload 方法中添加新命令
		this.addCommand({
			id: 'check-external-images',
			name: '检查笔记中的外部图片',
			checkCallback: (checking: boolean) => {
				const currentFile = this.app.workspace.getActiveFile();
				if (currentFile instanceof TFile) {
					if (checking) {
						return true;
					}
					this.checkExternalImages(currentFile);
					return true;
				}
				return false;
			}
		});

		console.log('Local Assets Manager Plugin loaded.');
	}

	onunload() {
		console.log('Local Assets Manager Plugin unloaded.');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// 在加载设置后解析 Referer 规则
		try {
			this.parsedRefererRules = JSON.parse(this.settings.refererRules || '{}');
		} catch (e) {
			console.error("加载 Referer 规则失败，请检查设置中的 JSON 格式:", e);
			new Notice('加载 Referer 规则失败，将使用默认策略。', 5000);
			this.parsedRefererRules = {}; // 使用空规则避免后续出错
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// 保存设置后也要重新解析规则
		try {
			this.parsedRefererRules = JSON.parse(this.settings.refererRules || '{}');
		} catch (e) {
			console.error("保存后解析 Referer 规则失败:", e);
			// 注意：这里不应再次调用 saveSettings 避免死循环
			this.parsedRefererRules = {};
		}
	}

	/**
	 * 处理粘贴事件
	 * @param evt 剪贴板事件
	 * @param editor Obsidian 编辑器实例
	 */
	async handlePaste(evt: ClipboardEvent, editor: Editor) {
		console.log("Paste event triggered");

		const clipboardData = evt.clipboardData;
		if (!clipboardData) {
			console.log("No clipboard data found.");
			return;
		}

		const html = clipboardData.getData('text/html');
		const plainText = clipboardData.getData('text/plain');

		if (!html) {
			console.log("No HTML content in clipboard.");
			return;
		}

		const hasHttpImg = /<img[^>]+src=[\"\']https?:\/\//i.test(html);
		if (!hasHttpImg) {
			console.log("No http(s) images detected in HTML.");
			return;
		}

		console.log("Detected http(s) images, preventing default paste.");
		evt.preventDefault();

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("请先打开或创建一个笔记文件再粘贴内容。");
			console.warn("No active file found for pasting.");
			return;
		}

		const processingNotice = new Notice("正在处理粘贴内容和下载图片...", 0);

		try {
			console.log("Calling processContent...");
			const processedHtml = await this.processContent(html, activeFile);
			console.log("processContent finished.");

			const dataTransfer = new DataTransfer();
			dataTransfer.setData('text/html', processedHtml);
			if (plainText) {
				dataTransfer.setData('text/plain', plainText);
			}

			console.log("Dispatching new paste event...");
			const pasteEventTarget = evt.target;

			if (pasteEventTarget instanceof HTMLElement || pasteEventTarget instanceof Window) {
				const newEvent = new ClipboardEvent('paste', {
					clipboardData: dataTransfer,
					bubbles: true,
					cancelable: false,
					composed: true,
				});

				pasteEventTarget.dispatchEvent(newEvent);
				console.log("New paste event dispatched.");
			} else {
				console.error("Paste event target is not an HTMLElement or Window, cannot dispatch event.");
				editor.replaceSelection(processedHtml);
				new Notice("无法精确模拟粘贴，已直接插入处理后的 HTML。");
			}

			processingNotice.hide();

		} catch (error) {
			processingNotice.hide();
			console.error("处理粘贴内容时出错:", error);
			new Notice(`处理粘贴内容失败: ${error.message}`);
			if (plainText) {
				editor.replaceSelection(plainText);
			}
		}
	}

	/**
	 * 处理 HTML 内容，下载其中的网络图片并替换链接
	 * @param html 原始 HTML 字符串
	 * @param file 当前笔记文件
	 * @returns 处理后的 HTML 字符串
	 */
	async processContent(html: string, file: TFile): Promise<string> {
		const parser = new DOMParser();
		let doc: Document;
		try {
			doc = parser.parseFromString(html, "text/html");
		} catch (error) {
			console.error("HTML 解析失败:", error);
			new Notice("无法解析剪贴板中的 HTML 内容。");
			return html;
		}

		const images = Array.from(doc.querySelectorAll("img"));
		const failedDownloads: { url: string, error: Error }[] = [];

		new Notice(`开始处理 ${images.length} 张图片...`);

		for (const img of images) {
			const originalUrl = img.getAttribute("src");

			if (!originalUrl || (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://'))) {
				console.log(`Skipping non-http(s) image: ${originalUrl?.substring(0, 100)}...`);
				continue;
			}

			console.log(`Processing image: ${originalUrl}`);
			try {
				const [localPath, downloadError] = await this.downloadImage(originalUrl, file);

				if (localPath) {
					img.setAttribute("src", localPath);
					img.removeAttribute("srcset");

					if (this.settings.keepOriginalUrl) {
						const comment = doc.createComment(` Original URL: ${originalUrl} `);
						img.parentNode?.insertBefore(comment, img.nextSibling);
					}
				} else {
					failedDownloads.push({ url: originalUrl, error: downloadError || new Error('Unknown download error after downloadImage call.') });
					img.style.border = '2px dashed red';
					img.style.opacity = '0.7';
					const failureNotice = doc.createElement('span');
					failureNotice.textContent = ` [下载失败: ${originalUrl.substring(0, 50)}...] `;
					failureNotice.style.color = 'red';
					failureNotice.style.fontSize = 'small';
					img.parentNode?.insertBefore(failureNotice, img.nextSibling);
				}
			} catch (error) {
				console.error(`处理图片 ${originalUrl} 时发生意外错误:`, error);
				failedDownloads.push({ url: originalUrl, error: error instanceof Error ? error : new Error(String(error)) });
			}
		}

		if (failedDownloads.length > 0) {
			this.showDownloadErrors(failedDownloads);
		} else if (images.length > 0) {
			new Notice(`所有 ${images.length} 张图片处理完成！`);
		} else {
			new Notice(`未找到需要下载的网络图片。`);
		}

		return doc.body.innerHTML;
	}

	/**
	 * 下载单个图片，处理防盗链和重试
	 * @param url 图片 URL
	 * @param file 当前笔记文件，用于计算保存路径
	 * @returns 返回一个元组 [本地路径 | null, 错误对象 | null]
	 */
	async downloadImage(url: string, file: TFile): Promise<[string | null, Error | null]> {
		const maxRetries = 3;
		let retryCount = 0;
		let obsidianResponse: import("obsidian").RequestUrlResponse | null = null;
		let lastError: Error | null = null;

		while (retryCount < maxRetries) {
			const headers = this.generateHeaders(url, retryCount);
			try {
				console.log(`Attempting to download ${url} (retry ${retryCount})`);

				obsidianResponse = await requestUrl({
					url: url,
					method: 'GET',
					headers: headers,
					throw: false // 保持为 false
				});

				if (obsidianResponse.status >= 200 && obsidianResponse.status < 300) {
					const contentType = obsidianResponse.headers['content-type'];
					if (!contentType || !contentType.startsWith('image/')) {
						lastError = new Error(`Invalid Content-Type: ${contentType}`);
						console.warn(`Download failed for ${url}: ${lastError.message}`);
						obsidianResponse = null; // 标记为失败
						break; // 内容类型错误，无需重试
					}
					lastError = null;
					break; // 下载成功
				} else if (obsidianResponse.status === 403) {
					lastError = new Error(`HTTP 403 Forbidden (Anti-hotlinking?)`);
					console.warn(`Download attempt failed for ${url} (retry ${retryCount}): ${lastError.message}`);
					retryCount++;
					if (retryCount < maxRetries) {
						await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
					}
				} else {
					lastError = new Error(`HTTP error! status: ${obsidianResponse.status}`);
					console.warn(`Download attempt failed for ${url} (retry ${retryCount}): ${lastError.message}`);
					retryCount++;
					if (retryCount < maxRetries) {
						await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
					}
				}

			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				console.warn(`Download attempt failed for ${url} (retry ${retryCount}) with network error:`, error);
				retryCount++;
				if (retryCount < maxRetries) {
					await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
				}
			}
		}

		if (!obsidianResponse || !(obsidianResponse.status >= 200 && obsidianResponse.status < 300)) {
			console.error(`Failed to download ${url} after ${maxRetries} retries. Last error:`, lastError);
			return [null, lastError || new Error('Unknown download error')];
		}

		// --- 下载成功，开始保存文件 ---
		try {
			const buffer = obsidianResponse.arrayBuffer;
			const assetsFolderPath = this.getAssetsFolderPath(file);
			const filename = this.getUniqueFilename(url);
			const savePath = path.join(assetsFolderPath, filename).replace(/\\/g, '/');

			await this.app.vault.adapter.mkdir(assetsFolderPath);

			const createdFile = await this.app.vault.createBinary(savePath, buffer);
			new Notice(`已下载图片: ${filename}`);

			// --- 计算返回路径 ---
			let returnPath: string;
			if (this.settings.useRelativePath) {
				const relativeLink = this.app.fileManager.generateMarkdownLink(
					createdFile, file.path
				);
				const match = relativeLink.match(/!\[.*?\]\((.+?)\)/);
				if (match && match[1]) {
					returnPath = decodeURIComponent(match[1]);
				} else {
					console.warn('Failed to extract relative path from markdown link, returning vault path.');
					returnPath = savePath;
				}
			} else {
				returnPath = savePath;
			}

			// 返回成功路径和 null 错误
			return [returnPath, null];

		} catch (error) {
			const saveError = error instanceof Error ? error : new Error(String(error));
			console.error(`保存图片失败 ${url} to ${file.path}:`, saveError);
			new Notice(`保存图片失败: ${url}. ${saveError.message}`);
			// 返回 null 路径和保存错误
			return [null, saveError];
		}
	}

	/**
	 * 根据 URL 和重试次数生成请求头
	 * @param url 图片 URL
	 * @param retryCount 当前重试次数 (0, 1, 2)
	 * @returns 请求头对象
	 */
	generateHeaders(url: string, retryCount: number = 0): Record<string, string> {
		try {
			const urlObj = new URL(url);
			const origin = urlObj.origin;
			const hostname = urlObj.hostname; // 获取主机名

			const headers: Record<string, string> = {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
				'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
				'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
				'Cache-Control': 'no-cache',
				'Pragma': 'no-cache',
				'Sec-Fetch-Dest': 'image',
				'Sec-Fetch-Mode': 'no-cors',
				'Sec-Fetch-Site': 'cross-site',
			};

			// --- 优先检查用户自定义规则 --- Start
			if (this.parsedRefererRules) {
				for (const [pattern, refererUrl] of Object.entries(this.parsedRefererRules)) {
					if (this.matchDomain(hostname, pattern)) {
						console.log(`Applying user-defined Referer rule for pattern ${pattern}: ${refererUrl}`);
						headers['Referer'] = refererUrl;
						try {
							// 尝试从用户设置的 Referer 中提取 Origin
							headers['Origin'] = new URL(refererUrl).origin;
						} catch (e) {
							console.warn("无法从用户自定义 Referer 中提取 Origin:", refererUrl, e);
							headers['Origin'] = origin; // 回退到默认 Origin
						}
						break; // 找到第一个匹配的规则就停止
					}
				}
			}
			// --- 优先检查用户自定义规则 --- End
			else {
				// --- 如果用户规则无效或未解析，可以保留之前的硬编码逻辑作为备选 --- Start
				if (hostname.endsWith('aliyuncs.com')) {
					headers['Referer'] = 'https://www.52audio.com/';
					headers['Origin'] = 'https://www.52audio.com';
					console.log(`Applying fallback Referer for aliyuncs.com: https://www.52audio.com`);
				}
				// --- 如果用户规则无效或未解析，可以保留之前的硬编码逻辑作为备选 --- End
			}

			// --- 根据重试次数应用策略 --- Start
			switch (retryCount) {
				case 0:
					// 首次尝试：使用计算出的初始 Referer 和 Origin
					headers['Referer'] = headers['Referer'] || '';
					headers['Origin'] = headers['Origin'] || '';
					break;
				case 1:
					// 第二次尝试 (通常在 403 后)：使用图片完整 URL 作为 Referer，不带 Origin
					headers['Referer'] = url;
					break;
				case 2:
					// 第三次尝试：尝试空 Referer，不带 Origin
					headers['Referer'] = '';
					break;
				default:
					// 默认情况（理论上不会进入 retryCount > 2）
					headers['Referer'] = headers['Referer'] || '';
					headers['Origin'] = headers['Origin'] || '';
					break;
			}
			// --- 根据重试次数应用策略 --- End

			console.log(`Generated headers for ${url} (retry ${retryCount}):`, headers);
			return headers;
		} catch (error) {
			console.error('生成请求头失败:', url, error);
			return { 'User-Agent': 'Mozilla/5.0' };
		}
	}

	showDownloadErrors(failedDownloads: { url: string, error: Error }[]) {
		const errorCount = failedDownloads.length;
		let message = `有 ${errorCount} 张图片下载失败:\n\n`; // 使用 \n 换行

		console.error("图片下载失败详情 (原始错误对象):");
		failedDownloads.forEach(({ url, error }, index) => {
			console.error(`[${index + 1}] URL: ${url}`);
			console.error("  Error Name: ", error?.name);
			console.error("  Error Message: ", error?.message);
			console.error("  Error Code: ", (error as any)?.code); // 尝试访问 code 属性
			console.error("  Error Errno: ", (error as any)?.errno); // 尝试访问 errno 属性
			console.error("  Error Stack: ", error?.stack);
			console.error("  Raw Error Object: ", error); // 打印原始对象以供检查
		});

		const maxErrorsToShow = 5;
		failedDownloads.slice(0, maxErrorsToShow).forEach(({ url, error }) => {
			let errorReason = error?.message || '未知错误'; // 添加 null 检查
			if (error?.message.includes('403')) {
				errorReason = '防盗链限制';
			} else if (error?.message.includes('Invalid Content-Type')) {
				errorReason = '非图片内容';
			} else if (error?.message.toLowerCase().includes('timeout')) {
				errorReason = '下载超时';
			} else if (error?.message.includes('HTTP error')) {
				errorReason = `服务器错误 (${error.message.split(' ').pop()})`;
			} else if (error?.message === 'Image download failed or was skipped.') {
				errorReason = '下载失败或跳过';
			} else if ((error as any)?.code === 'ENOENT') { // 检查上次的 ENOENT 错误
				errorReason = '文件路径或目录不存在';
			}

			const shortUrl = url.length > 80 ? url.substring(0, 77) + '...' : url;
			message += `- ${shortUrl}\n  原因: ${errorReason}\n`; // 使用 \n 换行
		});

		if (errorCount > maxErrorsToShow) {
			message += `\n...等 ${errorCount - maxErrorsToShow} 个其他错误。`;
		}

		message += "\n请检查 Obsidian 控制台 (Developer Tools) 获取详细日志。";

		new Notice(message, 15000);
	}

	/**
	 * 获取资源文件夹的绝对路径 (相对于 Vault 根目录)
	 * @param file 当前笔记文件
	 * @returns 资源文件夹的绝对路径
	 */
	getAssetsFolderPath(file: TFile): string {
		let folderPath = this.settings.imageFolder;
		folderPath = folderPath.replace(/\{title\}/g, file.basename);
		const parentPath = file.parent?.path || '/';
		const relativeFolderPath = path.join(parentPath === '/' ? '' : parentPath, folderPath);
		return relativeFolderPath.replace(/\\/g, '/').replace(/\/$/, '');
	}

	/**
	 * 根据旧文件路径计算旧资源文件夹路径 (相对于 Vault 根目录)
	 * @param oldPath 旧文件路径
	 * @returns 旧资源文件夹的绝对路径
	 */
	getAssetsFolderPathFromPath(oldPath: string): string {
		const parsedPath = path.parse(oldPath);
		const parentPath = parsedPath.dir === '.' ? '/' : parsedPath.dir;
		const basename = parsedPath.name;
		let folderPath = this.settings.imageFolder;
		folderPath = folderPath.replace(/\{title\}/g, basename);
		const relativeFolderPath = path.join(parentPath === '/' ? '' : parentPath, folderPath);
		return relativeFolderPath.replace(/\\/g, '/').replace(/\/$/, '');
	}

	/**
	 * 生成唯一的本地文件名
	 * @param url 图片 URL
	 * @returns 本地文件名
	 */
	getUniqueFilename(url: string): string {
		try {
			const urlObj = new URL(url);
			const parsedPath = path.parse(decodeURIComponent(urlObj.pathname));
			let originalName = parsedPath.name;
			let extension = parsedPath.ext;

			if (!extension) {
				const formatMatch = urlObj.search.match(/[?&]format=([^&]+)/i);
				if (formatMatch && formatMatch[1]) {
					extension = '.' + formatMatch[1].toLowerCase();
				} else {
					extension = '.png';
				}
			}

			originalName = originalName.replace(/[<>:"/\\|?*\s]+/g, '_');
			if (originalName.length > 100) {
				originalName = originalName.substring(0, 100);
			}

			const timestamp = Date.now();
			return `${originalName}_${timestamp}${extension}`;
		} catch (error) {
			console.error('生成唯一文件名失败:', url, error);
			return `image_${Date.now()}.png`;
		}
	}

	/**
	 * 简单的域名匹配函数，支持 *. 前缀通配符
	 * @param hostname 要匹配的主机名
	 * @param pattern 模式 (例如 "*.example.com" 或 "test.com")
	 * @returns 是否匹配
	 */
	matchDomain(hostname: string, pattern: string): boolean {
		if (pattern.startsWith('*.')) {
			// 通配符匹配
			const basePattern = pattern.substring(2);
			return hostname === basePattern || hostname.endsWith('.' + basePattern);
		} else {
			// 完全匹配
			return hostname === pattern;
		}
	}

	/**
	 * 清理当前笔记关联的资源文件夹中未使用的图片
	 * @param file 当前笔记文件
	 */
	async cleanupUnusedImages(file: TFile) {
		new Notice("开始清理未使用的图片...");
		console.log(`Starting cleanup for note: ${file.path}`);

		try {
			// 1. 获取并检查资源文件夹路径
			const assetsFolderPath = this.getAssetsFolderPath(file);
			if (!this.settings.imageFolder.includes('{title}')) {
				new Notice("清理功能仅在图片保存路径包含 {title} 时可用。");
				return;
			}

			const adapter = this.app.vault.adapter;
			const folderExists = await adapter.exists(assetsFolderPath);
			if (!folderExists) {
				new Notice("未找到关联的资源文件夹，无需清理。");
				return;
			}

			// 2. 扫描资源文件夹中的文件
			const listResult = await adapter.list(assetsFolderPath);
			const imageFilesInFolder = new Set<string>();

			// 修复：正确处理文件扩展名检查
			listResult.files.forEach(filePath => {
				const lowerPath = filePath.toLowerCase();
				if (lowerPath.endsWith('.png') || 
					lowerPath.endsWith('.jpg') || 
					lowerPath.endsWith('.jpeg') || 
					lowerPath.endsWith('.gif') || 
					lowerPath.endsWith('.bmp') || 
					lowerPath.endsWith('.webp') || 
					lowerPath.endsWith('.svg')) {
					imageFilesInFolder.add(filePath.replace(/\\/g, '/'));
				}
			});

			if (imageFilesInFolder.size === 0) {
				new Notice("资源文件夹中未找到图片文件。");
				return;
			}

			// 3. 读取笔记内容并提取链接
			const content = await this.app.vault.read(file);
			const linkedImages = new Set<string>();

			// 匹配 Obsidian Wiki 链接格式 ![[path/to/image.xxx]]
			const wikiLinkRegex = /!\[\[(.*?)\]\]/g;
			let match;
			while ((match = wikiLinkRegex.exec(content)) !== null) {
				if (match[1]) {
					const imagePath = match[1].replace(/^\.\//, '');
					const fullPath = this.app.metadataCache.getFirstLinkpathDest(imagePath, file.path)?.path;
					if (fullPath) {
						linkedImages.add(fullPath);
					}
				}
			}

			// 匹配标准 Markdown 图片链接格式 ![alt](path/to/image.xxx)
			const markdownLinkRegex = /!\[.*?\]\((.*?)\)/g;
			while ((match = markdownLinkRegex.exec(content)) !== null) {
				if (match[1]) {
					const imagePath = match[1].replace(/^\.\//, '');
					const fullPath = this.app.metadataCache.getFirstLinkpathDest(imagePath, file.path)?.path;
					if (fullPath) {
						linkedImages.add(fullPath);
					}
				}
			}

			// 4. 找出未使用的图片
			const unusedImagePaths: string[] = [];
			imageFilesInFolder.forEach(imagePath => {
				// 确保路径格式一致
				const normalizedImagePath = imagePath.replace(/\\/g, '/');
				if (!linkedImages.has(normalizedImagePath)) {
					unusedImagePaths.push(normalizedImagePath);
				}
			});

			// 5. 用户确认并执行删除
			if (unusedImagePaths.length > 0) {
				console.log("Found unused images:", unusedImagePaths);
				const modal = new ConfirmModal(
					this.app,
					unusedImagePaths,
					async () => {
						let deletedCount = 0;
						let errorCount = 0;
						for (const imagePath of unusedImagePaths) {
							try {
								const imageTFile = this.app.vault.getAbstractFileByPath(imagePath);
								if (imageTFile instanceof TFile) {
									await this.app.vault.trash(imageTFile, true); // 使用 trash 替代 delete，移动到回收站
									deletedCount++;
								} else {
									console.warn(`无法获取文件对象: ${imagePath}`);
									await adapter.remove(imagePath);
									deletedCount++;
								}
							} catch (delError) {
								console.error(`删除文件失败 ${imagePath}:`, delError);
								errorCount++;
							}
						}
						new Notice(`已移动 ${deletedCount} 张未使用的图片到回收站。${errorCount > 0 ? `\n${errorCount} 个文件删除失败。` : ''}`);
					}
				);
				modal.open();
			} else {
				new Notice("未找到当前笔记未使用的本地图片。");
			}

		} catch (error) {
			console.error("清理未使用图片时出错:", error);
			new Notice(`清理图片失败: ${error.message}`);
		}
	}

	/**
	 * 检查笔记中的外部图片链接
	 * @param file 当前笔记文件
	 */
	async checkExternalImages(file: TFile) {
		console.log(`开始检查笔记中的外部图片: ${file.path}`);
		try {
			const content = await this.app.vault.read(file);
			const externalImages = new Set<string>();

			// 匹配 Markdown 格式的图片链接
			const markdownLinkRegex = /!\[.*?\]\((https?:\/\/[^)]+)\)/g;
			let match;
			while ((match = markdownLinkRegex.exec(content)) !== null) {
				if (match[1]) {
					externalImages.add(match[1]);
				}
			}

			// 匹配 HTML 格式的图片链接
			const htmlLinkRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/g;
			while ((match = htmlLinkRegex.exec(content)) !== null) {
				if (match[1]) {
					externalImages.add(match[1]);
				}
			}

			if (externalImages.size > 0) {
				// 创建确认对话框
				const modal = new class extends Modal {
					externalUrls: string[];
					plugin: LocalAssetsManagerPlugin;
					downloadedImages: Map<string, string> = new Map(); // 存储下载结果

					constructor(app: App, urls: string[], plugin: LocalAssetsManagerPlugin) {
						super(app);
						this.externalUrls = urls;
						this.plugin = plugin;
					}

					async onOpen() {
						const {contentEl} = this;
						contentEl.empty();
						
						contentEl.createEl('h2', {text: '发现外部图片'});
						
						contentEl.createEl('p', {
							text: `在笔记中发现 ${this.externalUrls.length} 张外部图片。是否要下载到本地？`
						});

						// 创建图片列表
						const listEl = contentEl.createEl('div', {
							cls: 'external-images-list'
						});

						this.externalUrls.forEach(url => {
							const itemEl = listEl.createEl('div', {
								cls: 'external-image-item',
								text: url
							});
							itemEl.style.wordBreak = 'break-all';
							itemEl.style.marginBottom = '8px';
							itemEl.style.fontSize = '0.9em';
							itemEl.style.color = '#666';
						});

						// 添加按钮容器
						const buttonContainer = contentEl.createEl('div', {
							cls: 'button-container'
						});
						buttonContainer.style.marginTop = '20px';
						buttonContainer.style.display = 'flex';
						buttonContainer.style.justifyContent = 'flex-end';
						buttonContainer.style.gap = '10px';

						// 添加取消按钮
						const cancelButton = buttonContainer.createEl('button', {
							text: '取消'
						});
						cancelButton.addEventListener('click', () => {
							this.close();
						});

						// 添加下载按钮
						const downloadButton = buttonContainer.createEl('button', {
							cls: 'mod-cta',
							text: '下载图片'
						});
						downloadButton.addEventListener('click', async () => {
							downloadButton.disabled = true;
							downloadButton.setText('正在下载...');
							
							// 下载所有图片
							for (const url of this.externalUrls) {
								const [localPath, error] = await this.plugin.downloadImage(url, file);
								if (localPath) {
									this.downloadedImages.set(url, localPath);
								}
							}

							// 显示下载结果和替换选项
							this.showReplaceOptions();
						});
					}

					showReplaceOptions() {
						const {contentEl} = this;
						contentEl.empty();

						contentEl.createEl('h2', {text: '下载完成'});
						
						const successCount = this.downloadedImages.size;
						const failCount = this.externalUrls.length - successCount;

						contentEl.createEl('p', {
							text: `成功下载 ${successCount} 张图片${failCount > 0 ? `，${failCount} 张下载失败` : ''}`
						});

						if (successCount > 0) {
							const listEl = contentEl.createEl('div', {
								cls: 'downloaded-images-list'
							});

							this.downloadedImages.forEach((localPath, url) => {
								const itemEl = listEl.createEl('div', {
									cls: 'downloaded-image-item'
								});
								itemEl.style.marginBottom = '8px';
								itemEl.style.fontSize = '0.9em';

								itemEl.createEl('div', {
									text: `原始: ${url}`,
									cls: 'original-url'
								}).style.color = '#666';

								itemEl.createEl('div', {
									text: `本地: ${localPath}`,
									cls: 'local-path'
								}).style.color = '#008000';
							});

							// 添加按钮容器
							const buttonContainer = contentEl.createEl('div', {
								cls: 'button-container'
							});
							buttonContainer.style.marginTop = '20px';
							buttonContainer.style.display = 'flex';
							buttonContainer.style.justifyContent = 'flex-end';
							buttonContainer.style.gap = '10px';

							// 添加关闭按钮
							const closeButton = buttonContainer.createEl('button', {
								text: '仅下载'
							});
							closeButton.addEventListener('click', () => {
								this.close();
							});

							// 添加替换按钮
							const replaceButton = buttonContainer.createEl('button', {
								cls: 'mod-cta',
								text: '替换为本地链接'
							});
							replaceButton.addEventListener('click', async () => {
								await this.replaceLinks();
								this.close();
							});
						} else {
							// 如果没有成功下载的图片，只显示关闭按钮
							const buttonContainer = contentEl.createEl('div', {
								cls: 'button-container'
							});
							buttonContainer.style.marginTop = '20px';
							buttonContainer.style.display = 'flex';
							buttonContainer.style.justifyContent = 'flex-end';

							const closeButton = buttonContainer.createEl('button', {
								text: '关闭'
							});
							closeButton.addEventListener('click', () => {
								this.close();
							});
						}
					}

					async replaceLinks() {
						try {
							let content = await this.plugin.app.vault.read(file);
							let updated = false;

							// 替换 Markdown 格式的图片链接
							for (const [url, localPath] of this.downloadedImages) {
								const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
								const regex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedUrl}\\)`, 'g');
								content = content.replace(regex, (match, alt) => {
									updated = true;
									// 对本地路径做 URL 编码，空格转为 %20
									const encodedPath = encodeURI(localPath);
									return `![${alt}](${encodedPath})`;
								});
							}

							// 替换 HTML 格式的图片链接
							for (const [url, localPath] of this.downloadedImages) {
								const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
								const regex = new RegExp(`<img[^>]+src=["']${escapedUrl}["'][^>]*>`, 'g');
								content = content.replace(regex, (match) => {
									updated = true;
									// 对本地路径做 URL 编码
									const encodedPath = encodeURI(localPath);
									return match.replace(url, encodedPath);
								});
							}

							if (updated) {
								await this.plugin.app.vault.modify(file, content);
								new Notice('已成功替换所有图片链接为本地路径');
							}
						} catch (error) {
							console.error('替换图片链接时出错:', error);
							new Notice(`替换链接失败: ${error.message}`);
						}
					}

					onClose() {
						const {contentEl} = this;
						contentEl.empty();
					}
				}(this.app, Array.from(externalImages), this);

				modal.open();
			} else {
				new Notice("未发现外部图片链接。");
			}
		} catch (error) {
			console.error("检查外部图片时出错:", error);
			new Notice(`检查外部图片失败: ${error.message}`);
		}
	}

	/**
	 * 下载外部图片并替换笔记中的链接
	 * @param urls 外部图片 URL 数组
	 * @param file 当前笔记文件
	 */
	async downloadAndReplaceImages(urls: string[], file: TFile) {
		const downloadResults = new Map<string, string>(); // 存储 URL 到本地路径的映射
		const processingNotice = new Notice("正在下载图片...", 0);

		try {
			// 下载所有图片
			for (const url of urls) {
				const [localPath, error] = await this.downloadImage(url, file);
				if (localPath) {
					downloadResults.set(url, localPath);
				}
			}

			// 更新笔记内容
			let content = await this.app.vault.read(file);
			let updated = false;

			// 替换 Markdown 格式的图片链接
			const markdownLinkRegex = /!\[(.*?)\]\((https?:\/\/[^)]+)\)/g;
			content = content.replace(markdownLinkRegex, (match, alt, url) => {
				const localPath = downloadResults.get(url);
				if (localPath) {
					updated = true;
					// 对本地路径做 URL 编码，空格转为 %20
					const encodedPath = encodeURI(localPath);
					return `![${alt}](${encodedPath})`;
				}
				return match;
			});

			// 替换 HTML 格式的图片链接
			const htmlLinkRegex = /(<img[^>]+src=["'])(https?:\/\/[^"']+)(["'][^>]*>)/g;
			content = content.replace(htmlLinkRegex, (match, prefix, url, suffix) => {
				const localPath = downloadResults.get(url);
				if (localPath) {
					updated = true;
					// 同样对本地路径做 URL 编码
					const encodedPath = encodeURI(localPath);
					return `${prefix}${encodedPath}${suffix}`;
				}
				return match;
			});

			// 保存更新后的内容
			if (updated) {
				await this.app.vault.modify(file, content);
				processingNotice.hide();
				new Notice(`已下载 ${downloadResults.size} 张图片并更新链接。`);
			} else {
				processingNotice.hide();
				new Notice("未能更新任何图片链接。");
			}
		} catch (error) {
			processingNotice.hide();
			console.error("下载和替换图片时出错:", error);
			new Notice(`处理图片失败: ${error.message}`);
		}
	}
} 