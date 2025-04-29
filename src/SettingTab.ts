import { App, Notice, PluginSettingTab, Setting, TextComponent, ToggleComponent, TextAreaComponent, ButtonComponent } from 'obsidian';
import LocalAssetsManagerPlugin from '../main'; // 使用正确的相对路径导入
import { LocalAssetsManagerSettings, DEFAULT_SETTINGS } from './settings';

export class LocalAssetsManagerSettingTab extends PluginSettingTab {
	plugin: LocalAssetsManagerPlugin;

	constructor(app: App, plugin: LocalAssetsManagerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Local Assets Manager 设置' });

		new Setting(containerEl)
			.setName('使用相对路径')
			.setDesc('在笔记中使用相对路径引用图片。')
			.addToggle((toggle: ToggleComponent) => toggle
				.setValue(this.plugin.settings.useRelativePath)
				.onChange(async (value: boolean) => {
					this.plugin.settings.useRelativePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('保留原始 URL')
			.setDesc('在下载的图片下方注释其原始网址。')
			.addToggle((toggle: ToggleComponent) => toggle
				.setValue(this.plugin.settings.keepOriginalUrl)
				.onChange(async (value: boolean) => {
					this.plugin.settings.keepOriginalUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('图片保存路径')
			.setDesc('相对于笔记文件的图片保存路径。使用 {title} 表示笔记标题，例如：assets/{title}')
			.addText((text: TextComponent) => text
				.setPlaceholder('assets/{title}')
				.setValue(this.plugin.settings.imageFolder)
				.onChange(async (value: string) => {
					this.plugin.settings.imageFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('删除笔记时删除资源文件夹')
			.setDesc('当笔记被删除时，自动删除对应的资源文件夹 (如果路径包含 {title})。')
			.addToggle((toggle: ToggleComponent) => toggle
				.setValue(this.plugin.settings.deleteAssetsWithNote)
				.onChange(async (value: boolean) => {
					this.plugin.settings.deleteAssetsWithNote = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('下载超时时间 (毫秒)')
			.setDesc('图片下载的最长等待时间。')
			.addText((text: TextComponent) => text
				.setPlaceholder('30000')
				.setValue(String(this.plugin.settings.downloadTimeout))
				.onChange(async (value: string) => {
					const timeout = Number(value);
					if (!isNaN(timeout) && timeout > 0) {
						this.plugin.settings.downloadTimeout = timeout;
						await this.plugin.saveSettings();
					} else {
						new Notice('无效的超时时间输入。');
					}
				}));

		// --- 修改 Referer Rules 设置交互 --- Start
		const refererContainer = containerEl.createDiv();
		refererContainer.createEl('h3', { text: '自定义 Referer 规则' });
		refererContainer.createEl('p', { 
			text: '为特定域名设置 Referer 请求头以绕过防盗链。请输入有效的 JSON 格式，键为域名模式 (支持 *.example.com)，值为 Referer URL。修改后请点击保存按钮。',
			cls: 'setting-item-description'
		});

		const textAreaContainer = refererContainer.createDiv();
		textAreaContainer.style.marginTop = '12px';
		textAreaContainer.style.marginBottom = '12px';

		const textArea = new TextAreaComponent(textAreaContainer);
		textArea
			.setPlaceholder(`{
  // 域名模式支持通配符 *
  "*.example.com": "https://example.com/",
  "static.example.com": "https://www.example.com/",
  
  // 一个网站可以设置多个规则
  "img.site.com": "https://www.site.com/",
  "assets.site.com": "https://www.site.com/"
}`)
			.setValue(this.plugin.settings.refererRules)
			.onChange(() => {
				saveButton.setDisabled(false);
			});

		// 调整文本区域样式
		textArea.inputEl.style.width = '100%';
		textArea.inputEl.style.minHeight = '200px';
		textArea.inputEl.style.fontFamily = 'monospace';
		textArea.inputEl.style.marginBottom = '8px';

		// 创建按钮容器并设置样式
		const buttonContainer = refererContainer.createDiv();
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-start';

		// 创建保存按钮
		const saveButton = new ButtonComponent(buttonContainer)
			.setButtonText('保存规则')
			.setDisabled(true)
			.onClick(async () => {
				try {
					const value = textArea.getValue();
					JSON.parse(value); // 验证 JSON 格式
					this.plugin.settings.refererRules = value;
					await this.plugin.saveSettings();
					new Notice('Referer 规则已保存');
					saveButton.setDisabled(true);
				} catch (e) {
					console.error('无效的 Referer 规则 JSON 格式:', e);
					new Notice('Referer 规则格式错误，请检查 JSON 语法。', 5000);
				}
			});
		// --- 修改 Referer Rules 设置交互 --- End
	}
} 