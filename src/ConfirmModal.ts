import { App, Modal, Notice, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
    filesToDelete: string[];
    onConfirm: () => Promise<void>;

    constructor(app: App, files: string[], onConfirmCallback: () => Promise<void>) {
        super(app);
        this.filesToDelete = files;
        this.onConfirm = onConfirmCallback;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.empty();

        contentEl.createEl('h2', { text: '确认删除未使用的图片？' });

        contentEl.createEl('p', { text: '以下图片文件在当前笔记中未被引用，将从您的文件系统中删除：' });

        const listEl = contentEl.createEl('ul');
        // 只显示部分文件，避免列表过长
        const maxFilesToShow = 15;
        this.filesToDelete.slice(0, maxFilesToShow).forEach(filePath => {
            // 只显示文件名，路径可能太长
            const fileName = filePath.split('/').pop();
            listEl.createEl('li', { text: fileName });
        });

        if (this.filesToDelete.length > maxFilesToShow) {
            contentEl.createEl('p', { text: `...等共 ${this.filesToDelete.length} 个文件。` });
        }

        contentEl.createEl('p', { text: '此操作不可撤销，请谨慎确认。' }).style.color = 'var(--text-warning)';

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('确认删除')
                .setWarning() // 设置警告样式
                .setCta() // Call to action styling
                .onClick(async () => {
                    btn.setDisabled(true); // 防止重复点击
                    try {
                        await this.onConfirm(); // 执行传入的回调（实际删除操作）
                        this.close(); // 关闭 Modal
                    } catch (error) {
                        // 如果删除过程中出错，也需要提示用户并关闭
                        console.error("删除文件时出错:", error);
                        new Notice(`删除文件时出错: ${error.message}`);
                        btn.setDisabled(false); // 允许用户重试？或者直接关闭
                        this.close();
                    }
                }))
            .addButton(btn => btn
                .setButtonText('取消')
                .onClick(() => {
                    this.close(); // 直接关闭 Modal
                }));
    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
} 